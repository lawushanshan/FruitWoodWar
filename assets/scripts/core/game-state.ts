/**
 * 游戏状态创建与重置（M3：阵营独立 buff、学院/科研/绝地反击/AI 记忆初始字段）
 */

import { GAME_CONFIG } from '../config/game-config';
import { FACTION_CONFIG, FACTION_IDS } from '../config/faction-config';
import { BASE_TOWER_CONFIG } from '../config/building-config';
import type { FactionId, GameState, Side, SideBuffs, StartOptions, UnitType } from './types';

/** 按阵营顺序解析 AI 阵营：取玩家阵营的下一个 */
export function resolveAiFaction(playerFaction: FactionId): FactionId {
    const idx = FACTION_IDS.indexOf(playerFaction);
    return FACTION_IDS[(idx + 1) % FACTION_IDS.length];
}

/** 分配下一个实体 ID */
export function nextEntityId(state: GameState): string {
    return `e${state.nextId++}`;
}

/** 创建默认阵营增益 */
function defaultBuffs(): SideBuffs {
    return {
        atk: 1,
        hp: 1,
        attackSpeed: 1,
        damageReduce: 1,
        crit: 0,
        splashMult: 1,
        waveIntervalMult: 1,
        execute: false,
        lifeOnKill: 0,
        thorn: 0,
        packBonus: 0,
        bleed: 0,
        deathExplode: 0,
    };
}

function emptyComp(): Record<UnitType, number> {
    return { tank: 0, ranged: 0, aoe: 0, rush: 0, siege: 0 };
}

/** 基地塔位置：水晶前方 ±80px、道路走廊内上下两侧（±42px，不遮挡建造格） */
function addBaseTowers(state: GameState, side: Side): void {
    const crystalX = side === 'red' ? -500 : 500;
    const forward = side === 'red' ? 80 : -80;
    for (const offsetY of [42, -42]) {
        state.towers.push({
            id: nextEntityId(state),
            side,
            kind: 'base',
            x: crystalX + forward,
            y: offsetY,
            hp: BASE_TOWER_CONFIG.hp,
            maxHp: BASE_TOWER_CONFIG.hp,
            range: BASE_TOWER_CONFIG.range,
            atk: BASE_TOWER_CONFIG.atk,
            atkSpeed: BASE_TOWER_CONFIG.atkSpeed,
            atkCd: 0,
        });
    }
}

/** 创建初始对局状态（水晶 + 基地双塔，工厂由玩家/AI 自行建造） */
export function createInitialState(options: StartOptions): GameState {
    const aiFaction = options.aiFaction ?? resolveAiFaction(options.playerFaction);

    const state: GameState = {
        phase: 'idle',
        time: 0,
        wave: 0,
        waveTimer: GAME_CONFIG.waveInterval,
        playerSide: options.playerSide ?? 'red',
        factions: { red: options.playerFaction, blue: aiFaction },
        difficulty: options.difficulty ?? 'normal',
        gold: { red: GAME_CONFIG.startGold, blue: GAME_CONFIG.startGold },
        salaryTimer: { red: GAME_CONFIG.salaryInterval, blue: GAME_CONFIG.salaryInterval },
        units: [],
        buildings: [],
        towers: [],
        crystals: [],
        buffs: { red: defaultBuffs(), blue: defaultBuffs() },
        tempBuffs: [],
        academyLevel: { red: 0, blue: 0 },
        researchLayers: { red: 0, blue: 0 },
        comeback: { red: { streak: 0, active: false }, blue: { streak: 0, active: false } },
        cards: { offers: [], triggeredWaves: { 5: false, 10: false, 15: false }, usedCardIds: [] },
        stats: { kills: { red: 0, blue: 0 }, result: null },
        aiMemory: { playerCompSnapshot: emptyComp() },
        nextId: 1,
        doubleSalary: options.doubleSalary ?? false,
        aiEnabled: options.aiEnabled ?? true,
        disableCards: options.disableCards ?? false,
    };

    // 双方大本营水晶（4000 血）
    state.crystals.push({ id: 'crystal-red', side: 'red', x: -500, y: 0, hp: GAME_CONFIG.crystalHp, maxHp: GAME_CONFIG.crystalHp });
    state.crystals.push({ id: 'crystal-blue', side: 'blue', x: 500, y: 0, hp: GAME_CONFIG.crystalHp, maxHp: GAME_CONFIG.crystalHp });

    // 双方基地各 2 座固定防御塔（未拆完前水晶不可被攻击）
    addBaseTowers(state, 'red');
    addBaseTowers(state, 'blue');

    return state;
}

/** 获取某一边的阵营配置（便捷读取） */
export function factionOf(state: GameState, side: Side) {
    return FACTION_CONFIG[state.factions[side]];
}
