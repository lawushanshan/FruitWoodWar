import { describe, expect, it } from 'vitest';

import {
    ACADEMY_LEVELS,
    ARMY_RESEARCH,
    AURA_TOWER,
    BASE_TOWER,
    BUILDING_TYPES,
    CARD_RARITY_WEIGHTS,
    COMEBACK,
    ELITE_BOUNTY_MULTIPLIERS,
    FACTORY_UPGRADES,
    getFactoryPrice,
} from '../assets/scripts/config/GameConfig';

describe('M2 systems configuration', () => {
    it('factory upgrades follow the documented costs and multipliers', () => {
        expect(FACTORY_UPGRADES[2]).toEqual({
            cost: 150, statMultiplier: 1.5, healthMultiplier: 1.5, requiresAcademyLevel: 0,
        });
        expect(FACTORY_UPGRADES[3]).toEqual({
            cost: 300, statMultiplier: 2.2, healthMultiplier: 2.2, requiresAcademyLevel: 1,
        });
    });

    it('elite bounty multipliers use the v0.3 narrowed values', () => {
        expect(ELITE_BOUNTY_MULTIPLIERS[1]).toBe(1);
        expect(ELITE_BOUNTY_MULTIPLIERS[2]).toBe(1.5);
        expect(ELITE_BOUNTY_MULTIPLIERS[3]).toBe(2);
    });

    it('academy levels unlock Lv3 factories and research at Lv2', () => {
        expect(ACADEMY_LEVELS[1].cost).toBe(200);
        expect(ACADEMY_LEVELS[2].cost).toBe(400);
        expect(ACADEMY_LEVELS[2].attackBonus).toBeCloseTo(0.1);
        expect(ARMY_RESEARCH.baseCost).toBe(400);
        expect(ARMY_RESEARCH.costGrowth).toBeCloseTo(1.15);
        expect(ARMY_RESEARCH.attackBonusPerLayer).toBeCloseTo(0.08);
    });

    it('aura tower is limited to one per side with +15% attack speed', () => {
        expect(AURA_TOWER.cost).toBe(250);
        // v0.4.3：光环塔血量 800→1600，新增弱化版范围攻击（详见 02-数值设计表 §5）
        expect(AURA_TOWER.health).toBe(1600);
        expect(AURA_TOWER.attackSpeedBonus).toBeCloseTo(0.15);
        expect(AURA_TOWER.limitPerSide).toBe(1);
        expect(BUILDING_TYPES.auraTower).toBeDefined();
        expect('tower' in BUILDING_TYPES).toBe(false); // 防御塔不可建造
    });

    it('base towers match the fixed defense tower stats', () => {
        // v0.4：防御塔血量 1000→1500；攻击 65→80 并带 40% 溅射（详见 02-数值设计表 §5）
        expect(BASE_TOWER.health).toBe(1500);
        expect(BASE_TOWER.attack).toBe(80);
        expect(BASE_TOWER.attacksPerSecond).toBeCloseTo(1.2);
        expect(BASE_TOWER.rangePixels).toBe(360);
    });

    it('comeback triggers after 3 pushed waves with +50% salary', () => {
        expect(COMEBACK.triggerWaves).toBe(3);
        expect(COMEBACK.salaryMultiplier).toBeCloseTo(1.5);
    });

    it('card rarity weights favor rare over epic over legendary', () => {
        expect(CARD_RARITY_WEIGHTS.rare).toBeGreaterThan(CARD_RARITY_WEIGHTS.epic);
        expect(CARD_RARITY_WEIGHTS.epic).toBeGreaterThan(CARD_RARITY_WEIGHTS.legendary);
        expect(Object.values(CARD_RARITY_WEIGHTS).reduce((s, w) => s + w, 0)).toBe(100);
    });

    it('factory prices increase by 25% per owned same-type factory', () => {
        // 水果坦克厂基准 120：第 1 座 120，第 2 座 150，第 3 座 180
        expect(getFactoryPrice('tank', 'fruit', 0)).toBe(120);
        expect(getFactoryPrice('tank', 'fruit', 1)).toBe(150);
        expect(getFactoryPrice('tank', 'fruit', 2)).toBe(180);
        // 动物攻城厂基准 200：第 2 座 250
        expect(getFactoryPrice('siege', 'animal', 1)).toBe(250);
    });
});
