/**
 * 配置一致性测试：v1.1.0 唯一数值来源（config/*）与冻结基线逐项对齐。
 *
 * 替代旧的 GameConfig.test / M2Systems.test（随旧 config/GameConfig.ts 一并移除），
 * 断言值以《05-版本记录》v1.0.0 冻结值 + 远程塔演进合并（v1.1.0）为准。
 */

import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../assets/scripts/config/game-config';
import { FACTION_CONFIG } from '../assets/scripts/config/faction-config';
import { UNIT_CONFIG } from '../assets/scripts/config/unit-config';
import { BUILDING_CONFIG, BASE_TOWER_CONFIG, AURA_TOWER_CONFIG, BUILDING_IDS, buildingCost } from '../assets/scripts/config/building-config';
import { BUILD_GRID } from '../assets/scripts/config/build-grid';
import type { FactionId } from '../assets/scripts/core/types';

describe('全局参数（game-config）', () => {
    it('保持文档冻结的全局节奏值', () => {
        expect(GAME_CONFIG.crystalHp).toBe(4000);
        expect(GAME_CONFIG.unitCap).toBe(40);
        expect(GAME_CONFIG.aggroRangePx).toBe(260);
        expect(GAME_CONFIG.crystalDamageReduce).toBe(0.75);
        expect(GAME_CONFIG.suddenDeathTime).toBe(300);
        expect(GAME_CONFIG.waveInterval).toBe(20);
        expect(GAME_CONFIG.salaryInterval).toBe(15);
        expect(GAME_CONFIG.salary).toBe(50);
        expect(GAME_CONFIG.startGold).toBe(200);
    });

    it('升级/科研/学院费用与文档一致', () => {
        expect(GAME_CONFIG.upgradeLv2Cost).toBe(150);
        expect(GAME_CONFIG.upgradeLv3Cost).toBe(300);
        expect(GAME_CONFIG.lv2StatMult).toBe(1.5);
        expect(GAME_CONFIG.lv3StatMult).toBe(2.2);
        expect(GAME_CONFIG.academyLv1Cost).toBe(200);
        expect(GAME_CONFIG.academyLv2Cost).toBe(400);
        expect(GAME_CONFIG.researchBaseCost).toBe(400);
        expect(GAME_CONFIG.researchCostGrowth).toBeCloseTo(1.15, 5);
        expect(GAME_CONFIG.researchAtkBonus).toBeCloseTo(0.08, 5);
        expect(GAME_CONFIG.eliteBountyMult['2']).toBe(1.5);
        expect(GAME_CONFIG.eliteBountyMult['3']).toBe(2);
    });
});

describe('阵营参数（faction-config，v1.0.0 冻结值）', () => {
    it('水果王国：16s 出兵 / 调参后 hp 0.85 atk 0.95', () => {
        const f = FACTION_CONFIG.fruit;
        expect(f.waveInterval).toBe(16);
        expect(f.hpMult).toBeCloseTo(0.85, 5);
        expect(f.atkMult).toBeCloseTo(0.95, 5);
        expect(f.priceMult).toBeCloseTo(0.95, 5);
        expect(f.firstStrikeMult).toBe(2);
    });

    it('绿木林：调参后 hp 1.25 / 加兵概率 0.40 ×2', () => {
        const f = FACTION_CONFIG.wood;
        expect(f.waveInterval).toBe(20);
        expect(f.hpMult).toBeCloseTo(1.25, 5);
        expect(f.extraCountChance).toBeCloseTo(0.4, 5);
        expect(f.extraCount).toBe(2);
        expect(f.speedMult).toBeCloseTo(0.8, 5);
    });

    it('动物庄园：攻击 1.55 / 速度 1.35 / 首击 2.5', () => {
        const f = FACTION_CONFIG.animal;
        expect(f.atkMult).toBeCloseTo(1.55, 5);
        expect(f.speedMult).toBeCloseTo(1.35, 5);
        expect(f.firstStrikeMult).toBe(2.5);
    });

    it('所有工厂价格在阵营倍率与递增下均为正数', () => {
        const factions = Object.keys(FACTION_CONFIG) as FactionId[];
        for (const fac of factions) {
            for (const id of BUILDING_IDS) {
                if (BUILDING_CONFIG[id].kind !== 'factory') continue;
                expect(buildingCost(id, fac, 0)).toBeGreaterThan(0);
            }
        }
    });
});

describe('兵种基准（unit-config）', () => {
    it('五个兵种字段齐全且为正', () => {
        for (const id of Object.keys(UNIT_CONFIG) as Array<keyof typeof UNIT_CONFIG>) {
            const u = UNIT_CONFIG[id];
            expect(u.hp).toBeGreaterThan(0);
            expect(u.atk).toBeGreaterThan(0);
            expect(u.speed).toBeGreaterThan(0);
            expect(u.bounty).toBeGreaterThan(0);
        }
    });
});

describe('塔与网格（v1.1.0 合并远程演进）', () => {
    it('基地塔：1500 血 / 攻 80 / 射程 270 / 40% 溅射', () => {
        expect(BASE_TOWER_CONFIG.hp).toBe(1500);
        expect(BASE_TOWER_CONFIG.atk).toBe(80);
        expect(BASE_TOWER_CONFIG.atkSpeed).toBeCloseTo(1.2, 5);
        expect(BASE_TOWER_CONFIG.range).toBe(270);
        expect(BASE_TOWER_CONFIG.splashFraction).toBeCloseTo(0.4, 5);
        expect(BASE_TOWER_CONFIG.splashRadius).toBe(80);
    });

    it('光环塔：1600 血 / 攻 40 / 射程 280 / 30% 溅射 / 光环 400px', () => {
        expect(AURA_TOWER_CONFIG.hp).toBe(1600);
        expect(AURA_TOWER_CONFIG.atk).toBe(40);
        expect(AURA_TOWER_CONFIG.atkSpeed).toBeCloseTo(0.8, 5);
        expect(AURA_TOWER_CONFIG.range).toBe(280);
        expect(AURA_TOWER_CONFIG.splashFraction).toBeCloseTo(0.3, 5);
        expect(AURA_TOWER_CONFIG.splashRadius).toBe(70);
        expect(AURA_TOWER_CONFIG.buffRadius).toBe(400);
    });

    it('建造网格：9 列 × 8 行 = 72 格，行范围 ±100~±250 不越出视野', () => {
        expect(BUILD_GRID.columns).toBe(9);
        expect(BUILD_GRID.topRows).toEqual([100, 150, 200, 250]);
        expect(BUILD_GRID.bottomRows).toEqual([-100, -150, -200, -250]);
        expect(BUILD_GRID.cells()).toHaveLength(72);
        expect(BUILD_GRID.mirrorCells()).toHaveLength(72);
        // 镜像格点 x 取反
        expect(BUILD_GRID.mirrorCells()[0].x).toBe(-BUILD_GRID.cells()[0].x);
    });
});
