/**
 * 胜负系统（M3：决战时刻 + 同时归零判定 + 结算数据）
 *
 * - 5:00 起双方水晶每秒 -1% 最大血量（反僵持，保证 ≤7 分钟结束）
 * - 水晶归零即负；同时归零时击杀多者胜（击杀也相同判玩家胜，极罕见）
 * - 星级：胜利且己方水晶 ≥50% → 3 星；胜利 <50% → 2 星；失败 1 星
 */

import { GAME_CONFIG } from '../../config/game-config';
import type { GameState, MatchResult, Side } from '../types';

/** 每帧推进：决战时刻水晶过载 + 胜负判定 */
export function stepVictory(state: GameState, dt: number): void {
    if (state.stats.result) return;

    // 决战时刻：5:00 起双方水晶过载崩解
    if (state.time >= GAME_CONFIG.suddenDeathTime) {
        for (const c of state.crystals) {
            c.hp -= c.maxHp * GAME_CONFIG.suddenDeathDps * dt;
            if (c.hp < 0) c.hp = 0;
        }
    }

    const rc = state.crystals.find(c => c.side === 'red')!;
    const bc = state.crystals.find(c => c.side === 'blue')!;

    if (rc.hp <= 0 && bc.hp <= 0) {
        // 同时归零：击杀多者胜（击杀相同判玩家胜）
        const winner: Side = state.stats.kills.red >= state.stats.kills.blue ? 'red' : 'blue';
        endGame(state, winner);
    } else if (rc.hp <= 0) {
        endGame(state, 'blue');
    } else if (bc.hp <= 0) {
        endGame(state, 'red');
    }
}

/** 结束对局并计算星级与结算数据 */
function endGame(state: GameState, winner: Side): void {
    state.phase = 'ended';
    // 胜负/星级按玩家所在边判定（联机时玩家可能是蓝方）
    const won = winner === state.playerSide;
    const pc = state.crystals.find(c => c.side === state.playerSide)!;
    const hpRatio = pc.hp / pc.maxHp;
    const stars = won ? (hpRatio >= 0.5 ? 3 : 2) : 1;
    state.stats.result = {
        winner,
        stars,
        duration: state.time,
        playerGold: state.gold[state.playerSide],
    } satisfies MatchResult;
}
