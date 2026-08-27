/**
 * 战斗表现事件（FxEvent）测试
 *
 * 验证 combat-system 结算出供表现层消费的事件：
 * - 单位命中 → hit
 * - AOE 单位溅射 → aoe（带半径）
 * - 防御塔范围攻击 → tower（带半径）
 * 事件经 GameEngine.drainFx() 读取并清空，不写入 GameState（确定性序列化不受影响）。
 */

import { describe, expect, it } from 'vitest';
import { makeEngine, writableState, makeUnit, clearBattlefield } from './helpers';
import { UNIT_CONFIG } from '../assets/scripts/config/unit-config';

describe('战斗表现事件', () => {
    it('单位命中敌方单位产生 hit 事件', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ id: 'r1', side: 'red', type: 'tank', x: 0, y: 0, atk: 20, range: 55, atkSpeed: 10, hp: 9999, maxHp: 9999 }),
            makeUnit({ id: 'b1', side: 'blue', type: 'tank', x: 40, y: 0, hp: 9999, maxHp: 9999, speed: 0, atk: 0 }),
        ];
        engine.step(1 / 60);

        const fx = engine.drainFx();
        expect(fx.some(e => e.type === 'hit' && e.side === 'blue')).toBe(true);
        expect(engine.drainFx()).toHaveLength(0); // 读取后清空
    });

    it('AOE 单位溅射产生带半径的 aoe 事件', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ id: 'a1', side: 'red', type: 'aoe', x: 0, y: 0, atk: 35, range: 175, atkSpeed: 10, hp: 9999, maxHp: 9999 }),
            makeUnit({ id: 'b1', side: 'blue', type: 'tank', x: 100, y: 0, hp: 9999, maxHp: 9999, speed: 0, atk: 0 }),
        ];
        engine.step(1 / 60);

        const fx = engine.drainFx();
        const aoe = fx.find(e => e.type === 'aoe');
        expect(aoe).toBeDefined();
        expect((aoe as any).radius).toBe(UNIT_CONFIG.aoe.splashRadius);
    });

    it('基地塔范围攻击产生带半径的 tower 事件', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        // 保留一座基地塔并布置一个进入其射程的蓝方单位
        s.towers = [{ id: 't1', side: 'red', kind: 'base', x: 0, y: 0, hp: 1500, maxHp: 1500, range: 360, atk: 80, atkSpeed: 10, atkCd: 0 }];
        s.units = [makeUnit({ id: 'b1', side: 'blue', type: 'tank', x: 50, y: 0, hp: 9999, maxHp: 9999, speed: 0, atk: 0 })];
        engine.step(1 / 60);

        const fx = engine.drainFx();
        const tower = fx.find(e => e.type === 'tower');
        expect(tower).toBeDefined();
        expect((tower as any).radius).toBeGreaterThan(0);
    });

    it('攻击兵工厂/防御塔也产生带兵种类型的 hit 事件（结构命中反馈）', () => {
        // 兵工厂
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 0, y: 0, atk: 20, range: 55, speed: 0, hp: 9999, maxHp: 9999 })];
        s.buildings.push({ id: 'fb1', side: 'blue', unitType: null, x: 30, y: 0, hp: 800, maxHp: 800, waveTimer: 99, level: 1 });
        engine.step(1 / 60);
        const fx = engine.drainFx();
        const hit = fx.find(e => e.type === 'hit');
        expect(hit).toBeDefined();
        expect((hit as any).atkType).toBe('tank');
        expect((hit as any).side).toBe('blue');

        // 防御塔
        const engine2 = makeEngine();
        const s2 = writableState(engine2);
        clearBattlefield(s2);
        s2.units = [makeUnit({ side: 'red', id: 'r1', type: 'siege', x: 0, y: 0, atk: 12, range: 325, speed: 0, hp: 9999, maxHp: 9999 })];
        s2.towers.push({ id: 't1', side: 'blue', kind: 'base', x: 300, y: 0, hp: 1000, maxHp: 1000, range: 300, atk: 65, atkSpeed: 1.2, atkCd: 99 });
        engine2.step(1 / 60);
        const fx2 = engine2.drainFx();
        const hit2 = fx2.find(e => e.type === 'hit');
        expect(hit2).toBeDefined();
        expect((hit2 as any).atkType).toBe('siege');
    });

    it('攻击水晶不产生 hit 事件（水晶走专属 crystalHit 表现）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 495, y: 0, atk: 100, range: 55, speed: 0 })];
        engine.step(1 / 60);
        const fx = engine.drainFx();
        expect(fx.some(e => e.type === 'hit')).toBe(false);
    });

    it('fx 事件不写入 GameState（确定性序列化不受污染）', () => {
        const engine = makeEngine(7);
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [
            makeUnit({ id: 'r1', side: 'red', type: 'tank', x: 0, y: 0, atk: 20, range: 55, atkSpeed: 10, hp: 9999, maxHp: 9999 }),
            makeUnit({ id: 'b1', side: 'blue', type: 'tank', x: 40, y: 0, hp: 9999, maxHp: 9999, speed: 0, atk: 0 }),
        ];
        engine.step(1 / 60);
        expect(JSON.stringify(s)).not.toContain('"fx"');
    });
});
