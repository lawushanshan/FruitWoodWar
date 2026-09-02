/**
 * 战斗系统测试：克制、攻城、水晶减免、塔保护、首击、溅射、赏金（M2 规则）
 */

import { describe, expect, it } from 'vitest';
import { clearBattlefield, makeEngine, makeUnit, writableState } from './helpers';
import { GAME_CONFIG } from '../assets/scripts/config/game-config';

describe('战斗系统：基础伤害与克制', () => {
    it('无克制关系时造成攻击力全额伤害', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', x: 0, y: 0, atk: 100, range: 55, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', x: 30, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        expect(s.units.find(u => u.id === 'b1')!.hp).toBeCloseTo(400, 5);
    });

    it('克制矩阵 ×1.4：坦克克冲锋、远程克坦克、冲锋克远程/AOE', () => {
        const cases: Array<{ attackerType: 'tank' | 'ranged' | 'rush'; defenderType: 'tank' | 'ranged' | 'aoe' | 'rush'; expected: number }> = [
            { attackerType: 'tank', defenderType: 'rush', expected: 140 },
            { attackerType: 'ranged', defenderType: 'tank', expected: 140 },
            { attackerType: 'rush', defenderType: 'ranged', expected: 140 },
            { attackerType: 'rush', defenderType: 'aoe', expected: 140 },
            { attackerType: 'tank', defenderType: 'ranged', expected: 100 }, // 无克制
        ];
        for (const c of cases) {
            const engine = makeEngine();
            const s = writableState(engine);
            clearBattlefield(s);
            s.units = [
                // 冲锋攻击者关闭首击，单独验证克制倍率（首击另有专测）
                makeUnit({ side: 'red', id: 'r1', type: c.attackerType, x: 0, y: 0, atk: 100, range: 55, speed: 0, firstStrikeDone: true }),
                makeUnit({ side: 'blue', id: 'b1', type: c.defenderType, x: 30, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
            ];
            engine.step(1 / 60);
            expect(s.units.find(u => u.id === 'b1')!.hp).toBeCloseTo(500 - c.expected, 5);
        }
    });
});

describe('战斗系统：攻城与水晶', () => {
    it('攻城对兵工厂伤害 ×15（12 → 180）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [makeUnit({ side: 'red', id: 'r1', type: 'siege', x: 0, y: 0, atk: 12, range: 325, speed: 0 })];
        s.buildings.push({ id: 'fb1', side: 'blue', unitType: null, x: 30, y: 0, hp: 800, maxHp: 800, waveTimer: 99, level: 1 });
        engine.step(1 / 60);
        expect(s.buildings[0].hp).toBeCloseTo(800 - 180, 5);
    });

    it('攻城对防御塔伤害 ×15', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [makeUnit({ side: 'red', id: 'r1', type: 'siege', x: 0, y: 0, atk: 12, range: 325, speed: 0, hp: 9999, maxHp: 9999 })];
        s.towers.push({ id: 't1', side: 'blue', kind: 'base', x: 300, y: 0, hp: 1000, maxHp: 1000, range: 300, atk: 65, atkSpeed: 1.2, atkCd: 99 });
        engine.step(1 / 60);
        expect(s.towers[0].hp).toBeCloseTo(1000 - 180, 5);
    });

    it('非攻城对水晶伤害 ×0.75，攻城对水晶全额 ×15', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        // 非攻城：100 → 75
        s.units = [makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 495, y: 0, atk: 100, range: 55, speed: 0 })];
        engine.step(1 / 60);
        expect(s.crystals.find(c => c.side === 'blue')!.hp).toBeCloseTo(4000 - 75, 5);

        // 攻城：12 × 15 = 180
        const engine2 = makeEngine();
        const s2 = writableState(engine2);
        clearBattlefield(s2);
        s2.units = [makeUnit({ side: 'red', id: 'r1', type: 'siege', x: 495, y: 0, atk: 12, range: 325, speed: 0 })];
        engine2.step(1 / 60);
        expect(s2.crystals.find(c => c.side === 'blue')!.hp).toBeCloseTo(4000 - 180, 5);
    });

    it('基地塔保护：敌方塔未拆完时水晶不可被攻击', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [makeUnit({ side: 'red', id: 'r1', x: 495, y: 0, atk: 100, range: 55, speed: 0 })];
        s.buildings = [];
        // 蓝方 2 座基地塔存活，红方单位应转向攻击塔而非水晶
        engine.step(1 / 60);
        expect(s.crystals.find(c => c.side === 'blue')!.hp).toBe(4000);

        // 拆完全部蓝方塔后水晶可被攻击
        s.towers = s.towers.filter(t => t.side === 'red');
        engine.step(1 / 60);
        expect(s.crystals.find(c => c.side === 'blue')!.hp).toBeCloseTo(4000 - 75, 5);
    });
});

describe('战斗系统：首击与溅射', () => {
    it('冲锋首击 ×2（水果阵营），之后恢复正常伤害', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'rush', x: 0, y: 0, atk: 30, range: 55, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60); // 首击 30×2 = 60
        expect(s.units.find(u => u.id === 'b1')!.hp).toBeCloseTo(440, 5);
        engine.step(1); // 攻击冷却 1 秒后第二击 30
        expect(s.units.find(u => u.id === 'b1')!.hp).toBeCloseTo(410, 5);
    });

    it('动物阵营冲锋首击 ×2.5', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.factions.red = 'animal';
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'rush', x: 0, y: 0, atk: 30, range: 55, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60); // 首击 30×2.5 = 75
        expect(s.units.find(u => u.id === 'b1')!.hp).toBeCloseTo(425, 5);
    });

    it('冲锋首击附带范围冲击：撞击点 90px 内其他敌人受 50% 基础攻击（不吃首击倍率），后续普攻恢复单体', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'rush', x: 0, y: 0, atk: 30, range: 55, speed: 0 }),
            makeUnit({ side: 'blue', id: 'main', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
            makeUnit({ side: 'blue', id: 'near', type: 'ranged', x: 100, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
            makeUnit({ side: 'blue', id: 'far', type: 'ranged', x: 200, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        // 主目标吃首击倍率 30×2 = 60；near 距撞击点 70px（<90）受溅射 30×0.5 = 15；far 距 170px 不受
        expect(s.units.find(u => u.id === 'main')!.hp).toBeCloseTo(440, 5);
        expect(s.units.find(u => u.id === 'near')!.hp).toBeCloseTo(485, 5);
        expect(s.units.find(u => u.id === 'far')!.hp).toBe(500);
        engine.step(1); // 第二击恢复单体：main 再受 30，near 不再掉血
        expect(s.units.find(u => u.id === 'main')!.hp).toBeCloseTo(410, 5);
        expect(s.units.find(u => u.id === 'near')!.hp).toBeCloseTo(485, 5);
    });

    it('AOE 兵种攻击附带溅射：75px 内敌方单位受 50% 伤害，范围外不受', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'aoe', x: 0, y: 0, atk: 100, range: 175, speed: 0 }),
            makeUnit({ side: 'blue', id: 'main', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
            makeUnit({ side: 'blue', id: 'near', type: 'ranged', x: 80, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
            makeUnit({ side: 'blue', id: 'far', type: 'ranged', x: 200, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        expect(s.units.find(u => u.id === 'main')!.hp).toBeCloseTo(400, 5); // 主目标 100
        expect(s.units.find(u => u.id === 'near')!.hp).toBeCloseTo(450, 5); // 溅射 50
        expect(s.units.find(u => u.id === 'far')!.hp).toBe(500); // 范围外
    });
});

describe('战斗系统：赏金与击杀', () => {
    it('击杀敌方单位获得兵种赏金（坦克 10 金）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 0, y: 0, atk: 999, range: 55, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 100, maxHp: 100, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        expect(s.units.length).toBe(1);
        expect(s.stats.kills.red).toBe(1);
        expect(s.gold.red).toBe(200 + 10);
    });

    it('拆掉敌方兵工厂获得 50 金', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.gold.blue = 0; // 冻结蓝方 AI，避免同帧补厂干扰断言
        s.units = [makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 0, y: 0, atk: 999, range: 55, speed: 0 })];
        s.buildings.push({ id: 'fb1', side: 'blue', unitType: null, x: 30, y: 0, hp: 100, maxHp: 100, waveTimer: 99, level: 1 });
        engine.step(1 / 60);
        expect(s.buildings.length).toBe(0);
        expect(s.gold.red).toBe(200 + 50);
    });

    it('同帧多个攻击者击杀同一目标只结算一次赏金与击杀数', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 0, y: 0, atk: 100, range: 55, speed: 0 }),
            makeUnit({ side: 'red', id: 'r2', type: 'tank', x: 10, y: 0, atk: 100, range: 55, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 1, maxHp: 100, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        expect(s.stats.kills.red).toBe(1);
        expect(s.gold.red).toBe(200 + 10);
    });

    it('防御塔击杀单位同样发放赏金', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 100, y: 0, hp: 20, maxHp: 20 })];
        s.towers.push({ id: 't1', side: 'red', kind: 'base', x: 0, y: 0, hp: 1000, maxHp: 1000, range: 300, atk: 65, atkSpeed: 1.2, atkCd: 0 });
        engine.step(1 / 60);
        expect(s.units.length).toBe(0);
        expect(s.stats.kills.red).toBe(1);
        expect(s.gold.red).toBe(200 + 10);
        expect(s.towers[0].atkCd).toBeCloseTo(1 / 1.2, 5);
    });
});

describe('战斗系统：控制与位移', () => {
    it('超出射程时按速度（像素/秒）向目标移动', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', x: 0, y: 0, atk: 100, range: 55, speed: 50 }),
            makeUnit({ side: 'blue', id: 'b1', x: 200, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        expect(s.units.find(u => u.id === 'r1')!.x).toBeCloseTo(50 / 60, 5);
        expect(s.units.find(u => u.id === 'b1')!.hp).toBe(500);
    });

    it('护盾优先吸收伤害', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 0, y: 0, atk: 100, range: 55, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, shield: 60, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        const blue = s.units.find(u => u.id === 'b1')!;
        expect(blue.shield).toBe(0);
        expect(blue.hp).toBeCloseTo(460, 5);
    });

    it('定身单位不移动不攻击', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', x: 0, y: 0, atk: 100, range: 55, speed: 50, stunDur: 3 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        expect(s.units.find(u => u.id === 'r1')!.x).toBe(0);
        expect(s.units.find(u => u.id === 'b1')!.hp).toBe(500);
        expect(s.units.find(u => u.id === 'r1')!.stunDur).toBeCloseTo(3 - 1 / 60, 5);
    });

    it('击杀回血（lifeOnKill）生效', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.buffs.red.lifeOnKill = 0.2;
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 0, y: 0, atk: 999, range: 55, speed: 0, hp: 100, maxHp: 1000 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 100, maxHp: 100, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        expect(s.units[0].hp).toBeCloseTo(100 + 1000 * 0.2, 5);
    });
});

describe('战斗系统：同族分离推挤', () => {
    it('同阵营重叠单位在数秒内被推开至最小间距', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', x: 100, y: 100, speed: 0, range: 0 }),
            makeUnit({ side: 'red', id: 'r2', x: 100, y: 100, speed: 0, range: 0 }),
        ];
        for (let i = 0; i < 120; i++) engine.step(1 / 60);
        const a = s.units.find(u => u.id === 'r1')!;
        const b = s.units.find(u => u.id === 'r2')!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        expect(d).toBeGreaterThanOrEqual(GAME_CONFIG.unitSeparateDist - 1e-6);
    });

    it('敌我单位保持交战贴合，不被分离逻辑推开', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ side: 'red', id: 'r1', x: 100, y: 100, atk: 0, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', x: 100, y: 100, atk: 0, hp: 9999, maxHp: 9999, speed: 0 }),
        ];
        for (let i = 0; i < 60; i++) engine.step(1 / 60);
        const a = s.units.find(u => u.id === 'r1')!;
        const b = s.units.find(u => u.id === 'b1')!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(5);
    });
});

describe('战斗系统：水晶本体阻挡', () => {
    it('近战单位不再叠在敌方主城堡上，贴边停靠并持续造成伤害', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        const crystal = s.crystals.find(c => c.side === 'blue')!;
        crystal.hp = 9999;
        crystal.maxHp = 9999;
        // 初始把单位放在水晶正中心（复现"走到城堡上面"的场景）
        s.units = [
            makeUnit({ side: 'red', id: 'r1', x: crystal.x, y: crystal.y, atk: 10, range: 50, speed: 60 }),
        ];
        for (let i = 0; i < 180; i++) engine.step(1 / 60);
        const a = s.units.find(u => u.id === 'r1')!;
        const minDist = GAME_CONFIG.crystalBodyRadius + GAME_CONFIG.unitBodyRadius;
        expect(Math.hypot(a.x - crystal.x, a.y - crystal.y)).toBeGreaterThanOrEqual(minDist - 1e-6);
        expect(crystal.hp).toBeLessThan(9999);
    });

    it('己方单位同样不能停留在己方水晶身体内', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        const crystal = s.crystals.find(c => c.side === 'red')!;
        s.units = [
            makeUnit({ side: 'red', id: 'r1', x: crystal.x, y: crystal.y, atk: 0, speed: 60 }),
        ];
        for (let i = 0; i < 60; i++) engine.step(1 / 60);
        const a = s.units.find(u => u.id === 'r1')!;
        const minDist = GAME_CONFIG.crystalBodyRadius + GAME_CONFIG.unitBodyRadius;
        expect(Math.hypot(a.x - crystal.x, a.y - crystal.y)).toBeGreaterThanOrEqual(minDist - 1e-6);
    });
});
