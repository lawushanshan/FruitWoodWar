/**
 * match：匹配队列（P1 内存版；P2 迁 Redis 跨进程）。
 * - quick：先到先配对，随机分配阵营/种子
 * - friend：房间码加入，房主等待
 */

import { randomInt } from 'node:crypto';
import type { FactionId } from './protocol.ts';

const FACTIONS: FactionId[] = ['fruit', 'wood', 'animal'];

interface Waiting {
    connId: string;
    mode: 'quick' | 'friend';
    roomCode: string | null;
}

export class MatchMaker {
    private queue: Waiting[] = [];
    /** 房间码 → 已等待的连接（好友房） */
    private friendRooms = new Map<string, Waiting[]>();
    /** connId → 所在房间（防止重复入队） */
    private inRoom = new Set<string>();
    private createRoom: (a: string, b: string, seed: number, sides: { red: string; blue: string }, factions: { red: FactionId; blue: FactionId }, roomCode?: string) => void;

    constructor(createRoom: (a: string, b: string, seed: number, sides: { red: string; blue: string }, factions: { red: FactionId; blue: FactionId }, roomCode?: string) => void) {
        this.createRoom = createRoom;
    }

    join(connId: string, mode: 'quick' | 'friend', roomCode: string | null) {
        if (this.inRoom.has(connId)) return;

        if (mode === 'friend' && roomCode) {
            const list = this.friendRooms.get(roomCode) ?? [];
            if (list.some(w => w.connId === connId)) return;
            list.push({ connId, mode, roomCode });
            this.friendRooms.set(roomCode, list);
            if (list.length >= 2) {
                this.friendRooms.delete(roomCode);
                const [a, b] = list;
                this.inRoom.add(a.connId); this.inRoom.add(b.connId);
                this.pairUp(a.connId, b.connId, roomCode);
            }
            return;
        }

        // quick：排队并尝试配对
        if (this.queue.some(w => w.connId === connId)) return;
        this.queue.push({ connId, mode: 'quick', roomCode: null });
        while (this.queue.length >= 2) {
            const a = this.queue.shift()!;
            const b = this.queue.shift()!;
            this.inRoom.add(a.connId); this.inRoom.add(b.connId);
            this.pairUp(a.connId, b.connId);
        }
    }

    private pairUp(a: string, b: string, roomCode?: string) {
        // 随机分配边与阵营，随机种子由服务器下发（双端共用）
        const redIsA = randomInt(2) === 0;
        const red = FACTIONS[randomInt(3)];
        let blue = FACTIONS[randomInt(3)];
        while (blue === red) blue = FACTIONS[randomInt(3)];
        const seed = randomInt(1, 2 ** 31);
        this.createRoom(a, b, seed,
            redIsA ? { red: a, blue: b } : { red: b, blue: a },
            { red, blue },
            roomCode);
    }

    leaveQueue(connId: string) {
        this.queue = this.queue.filter(w => w.connId !== connId);
        for (const [code, list] of this.friendRooms) {
            const left = list.filter(w => w.connId !== connId);
            if (left.length === 0) this.friendRooms.delete(code);
            else this.friendRooms.set(code, left);
        }
    }

    onRoomClosed(roomId: string) {
        // 房间结束：允许玩家重新排队（connId 由 gateway 关联，此处仅占位钩子）
        void roomId;
    }
}
