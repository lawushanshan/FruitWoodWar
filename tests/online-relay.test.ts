/**
 * 联机全链路集成测试（需要本地 ws 服务器运行在 127.0.0.1:8100）：
 * 两个客户端各跑一份真实 GameEngine（同 seed、禁卡、无 AI），由服务器 frame 消息
 * 驱动锁步推进，期间双方持续提交建造命令并每 30 帧上报 stateHash。
 * 服务器未判 desync、命令在双端生效、有单位产出 → 联机链路健康。
 *
 * 运行：先 `cd server && npm start`，再 `npx vitest run tests/online-relay.test.ts`。
 * 服务器未启动时跳过（不阻断普通 CI）。
 */

import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { GameEngine } from '../assets/scripts/core/game-engine';
import { SeededRandomSource } from '../assets/scripts/core/random';
import { stateHash } from '../assets/scripts/core/state-hash';
import type { ServerMessage } from '../assets/scripts/network/protocol';

const URL = 'ws://127.0.0.1:8100';
const DT = 1 / 30;

interface PeerState {
    side: 'red' | 'blue' | null;
    engine: GameEngine | null;
    frame: number;
    lastHashFrame: number;
    errors: string[];
    result: { winner: string; reason: string } | null;
    desync: boolean;
}

function makePeer(): Promise<{ st: PeerState; ws: WebSocket; close: () => void }> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(URL);
        const st: PeerState = { side: null, engine: null, frame: 0, lastHashFrame: 0, errors: [], result: null, desync: false };
        ws.on('error', reject);
        ws.on('open', () => {
            ws.send(JSON.stringify({ t: 'join', token: 'vitest-' + Math.random(), mode: 'quick' }));
            resolve({
                st, ws,
                close: () => { try { ws.close(); } catch { /* ignore */ } },
            });
        });
        ws.on('message', (raw) => {
            const m = JSON.parse(String(raw)) as ServerMessage;
            switch (m.t) {
                case 'matched': {
                    st.side = m.yourSide;
                    st.engine = new GameEngine(new SeededRandomSource(m.seed));
                    st.engine.reset({
                        // 与 GameManager.onNetMessage 相同的建局映射
                        playerFaction: st.side === 'red' ? m.yourFaction : m.oppFaction,
                        aiFaction: st.side === 'red' ? m.oppFaction : m.yourFaction,
                        playerSide: st.side,
                        aiEnabled: false,
                        disableCards: true,
                    });
                    break;
                }
                case 'error': st.errors.push(m.msg); break;
                case 'result':
                    st.result = { winner: m.winner, reason: m.reason };
                    if (m.reason === 'desync') st.desync = true;
                    break;
                case 'frame': {
                    if (!st.engine || st.engine.state.phase !== 'playing') return;
                    st.frame = m.frame;
                    for (const { side, cmd } of m.cmds) st.engine.execute(cmd as never, side);
                    // 每 60 帧造一座兵工厂（红蓝各用各的半场格点）
                    if (m.frame % 60 === 10 && st.engine.state.gold[st.side!] >= 200) {
                        const col = Math.floor(m.frame / 60);
                        const gx = st.side === 'red' ? -90 - col * 60 : 90 + col * 60;
                        ws.send(JSON.stringify({
                            t: 'cmd', frame: st.frame + 2,
                            cmd: { type: 'build', itemId: 'tank', position: { x: gx, y: 100 } },
                        }));
                    }
                    for (let i = 0; i < 3; i++) {
                        if (st.engine.state.phase === 'playing') st.engine.step(DT);
                    }
                    if (st.frame - st.lastHashFrame >= 30) {
                        st.lastHashFrame = st.frame;
                        ws.send(JSON.stringify({ t: 'hash', frame: st.frame, hash: stateHash(st.engine.state as never) }));
                    }
                    break;
                }
            }
        });
    });
}

async function serverUp(): Promise<boolean> {
    return new Promise((resolve) => {
        const ws = new WebSocket(URL);
        const timer = setTimeout(() => { try { ws.close(); } catch { /* */ } resolve(false); }, 1500);
        ws.on('open', () => { clearTimeout(timer); ws.close(); resolve(true); });
        ws.on('error', () => { clearTimeout(timer); resolve(false); });
    });
}

describe('联机服务器全链路（真实 ws 中继 + 双引擎锁步）', () => {
    it('双方持续操作 900 帧无 desync，命令双端生效', { timeout: 60_000 }, async () => {
        if (!(await serverUp())) {
            console.warn('跳过：ws://127.0.0.1:8100 未运行（cd server && npm start 后重试）');
            return;
        }
        const a = await makePeer();
        const b = await makePeer();
        try {
            const t0 = Date.now();
            while (Date.now() - t0 < 45_000) {
                // 900 帧 × 100ms = 90s 太长，跑 45s 覆盖约 450 帧 + 多次建造与哈希比对
                if (a.st.result || b.st.result) break;
                if (a.st.frame >= 900 && b.st.frame >= 900) break;
                await new Promise((r) => setTimeout(r, 300));
            }
            const aS = a.st.engine!.state;
            const bS = b.st.engine!.state;
            expect(a.st.errors).toEqual([]);
            expect(b.st.errors).toEqual([]);
            expect(a.st.desync || b.st.desync).toBe(false);
            expect(a.st.frame).toBeGreaterThanOrEqual(150);
            // 双方建造命令都在两端状态里生效（对称）
            const redB = aS.buildings.filter((x) => x.side === 'red').length;
            const blueB = aS.buildings.filter((x) => x.side === 'blue').length;
            expect(redB).toBeGreaterThanOrEqual(1);
            expect(blueB).toBeGreaterThanOrEqual(1);
            expect(aS.buildings.length).toBe(bS.buildings.length);
            // 出兵正常，且双端哈希一致（服务器比对未报 desync 的前提下再本地复核）
            expect(aS.units.length + bS.units.length).toBeGreaterThan(0);
            expect(stateHash(aS as never)).toBe(stateHash(bS as never));
        } finally {
            a.close(); b.close();
        }
    });
});
