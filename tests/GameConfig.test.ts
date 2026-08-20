import { describe, expect, it } from 'vitest';

import {
    FACTORY_COSTS,
    FACTORY_OUTPUT,
    FACTIONS,
    GAME_CONFIG,
    UNIT_TYPES,
    getFactoryOutput,
} from '../assets/scripts/config/GameConfig';

describe('v0.3 balance configuration', () => {
    it('keeps the documented global pacing values', () => {
        expect(GAME_CONFIG.crystalHealth).toBe(4000);
        expect(GAME_CONFIG.unitCapPerSide).toBe(60);
        expect(GAME_CONFIG.unitAggroRangePixels).toBe(260);
        expect(GAME_CONFIG.nonSiegeCrystalDamageMultiplier).toBe(0.75);
        expect(GAME_CONFIG.suddenDeathStartTimeSeconds).toBe(300);
    });

    it('aligns faction passives with the v0.3 tuning pass', () => {
        expect(FACTIONS.fruit.waveIntervalSeconds).toBe(16);
        expect(FACTIONS.wood.healthMultiplier).toBeCloseTo(1.35);
        expect(FACTIONS.wood.factoryBonusChance).toBeCloseTo(0.5);
        expect(FACTIONS.wood.factoryBonusCount).toBe(2);
        expect(FACTIONS.animal.attackMultiplier).toBeCloseTo(1.55);
        expect(FACTIONS.animal.firstStrikeMultiplier).toBe(2.5);
    });

    it('defines costs and output for every factory and faction', () => {
        const factions = Object.keys(FACTIONS) as Array<keyof typeof FACTIONS>;
        const factoryRoles = Object.keys(UNIT_TYPES) as Array<keyof typeof UNIT_TYPES>;

        for (const faction of factions) {
            for (const role of factoryRoles) {
                expect(FACTORY_COSTS[faction][role]).toBeGreaterThan(0);
                expect(FACTORY_OUTPUT[faction][role].min).toBeGreaterThan(0);
                expect(FACTORY_OUTPUT[faction][role].max)
                    .toBeGreaterThanOrEqual(FACTORY_OUTPUT[faction][role].min);
            }
        }
    });

    it('uses deterministic factory output before passive rolls', () => {
        expect(getFactoryOutput('tank', 'wood', () => 0)).toBe(3);
        expect(getFactoryOutput('tank', 'wood', () => 0.99)).toBe(3);
    });
});
