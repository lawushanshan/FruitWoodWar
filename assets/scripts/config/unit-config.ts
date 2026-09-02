/**
 * 兵种模板配置（M2 已对齐《02-数值设计表》v0.3 §2 基准模板）
 *
 * 数值来源（基准，阵营修正前）：
 * | 定位 | 血量 | 攻击 | 攻速 | 射程(格→px) | 速度(格/秒→px/秒) | 击杀赏金 | 每波出兵 |
 * | 坦克 | 400 | 15 | 1.0 | 1→50   | 1.0→50  | 10 | 3 |
 * | 远程 | 150 | 25 | 1.0 | 4→200  | 1.0→50  | 7  | 3 |
 * | AOE  | 120 | 35 | 0.8 | 3.5→175| 0.9→45  | 8  | 2 |
 * | 冲锋 | 200 | 30 | 1.0 | 1→50   | 2.0→100 | 8  | 3 |
 * | 攻城 | 250 | 12 | 0.5 | 6.5→325| 0.5→25  | 12 | 1 |
 *
 * 攻城对建筑伤害 ×15（见 game-config.siegeVsBuildingMult），即对建筑 180。
 * 冲锋首击倍率见 faction-config.firstStrikeMult；首击为范围冲击（半径/比例见
 * game-config.rushFirstStrikeSplash*），后续普攻仍为单体。
 * cost 为对应兵工厂的基准价格（动物价，实际价格 = cost × 阵营价格倍率）。
 */

import type { UnitConfig, UnitType } from '../core/types';

/** 兵种顺序（随机兵种工厂按此顺序取随机） */
export const UNIT_TYPES: UnitType[] = ['tank', 'ranged', 'aoe', 'rush', 'siege'];

export const UNIT_CONFIG: Record<UnitType, UnitConfig> = {
    tank: {
        type: 'tank', name: '坦克', hp: 400, atk: 15,
        speed: 50, range: 50, atkSpeed: 1.0,
        cost: 150, bounty: 10, unitsPerWave: 3, splashRadius: 0, icon: '🛡️',
    },
    ranged: {
        type: 'ranged', name: '远程', hp: 150, atk: 25,
        speed: 50, range: 200, atkSpeed: 1.0,
        cost: 130, bounty: 7, unitsPerWave: 3, splashRadius: 0, icon: '🏹',
    },
    aoe: {
        type: 'aoe', name: 'AOE', hp: 120, atk: 35,
        speed: 45, range: 175, atkSpeed: 0.8,
        cost: 180, bounty: 8, unitsPerWave: 2, splashRadius: 75, icon: '✨',
    },
    rush: {
        type: 'rush', name: '冲锋', hp: 200, atk: 30,
        speed: 100, range: 50, atkSpeed: 1.0,
        cost: 160, bounty: 8, unitsPerWave: 3, splashRadius: 0, icon: '⚡',
    },
    siege: {
        type: 'siege', name: '攻城', hp: 250, atk: 12,
        speed: 25, range: 325, atkSpeed: 0.5,
        cost: 200, bounty: 12, unitsPerWave: 1, splashRadius: 0, icon: '🪨',
    },
};

/**
 * 兵种克制矩阵（§5，伤害倍率）：
 * 坦克克冲锋、冲锋克远程/AOE、远程克坦克，其余 ×1.0。
 * 攻城对单位的克制在矩阵内不体现（对建筑 ×15 另行结算）。
 */
export const COUNTER_MATRIX: Record<UnitType, Partial<Record<UnitType, number>>> = {
    tank: { rush: 1.4 },
    ranged: { tank: 1.4 },
    aoe: {},
    rush: { ranged: 1.4, aoe: 1.4 },
    siege: {},
};

/** 查询克制倍率（无克制关系返回 1） */
export function counterMultiplier(attacker: UnitType, defender: UnitType): number {
    return COUNTER_MATRIX[attacker][defender] ?? 1;
}
