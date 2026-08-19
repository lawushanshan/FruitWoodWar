/**
 * 经济系统测试：工资发放与 AI 开销（M2 规则）
 */

import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../assets/scripts/config/game-config';
import { buildingCost, cheapestFactoryId } from '../assets/scripts/config/building-config';
import { makeEngine, runSeconds, writableState } from './helpers';

describe('经济系统：工资', () => {
    it('开局双方各 200 金，水晶 4000 血，双方各 2 座基地塔，无开局工厂', () => {
        const engine = makeEngine();
        expect(engine.state.gold.red).toBe(GAME_CONFIG.startGold);
        expect(engine.state.gold.blue).toBe(GAME_CONFIG.startGold);
        expect(engine.state.crystals.every(c => c.maxHp === 4000)).toBe(true);
        expect(engine.state.towers.filter(t => t.side === 'red').length).toBe(2);
        expect(engine.state.towers.filter(t => t.side === 'blue').length).toBe(2);
        expect(engine.state.buildings.length).toBe(0);
    });

    it('15 秒：红方发工资 +50；蓝方 AI 延迟 1 波未建造（普通难度）', () => {
        const engine = makeEngine(); // 红方 fruit，蓝方 AI wood
        runSeconds(engine, 15);
        expect(engine.state.gold.red).toBe(250);
        // 蓝方：普通 AI 延迟 1 波（20s 才到第 1 波），15s 时只领工资不造厂
        expect(engine.state.gold.blue).toBe(250);
        expect(engine.state.buildings.filter(b => b.side === 'blue').length).toBe(0);
    });

    it('30 秒：蓝方在第 1 波后按阵营价造厂（远程厂 130×1.1=143）', () => {
        const engine = makeEngine();
        const aiCost = buildingCost(cheapestFactoryId('wood'), 'wood');
        expect(aiCost).toBe(143);
        runSeconds(engine, 30);
        expect(engine.state.gold.red).toBe(300);
        // 蓝方：200 + 50(15s) - 143(20s 造厂) + 50(30s) = 157
        expect(engine.state.gold.blue).toBe(157);
        expect(engine.state.buildings.filter(b => b.side === 'blue').length).toBe(1);
    });

    it('困难 AI 收入 ×1.15：15 秒工资 57 金（浮点 57.5 截断为 57）', () => {
        const engine = makeEngine();
        writableState(engine).difficulty = 'hard';
        runSeconds(engine, 15);
        // 困难 AI 延迟 0 波：t=0 即造远程厂 143 → 57；15s 工资 50×1.15≈57.5 → 57
        expect(engine.state.gold.blue).toBe(200 - 143 + 57);
    });

    it('简单 AI 收入 ×0.8：15 秒工资 40 金', () => {
        const engine = makeEngine();
        writableState(engine).difficulty = 'easy';
        runSeconds(engine, 15);
        expect(engine.state.gold.blue).toBe(200 + 40);
    });

    it('非 playing 阶段不推进经济', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.phase = 'card-pause';
        const goldBefore = s.gold.red;
        runSeconds(engine, 30);
        expect(s.gold.red).toBe(goldBefore);
    });
});
