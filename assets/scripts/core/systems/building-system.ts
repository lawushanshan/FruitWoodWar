/**
 * 建筑系统：建造 / 升级 / 学院 / 光环塔 / 全军强化（M3）
 *
 * - 兵工厂价格 = 基准价 × 阵营倍率 × 同类递增（每多 1 座同类厂 +25%）
 * - 升级：Lv1→2（150 金，属性 ×1.5）、Lv2→3（300 金，属性 ×2.2，需学院 Lv1）
 * - 学院：Lv0→1（200 金，解锁 Lv3）、Lv1→2（400 金，全队攻击 +10%、解锁全军强化）
 * - 光环塔：250 金起 / 800 血，每方最多 3 座（价格逐座 +25%），400px 内攻速 +15%（多塔不叠加）
 * - 全军强化：需学院 Lv2，400 金起每层 ×1.15，+8% 攻击/层，无限叠加
 */

import {
    BUILDING_CONFIG,
    AURA_TOWER_CONFIG,
    applyBuildingLevelHp,
    auraCostInState,
    buildingCostInState,
    researchCost,
    shieldCost,
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

/** 建造报价结果：ok=true 时 cost 为本次实付价格；ok=false 时 message 为不可建/钱不够的原因 */
export type BuildQuote = { ok: true; cost: number } | { ok: false; message: string };

/**
 * 建造报价（计价与资格校验的唯一入口，tryBuild 与 UI 点击预检共用）：
 * - 学院按当前等级计价，满级不可建
 * - 光环塔按已建数量递增，达到上限不可建
 * - 工厂按阵营倍率 × 同类递增
 * - 金币不足直接给出提示（需求：点建造时钱不够要立刻反馈）
 */
export function quoteBuild(state: GameState, side: Side, itemId: BuildingItemId): BuildQuote {
    const conf = BUILDING_CONFIG[itemId];
    if (!conf) {
        return { ok: false, message: '未知建筑' };
    }

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
            return { ok: false, message: `光环塔每方最多建造 ${GAME_CONFIG.auraTowerLimit} 座！` };
        }
        cost = auraCostInState(state, side);
    } else {
        cost = buildingCostInState(state, side, itemId);
    }

    if (state.gold[side] < cost) {
        return { ok: false, message: `金币不足！需要 ${cost} 金` };
    }
    return { ok: true, cost };
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

    // 计价 + 上限 + 金币预检全部收敛到 quoteBuild（与建造按钮点击时的提示完全一致）
    const quote = quoteBuild(state, side, itemId);
    if (quote.ok === false) {
        return quote; // 直接透传失败原因（上限/金币不足等）
    }
    const cost = quote.cost;

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

/**
 * 处理水晶护盾命令：花金币给己方水晶加临时护盾（问题 #5 后期金币出口）。
 * 护盾值与持续时长来自 GAME_CONFIG；到期由引擎步进清零。
 * 护盾激活期间不可重复购买（先花掉旧护盾是亏的，也避免无限叠层）。
 * 定价函数 shieldCost 在 config/building-config（与 researchCost 同处）。
 */
export function tryShield(state: GameState, side: Side = state.playerSide): CommandResult {
    if (state.phase !== 'playing') {
        return { ok: false };
    }
    const crystal = state.crystals.find(c => c.side === side);
    if (!crystal) {
        return { ok: false };
    }
    if (crystal.shieldDur > 0) {
        return { ok: false, message: '护盾已激活！' };
    }
    const cost = shieldCost(state.shieldLayers[side]);
    if (state.gold[side] < cost) {
        return { ok: false, message: `金币不足！需要 ${cost} 金` };
    }

    state.gold[side] -= cost;
    state.shieldLayers[side] += 1;
    crystal.shield = GAME_CONFIG.shieldAmount;
    crystal.shieldDur = GAME_CONFIG.shieldDuration;
    return { ok: true, message: `水晶护盾 +${GAME_CONFIG.shieldAmount}！持续 ${GAME_CONFIG.shieldDuration} 秒` };
}
