/**
 * server 稳定性测试（匹配索引释放 / 房间双断线结算 / 掉线清理）
 *
 * 背景修复（2026-09-01）：
 *  - gateway 此前无 ws 'error' 监听器，客户端异常断网会抛未捕获异常导致进程崩溃
 *  - MatchMaker.inRoom 此前永不清理，对局结束后玩家残留 → 内存泄漏 + 重新匹配误报
 *  - RoomManager 双方都断线时 leftSince 被重置，房间多挂 15 秒且胜负判定可能出错
 *
 * 本测试直接驱动 server 的 MatchMaker / RoomManager（纯逻辑层，无需真实 ws）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchMaker } from '../server/src/match';
import { RoomManager } from '../server/src/room';

type Faction = 'fruit' | 'wood' | 'animal';

describe('MatchMaker 匹配索引释放', () => {
    it('对局结束后 release 玩家可重新匹配，未释放时被拒绝', () => {
        const created: Array<{ a: string; b: string }> = [];
        const mm = new MatchMaker((a, b) => { created.push({ a, b }); });

        // 首次配对成功
        expect(mm.join('a', 'quick', null)).toBeNull();
        expect(mm.join('b', 'quick', null)).toBeNull();
        expect(created).toHaveLength(1);

        // 对局中重复匹配被拒
        expect(mm.join('a', 'quick', null)).toBe('你已在对局中');

        // 房间结束：释放双方
        mm.release('a');
        mm.release('b');

        // 可重新排队并再次配对
        expect(mm.join('a', 'quick', null)).toBeNull();
        expect(mm.join('b', 'quick', null)).toBeNull();
        expect(created).toHaveLength(2);
    });

    it('leaveQueue 只清队列不清 inRoom（对局中掉线由 release/房间钩子处理）', () => {
        const created: Array<{ a: string; b: string }> = [];
        const mm = new MatchMaker((a, b) => { created.push({ a, b }); });

        mm.join('a', 'quick', null);
        mm.join('b', 'quick', null);
        expect(created).toHaveLength(1);

        // 模拟旧实现行为：只 leaveQueue 不 release → 依然视为在对局中
        mm.leaveQueue('a');
        expect(mm.join('a', 'quick', null)).toBe('你已在对局中');

        // release 后恢复
        mm.release('a');
        expect(mm.join('a', 'quick', null)).toBeNull();
    });
});

describe('RoomManager 房间稳定性', () => {
    let sent: Array<{ to: string; msg: any }>;
    let conns: Map<string, { roomId: string | null }>;
    let emptyCalls: Array<{ roomId: string; red: string | null; blue: string | null }>;
    let rooms: RoomManager;

    beforeEach(() => {
        vi.useFakeTimers();
        sent = [];
        conns = new Map([
            ['a', { roomId: null }],
            ['b', { roomId: null }],
        ]);
        emptyCalls = [];
        rooms = new RoomManager({
            send: (to, msg) => { sent.push({ to, msg }); },
            getConn: (id) => conns.get(id) ?? null,
            onRoomEmpty: (roomId, red, blue) => { emptyCalls.push({ roomId, red, blue }); },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /** 创建房间并返回真实 roomId（模块级 nextRoomId 跨测试递增，不能硬编码） */
    function createRoom(): string {
        rooms.createRoom('a', 'b', 123456,
            { red: 'a', blue: 'b' },
            { red: 'fruit' as Faction, blue: 'wood' as Faction });
        const matched = sent.find(s => s.to === 'a' && s.msg.t === 'matched');
        return matched!.msg.roomId as string;
    }

    it('双方都断线时立即结算，不等 15 秒宽限', () => {
        const roomId = createRoom();
        // 倒计时 3s 后进入对局
        vi.advanceTimersByTime(3100);

        // 红方先断线 → 通知蓝方
        rooms.onLeave(roomId, 'a');
        expect(sent.some(s => s.to === 'b' && s.msg.t === 'opp_left')).toBe(true);

        // 蓝方随后也断线 → 应立即 finish（按先走者判负：红先走 → 蓝胜）
        sent.length = 0;
        rooms.onLeave(roomId, 'b');

        expect(sent.some(s => s.msg.t === 'result' && s.msg.winner === 'blue')).toBe(true);
        expect(emptyCalls).toEqual([{ roomId, red: 'a', blue: 'b' }]);
    });

    it('单方断线仍走 15 秒宽限后判负', () => {
        const roomId = createRoom();
        vi.advanceTimersByTime(3100);

        rooms.onLeave(roomId, 'a');
        // 宽限未到：不应结算
        vi.advanceTimersByTime(10_000);
        expect(emptyCalls).toHaveLength(0);

        // 宽限到点（15s）：红先走 → 蓝胜
        vi.advanceTimersByTime(6_000);
        expect(sent.some(s => s.msg.t === 'result' && s.msg.winner === 'blue')).toBe(true);
        expect(emptyCalls).toEqual([{ roomId, red: 'a', blue: 'b' }]);
    });

    it('房间销毁后 rejoinToken 失效，重连被拒', () => {
        const roomId = createRoom();
        vi.advanceTimersByTime(3100);

        // 拿到红方 token：matched 消息里下发
        const matched = sent.find(s => s.to === 'a' && s.msg.t === 'matched');
        expect(matched).toBeTruthy();
        const token: string = matched!.msg.rejoinToken;

        // 红方断线后凭 token 重连成功
        rooms.onLeave(roomId, 'a');
        expect(rooms.onRejoin('a', token)).toBe(true);

        // 红已重连，蓝方再走 → 只剩红方一人，走 15 秒宽限后判红胜
        rooms.onLeave(roomId, 'b');
        vi.advanceTimersByTime(16_000);
        expect(sent.some(s => s.msg.t === 'result' && s.msg.winner === 'red')).toBe(true);

        // 房间已销毁：token 失效
        expect(rooms.onRejoin('a', token)).toBe(false);
    });

    it('对局结束后清理连接的 roomId', () => {
        const roomId = createRoom();
        vi.advanceTimersByTime(3100);
        expect(conns.get('a')!.roomId).toBe(roomId);

        rooms.onLeave(roomId, 'a');
        rooms.onLeave(roomId, 'b');

        expect(conns.get('a')!.roomId).toBeNull();
        expect(conns.get('b')!.roomId).toBeNull();
    });

    it('倒计时阶段断线立即结算', () => {
        const roomId = createRoom();
        // 不推进倒计时，直接断线（phase=countdown ≠ playing → 走 finish 分支）
        rooms.onLeave(roomId, 'a');
        expect(sent.some(s => s.msg.t === 'result' && s.msg.winner === 'blue')).toBe(true);
        expect(emptyCalls).toEqual([{ roomId, red: 'a', blue: 'b' }]);
    });
});
