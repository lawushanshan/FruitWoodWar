/**
 * 战斗系统（M3）
 *
 * M2 规则保留：克制矩阵、攻城 ×15、水晶减免、塔保护、首击、AOE 溅射、赏金。
 * M3 新增：
 * - buff 按阵营隔离：攻击/攻速/减伤/暴击等只作用于己方（修正双方共享增益的历史偏差）
 * - 临时 buff 真正生效：攻速/攻击/速度倍增在结算时实时计算
 * - 光环塔：己方光环塔存活时全队攻速 +15%
 * - 卡牌被动：反伤（荆棘）、狼群（按友军数加攻）、流血（利爪）、死亡爆炸（适者生存）
 * - 精英兵（Lv2/Lv3 工厂出品）击杀赏金 ×1.5/×2
 */

import { GAME_CONFIG } from '../../config/game-config';
import { FACTION_CONFIG } from '../../config/faction-config';
import { UNIT_CONFIG, counterMultiplier } from '../../config/unit-config';
import { eliteBountyMult } from '../../config/building-config';
import type {
    BuildingState,
    CrystalState,
    GameState,
    Side,
    TowerState,
    UnitState,
} from '../types';
import type { RandomSource } from '../random';

/** 可攻击目标联合类型 */
type AttackTarget = UnitState | BuildingState | TowerState | CrystalState;

/** 目标类别（决定克制/攻城/水晶倍率的结算分支） */
type TargetKind = 'unit' | 'building' | 'tower' | 'crystal';

/** 卡牌溅射判定半径（曼哈顿距离，像素） */
const CARD_SPLASH_RADIUS = 80;
/** 死亡爆炸半径（曼哈顿距离，像素） */
const DEATH_EXPLODE_RADIUS = 80;
/** 流血持续时间（秒） */
const BLEED_DURATION = 3;

// ==================== 增益计算 ====================

/** 某边光环塔是否存活 */
export function auraAlive(state: GameState, side: Side): boolean {
    return state.towers.some(t => t.side === side && t.kind === 'aura');
}

/** 某边当前攻速倍率：永久 buff × 光环塔 × 临时 buff */
export function effectiveAttackSpeedMult(state: GameState, side: Side): number {
    let mult = state.buffs[side].attackSpeed;
    if (auraAlive(state, side)) {
        mult *= 1 + GAME_CONFIG.auraAttackSpeedBonus;
    }
    for (const tb of state.tempBuffs) {
        if (tb.side === side && tb.type === 'attackSpeedMult') mult *= tb.mult;
    }
    return mult;
}

/** 某边当前攻击倍率：永久 buff × 临时 buff × 狼群（按友军数量加成） */
export function effectiveAtkMult(state: GameState, side: Side): number {
    let mult = state.buffs[side].atk;
    for (const tb of state.tempBuffs) {
        if (tb.side === side && tb.type === 'atkMult') mult *= tb.mult;
    }
    const pack = state.buffs[side].packBonus;
    if (pack > 0) {
        const allies = state.units.filter(u => u.side === side).length;
        mult *= 1 + pack * allies;
    }
    return mult;
}

/** 某边当前速度倍率（临时 buff） */
export function effectiveSpeedMult(state: GameState, side: Side): number {
    let mult = 1;
    for (const tb of state.tempBuffs) {
        if (tb.side === side && tb.type === 'speedMult') mult *= tb.mult;
    }
    return mult;
}

// ==================== 战斗推进 ====================

/** 推进所有单位与防御塔的战斗行为 */
export function stepCombat(state: GameState, dt: number, random: RandomSource): void {
    for (const u of state.units) {
        updateUnit(state, u, dt, random);
    }
    for (const t of state.towers) {
        if (t.kind === 'aura') continue; // 光环塔不攻击
        updateTower(state, t, dt);
    }
}

/** 清理本帧死亡实体；死亡爆炸（适者生存）在此统一结算 */
export function cleanupDead(state: GameState): void {
    // 死亡爆炸：己方有死亡被动时，阵亡单位对周围敌人造成伤害
    for (const u of state.units) {
        if (u.hp > 0) continue;
        const explode = state.buffs[u.side].deathExplode;
        if (explode <= 0) continue;
        for (const e of state.units) {
            if (e.side === u.side || e.hp <= 0) continue;
            if (Math.abs(e.x - u.x) + Math.abs(e.y - u.y) < DEATH_EXPLODE_RADIUS) {
                e.hp -= explode;
            }
        }
    }
    state.units = state.units.filter(u => u.hp > 0);
    state.buildings = state.buildings.filter(b => b.hp > 0);
    state.towers = state.towers.filter(t => t.hp > 0);
}

/** 识别目标类别：建筑有 unitType 字段，单位有 type 字段，塔有 atk 字段，其余为水晶 */
function targetKindOf(t: AttackTarget): TargetKind {
    if ('unitType' in t) return 'building';
    if ('type' in t) return 'unit';
    if ('atk' in t) return 'tower';
    return 'crystal';
}

/** 更新单个单位：流血、控制、索敌、移动、攻击 */
function updateUnit(state: GameState, u: UnitState, dt: number, random: RandomSource): void {
    if (u.hp <= 0) return;

    // 流血（利爪撕裂）
    if (u.bleedDur > 0) {
        u.hp -= u.bleedDps * dt;
        u.bleedDur -= dt;
        if (u.hp <= 0) return;
    }

    let spdMult = 1;
    if (u.slowDur > 0) {
        spdMult = u.slowMult;
        u.slowDur -= dt;
    }
    if (u.stunDur > 0) {
        u.stunDur -= dt;
        return;
    }
    if (u.atkCd > 0) u.atkCd -= dt;

    const target = findTarget(state, u);
    if (target) {
        const dx = target.x - u.x;
        const dy = target.y - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= u.range) {
            if (u.atkCd <= 0) {
                attack(state, u, target, random);
                u.atkCd = 1 / (u.atkSpeed * effectiveAttackSpeedMult(state, u.side));
            }
        } else {
            const speedMult = spdMult * effectiveSpeedMult(state, u.side);
            u.x += (dx / dist) * u.speed * speedMult * dt;
            u.y += (dy / dist) * u.speed * speedMult * dt;
        }
    } else {
        // 无目标时向敌方水晶推进
        const crystal = state.crystals.find(c => c.side !== u.side);
        if (crystal) {
            const dx = crystal.x - u.x;
            const dy = crystal.y - u.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1) {
                const speedMult = spdMult * effectiveSpeedMult(state, u.side);
                u.x += (dx / dist) * u.speed * speedMult * dt;
                u.y += (dy / dist) * u.speed * speedMult * dt;
            }
        }
    }
}

/**
 * 索敌：最近的敌方目标。
 * - 敌方单位/兵工厂：曼哈顿距离 < 260px（防被兵流永远缠住）
 * - 防御塔：普通单位同样 260px；攻城单位用自己的射程（325px > 塔射程 300px，
 *   实现文档"攻城车站在塔射程外安全拆塔"的设计）
 * - 水晶：敌方基地塔未拆完时不可被选为目标（防偷家规则）
 */
function findTarget(state: GameState, u: UnitState): AttackTarget | null {
    let nearest: AttackTarget | null = null;
    let minDist = Infinity;

    for (const e of state.units) {
        if (e.side === u.side || e.hp <= 0) continue;
        const d = Math.abs(e.x - u.x) + Math.abs(e.y - u.y);
        if (d < minDist && d < GAME_CONFIG.aggroRangePx) {
            minDist = d;
            nearest = e;
        }
    }
    for (const b of state.buildings) {
        if (b.side === u.side) continue;
        const d = Math.abs(b.x - u.x) + Math.abs(b.y - u.y);
        if (d < minDist && d < GAME_CONFIG.aggroRangePx) {
            minDist = d;
            nearest = b;
        }
    }
    for (const t of state.towers) {
        if (t.side === u.side) continue;
        const d = Math.abs(t.x - u.x) + Math.abs(t.y - u.y);
        // 攻城对塔的索敌半径 = 自身射程（可站在塔射程外拆塔）
        const detect = u.type === 'siege' ? u.range : GAME_CONFIG.aggroRangePx;
        if (d < minDist && d < detect) {
            minDist = d;
            nearest = t;
        }
    }

    // 基地塔保护：敌方还有塔存活时，水晶不可被攻击
    const enemyTowersAlive = state.towers.some(t => t.side !== u.side);
    if (!enemyTowersAlive) {
        const crystal = state.crystals.find(c => c.side !== u.side);
        if (crystal) {
            const d = Math.abs(crystal.x - u.x) + Math.abs(crystal.y - u.y);
            if (d < minDist) nearest = crystal;
        }
    }
    return nearest;
}

/** 单位攻击结算：首击、暴击、处决、克制/攻城/水晶倍率、护盾、减伤、反伤、流血、溅射、赏金 */
function attack(state: GameState, attacker: UnitState, target: AttackTarget, random: RandomSource): void {
    const kind = targetKindOf(target);
    const hpBefore = target.hp;
    const atkBuff = effectiveAtkMult(state, attacker.side);
    const fConf = FACTION_CONFIG[state.factions[attacker.side]];

    let dmg = attacker.atk * atkBuff;

    // 冲锋首击倍率（仅第一次攻击）
    if (attacker.type === 'rush' && !attacker.firstStrikeDone) {
        dmg *= fConf.firstStrikeMult;
        attacker.firstStrikeDone = true;
    }
    // 暴击（卡牌）
    if (random.next() < state.buffs[attacker.side].crit) dmg *= 2;
    // 处决（卡牌"捕食者"）
    if (state.buffs[attacker.side].execute && target.hp < target.maxHp * 0.3) dmg *= 2;

    // 按目标类别结算倍率
    if (kind === 'unit') {
        dmg *= counterMultiplier(attacker.type, target.type);
    } else if (kind === 'crystal') {
        // 攻城全额（含 ×15），非攻城 ×0.75
        dmg *= attacker.type === 'siege' ? GAME_CONFIG.siegeVsBuildingMult : GAME_CONFIG.crystalDamageReduce;
    } else {
        // 工厂 / 防御塔：攻城 ×15
        dmg *= attacker.type === 'siege' ? GAME_CONFIG.siegeVsBuildingMult : 1;
    }

    // 护盾吸收（仅单位拥有护盾字段）
    const shieldTarget = target as { hp: number; shield?: number };
    if (shieldTarget.shield && shieldTarget.shield > 0) {
        const absorbed = Math.min(shieldTarget.shield, dmg);
        shieldTarget.shield -= absorbed;
        dmg -= absorbed;
    }

    // 防御方减伤（树皮铠甲等，按防御方阵营生效）
    dmg *= state.buffs[target.side].damageReduce;
    target.hp -= dmg;
    if (target.hp < 0) target.hp = 0;

    // 反伤（荆棘之甲）：防御方单位把受到伤害的一部分反弹给攻击者
    if (kind === 'unit' && dmg > 0 && state.buffs[target.side].thorn > 0) {
        attacker.hp -= dmg * state.buffs[target.side].thorn;
        if (attacker.hp < 0) attacker.hp = 0;
    }

    // 流血（利爪撕裂）：攻击附带持续伤害
    if (kind === 'unit' && dmg > 0 && state.buffs[attacker.side].bleed > 0) {
        target.bleedDps = dmg * state.buffs[attacker.side].bleed;
        target.bleedDur = BLEED_DURATION;
    }

    // AOE 兵种 innate 溅射：对目标周围敌方单位造成 50% 伤害
    const uConf = UNIT_CONFIG[attacker.type];
    if (uConf.splashRadius > 0 && dmg > 0) {
        const splashDmg = attacker.atk * atkBuff * GAME_CONFIG.aoeSplashRatio * state.buffs[target.side].damageReduce;
        for (const e of state.units) {
            if (e.side === attacker.side || e === target) continue;
            if (Math.abs(e.x - target.x) + Math.abs(e.y - target.y) < uConf.splashRadius) {
                e.hp -= splashDmg;
            }
        }
    }

    // 卡牌"果弹飞溅"额外溅射
    if (state.buffs[attacker.side].splashMult > 1 && dmg > 0) {
        const cardSplash = dmg * 0.5 * (state.buffs[attacker.side].splashMult - 1);
        for (const e of state.units) {
            if (e.side === attacker.side || e === target) continue;
            if (Math.abs(e.x - target.x) + Math.abs(e.y - target.y) < CARD_SPLASH_RADIUS) {
                e.hp -= cardSplash;
            }
        }
    }

    // 击杀结算：仅目标从存活转为死亡的瞬间计一次（防同帧重复计费）
    if (hpBefore > 0 && target.hp <= 0) {
        state.stats.kills[attacker.side]++;
        const lifeOnKill = state.buffs[attacker.side].lifeOnKill;
        if (lifeOnKill > 0) {
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + attacker.maxHp * lifeOnKill);
        }
        if (kind === 'unit') {
            // 击杀赏金：兵种赏金 × 精英倍率
            state.gold[attacker.side] += UNIT_CONFIG[target.type].bounty * eliteBountyMult(target.level);
        } else if (kind === 'building') {
            // 拆厂赏金：+50 金
            state.gold[attacker.side] += GAME_CONFIG.razeBounty;
        }
    }
}

/** 更新防御塔：冷却后攻击射程内最近的敌方单位 */
function updateTower(state: GameState, t: TowerState, dt: number): void {
    if (t.atkCd > 0) {
        t.atkCd -= dt;
        return;
    }
    let target: UnitState | null = null;
    let minDist = Infinity;
    for (const u of state.units) {
        if (u.side === t.side || u.hp <= 0) continue;
        const d = Math.abs(u.x - t.x) + Math.abs(u.y - t.y);
        if (d < t.range && d < minDist) {
            minDist = d;
            target = u;
        }
    }
    if (target) {
        const hpBefore = target.hp;
        target.hp -= t.atk;
        if (target.hp < 0) target.hp = 0;
        t.atkCd = 1 / t.atkSpeed;
        if (hpBefore > 0 && target.hp <= 0) {
            state.stats.kills[t.side]++;
            // 塔击杀同样发放击杀赏金（含精英倍率）
            state.gold[t.side] += UNIT_CONFIG[target.type].bounty * eliteBountyMult(target.level);
        }
    }
}
