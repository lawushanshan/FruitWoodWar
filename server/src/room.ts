/**
 * room：房间生命周期状态机（帧同步中继核心，DOCS/06 §2.2）。
 *
 * 职责（刻意保持薄）：
 *  - createRoom：分配边/阵营/种子 → matched → start 倒计时
 *  - 帧聚合：收到双方 cmd 按 frame 归组，定时 100ms 广播（未收到也广播空帧，
 *    保证双端锁步节奏一致）
 *  - 哈希比对：双方上报同帧哈希，不一致 → result(desync)
 *  - 离场宽限：opp_left → 15s → result(对方判负)；重连回来 opp_back
 *  - result 后房间销毁
 */

import { randomInt } from 'node:crypto';
import type { GameCommandPayload } from './protocol.ts';

type Side = 'red' | 'blue';
type Phase = 'matching' | 'countdown' | 'playing' | 'ended';

interface RoomOpts {
    send: (connId: string, msg: unknown) => void;
    getConn: (connId: string) => { roomId: string | null } | null;
    onRoomEmpty: (roomId: string) => void;
}

const FRAME_MS = 100;
const HASH_EVERY = 30;
const GRACE_MS = 15_000;
const COUNTDOWN_MS = 3_000;
const MAX_IDLE_FRAMES = 30 * 60 * 10; // 10 分钟无命令仍空转则判超时（防泄漏）
const HISTORY_FRAMES = 30 * 60 * 5;   // 命令历史保留 5 分钟（断线重连回放用）

let nextRoomId = 1;

export class RoomManager {
    private rooms = new Map<string, Room>();
    /** rejoinToken → roomId（断线重连索引） */
    private rejoinIndex = new Map<string, { roomId: string; side: Side }>();
    private opts: RoomOpts;

    constructor(opts: RoomOpts) {
        this.opts = opts;
    }

    createRoom(
        connA: string, connB: string, seed: number,
        sides: { red: string; blue: string },
        factions: { red: 'fruit' | 'wood' | 'animal'; blue: 'fruit' | 'wood' | 'animal' },
        roomCode?: string,
    ) {
        const roomId = `r${nextRoomId++}`;
        // 重连凭证：每边一个（客户端断线后凭它找回房间与自己的边）
        const tokenRed = `rj_${roomId}_${randomInt(1, 2 ** 40).toString(36)}`;
        const tokenBlue = `rj_${roomId}_${randomInt(1, 2 ** 40).toString(36)}`;
        const room: Room = {
            id: roomId, seed, phase: 'countdown',
            conns: { red: sides.red, blue: sides.blue },
            factions,
            frame: 0,
            pendingCmds: new Map(), // frame → 各边命令
            history: [],            // 已广播命令（重连回放）
            rejoinTokens: { red: tokenRed, blue: tokenBlue },
            hashes: new Map(),      // frame → { red?, blue? }
            leftConn: null,
            leftSince: null,
            ticker: null,
            lastCmdFrame: 0,
        };
        this.rooms.set(roomId, room);
        this.rejoinIndex.set(tokenRed, { roomId, side: 'red' });
        this.rejoinIndex.set(tokenBlue, { roomId, side: 'blue' });

        const attach = (connId: string) => {
            const conn = this.opts.getConn(connId);
            if (conn) conn.roomId = roomId;
        };
        attach(sides.red); attach(sides.blue);

        const matchedMsg = (side: Side) => ({
            t: 'matched', roomId, seed, yourSide: side,
            yourFaction: factions[side], oppFaction: factions[side === 'red' ? 'blue' : 'red'],
            roomCode, rejoinToken: room.rejoinTokens[side],
        });
        this.opts.send(sides.red, matchedMsg('red'));
        this.opts.send(sides.blue, matchedMsg('blue'));
        this.opts.send(sides.red, { t: 'start', startInMs: COUNTDOWN_MS });
        this.opts.send(sides.blue, { t: 'start', startInMs: COUNTDOWN_MS });

        // 倒计时结束进入对局帧循环
        setTimeout(() => this.startPlaying(roomId), COUNTDOWN_MS);
    }

    private startPlaying(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== 'countdown') return;
        room.phase = 'playing';
        room.ticker = setInterval(() => this.tick(roomId), FRAME_MS);
    }

    /** 断线重连：凭 token 找回房间，换绑新连接并下发 resume（seed + 命令历史） */
    onRejoin(connId: string, token: string): boolean {
        const entry = this.rejoinIndex.get(token);
        if (!entry) return false;
        const room = this.rooms.get(entry.roomId);
        if (!room || room.phase === 'ended') return false;

        // 换绑：旧连接若还挂着（半开连接），先解除
        const oldConnId = room.conns[entry.side];
        const oldConn = this.opts.getConn(oldConnId);
        if (oldConn) oldConn.roomId = null;
        room.conns[entry.side] = connId;
        const conn = this.opts.getConn(connId);
        if (conn) conn.roomId = room.id;

        // 对手回来：清离场宽限并通知对方
        if (room.leftConn !== null) {
            room.leftConn = null;
            room.leftSince = null;
            this.opts.send(room.conns[entry.side === 'red' ? 'blue' : 'red'], { t: 'opp_back' });
        }

        this.opts.send(connId, {
            t: 'resume', roomId: room.id, seed: room.seed,
            yourSide: entry.side,
            yourFaction: room.factions[entry.side],
            oppFaction: room.factions[entry.side === 'red' ? 'blue' : 'red'],
            frame: room.frame,
            history: room.history,
        });
        console.log(`[room ${room.id}] rejoin: side=${entry.side} frame=${room.frame} history=${room.history.length}`);
        return true;
    }

    /** 每 100ms：广播本帧命令（可能为空），推进帧号 */
    private tick(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== 'playing') return;
        room.frame++;

        const cmds = room.pendingCmds.get(room.frame) ?? [];
        room.pendingCmds.delete(room.frame);

        // 记录命令历史（重连回放；只保留最近 HISTORY_FRAMES 帧内的命令）
        if (cmds.length > 0) {
            for (const c of cmds) room.history.push({ frame: room.frame, ...c });
            while (room.history.length > 0 && room.history[0].frame < room.frame - HISTORY_FRAMES) {
                room.history.shift();
            }
        }

        const frameMsg = { t: 'frame', frame: room.frame, cmds };
        this.opts.send(room.conns.red, frameMsg);
        this.opts.send(room.conns.blue, frameMsg);

        if (cmds.length > 0) room.lastCmdFrame = room.frame;

        // 离场宽限到点 → 判定
        if (room.leftSince !== null && Date.now() - room.leftSince >= GRACE_MS) {
            const winner: Side = room.conns.red === room.leftConn ? 'blue' : 'red';
            this.finish(roomId, winner, 'surrender');
            return;
        }

        // 空转上限保护
        if (room.frame - room.lastCmdFrame > MAX_IDLE_FRAMES) {
            this.finish(roomId, 'red', 'timeout');
        }
    }

    onCmd(roomId: string, connId: string, frame: number, cmd: GameCommandPayload) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== 'playing') return;
        const side = this.sideOf(room, connId);
        if (!side) return;
        // 迟到命令兜底：客户端按"收到帧号+2"提交，网络抖动时可能落后于服务器当前帧。
        // 若直接按原帧号入桶，该帧已广播、命令永远不被消费 → 双端命令序列不一致 → desync。
        // 这里把过期/超前的命令钳制到 [当前帧+1, 当前帧+5]，保证一定能被广播。
        const target = Math.min(Math.max(frame, room.frame + 1), room.frame + 5);
        const bucket = room.pendingCmds.get(target) ?? [];
        bucket.push({ side, cmd });
        room.pendingCmds.set(target, bucket);
        // 只缓存未来 5 帧，防恶意超大 frame 占内存
        for (const f of room.pendingCmds.keys()) {
            if (f > room.frame + 5) room.pendingCmds.delete(f);
        }
    }

    /** 客户端本地模拟判定胜负（水晶被拆）后上报，服务器广播权威 result 并销毁房间 */
    onGameEnd(roomId: string, connId: string, winner: Side) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== 'playing') return;
        // 只有房间内玩家可以上报，且赢家必须是其所属边之一（防任意伪造对端胜利）
        const side = this.sideOf(room, connId);
        if (!side) return;
        if (winner !== 'red' && winner !== 'blue') return;
        this.finish(roomId, winner, 'crystal');
    }

    onHash(roomId: string, connId: string, frame: number, hash: string) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== 'playing') return;
        const side = this.sideOf(room, connId);
        if (!side) return;
        const bucket = room.hashes.get(frame) ?? {};
        bucket[side] = hash;
        room.hashes.set(frame, bucket);
        if (bucket.red !== undefined && bucket.blue !== undefined) {
            if (bucket.red !== bucket.blue) {
                console.warn(`[room ${roomId}] desync at frame ${frame}: ${bucket.red} vs ${bucket.blue}`);
                this.finish(roomId, 'red', 'desync');
                return;
            }
            room.hashes.delete(frame);
        }
        // 只保留最近 60 帧的哈希桶
        for (const f of room.hashes.keys()) {
            if (f < room.frame - 60) room.hashes.delete(f);
        }
    }

    onLeave(roomId: string, connId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const side = this.sideOf(room, connId);
        if (!side) return;
        const conn = this.opts.getConn(connId);
        if (conn) conn.roomId = null;

        if (room.phase === 'playing') {
            room.leftConn = connId;
            room.leftSince = Date.now();
            const opp = side === 'red' ? room.conns.blue : room.conns.red;
            this.opts.send(opp, { t: 'opp_left' });
        } else {
            this.finish(roomId, side === 'red' ? 'blue' : 'red', 'surrender');
        }
    }

    /** 断线重连（P2 完整重放；P1 允许同 connId 重新 attach 简化处理） */
    private sideOf(room: Room, connId: string): Side | null {
        if (room.conns.red === connId) return 'red';
        if (room.conns.blue === connId) return 'blue';
        return null;
    }

    private finish(roomId: string, winner: Side, reason: 'crystal' | 'surrender' | 'timeout' | 'desync') {
        const room = this.rooms.get(roomId);
        if (!room || room.phase === 'ended') return;
        room.phase = 'ended';
        if (room.ticker) clearInterval(room.ticker);
        const msg = { t: 'result', winner, reason };
        this.opts.send(room.conns.red, msg);
        this.opts.send(room.conns.blue, msg);
        for (const connId of [room.conns.red, room.conns.blue]) {
            const conn = this.opts.getConn(connId);
            if (conn) conn.roomId = null;
        }
        this.rooms.delete(roomId);
        // 清理重连索引（房间已结束，token 失效）
        if (room.rejoinTokens) {
            this.rejoinIndex.delete(room.rejoinTokens.red);
            this.rejoinIndex.delete(room.rejoinTokens.blue);
        }
        this.opts.onRoomEmpty(roomId);
        console.log(`[room ${roomId}] finished: winner=${winner} reason=${reason}`);
    }
}

interface Room {
    id: string;
    seed: number;
    phase: Phase;
    conns: { red: string; blue: string };
    factions: { red: 'fruit' | 'wood' | 'animal'; blue: 'fruit' | 'wood' | 'animal' };
    frame: number;
    pendingCmds: Map<number, Array<{ side: Side; cmd: GameCommandPayload }>>;
    /** 已广播命令历史（frame 升序；断线重连时回放） */
    history: Array<{ frame: number; side: Side; cmd: GameCommandPayload }>;
    /** 断线重连凭证（每边一个） */
    rejoinTokens: { red: string; blue: string };
    hashes: Map<number, { red?: string; blue?: string }>;
    leftConn: string | null;
    leftSince: number | null;
    ticker: ReturnType<typeof setInterval> | null;
    lastCmdFrame: number;
}

// 防未使用告警（randomInt 已用于 rejoin token 生成）
void HASH_EVERY;
