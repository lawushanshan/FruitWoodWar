/**
 * 地图布局测试（v1.2.0）：楚河汉界规则
 *
 * - 单位只能在中央道路走廊（|y| ≤ roadHalfHeight）内跨越中线（x 变号）
 * - 河/道路与建造网格互不重叠
 */

import { describe, expect, it } from 'vitest';
import { GameEngine } from '../assets/scripts/core/game-engine';
import { SeededRandomSource } from '../assets/scripts/core/random';
import { MAP_LAYOUT } from '../assets/scripts/config/map-layout';
import { BUILD_GRID } from '../assets/scripts/config/build-grid';
import { createInitialState } from '../assets/scripts/core/game-state';

describe('楚河汉界地图规则', () => {
    it('布局常量：道路居中不占格、河宽不占最内列', () => {
        expect(MAP_LAYOUT.roadCenterY).toBe(0);
        expect(MAP_LAYOUT.riverCenterX).toBe(0);
        // 道路半高 70 < 最内网格行 100，不压格
        expect(MAP_LAYOUT.roadHalfHeight).toBeLessThan(Math.min(...BUILD_GRID.topRows));
        // 河半宽 60 < 最内列 |x|=90，不占格
        expect(MAP_LAYOUT.riverHalfWidth).toBeLessThan(Math.abs(BUILD_GRID.gridOriginX + (BUILD_GRID.columns - 1) * BUILD_GRID.cellSize));
    });

    it('非道路走廊处不得越河：单位先折向桥头再经道路过河', () => {
        // 直接构造无建筑/无单位的初始状态，放一个红方单位在上区（y=250），目标是蓝方水晶
        const engine = new GameEngine(new SeededRandomSource(1));
        engine.reset({ playerFaction: 'fruit', aiFaction: 'wood', disableCards: true });
        const s = engine.state as any;
        // 清空基地塔与敌对单位，避免索敌干扰，直接走"无目标→攻敌方水晶"分支
        s.towers = [];
        s.buildings = [];
        s.units = [{
            id: 'u1', side: 'red', type: 'tank', level: 1,
            x: -300, y: 250, hp: 9999, maxHp: 9999, atk: 0, speed: 50,
            range: 50, atkSpeed: 1, atkCd: 0, firstStrikeDone: true,
            shield: 0, stunDur: 0, slowMult: 1, slowDur: 0, bleedDps: 0, bleedDur: 0,
        }];

        let violated = false;
        let crossed = false;
        for (let i = 0; i < 2000 && !crossed; i++) {
            engine.step(1 / 30);
            const u = s.units[0];
            if (!u) break;
            // 在河区内（|x| < riverHalfWidth）时，必须已在道路走廊内
            if (Math.abs(u.x) < MAP_LAYOUT.riverHalfWidth) {
                if (Math.abs(u.y - MAP_LAYOUT.roadCenterY) > MAP_LAYOUT.roadHalfHeight) {
                    violated = true;
                    break;
                }
            }
            if (u.x > MAP_LAYOUT.riverHalfWidth) crossed = true;
        }

        expect(violated).toBe(false);
        expect(crossed).toBe(true); // 最终能从道路过河
    });

    it('河道规则不破坏常规对局推进（批量冒烟）', () => {
        const engine = new GameEngine(new SeededRandomSource(42));
        engine.reset({ playerFaction: 'animal', aiFaction: 'fruit', difficulty: 'normal', disableCards: true });
        for (let i = 0; i < 30 * 120; i++) engine.step(1 / 30); // 120 秒
        const s = engine.state;
        // 120 秒内应已发生交战/推进，单位不会全部卡死在一侧
        expect(s.units.length + s.buildings.length).toBeGreaterThan(0);
        // 人口/经济未失控
        expect(s.units.length).toBeLessThanOrEqual(120);
    });
});
