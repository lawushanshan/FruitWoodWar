import { describe, expect, it } from 'vitest';

import {
    calculateDamage,
    distance,
    getCounterMultiplier,
    getFirstStrikeMultiplier,
    getTargetDamageMultiplier,
    isInRange,
} from '../assets/scripts/core/CombatRules';

describe('combat rules', () => {
    it('uses euclidean distance and inclusive range checks', () => {
        const origin = { x: 0, y: 0 };
        const point = { x: 30, y: 40 };

        expect(distance(origin, point)).toBe(50);
        expect(isInRange(origin, point, 50)).toBe(true);
        expect(isInRange(origin, point, 49.9)).toBe(false);
    });

    it('applies the documented counter matrix', () => {
        expect(getCounterMultiplier('tank', 'rush')).toBe(1.4);
        expect(getCounterMultiplier('ranged', 'tank')).toBe(1.4);
        expect(getCounterMultiplier('rush', 'ranged')).toBe(1.4);
        expect(getCounterMultiplier('rush', 'aoe')).toBe(1.4);
        expect(getCounterMultiplier('aoe', 'tank')).toBe(1);
    });

    it('applies first-strike bonuses only to an unstruck rush unit', () => {
        expect(getFirstStrikeMultiplier('rush', 'fruit', false)).toBe(2);
        expect(getFirstStrikeMultiplier('rush', 'animal', false)).toBe(2.5);
        expect(getFirstStrikeMultiplier('rush', 'animal', true)).toBe(1);
        expect(getFirstStrikeMultiplier('tank', 'animal', false)).toBe(1);
    });

    it('applies target-specific siege and crystal modifiers', () => {
        expect(getTargetDamageMultiplier('siege', 'building')).toBe(15);
        expect(getTargetDamageMultiplier('siege', 'tower')).toBe(15);
        expect(getTargetDamageMultiplier('siege', 'crystal')).toBe(1);
        expect(getTargetDamageMultiplier('tank', 'crystal')).toBe(0.75);
        expect(getTargetDamageMultiplier('tank', 'building')).toBe(1);
    });

    it('calculates damage deterministically with counter and target modifiers', () => {
        expect(calculateDamage({
            attack: 100,
            counterMultiplier: 1.4,
            targetMultiplier: 0.75,
            criticalChance: 0,
            damageReduction: 0.8,
            random: () => 1,
        })).toEqual({ damage: 84, shieldConsumed: 0, critical: false });
    });

    it('consumes shields before damage reduction', () => {
        expect(calculateDamage({
            attack: 100,
            shield: 30,
            damageReduction: 0.5,
            random: () => 1,
        })).toEqual({ damage: 35, shieldConsumed: 30, critical: false });
    });
});
