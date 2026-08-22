/**
 * 建筑配置（M3 已对齐《02-数值设计表》v0.3 §6）
 *
 * - 兵工厂价格 = 基准价 × 阵营倍率 × 同类递增（每多 1 座同类厂 +25%）
 * - 工厂升级：Lv2 150 金（属性 ×1.5）、Lv3 300 金（属性 ×2.2，需学院 Lv1）
 * - 战争学院：Lv1 200 金（解锁 Lv3）、Lv2 再花 400 金（全队攻击 +10%、解锁全军强化）
 * - 光环塔：250 金 / 1600 血，攻速光环（400px 内 +15%）+ 弱化版范围攻击，每方限 1 座
 * - 全军强化：400 金起、每层 ×1.15 递增，全队攻击 +8%/层，无限叠加
 * - 基地防御塔为固定建筑（双方各 2 座，不可建造）
 */

import { GAME_CONFIG } from './game-config';
import { FACTION_CONFIG } from './faction-config';
import type { BuildingConfig, BuildingItemId, BuildingState, FactionId, GameState, Side } from '../core/types';
import type { UnitType } from '../core/types';

/** 玩家可建造项（工厂 5 种 + 学院 + 光环塔） */
export const BUILDING_IDS: BuildingItemId[] = ['tank', 'ranged', 'aoe', 'rush', 'siege', 'academy', 'aura'];

export const BUILDING_CONFIG: Record<BuildingItemId, BuildingConfig> = {
    tank: { id: 'tank', kind: 'factory', name: '坦克厂', hp: 800, cost: 150, icon: '🛡️', unitType: 'tank' },
    ranged: { id: 'ranged', kind: 'factory', name: '远程厂', hp: 700, cost: 130, icon: '🏹', unitType: 'ranged' },
    aoe: { id: 'aoe', kind: 'factory', name: 'AOE厂', hp: 600, cost: 180, icon: '✨', unitType: 'aoe' },
    rush: { id: 'rush', kind: 'factory', name: '冲锋厂', hp: 700, cost: 160, icon: '⚡', unitType: 'rush' },
    siege: { id: 'siege', kind: 'factory', name: '攻城厂', hp: 900, cost: 200, icon: '🪨', unitType: 'siege' },
    academy: { id: 'academy', kind: 'academy', name: '战争学院', hp: 1000, cost: GAME_CONFIG.academyLv1Cost, icon: '🎓' },
    aura: { id: 'aura', kind: 'aura', name: '光环塔', hp: 1600, cost: 250, icon: '💠' },
};

/**
 * 基地防御塔（§6.4，双方固定 2 座，不可建造）：
 * 血 1000 / 攻 65 / 攻速 1.2 / 射程 6 格 = 300px。
 * 规则：敌方基地塔未被拆完前，水晶不可被攻击（防一波偷家）。
 */
/**
 * 基地防御塔（§6.4，双方固定 2 座，不可建造）：
 * 血 1500 / 攻 80 / 攻速 1.2 / 射程 180px（v1.6 减半，让敌方兵种能靠前），
 * 范围攻击：主目标全额 + 40% 溅射（半径 80px）。
 * 规则：敌方基地塔未被拆完前，水晶不可被攻击（防一波偷家）。
 */
export const BASE_TOWER_CONFIG = {
    hp: 1500,
    atk: 80,
    atkSpeed: 1.2,
    range: 180,
    /** 溅射伤害比例（主目标的百分比） */
    splashFraction: 0.4,
    /** 溅射半径（px） */
    splashRadius: 80,
} as const;

/**
 * 光环塔（v0.4 远程演进合并）：
 * 血 1600 / 攻 40 / 攻速 0.8 / 射程 280px，弱化版范围攻击（30% 溅射，半径 70px）；
 * 攻速 +15% 光环仅在塔周围 400px 内生效（不再全场）。
 */
export const AURA_TOWER_CONFIG = {
    hp: 1600,
    atk: 40,
    atkSpeed: 0.8,
    range: 280,
    splashFraction: 0.3,
    splashRadius: 70,
    /** 攻速光环生效半径（px） */
    buffRadius: 400,
} as const;

/** 某边现有同类兵工厂数量（用于价格递增） */
function sameFactoryCount(state: GameState, side: Side, itemId: BuildingItemId): number {
    const conf = BUILDING_CONFIG[itemId];
    if (conf.kind !== 'factory' || !conf.unitType) return 0;
    return state.buildings.filter(b => b.side === side && b.unitType === conf.unitType).length;
}

/**
 * 计算建造实际价格：
 * - 工厂 = 基准价 × 阵营倍率 × (1 + 0.25 × 同类现存数量)，四舍五入
 * - 学院 = 按当前等级（Lv0→200，Lv1→400，Lv2 不可再买）
 * - 光环塔 = 固定 250
 */
export function buildingCost(itemId: BuildingItemId, faction: FactionId, existing = 0): number {
    const conf = BUILDING_CONFIG[itemId];
    const base = Math.round(conf.cost * FACTION_CONFIG[faction].priceMult);
    if (conf.kind !== 'factory') return conf.cost;
    return Math.round(base * (1 + GAME_CONFIG.priceEscalateStep * existing));
}

/** 从状态计算建造价格（自动统计同类现存数量） */
export function buildingCostInState(state: GameState, side: Side, itemId: BuildingItemId): number {
    return buildingCost(itemId, state.factions[side], sameFactoryCount(state, side, itemId));
}

/** 工厂升级价格（Lv1→2 / Lv2→3） */
export function upgradeCost(level: 1 | 2 | 3): number | null {
    if (level === 1) return GAME_CONFIG.upgradeLv2Cost;
    if (level === 2) return GAME_CONFIG.upgradeLv3Cost;
    return null; // 已满级
}

/** 工厂等级对应的出兵属性倍率 */
export function factoryStatMult(level: 1 | 2 | 3): number {
    if (level === 2) return GAME_CONFIG.lv2StatMult;
    if (level === 3) return GAME_CONFIG.lv3StatMult;
    return 1;
}

/** 精英兵击杀赏金倍率 */
export function eliteBountyMult(level: 1 | 2 | 3): number {
    if (level === 2) return GAME_CONFIG.eliteBountyMult['2'];
    if (level === 3) return GAME_CONFIG.eliteBountyMult['3'];
    return 1;
}

/** 全军强化当前层的价格（400 × 1.15^层数） */
export function researchCost(layers: number): number {
    return Math.round(GAME_CONFIG.researchBaseCost * Math.pow(GAME_CONFIG.researchCostGrowth, layers));
}

/** 找某阵营当前最便宜的兵工厂（供 AI 决策与测试使用） */
export function cheapestFactoryId(faction: FactionId): UnitType {
    let best: UnitType = 'tank';
    let bestCost = Infinity;
    for (const id of BUILDING_IDS) {
        const conf = BUILDING_CONFIG[id];
        if (conf.kind !== 'factory' || !conf.unitType) continue;
        const cost = buildingCost(id, faction, 0);
        if (cost < bestCost) {
            bestCost = cost;
            best = conf.unitType;
        }
    }
    return best;
}

/** 按工厂等级重算建筑血量（升级时同步抬高当前血量） */
export function applyBuildingLevelHp(building: BuildingState, conf: BuildingConfig): void {
    const mult = factoryStatMult(building.level);
    building.maxHp = Math.round(conf.hp * mult);
    building.hp = Math.min(building.maxHp, building.hp + Math.round(conf.hp * (mult - 1)));
}
