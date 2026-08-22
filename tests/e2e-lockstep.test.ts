/**
 * 联机锁步一致性测试（P1 客户端逻辑验证，DOCS/06）
 *
 * 模拟"服务器按帧定序转发命令"的锁步循环，用两份真实 GameEngine
 * （同 seed、aiEnabled=false、disableCards=true、分属 red/blue）验证：
 *  - 同命令序列下双端逐帧 stateHash 完全一致（无 desync）
 *  - 双方各自提交的建造命令在对方侧同样生效（对称）
 *
 * 注：ws 传输层（gateway/room 帧中继 + 哈希比对 + 离场宽限）已由
 * server 冒烟脚本单独验证；本测试聚焦"客户端 core 在锁步驱动下的确定性"。
 */

import { describe, expect, it } from 'vitest';
import { GameEngine } from '../assets/scripts/core/game-engine';
import { SeededRandomSource } from '../assets/scripts/core/random';
import { stateHash } from '../assets/scripts/core/state-hash';
import { BUILD_GRID } from '../assets/scripts/config/build-grid';
import type { FactionId, GameCommand, Side } from '../assets/scripts/core/types';

const DT = 1 / 30;
const FRAME_MS = 100;
const LOGIC_STEPS = Math.round(FRAME_MS / (DT * 1000)); // 3

interface Peer {
    engine: GameEngine;
    side: Side;
    frame: number;
    hashes: Map<number, string>;
    nextBuild: number;
}

function makePeer(seed: number, side: Side, faction: FactionId, oppFaction: FactionId): Peer {
    const engine = new GameEngine(new SeededRandomSource(seed));
    engine.reset({
        playerFaction: side === 'red' ? faction : oppFaction,
        aiFaction: side === 'red' ? oppFaction : faction,
        playerSide: side,
        aiEnabled: false,
        disableCards: true,
    });
    return { engine, side, frame: 0, hashes: new Map(), nextBuild: 10 };
}

function peerCmd(peer: Peer): GameCommand | null {
    if (peer.frame !== peer.nextBuild) return null;
    peer.nextBuild += 50;
    const idx = (peer.frame / 50) % (BUILD_GRID.columns * 4);
    const col = idx % BUILD_GRID.columns;
    const row = Math.floor(idx / BUILD_GRID.columns) % 4;
    const gx = peer.side === 'red'
        ? BUILD_GRID.gridOriginX + col * BUILD_GRID.cellSize
        : -(BUILD_GRID.gridOriginX + col * BUILD_GRID.cellSize);
    const gy = BUILD_GRID.topRows[row];
    return { type: 'build', itemId: 'tank', position: { x: gx, y: gy } };
}

function advanceFrame(red: Peer, blue: Peer) {
    red.frame++; blue.frame++;
    const rCmd = peerCmd(red);
    const bCmd = peerCmd(blue);
    const cmds: Array<{ side: Side; cmd: GameCommand }> = [];
    if (rCmd) cmds.push({ side: 'red', cmd: rCmd });
    if (bCmd) cmds.push({ side: 'blue', cmd: bCmd });

    for (const { side, cmd } of cmds) {
        red.engine.execute(cmd, side);
        blue.engine.execute(cmd, side);
    }
    for (let i = 0; i < LOGIC_STEPS; i++) {
        if (red.engine.state.phase === 'playing') red.engine.step(DT);
        if (blue.engine.state.phase === 'playing') blue.engine.step(DT);
    }
}

describe('联机锁步一致性', () => {
    it('双端同命令序列 300 帧 stateHash 完全一致（无 desync）', () => {
        const seed = 20260821;
        const red = makePeer(seed, 'red', 'fruit', 'wood');
        const blue = makePeer(seed, 'blue', 'wood', 'fruit');

        let compared = 0;
        for (let f = 1; f <= 300; f++) {
            advanceFrame(red, blue);
            if (f % 30 === 0) {
                expect(stateHash(red.engine.state as never)).toBe(stateHash(blue.engine.state as never));
                compared++;
            }
        }
        expect(compared).toBe(10);
        expect(red.engine.state.units.length + blue.engine.state.units.length).toBeGreaterThan(0);
    });

    it('双方建造命令对称生效（红蓝工厂数一致）', () => {
        const seed = 42;
        const red = makePeer(seed, 'red', 'animal', 'fruit');
        const blue = makePeer(seed, 'blue', 'fruit', 'animal');
        for (let f = 1; f <= 250; f++) advanceFrame(red, blue);

        const redBuildings = red.engine.state.buildings.filter(b => b.side === 'red').length;
        const blueBuildings = blue.engine.state.buildings.filter(b => b.side === 'blue').length;
        // 金币跟不上每 50 帧一座的节奏，但重点是"对称"：红方命令只产生红方厂、
        // 蓝方命令只产生蓝方厂，且双端视角完全一致
        expect(redBuildings).toBeGreaterThanOrEqual(1);
        expect(blueBuildings).toBeGreaterThanOrEqual(1);
        expect(redBuildings).toBe(blueBuildings);
        expect(stateHash(red.engine.state as never)).toBe(stateHash(blue.engine.state as never));
    });
});
