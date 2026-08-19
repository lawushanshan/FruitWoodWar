/**
 * AI 系统：蓝方三档决策（M3），全部产出 GameCommand 由引擎执行
 *
 * | 难度 | 收入 | 反应 | 行为 |
 * | 简单 | ×0.8 | 延迟 2 波 | 固定建造表循环，不做针对性 |
 * | 普通 | ×1.0 | 延迟 1 波 | 按上一波玩家兵种构成补克制厂 |
 * | 困难 | ×1.15 | 即时 | 即时克制 + 学院/光环塔/升级/全军强化 |
 *
 * 收入倍率在 economy-system 按 state.difficulty 生效；本文件只管花钱。
 */

import { BUILDING_CONFIG, buildingCostInState, cheapestFactoryId, researchCost, upgradeCost } from '../../config/building-config';
import { GAME_CONFIG } from '../../config/game-config';
import type { BuildingItemId, GameCommand, GameState, UnitType } from '../types';
import type { RandomSource } from '../random';

/** 各难度工厂数量上限 */
const FACTORY_CAP: Record<string, number> = { easy: 6, normal: 8, hard: 8 };

/** 简单 AI 的固定建造表（循环使用） */
const EASY_BUILD_ORDER: UnitType[] = ['tank', 'ranged', 'rush', 'aoe', 'siege'];

/** 兵种克制反查：要克制敌方 T 应造什么厂 */
function counterFactoryAgainst(enemyType: UnitType): UnitType {
    switch (enemyType) {
        case 'tank': return 'ranged';  // 远程克坦克
        case 'rush': return 'tank';    // 坦克克冲锋
        case 'ranged': return 'rush';  // 冲锋克远程
        case 'aoe': return 'rush';     // 冲锋克 AOE
        case 'siege': return 'tank';   // 攻城无直接克制，用坦克兜底
    }
}

/** 统计某边存活单位兵种构成 */
function compositionOf(state: GameState, side: 'red' | 'blue'): Record<UnitType, number> {
    const comp: Record<UnitType, number> = { tank: 0, ranged: 0, aoe: 0, rush: 0, siege: 0 };
    for (const u of state.units) {
        if (u.side === side && u.hp > 0) comp[u.type]++;
    }
    return comp;
}

/** 找构成中数量最多的兵种（全 0 返回 null） */
function dominantType(comp: Record<UnitType, number>): UnitType | null {
    let best: UnitType | null = null;
    let max = 0;
    for (const t of Object.keys(comp) as UnitType[]) {
        if (comp[t] > max) {
            max = comp[t];
            best = t;
        }
    }
    return best;
}

/** 蓝方工厂建造位置（随机） */
function factoryPosition(random: RandomSource) {
    return { x: 350 + random.range(0, 100), y: -50 + random.range(-30, 30) };
}

/** 蓝方 AI 每帧决策：返回 0 或 1 条命令（控制花钱节奏） */
export function aiDecide(state: GameState, random: RandomSource): GameCommand | null {
    if (state.phase !== 'playing') return null;
    const difficulty = state.difficulty;

    // 反应延迟：开局前 N 波不建造
    if (state.wave < GAME_CONFIG.aiDelayWaves[difficulty]) return null;

    const myFactories = state.buildings.filter(b => b.side === 'blue');
    const gold = state.gold.blue;

    // ---- 困难：基建优先级（学院 → 光环塔 → 升级 → 全军强化） ----
    if (difficulty === 'hard') {
        const academyLevel = state.academyLevel.blue;
        if (academyLevel === 0 && myFactories.length >= 4 && gold >= GAME_CONFIG.academyLv1Cost) {
            return { type: 'build', itemId: 'academy', position: factoryPosition(random) };
        }
        if (academyLevel === 1 && gold >= GAME_CONFIG.academyLv2Cost + 100) {
            return { type: 'build', itemId: 'academy', position: factoryPosition(random) };
        }
        const hasAura = state.towers.some(t => t.side === 'blue' && t.kind === 'aura');
        if (academyLevel >= 1 && !hasAura && gold >= 250 + 100) {
            return { type: 'build', itemId: 'aura', position: { x: 380 + random.range(-20, 20), y: random.range(-60, 60) } };
        }
        if (academyLevel === 2 && gold >= researchCost(state.researchLayers.blue) + 150) {
            return { type: 'research' };
        }
        // 有富余时升级最低等级工厂
        if (myFactories.length >= 5) {
            const upgradable = myFactories
                .filter(b => b.unitType !== null && upgradeCost(b.level) !== null)
                .sort((a, b) => a.level - b.level)[0];
            if (upgradable) {
                const cost = upgradeCost(upgradable.level)!;
                const needAcademy = upgradable.level === 2 && state.academyLevel.blue < 1;
                if (!needAcademy && gold >= cost + 100) {
                    return { type: 'upgrade', buildingId: upgradable.id };
                }
            }
        }
    }

    // ---- 工厂建造（三档共用框架，选厂策略不同） ----
    const cap = FACTORY_CAP[difficulty];
    if (myFactories.length >= cap) return null;

    let buildType: BuildingItemId;
    if (difficulty === 'easy') {
        // 固定建造表：按已建数量循环取类型
        buildType = EASY_BUILD_ORDER[myFactories.length % EASY_BUILD_ORDER.length];
    } else {
        // 克制策略：普通用上一波快照（延迟 1 波），困难用即时构成
        const comp = difficulty === 'hard' ? compositionOf(state, 'red') : state.aiMemory.playerCompSnapshot;
        const dominant = dominantType(comp);
        buildType = dominant ? counterFactoryAgainst(dominant) : cheapestFactoryId(state.factions.blue);
    }

    const cost = buildingCostInState(state, 'blue', buildType);
    if (gold < cost) return null;
    return { type: 'build', itemId: buildType, position: factoryPosition(random) };
}

/** 波次结算时调用：快照玩家兵种构成（供普通 AI 延迟克制） */
export function snapshotPlayerComposition(state: GameState): void {
    state.aiMemory.playerCompSnapshot = compositionOf(state, 'red');
}

/** 波次结算时调用：评估双方绝地反击状态 */
export function evaluateComeback(state: GameState): void {
    for (const side of ['red', 'blue'] as const) {
        // 己方高地区域：水晶一侧 |x| ≥ 300
        const intruded = state.units.some(u =>
            u.side !== side && u.hp > 0 && (side === 'red' ? u.x <= -300 : u.x >= 300)
        );
        const cb = state.comeback[side];
        if (intruded) {
            cb.streak += 1;
            cb.active = cb.streak >= GAME_CONFIG.comebackWaves;
        } else {
            // 兵线重回中路：解除反击工资
            cb.streak = 0;
            cb.active = false;
        }
    }
}

/** 供测试与表现层使用的工具：构建按钮显示名 */
export function buildingName(itemId: BuildingItemId): string {
    return BUILDING_CONFIG[itemId].name;
}
