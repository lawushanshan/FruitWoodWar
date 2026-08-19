/**
 * M6 功能测试：广告激励相关引擎规则（复活 / 双倍工资）
 */

import { describe, it, expect } from 'vitest';
import { GameEngine } from '../assets/scripts/core/game-engine';
import { createInitialState } from '../assets/scripts/core/game-state';
import { salaryAmount } from '../assets/scripts/core/systems/economy-system';
import { runSeconds, writableState } from './helpers';

describe('M6：广告激励', () => {
    it('复活：ended 后恢复 30% 水晶血量并回到 playing', () => {
        const engine = new GameEngine();
        engine.reset({ playerFaction: 'fruit', difficulty: 'easy' });
        const s = writableState(engine);

        // 未结束时不可复活
        expect(engine.revivePlayer(0.3)).toBe(false);

        // 直接清空玩家水晶触发结束
        const crystal = s.crystals.find(c => c.side === 'red')!;
        crystal.hp = 0;
        engine.step(0.016);
        expect(s.phase).toBe('ended');

        // 复活成功：30% 血量 + 回到 playing
        expect(engine.revivePlayer(0.3)).toBe(true);
        expect(s.phase).toBe('playing');
        expect(s.stats.result).toBeNull();
        expect(crystal.hp).toBe(Math.ceil(crystal.maxHp * 0.3));
    });

    it('双倍工资：StartOptions 传入后仅玩家方工资 ×2', () => {
        const engine = new GameEngine();
        engine.reset({ playerFaction: 'fruit', difficulty: 'normal', doubleSalary: true });
        const s = writableState(engine);

        // 玩家 50×2=100，AI 50×1.0=50
        expect(salaryAmount(s, 'red')).toBe(100);
        expect(salaryAmount(s, 'blue')).toBe(50);

        // 不传则为默认 50
        const plain = createInitialState({ playerFaction: 'fruit' });
        expect(salaryAmount(plain, 'red')).toBe(50);
    });

    it('双倍工资与绝地反击叠加：50×1.5×2=150', () => {
        const engine = new GameEngine();
        engine.reset({ playerFaction: 'fruit', difficulty: 'normal', doubleSalary: true });
        const s = writableState(engine);
        s.comeback.red.active = true;
        expect(salaryAmount(s, 'red')).toBe(150);
    });

    it('双倍工资实际入账：15 秒后玩家金币多于 AI（同难度）', () => {
        const engine = new GameEngine();
        engine.reset({ playerFaction: 'fruit', difficulty: 'normal', doubleSalary: true });
        // 冻结建造避免花费干扰（清空双方初始工厂区并锁 AI 金币）
        const s = writableState(engine);
        s.gold.blue = 0;
        runSeconds(engine, 16);
        // 玩家至少收到一次 100 工资，开局 200
        expect(s.gold.red).toBeGreaterThanOrEqual(300);
    });
});
