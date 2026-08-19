/**
 * 胜负系统测试：水晶击破、阶段与星级
 */

import { describe, expect, it } from 'vitest';
import { clearBattlefield, makeEngine, makeUnit, writableState } from './helpers';

describe('胜负系统', () => {
    it('击破蓝方水晶 → 红方胜利，水晶满血 3 星', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s); // 清掉工厂，保证单位直攻水晶
        s.units = [makeUnit({ side: 'red', id: 'r1', x: 495, y: 0, atk: 100, range: 55, speed: 0 })];
        s.crystals.find(c => c.side === 'blue')!.hp = 1;
        engine.step(1 / 60);
        expect(s.phase).toBe('ended');
        expect(s.stats.result?.winner).toBe('red');
        expect(s.stats.result?.stars).toBe(3); // 红方水晶满血 ≥50%
    });

    it('击破红方水晶 → 蓝方胜利 1 星', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [makeUnit({ side: 'blue', id: 'b1', x: -495, y: 0, atk: 100, range: 55, speed: 0 })];
        s.crystals.find(c => c.side === 'red')!.hp = 1;
        engine.step(1 / 60);
        expect(s.phase).toBe('ended');
        expect(s.stats.result?.winner).toBe('blue');
        expect(s.stats.result?.stars).toBe(1);
    });

    it('胜利但己方水晶低于 50% 时为 2 星', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [makeUnit({ side: 'red', id: 'r1', x: 495, y: 0, atk: 100, range: 55, speed: 0 })];
        s.crystals.find(c => c.side === 'blue')!.hp = 1;
        s.crystals.find(c => c.side === 'red')!.hp = 100; // 100/5000 < 50%
        engine.step(1 / 60);
        expect(s.stats.result?.stars).toBe(2);
    });

    it('已结算后不再重复判定', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefield(s);
        s.units = [makeUnit({ side: 'red', id: 'r1', x: 495, y: 0, atk: 100, range: 55, speed: 0 })];
        s.crystals.find(c => c.side === 'blue')!.hp = 1;
        engine.step(1 / 60);
        const firstResult = s.stats.result;
        s.crystals.find(c => c.side === 'red')!.hp = 0; // 人为再打破红方
        engine.step(1 / 60);
        expect(s.stats.result).toBe(firstResult); // 结果不变
        expect(s.phase).toBe('ended');
    });
});
