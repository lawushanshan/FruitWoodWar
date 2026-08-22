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

let nextRoomId = 1;

export class RoomManager {
    private rooms = new Map<string, Room>();
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
        const room: Room = {
            id: roomId, seed, phase: 'countdown',
            conns: { red: sides.red, blue: sides.blue },
            factions,
            frame: 0,
            pendingCmds: new Map(), // frame → 各边命令
            hashes: new Map(),      // frame → { red?, blue? }
            leftConn: null,
            leftSince: null,
            ticker: null,
            lastCmdFrame: 0,
        };
        this.rooms.set(roomId, room);

        const attach = (connId: string) => {
            const conn = this.opts.getConn(connId);
            if (conn) conn.roomId = roomId;
        };
        attach(sides.red); attach(sides.blue);

        const matchedMsg = (side: Side) => ({
            t: 'matched', roomId, seed, yourSide: side,
            yourFaction: factions[side], oppFaction: factions[side === 'red' ? 'blue' : 'red'],
            roomCode,
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

    /** 每 100ms：广播本帧命令（可能为空），推进帧号 */
    private tick(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== 'playing') return;
        room.frame++;

        const cmds = room.pendingCmds.get(room.frame) ?? [];
        room.pendingCmds.delete(room.frame);

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
        const bucket = room.pendingCmds.get(frame) ?? [];
        bucket.push({ side, cmd });
        room.pendingCmds.set(frame, bucket);
        // 只缓存未来 5 帧，防恶意超大 frame 占内存
        for (const f of room.pendingCmds.keys()) {
            if (f > room.frame + 5) room.pendingCmds.delete(f);
        }
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
    hashes: Map<number, { red?: string; blue?: string }>;
    leftConn: string | null;
    leftSince: number | null;
    ticker: ReturnType<typeof setInterval> | null;
    lastCmdFrame: number;
}

// 防未使用告警（构造期随机仅用于未来扩展）
void randomInt;
