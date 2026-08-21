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
