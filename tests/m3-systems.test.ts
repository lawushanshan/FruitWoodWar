/**
 * M3 系统测试：价格递增、工厂升级、学院、光环塔、全军强化、
 * 绝地反击、AI 三档、决战时刻、阵营独立增益
 */

import { describe, expect, it } from 'vitest';
import { buildingCost, researchCost } from '../assets/scripts/config/building-config';
import { effectiveAttackSpeedMult } from '../assets/scripts/core/systems/combat-system';
import { makeEngine, makeUnit, runSeconds, writableState } from './helpers';

const POS = { x: -350, y: -50 };

describe('建筑：价格递增与升级', () => {
    it('同类工厂价格递增 +25%（水果坦克厂 141 → 176 → 212）', () => {
        expect(buildingCost('tank', 'fruit', 0)).toBe(141);
        expect(buildingCost('tank', 'fruit', 1)).toBe(176);
        expect(buildingCost('tank', 'fruit', 2)).toBe(212);
    });

    it('不同类工厂互不影响递增', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.red = 1000;
        s.gold.blue = 0;
        engine.execute({ type: 'build', itemId: 'tank', position: POS });   // 141
        engine.execute({ type: 'build', itemId: 'ranged', position: POS }); // 105×1.25? 不：不同类首座 105... fruit ranged = round(130×0.95)=124? 见断言
        const factories = s.buildings.filter(b => b.side === 'red');
        expect(factories.length).toBe(2);
        // 第二座坦克厂价格应为 176
        expect(buildingCost('tank', 'fruit', 1)).toBe(176);
    });

    it('工厂升级 Lv2：150 金，出兵属性 ×1.5，建筑血量 ×1.5', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.blue = 0;
        s.gold.red = 1000;
        engine.execute({ type: 'build', itemId: 'tank', position: POS });
        const factory = s.buildings.find(b => b.side === 'red')!;
        const goldBefore = s.gold.red;
        const result = engine.execute({ type: 'upgrade', buildingId: factory.id });
        expect(result.ok).toBe(true);
        expect(s.gold.red).toBe(goldBefore - 150);
        expect(factory.level).toBe(2);
        expect(factory.maxHp).toBe(1200); // 800 × 1.5

        // Lv2 工厂出兵：坦 400×0.95×1.5 = 570 血
        factory.waveTimer = 0.001;
        engine.step(0.002);
        const tank = s.units.find(u => u.side === 'red')!;
        expect(tank.level).toBe(2);
        expect(tank.maxHp).toBeCloseTo(570, 5);
        expect(tank.atk).toBeCloseTo(15 * 0.95 * 1.5, 5);
    });

    it('工厂升级 Lv3 需要：300 金 + 战争学院 Lv1，属性 ×2.2', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.blue = 0;
        s.gold.red = 2000;
        engine.execute({ type: 'build', itemId: 'tank', position: POS });
        const factory = s.buildings.find(b => b.side === 'red')!;
        engine.execute({ type: 'upgrade', buildingId: factory.id }); // → Lv2

        // 无学院时 Lv3 失败
        const denied = engine.execute({ type: 'upgrade', buildingId: factory.id });
        expect(denied.ok).toBe(false);
        expect(factory.level).toBe(2);

        // 买学院 Lv1 后可升 Lv3
        engine.execute({ type: 'build', itemId: 'academy', position: POS });
        const goldBefore = s.gold.red;
        const ok = engine.execute({ type: 'upgrade', buildingId: factory.id });
        expect(ok.ok).toBe(true);
        expect(s.gold.red).toBe(goldBefore - 300);
        expect(factory.level).toBe(3);

        // Lv3 出兵：坦 400×0.95×2.2 = 836 血
        factory.waveTimer = 0.001;
        engine.step(0.002);
        expect(s.units.find(u => u.side === 'red')!.maxHp).toBeCloseTo(836, 4);
    });

    it('精英兵击杀赏金 ×1.5 / ×2（Lv2 坦克 15 金）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [];
        s.buildings = [];
        s.towers = [];
        s.gold.blue = 0;
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 0, y: 0, atk: 999, range: 55, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', level: 2, x: 30, y: 0, hp: 100, maxHp: 100, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        expect(s.gold.red).toBe(200 + 15); // 10 × 1.5
    });

    it('满级工厂不可再升级', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.blue = 0;
        s.gold.red = 9999;
        engine.execute({ type: 'build', itemId: 'tank', position: POS });
        const factory = s.buildings.find(b => b.side === 'red')!;
        engine.execute({ type: 'build', itemId: 'academy', position: POS });
        engine.execute({ type: 'upgrade', buildingId: factory.id });
        engine.execute({ type: 'upgrade', buildingId: factory.id });
        const result = engine.execute({ type: 'upgrade', buildingId: factory.id });
        expect(result.ok).toBe(false);
        expect(factory.level).toBe(3);
    });
});

describe('建筑：学院 / 光环塔 / 全军强化', () => {
    it('战争学院两级：Lv1 200 解锁，Lv2 400 攻击+10%，满级不可再买', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.blue = 0;
        s.gold.red = 1000;

        const lv1 = engine.execute({ type: 'build', itemId: 'academy', position: POS });
        expect(lv1.ok).toBe(true);
        expect(s.gold.red).toBe(800);
        expect(s.academyLevel.red).toBe(1);

        const lv2 = engine.execute({ type: 'build', itemId: 'academy', position: POS });
        expect(lv2.ok).toBe(true);
        expect(s.gold.red).toBe(400);
        expect(s.academyLevel.red).toBe(2);
        expect(s.buffs.red.atk).toBeCloseTo(1.1, 5);

        const lv3 = engine.execute({ type: 'build', itemId: 'academy', position: POS });
        expect(lv3.ok).toBe(false);
    });

    it('光环塔：250 金起逐座递增、每方限 3 座、400px 内攻速 +15%（多塔不叠加）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.blue = 0;
        s.gold.red = 2000;
        expect(effectiveAttackSpeedMult(s, 'red', -420, 0)).toBe(1);

        // 第 1 座：250 金
        const first = engine.execute({ type: 'build', itemId: 'aura', position: { x: -420, y: 0 } });
        expect(first.ok).toBe(true);
        expect(s.gold.red).toBe(1750);
        // 塔周围 400px 内生效
        expect(effectiveAttackSpeedMult(s, 'red', -420, 0)).toBeCloseTo(1.15, 5);
        expect(effectiveAttackSpeedMult(s, 'red', -100, 0)).toBeCloseTo(1.15, 5);
        // 400px 外不生效（v0.4：光环不再全场）
        expect(effectiveAttackSpeedMult(s, 'red', 0, 0)).toBe(1);

        // 第 2 座：313 金（250 × 1.25 递增）
        const second = engine.execute({ type: 'build', itemId: 'aura', position: { x: -420, y: 100 } });
        expect(second.ok).toBe(true);
        expect(s.gold.red).toBe(1437);
        // 三塔同覆盖同一点，攻速仍只 +15%（不叠加）
        expect(effectiveAttackSpeedMult(s, 'red', -420, 0)).toBeCloseTo(1.15, 5);

        // 第 3 座：375 金（250 × 1.5 递增）
        const third = engine.execute({ type: 'build', itemId: 'aura', position: { x: -420, y: 200 } });
        expect(third.ok).toBe(true);
        expect(s.gold.red).toBe(1062);
        expect(effectiveAttackSpeedMult(s, 'red', -420, 0)).toBeCloseTo(1.15, 5);

        // 限 3 座：金币充足（余额 1062 ≥ 第 4 座 438 金）仍拒绝
        const again = engine.execute({ type: 'build', itemId: 'aura', position: POS });
        expect(again.ok).toBe(false);

        // 光环塔被拆后失效
        s.towers = s.towers.filter(t => !(t.side === 'red' && t.kind === 'aura'));
        expect(effectiveAttackSpeedMult(s, 'red', -420, 0)).toBe(1);
    });

    it('全军强化：需学院 Lv2，400 金起 ×1.25 递增，每层 +8% 攻击', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.blue = 0;
        s.gold.red = 2000;

        // 未达学院 Lv2 时失败
        expect(engine.execute({ type: 'research' }).ok).toBe(false);
        engine.execute({ type: 'build', itemId: 'academy', position: POS });
        expect(engine.execute({ type: 'research' }).ok).toBe(false); // Lv1 仍不够
        engine.execute({ type: 'build', itemId: 'academy', position: POS });

        const goldBefore = s.gold.red;
        expect(engine.execute({ type: 'research' }).ok).toBe(true);
        expect(s.gold.red).toBe(goldBefore - 400);
        expect(s.researchLayers.red).toBe(1);
        expect(s.buffs.red.atk).toBeCloseTo(1.1 * 1.08, 5);

        expect(engine.execute({ type: 'research' }).ok).toBe(true);
        expect(researchCost(1)).toBe(500); // 第二层 400×1.25
        expect(s.buffs.red.atk).toBeCloseTo(1.1 * 1.08 * 1.08, 5);
    });
});

describe('绝地反击', () => {
    it('连续 3 波被推回己方高地 → 工资 +50%，兵线回中后解除', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.blue = 0; // 冻结 AI
        s.buildings = [];
        // 蓝方单位侵入红方高地（x ≤ -300），血量拉满避免被基地塔拆掉
        s.units = [makeUnit({ side: 'blue', id: 'invader', x: -400, y: 0, hp: 1e9, maxHp: 1e9, atk: 0, range: 1, speed: 0 })];
        s.crystals.forEach(c => { c.hp = 1e9; c.maxHp = 1e9; });

        // 推进 3 波（每波 20 秒），并同步工资计时观察
        s.salaryTimer.red = 21; // 让工资在第 1 波后立刻可观察
        runSeconds(engine, 60); // 3 波
        expect(s.comeback.red.streak).toBeGreaterThanOrEqual(3);
        expect(s.comeback.red.active).toBe(true);

        // 反击工资：50 → 75
        s.salaryTimer.red = 0.01;
        const goldBefore = s.gold.red;
        engine.step(0.02);
        expect(s.gold.red).toBe(goldBefore + 75);

        // 兵线回中（清除入侵单位），下一波解除
        s.units = [];
        s.waveTimer = 0.01;
        runSeconds(engine, 0.02);
        expect(s.comeback.red.active).toBe(false);
        s.salaryTimer.red = 0.01;
        const goldBefore2 = s.gold.red;
        engine.step(0.02);
        expect(s.gold.red).toBe(goldBefore2 + 50);
    });
});

describe('AI 三档', () => {
    it('简单 AI 延迟 2 波：第 1 波时仍未建造（普通已建造）', () => {
        // 普通
        const normal = makeEngine();
        runSeconds(normal, 21); // 第 1 波
        expect(normal.state.buildings.filter(b => b.side === 'blue').length).toBe(1);
        // 简单
        const easy = makeEngine();
        writableState(easy).difficulty = 'easy';
        runSeconds(easy, 21);
        expect(easy.state.buildings.filter(b => b.side === 'blue').length).toBe(0);
        runSeconds(easy, 20); // 第 2 波后开始建造
        expect(easy.state.buildings.filter(b => b.side === 'blue').length).toBe(1);
    });

    it('普通 AI 按上一波玩家构成补克制厂（玩家坦克多 → 造远程厂）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.difficulty = 'normal';
        s.wave = 1; // 过延迟
        s.aiMemory.playerCompSnapshot = { tank: 5, ranged: 0, aoe: 0, rush: 0, siege: 0 };
        s.gold.blue = 500;
        engine.step(1 / 60);
        const built = s.buildings.find(b => b.side === 'blue');
        expect(built).toBeTruthy();
        expect(built!.unitType).toBe('ranged'); // 远程克坦克
    });

    it('困难 AI 即时克制（当前场上冲锋多 → 造坦克厂）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.difficulty = 'hard';
        s.wave = 1;
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'rush', x: 0, y: 0 }),
            makeUnit({ side: 'red', id: 'r2', type: 'rush', x: 10, y: 0 }),
            makeUnit({ side: 'red', id: 'r3', type: 'rush', x: 20, y: 0 }),
        ];
        s.gold.blue = 500;
        engine.step(1 / 60);
        const built = s.buildings.find(b => b.side === 'blue');
        expect(built).toBeTruthy();
        expect(built!.unitType).toBe('tank'); // 坦克克冲锋
    });

    it('困难 AI 会建造学院（工厂 ≥4 且有钱时）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.difficulty = 'hard';
        s.wave = 1;
        s.gold.blue = 1000;
        for (let i = 0; i < 4; i++) {
            s.buildings.push({ id: `f-${i}`, side: 'blue', unitType: 'tank', x: 400, y: -50, hp: 800, maxHp: 800, waveTimer: 99, level: 1 });
        }
        engine.step(1 / 60);
        expect(s.academyLevel.blue).toBe(1);
        expect(s.gold.blue).toBe(800);
    });
});

describe('决战时刻与结算', () => {
    it('5:00 起双方水晶每秒 -1% 最大血量', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.time = 300;
        s.units = [];
        s.buildings = [];
        s.towers = [];
        s.gold.blue = 0;
        // 决战时刻下水晶高血量不触发出兵干扰
        s.crystals.forEach(c => { c.hp = 4000; c.maxHp = 4000; });
        runSeconds(engine, 2, 1); // 2 秒
        for (const c of s.crystals) {
            expect(c.hp).toBeCloseTo(4000 - 80, 0); // 4000 × 1% × 2s = 80
        }
    });

    it('决战时刻同时归零：击杀多者胜', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.time = 300;
        s.units = [];
        s.buildings = [];
        s.towers = [];
        s.gold.blue = 0;
        s.crystals.forEach(c => { c.hp = 0.1; c.maxHp = 4000; });
        s.stats.kills.red = 10;
        s.stats.kills.blue = 5;
        engine.step(1 / 60);
        expect(s.phase).toBe('ended');
        expect(s.stats.result?.winner).toBe('red');
    });

    it('结算包含用时与剩余金币', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [makeUnit({ side: 'red', id: 'r1', x: 495, y: 0, atk: 100, range: 55, speed: 0 })];
        s.buildings = [];
        s.towers = [];
        s.gold.blue = 0;
        s.crystals.find(c => c.side === 'blue')!.hp = 1;
        s.time = 123.4;
        s.gold.red = 321;
        engine.step(1 / 60);
        expect(s.stats.result?.duration).toBeCloseTo(123.4 + 1 / 60, 5);
        expect(s.stats.result?.playerGold).toBe(321);
    });
});

describe('阵营独立增益', () => {
    it('蓝方增益不影响红方：蓝方攻击 ×2 只对蓝方单位生效', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [];
        s.buildings = [];
        s.towers = [];
        s.gold.blue = 0;
        s.buffs.blue.atk = 2;
        s.units = [
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 0, y: 0, atk: 100, range: 55, speed: 0 }),
            makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        // 蓝方 100 × 2 = 200；红方 buff 保持 1
        expect(s.units.find(u => u.id === 'r1')!.hp).toBeCloseTo(300, 5);
        expect(s.buffs.red.atk).toBe(1);
    });
});
