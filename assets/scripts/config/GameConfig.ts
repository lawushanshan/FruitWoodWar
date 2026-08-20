export type FactionId = 'fruit' | 'wood' | 'animal';
export type UnitRoleId = 'tank' | 'ranged' | 'aoe' | 'rush' | 'siege';
export type FactoryRoleId = Exclude<UnitRoleId, never>;
export type BuildingId = UnitRoleId | 'tower' | 'academy';

export interface FactionConfig {
    readonly id: FactionId;
    readonly name: string;
    readonly passive: string;
    readonly priceMultiplier: number;
    readonly healthMultiplier: number;
    readonly attackMultiplier: number;
    readonly speedMultiplier: number;
    readonly waveIntervalSeconds: number;
    readonly factoryBonusChance: number;
    readonly factoryBonusCount: number;
    readonly firstStrikeMultiplier: number;
    readonly color: string;
}

export interface UnitTypeConfig {
    readonly id: UnitRoleId;
    readonly name: string;
    readonly health: number;
    readonly attack: number;
    readonly attacksPerSecond: number;
    readonly rangePixels: number;
    readonly speedPixelsPerSecond: number;
    readonly bounty: number;
    readonly splashRadiusPixels: number;
    readonly hasFirstStrike: boolean;
    readonly buildingMultiplier: number;
    readonly crystalMultiplier: number;
}

export interface BuildingConfig {
    readonly id: BuildingId;
    readonly name: string;
    readonly icon: string;
    readonly health: number;
    readonly cost: number;
    readonly rangePixels: number;
    readonly attack: number;
    readonly attacksPerSecond: number;
}

export interface DifficultyConfig {
    readonly id: 'easy' | 'normal' | 'hard';
    readonly name: string;
    readonly incomeMultiplier: number;
    readonly buildIntervalSeconds: number;
}

export const GAME_CONFIG = {
    waveIntervalSeconds: 20,
    salaryIntervalSeconds: 15,
    salaryGold: 50,
    startingGold: 200,
    crystalHealth: 4000,
    unitCapPerSide: 60,
    razeBounty: 50,
    unitAggroRangePixels: 260,
    nonSiegeCrystalDamageMultiplier: 0.75,
    suddenDeathStartTimeSeconds: 300,
    suddenDeathHealthFractionPerSecond: 0.01,
} as const;

export const FACTIONS: Record<FactionId, FactionConfig> = {
    fruit: {
        id: 'fruit',
        name: '水果王国',
        passive: '阳光生长：出兵间隔 16 秒',
        priceMultiplier: 0.95,
        healthMultiplier: 0.78,
        attackMultiplier: 0.9,
        speedMultiplier: 1,
        waveIntervalSeconds: 16,
        factoryBonusChance: 0,
        factoryBonusCount: 0,
        firstStrikeMultiplier: 2,
        color: '#ff7043',
    },
    wood: {
        id: 'wood',
        name: '绿木林',
        passive: '生生不息：每厂 50% 概率多出 2 兵',
        priceMultiplier: 1.1,
        healthMultiplier: 1.35,
        attackMultiplier: 1,
        speedMultiplier: 0.8,
        waveIntervalSeconds: 20,
        factoryBonusChance: 0.5,
        factoryBonusCount: 2,
        firstStrikeMultiplier: 2,
        color: '#66bb6a',
    },
    animal: {
        id: 'animal',
        name: '动物庄园',
        passive: '野性力量：攻击 +55%',
        priceMultiplier: 1,
        healthMultiplier: 0.95,
        attackMultiplier: 1.55,
        speedMultiplier: 1.35,
        waveIntervalSeconds: 20,
        factoryBonusChance: 0,
        factoryBonusCount: 0,
        firstStrikeMultiplier: 2.5,
        color: '#ffca28',
    },
};

export const UNIT_TYPES: Record<UnitRoleId, UnitTypeConfig> = {
    tank: {
        id: 'tank', name: '坦克', health: 400, attack: 15, attacksPerSecond: 1,
        rangePixels: 60, speedPixelsPerSecond: 60, bounty: 10,
        splashRadiusPixels: 0, hasFirstStrike: false, buildingMultiplier: 1, crystalMultiplier: 1,
    },
    ranged: {
        id: 'ranged', name: '远程', health: 150, attack: 25, attacksPerSecond: 1,
        rangePixels: 240, speedPixelsPerSecond: 60, bounty: 7,
        splashRadiusPixels: 0, hasFirstStrike: false, buildingMultiplier: 1, crystalMultiplier: 1,
    },
    aoe: {
        id: 'aoe', name: 'AOE', health: 120, attack: 35, attacksPerSecond: 0.8,
        rangePixels: 210, speedPixelsPerSecond: 54, bounty: 8,
        splashRadiusPixels: 90, hasFirstStrike: false, buildingMultiplier: 1, crystalMultiplier: 1,
    },
    rush: {
        id: 'rush', name: '冲刺', health: 200, attack: 30, attacksPerSecond: 1,
        rangePixels: 60, speedPixelsPerSecond: 120, bounty: 8,
        splashRadiusPixels: 0, hasFirstStrike: true, buildingMultiplier: 1, crystalMultiplier: 1,
    },
    siege: {
        id: 'siege', name: '攻城', health: 250, attack: 12, attacksPerSecond: 0.5,
        rangePixels: 390, speedPixelsPerSecond: 30, bounty: 12,
        splashRadiusPixels: 0, hasFirstStrike: false, buildingMultiplier: 15, crystalMultiplier: 1,
    },
};

export const BUILDING_TYPES: Record<BuildingId, BuildingConfig> = {
    tank: {
        id: 'tank', name: '坦克厂', icon: '🛡️', health: 800, cost: 150,
        rangePixels: 0, attack: 0, attacksPerSecond: 0,
    },
    ranged: {
        id: 'ranged', name: '远程厂', icon: '🏹', health: 700, cost: 130,
        rangePixels: 0, attack: 0, attacksPerSecond: 0,
    },
    aoe: {
        id: 'aoe', name: 'AOE厂', icon: '✨', health: 600, cost: 180,
        rangePixels: 0, attack: 0, attacksPerSecond: 0,
    },
    rush: {
        id: 'rush', name: '冲刺厂', icon: '⚡', health: 700, cost: 160,
        rangePixels: 0, attack: 0, attacksPerSecond: 0,
    },
    siege: {
        id: 'siege', name: '攻城厂', icon: '🏰', health: 900, cost: 200,
        rangePixels: 0, attack: 0, attacksPerSecond: 0,
    },
    tower: {
        id: 'tower', name: '防御塔', icon: '🗼', health: 1000, cost: 120,
        rangePixels: 360, attack: 65, attacksPerSecond: 1.2,
    },
    academy: {
        id: 'academy', name: '战争学院', icon: '️', health: 1000, cost: 200,
        rangePixels: 0, attack: 0, attacksPerSecond: 0,
    },
};

export const FACTORY_COSTS: Record<FactionId, Record<FactoryRoleId, number>> = {
    fruit: { tank: 120, ranged: 105, aoe: 145, rush: 130, siege: 160 },
    wood: { tank: 165, ranged: 145, aoe: 200, rush: 175, siege: 220 },
    animal: { tank: 150, ranged: 130, aoe: 180, rush: 160, siege: 200 },
};

export const FACTORY_OUTPUT: Record<FactionId, Record<FactoryRoleId, { min: number; max: number }>> = {
    fruit: { tank: { min: 3, max: 3 }, ranged: { min: 3, max: 3 }, aoe: { min: 2, max: 2 }, rush: { min: 3, max: 3 }, siege: { min: 1, max: 1 } },
    wood: { tank: { min: 3, max: 3 }, ranged: { min: 3, max: 3 }, aoe: { min: 2, max: 2 }, rush: { min: 3, max: 3 }, siege: { min: 1, max: 1 } },
    animal: { tank: { min: 3, max: 3 }, ranged: { min: 3, max: 3 }, aoe: { min: 2, max: 2 }, rush: { min: 3, max: 3 }, siege: { min: 1, max: 1 } },
};

export const DIFFICULTIES: Record<'easy' | 'normal' | 'hard', DifficultyConfig> = {
    easy: { id: 'easy', name: '简单', incomeMultiplier: 0.8, buildIntervalSeconds: 2 },
    normal: { id: 'normal', name: '普通', incomeMultiplier: 1, buildIntervalSeconds: 1 },
    hard: { id: 'hard', name: '困难', incomeMultiplier: 1.15, buildIntervalSeconds: 0.5 },
};

export function isFactoryId(id: BuildingId): id is FactoryRoleId {
    return id in FACTORY_COSTS.fruit;
}

export function getBuildingCost(id: BuildingId, faction: FactionId): number {
    return isFactoryId(id) ? FACTORY_COSTS[faction][id] : BUILDING_TYPES[id].cost;
}

export function getFactoryOutput(
    id: FactoryRoleId,
    faction: FactionId,
    random: () => number = Math.random,
): number {
    const range = FACTORY_OUTPUT[faction][id];
    const output = range.min + Math.floor(random() * (range.max - range.min + 1));
    return output;
}
