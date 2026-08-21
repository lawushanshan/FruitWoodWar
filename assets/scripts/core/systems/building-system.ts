/**
 * 建筑系统：建造 / 升级 / 学院 / 光环塔 / 全军强化（M3）
 *
 * - 兵工厂价格 = 基准价 × 阵营倍率 × 同类递增（每多 1 座同类厂 +25%）
 * - 升级：Lv1→2（150 金，属性 ×1.5）、Lv2→3（300 金，属性 ×2.2，需学院 Lv1）
 * - 学院：Lv0→1（200 金，解锁 Lv3）、Lv1→2（400 金，全队攻击 +10%、解锁全军强化）
 * - 光环塔：250 金 / 800 血，每方限 1 座，全队攻速 +15%
 * - 全军强化：需学院 Lv2，400 金起每层 ×1.15，+8% 攻击/层，无限叠加
 */

import {
    BUILDING_CONFIG,
    AURA_TOWER_CONFIG,
    applyBuildingLevelHp,
    buildingCostInState,
    researchCost,
    upgradeCost,
} from '../../config/building-config';
import { GAME_CONFIG } from '../../config/game-config';
import { FACTION_CONFIG } from '../../config/faction-config';
import { nextEntityId } from '../game-state';
import type { BuildingItemId, CommandResult, GameState, Position, Side } from '../types';

/**
 * 从场上学院实体同步推导学院等级（每次建造/拆除学院后调用）。
 * 等级 = 存活学院建筑数（每方最多 2 座 → Lv2）。被拆掉一座，等级随之回落，
 * 已生效的 Lv2 攻击加成按比例回收（保持 atk buff 与等级一致）。
 */
export function syncAcademyLevel(state: GameState, side: Side): void {
    const count = state.buildings.filter(b => b.side === side && b.kind === 'academy' && b.hp > 0).length;
    const newLevel = Math.min(2, count);
    const oldLevel = state.academyLevel[side];
    if (newLevel === oldLevel) return;
    if (oldLevel === 2 && newLevel < 2) {
        // 学院被拆：回收 Lv2 的 +10% 攻击（按当层系数除回）
        state.buffs[side].atk /= 1.1;
    } else if (oldLevel < 2 && newLevel === 2) {
        state.buffs[side].atk *= 1.1;
    }
    state.academyLevel[side] = newLevel;
}

/** 学院升级提示文案 */
function academyMessage(state: GameState, side: Side): string {
    return state.academyLevel[side] === 2
        ? '战争学院 Lv2！全队攻击+10%，解锁全军强化'
        : '战争学院 Lv1！解锁兵工厂 Lv3 升级';
}

/** 处理建造命令（side 默认玩家方，AI 复用同一路径） */
export function tryBuild(state: GameState, itemId: BuildingItemId, position: Position, side: Side = state.playerSide): CommandResult {
    if (state.phase !== 'playing') {
        return { ok: false };
    }
    const conf = BUILDING_CONFIG[itemId];
    if (!conf) {
        return { ok: false };
    }

    // 学院按当前等级计价；光环塔固定价；工厂按阵营倍率 × 同类递增
    let cost: number;
    if (conf.kind === 'academy') {
        const level = state.academyLevel[side];
        if (level >= 2) {
            return { ok: false, message: '战争学院已满级！' };
        }
        cost = level === 0 ? GAME_CONFIG.academyLv1Cost : GAME_CONFIG.academyLv2Cost;
    } else if (conf.kind === 'aura') {
        const owned = state.towers.filter(t => t.side === side && t.kind === 'aura').length;
        if (owned >= GAME_CONFIG.auraTowerLimit) {
            return { ok: false, message: '光环塔每方只能建造 1 座！' };
        }
        cost = conf.cost;
    } else {
        cost = buildingCostInState(state, side, itemId);
    }

    if (state.gold[side] < cost) {
        return { ok: false, message: `金币不足！需要 ${cost} 金` };
    }

    // 光环塔：可攻击的塔实体（弱化版范围攻击 + 400px 攻速光环，可被敌方拆掉）
    if (conf.kind === 'aura') {
        state.gold[side] -= cost;
        state.towers.push({
            id: nextEntityId(state),
            side,
            kind: 'aura',
            x: position.x,
            y: position.y,
            hp: AURA_TOWER_CONFIG.hp,
            maxHp: AURA_TOWER_CONFIG.hp,
            range: AURA_TOWER_CONFIG.range,
            atk: AURA_TOWER_CONFIG.atk,
            atkSpeed: AURA_TOWER_CONFIG.atkSpeed,
            atkCd: 0,
        });
        return { ok: true, message: '建造了光环塔！周围 400px 己方攻速 +15%' };
    }

    // 战争学院：放置为可被拆除的实体建筑，等级由场上学院实体推导（被拆即失效）
    if (conf.kind === 'academy') {
        state.gold[side] -= cost;
        state.buildings.push({
            id: nextEntityId(state),
            side,
            unitType: null,
            kind: 'academy',
            x: position.x,
            y: position.y,
            hp: conf.hp,
            maxHp: conf.hp,
            waveTimer: 0,
            level: 1,
        });
        syncAcademyLevel(state, side);
        return { ok: true, message: academyMessage(state, side) };
    }

    // 兵工厂
    state.gold[side] -= cost;
    const fConf = FACTION_CONFIG[state.factions[side]];
    state.buildings.push({
        id: nextEntityId(state),
        side,
        unitType: conf.unitType ?? null,
        x: position.x,
        y: position.y,
        hp: conf.hp,
        maxHp: conf.hp,
        waveTimer: fConf.waveInterval,
        level: 1,
    });
    return { ok: true, message: `建造了 ${conf.name}！` };
}

/** 处理工厂升级命令：Lv1→2（150）/ Lv2→3（300，需学院 Lv1） */
export function tryUpgrade(state: GameState, buildingId: string, side: Side = state.playerSide): CommandResult {
    if (state.phase !== 'playing') {
        return { ok: false };
    }
    const building = state.buildings.find(b => b.id === buildingId && b.side === side);
    if (!building || building.unitType === null) {
        return { ok: false, message: '找不到可升级的兵工厂' };
    }
    const cost = upgradeCost(building.level);
    if (cost === null) {
        return { ok: false, message: '该工厂已满级！' };
    }
    if (building.level === 2 && state.academyLevel[side] < 1) {
        return { ok: false, message: '升级 Lv3 需要先建造战争学院！' };
    }
    if (state.gold[side] < cost) {
        return { ok: false, message: `金币不足！需要 ${cost} 金` };
    }

    state.gold[side] -= cost;
    building.level = (building.level + 1) as 2 | 3;
    // 建筑血量随等级提升（同步回满增量部分）
    applyBuildingLevelHp(building, BUILDING_CONFIG[building.unitType]);
    const stars = building.level === 2 ? '★' : '★★';
    return { ok: true, message: `工厂升级到 Lv${building.level}${stars}！出兵属性 ×${building.level === 2 ? '1.5' : '2.2'}` };
}

/** 处理全军强化命令：需学院 Lv2，价格逐层递增，攻击 +8%/层，无限叠加 */
export function tryResearch(state: GameState, side: Side = state.playerSide): CommandResult {
    if (state.phase !== 'playing') {
        return { ok: false };
    }
    if (state.academyLevel[side] < 2) {
        return { ok: false, message: '全军强化需要战争学院 Lv2！' };
    }
    const cost = researchCost(state.researchLayers[side]);
    if (state.gold[side] < cost) {
        return { ok: false, message: `金币不足！需要 ${cost} 金` };
    }
    state.gold[side] -= cost;
    state.researchLayers[side] += 1;
    state.buffs[side].atk *= 1 + GAME_CONFIG.researchAtkBonus;
    return { ok: true, message: `全军强化 第${state.researchLayers[side]}层！全队攻击 +8%` };
}
