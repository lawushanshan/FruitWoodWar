export type FactionId = 'fruit' | 'wood' | 'animal';
export type UnitRoleId = 'tank' | 'ranged' | 'aoe' | 'rush' | 'siege';
export type FactoryRoleId = Exclude<UnitRoleId, never>;
export type BuildingId = UnitRoleId | 'auraTower' | 'academy';
export type UnitLevel = 1 | 2 | 3;

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

// ==================== M2 系统配置 ====================

/** 同类兵工厂价格递增：每多造 1 座 +25%（第 2 座 +25%、第 3 座 +50%） */
export const FACTORY_PRICE_INCREMENT = 0.25;

/** 兵工厂升级（Lv1→Lv2→Lv3）：出兵属性与建筑血量倍率（相对基准） */
export const FACTORY_UPGRADES: Record<Exclude<UnitLevel, 1>, {
    readonly cost: number;
    readonly statMultiplier: number;
    readonly healthMultiplier: number;
    readonly requiresAcademyLevel: number;
}> = {
    2: { cost: 150, statMultiplier: 1.5, healthMultiplier: 1.5, requiresAcademyLevel: 0 },
    3: { cost: 300, statMultiplier: 2.2, healthMultiplier: 2.2, requiresAcademyLevel: 1 },
};

/** 精英兵击杀赏金加成（Lv2 ×1.5，Lv3 ×2，v0.3 收窄版） */
export const ELITE_BOUNTY_MULTIPLIERS: Record<UnitLevel, number> = { 1: 1, 2: 1.5, 3: 2 };

/** 战争学院：Lv1 解锁 Lv3 兵工厂；Lv2 全队攻击 +10% 并解锁全军强化研究 */
export const ACADEMY_LEVELS = {
    1: { cost: 200, health: 1000 },
    2: { cost: 400, health: 1500, attackBonus: 0.1 },
} as const;

/** 全军强化研究（需学院 Lv2）：400 金起，每层 ×1.15，全队攻击 +8%/层，无限叠加 */
export const ARMY_RESEARCH = {
    baseCost: 400,
    costGrowth: 1.15,
    attackBonusPerLayer: 0.08,
} as const;

/** 光环塔：每方限 1 座，全体己方单位攻速 +15% */
export const AURA_TOWER = {
    cost: 250,
    health: 800,
    attackSpeedBonus: 0.15,
    limitPerSide: 1,
} as const;

/** 基地防御塔（双方固定各 2 座，不可建造）：塔不倒不能打水晶 */
export const BASE_TOWER = {
    health: 1000,
    attack: 65,
    attacksPerSecond: 1.2,
    rangePixels: 360,
} as const;

/** 卡牌稀有度出现权重（稀有高、史诗中、传说低） */
export const CARD_RARITY_WEIGHTS: Record<'rare' | 'epic' | 'legendary', number> = {
    rare: 60,
    epic: 30,
    legendary: 10,
};

/** 绝地反击：连续 N 波兵线被推回己方高地 → 工资 +50%，直到兵线重回中路 */
export const COMEBACK = {
    triggerWaves: 3,
    salaryMultiplier: 1.5,
    frontlineThresholdPixels: 200,
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
    auraTower: {
        id: 'auraTower', name: '光环塔', icon: '🌀', health: 800, cost: 250,
        rangePixels: 0, attack: 0, attacksPerSecond: 0,
    },
    academy: {
        id: 'academy', name: '战争学院', icon: '🎓', health: 1000, cost: 200,
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

export function getFactoryPrice(
    id: FactoryRoleId,
    faction: FactionId,
    ownedSameTypeCount: number,
): number {
    const base = FACTORY_COSTS[faction][id];
    return Math.round(base * (1 + FACTORY_PRICE_INCREMENT * ownedSameTypeCount));
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
