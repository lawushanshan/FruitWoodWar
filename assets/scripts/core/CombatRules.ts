import {
    FACTIONS,
    GAME_CONFIG,
    UNIT_TYPES,
    FactionId,
    UnitRoleId,
} from '../config/GameConfig';

export interface PointLike {
    x: number;
    y: number;
}

const COUNTER_MULTIPLIERS: Record<UnitRoleId, Partial<Record<UnitRoleId, number>>> = {
    tank: { rush: 1.4 },
    ranged: { tank: 1.4 },
    aoe: {},
    rush: { ranged: 1.4, aoe: 1.4 },
    siege: {},
};

export function distance(a: PointLike, b: PointLike): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function isInRange(a: PointLike, b: PointLike, range: number): boolean {
    return distance(a, b) <= range;
}

export function getCounterMultiplier(attacker: UnitRoleId, defender: UnitRoleId): number {
    return COUNTER_MULTIPLIERS[attacker][defender] ?? 1;
}

export type TargetKind = 'unit' | 'building' | 'tower' | 'crystal';

export function getFirstStrikeMultiplier(
    role: UnitRoleId,
    faction: FactionId,
    hasStruck: boolean,
): number {
    if (hasStruck || !UNIT_TYPES[role].hasFirstStrike) return 1;
    return FACTIONS[faction].firstStrikeMultiplier;
}

export function getTargetDamageMultiplier(role: UnitRoleId, targetKind: TargetKind): number {
    if (targetKind === 'unit') return 1;
    if (targetKind === 'crystal') {
        return role === 'siege'
            ? UNIT_TYPES.siege.crystalMultiplier
            : GAME_CONFIG.nonSiegeCrystalDamageMultiplier;
    }
    return role === 'siege' ? UNIT_TYPES.siege.buildingMultiplier : 1;
}

export interface DamageInput {
    attack: number;
    attackMultiplier?: number;
    counterMultiplier?: number;
    firstStrikeMultiplier?: number;
    targetMultiplier?: number;
    criticalChance?: number;
    criticalMultiplier?: number;
    damageReduction?: number;
    shield?: number;
    random?: () => number;
}

export interface DamageResult {
    damage: number;
    shieldConsumed: number;
    critical: boolean;
}

export function calculateDamage(input: DamageInput): DamageResult {
    const random = input.random ?? Math.random;
    const critical = random() < (input.criticalChance ?? 0);
    const criticalMultiplier = input.criticalMultiplier ?? 2;
    const multiplier = (input.attackMultiplier ?? 1) *
        (input.counterMultiplier ?? 1) *
        (input.firstStrikeMultiplier ?? 1) *
        (input.targetMultiplier ?? 1) *
        (critical ? criticalMultiplier : 1);

    const rawDamage = input.attack * multiplier;
    const shieldConsumed = Math.min(input.shield ?? 0, rawDamage);
    const damage = Math.max(0, (rawDamage - shieldConsumed) * (input.damageReduction ?? 1));

    return { damage, shieldConsumed, critical };
}
