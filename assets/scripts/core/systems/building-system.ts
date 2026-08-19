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
    applyBuildingLevelHp,
    buildingCostInState,
    researchCost,
    upgradeCost,
} from '../../config/building-config';
import { GAME_CONFIG } from '../../config/game-config';
import { FACTION_CONFIG } from '../../config/faction-config';
import { nextEntityId } from '../game-state';
import type { BuildingItemId, CommandResult, GameState, Position, Side } from '../types';

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

    // 光环塔：作为无攻击力的塔实体（可被敌方拆掉，失去光环效果）
    if (conf.kind === 'aura') {
        state.gold[side] -= cost;
        state.towers.push({
            id: nextEntityId(state),
            side,
            kind: 'aura',
            x: position.x,
            y: position.y,
            hp: conf.hp,
            maxHp: conf.hp,
            range: 0,
            atk: 0,
            atkSpeed: 1,
            atkCd: 0,
        });
        return { ok: true, message: '建造了光环塔！全队攻速 +15%' };
    }

    // 战争学院：提升等级并生效
    if (conf.kind === 'academy') {
        state.gold[side] -= cost;
        state.academyLevel[side] += 1;
        if (state.academyLevel[side] === 2) {
            state.buffs[side].atk *= 1.1;
            return { ok: true, message: '战争学院 Lv2！全队攻击+10%，解锁全军强化' };
        }
        return { ok: true, message: '战争学院 Lv1！解锁兵工厂 Lv3 升级' };
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
