/**
 * 出兵系统测试：每波出兵数、绿木概率加兵、人口上限（M2 规则）
 */

import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../assets/scripts/config/game-config';
import { makeEngine, makeUnit, writableState, runSeconds } from './helpers';

/** 在红方加一座指定兵种工厂（出兵倒计时可控） */
function addFactory(engine: ReturnType<typeof makeEngine>, unitType: 'tank' | 'ranged' | 'aoe' | 'rush' | 'siege', waveTimer = 0.01) {
    const s = writableState(engine);
    s.buildings.push({
        id: `f-${unitType}-${s.buildings.length}`, side: 'red', unitType,
        x: -400, y: -50, hp: 800, maxHp: 800, waveTimer, level: 1,
    });
}

describe('出兵系统', () => {
    it('水果坦克厂 15 秒出一波，每波 3 个坦克兵', () => {
        const engine = makeEngine(); // 红方 fruit
        addFactory(engine, 'tank', 16);
        let steps = 0;
        while (engine.state.units.filter(u => u.side === 'red').length === 0 && steps < 60 * 20) {
            engine.step(1 / 60);
            steps++;
        }
        const redUnits = engine.state.units.filter(u => u.side === 'red');
        expect(redUnits.length).toBe(3);
        expect(redUnits.every(u => u.type === 'tank')).toBe(true);
        // 出兵属性套阵营倍率：400 × 0.95 = 380
        expect(redUnits[0].maxHp).toBeCloseTo(380, 5);
        // 出兵后重置为水果间隔 15 秒
        const factory = writableState(engine).buildings.find(b => b.side === 'red')!;
        expect(factory.waveTimer).toBeCloseTo(15, 5);
    });

    it('AOE 厂每波 2 个，攻城厂每波 1 个', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        addFactory(engine, 'aoe');
        addFactory(engine, 'siege');
        s.gold.blue = 0; // 冻结蓝方 AI，避免干扰
        engine.step(0.02);
        const redUnits = s.units.filter(u => u.side === 'red');
        expect(redUnits.filter(u => u.type === 'aoe').length).toBe(2);
        expect(redUnits.filter(u => u.type === 'siege').length).toBe(1);
    });

    it('绿木"生生不息"：每波 3 或 5 个（50% 概率 +2），两种情况都会出现', () => {
        const engine = makeEngine(7); // 红方 fruit；改红方阵营为 wood
        const s = writableState(engine);
        s.factions.red = 'wood';
        s.gold.blue = 0;
        addFactory(engine, 'ranged');
        const factory = s.buildings.find(b => b.side === 'red')!;

        const waveCounts: number[] = [];
        let spawned = 0;
        for (let wave = 0; wave < 60; wave++) {
            const before = s.units.filter(u => u.side === 'red').length;
            factory.waveTimer = 0.001;
            engine.step(0.002);
            const after = s.units.filter(u => u.side === 'red').length;
            waveCounts.push(after - before);
            spawned = after;
            // 清场避免人口上限截断与战斗干扰
            s.units = s.units.filter(u => u.side !== 'red');
        }
        // 每波要么 3 要么 5
        expect(waveCounts.every(c => c === 3 || c === 5)).toBe(true);
        // 60 波内两种情况都出现（全同概率约 2^-59）
        expect(waveCounts.some(c => c === 3)).toBe(true);
        expect(waveCounts.some(c => c === 5)).toBe(true);
        expect(spawned).toBeGreaterThan(0);
    });

    it('人口满上限时工厂暂停出兵', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        for (let i = 0; i < GAME_CONFIG.unitCap; i++) {
            s.units.push(makeUnit({ side: 'red', id: `fill-${i}` }));
        }
        addFactory(engine, 'tank');
        engine.step(0.02);
        const redPop = s.units.filter(u => u.side === 'red').length;
        expect(redPop).toBe(GAME_CONFIG.unitCap);
    });

    it('人口接近上限时最多补到上限', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        for (let i = 0; i < GAME_CONFIG.unitCap - 2; i++) {
            s.units.push(makeUnit({ side: 'red', id: `fill-${i}` }));
        }
        addFactory(engine, 'tank');
        engine.step(0.02);
        expect(s.units.filter(u => u.side === 'red').length).toBe(GAME_CONFIG.unitCap);
    });
});

describe('战争学院不出兵（回归）', () => {
    it('只建学院时不会产生任何单位', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.red = 10000;
        // 建两座学院（Lv2）
        engine.execute({ type: 'build', itemId: 'academy', position: { x: -300, y: 100 } });
        engine.execute({ type: 'build', itemId: 'academy', position: { x: -300, y: -100 } });
        // 清空可能存在的 AI 单位/建筑，只保留玩家学院
        s.units = [];
        s.buildings = s.buildings.filter(b => b.side === 'red' && b.kind === 'academy');
        s.gold.blue = 0;
        s.towers = [];
        const before = s.buildings.length;
        expect(before).toBe(2);

        runSeconds(engine, 30); // 跨过多个出兵间隔
        // 学院不应出兵
        expect(s.units.length).toBe(0);
        expect(s.buildings.length).toBe(before);
    });
});
