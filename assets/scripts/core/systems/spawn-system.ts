/**
 * 出兵系统：兵工厂计时与出兵（M3：精英等级、buff 按阵营隔离）
 *
 * - 出兵数 = 兵种模板 unitsPerWave（等级不改变出兵数量）
 * - Lv2/Lv3 工厂出的兵属性 ×1.5/×2.2，赏金 ×1.5/×2
 * - buff 结算口径：血量在出兵时烘焙；攻击/攻速在战斗结算时按当时 buff 生效
 *   （M2 之前"出兵烘焙 + 攻击再乘"的双重应用已修正为只算一次）
 * - 绿木"生生不息"：每厂每波 50% 概率额外 +2 兵
 */

import { GAME_CONFIG } from '../../config/game-config';
import { FACTION_CONFIG } from '../../config/faction-config';
import { UNIT_CONFIG, UNIT_TYPES } from '../../config/unit-config';
import { factoryStatMult } from '../../config/building-config';
import { nextEntityId } from '../game-state';
import type { BuildingState, GameState, UnitState } from '../types';
import type { RandomSource } from '../random';

/** 推进所有兵工厂的出兵倒计时并触发出兵 */
export function stepSpawners(state: GameState, dt: number, random: RandomSource): void {
    for (const b of state.buildings) {
        b.waveTimer -= dt;
        if (b.waveTimer <= 0) {
            spawnWave(state, b, random);
            // 出兵间隔 = 阵营间隔 × 己方 buff（自然生长卡牌只加快己方工厂）
            const fConf = FACTION_CONFIG[state.factions[b.side]];
            b.waveTimer = fConf.waveInterval * state.buffs[b.side].waveIntervalMult;
        }
    }
}

/** 单个工厂出一波兵 */
function spawnWave(state: GameState, factory: BuildingState, random: RandomSource): void {
    const fConf = FACTION_CONFIG[state.factions[factory.side]];
    // 工厂未指定兵种时随机取一种（随机工厂行为）
    const unitType = factory.unitType ?? UNIT_TYPES[random.int(UNIT_TYPES.length)];
    const uConf = UNIT_CONFIG[unitType];

    let count = uConf.unitsPerWave;
    // 绿木概率加兵：50% 概率 +2
    if (fConf.extraCountChance > 0 && random.next() < fConf.extraCountChance) {
        count += fConf.extraCount;
    }
    // 人口上限保护：满员时截断本波出兵数
    const pop = state.units.filter(u => u.side === factory.side).length;
    if (pop + count > GAME_CONFIG.unitCap) {
        count = Math.max(0, GAME_CONFIG.unitCap - pop);
    }

    for (let i = 0; i < count; i++) {
        state.units.push(makeUnit(state, factory.side, unitType, factory.level, factory.x, factory.y, random));
    }
}

/** 生成一个新单位（阵营修正 × 工厂等级 × 己方血量 buff） */
export function makeUnit(
    state: GameState,
    side: BuildingState['side'],
    unitType: UnitState['type'],
    level: UnitState['level'],
    x: number,
    y: number,
    random: RandomSource,
): UnitState {
    const uConf = UNIT_CONFIG[unitType];
    const fConf = FACTION_CONFIG[state.factions[side]];
    const eliteMult = factoryStatMult(level);
    const hp = uConf.hp * fConf.hpMult * eliteMult * state.buffs[side].hp;
    return {
        id: nextEntityId(state),
        side,
        type: unitType,
        level,
        // 出生点：工厂前方 40px + 随机散布（兵线宽 3.3 格，有纵向纵深）
        x: x + (side === 'red' ? 40 : -40) + random.range(0, 30),
        y: y + random.range(-30, 30),
        hp,
        maxHp: hp,
        // 攻击不在出兵时烘焙 buff（攻击结算时按当时 buff 生效）
        atk: uConf.atk * fConf.atkMult * eliteMult,
        speed: uConf.speed * fConf.speedMult,
        range: uConf.range,
        atkSpeed: uConf.atkSpeed,
        atkCd: 0,
        firstStrikeDone: false,
        shield: 0,
        stunDur: 0,
        slowMult: 1,
        slowDur: 0,
        bleedDps: 0,
        bleedDur: 0,
    };
}
