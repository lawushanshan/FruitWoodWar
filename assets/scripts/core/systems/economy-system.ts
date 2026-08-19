/**
 * 经济系统：工资发放（M3：AI 难度收入倍率 + 绝地反击工资加成，M6：双倍工资广告）
 */

import { GAME_CONFIG } from '../../config/game-config';
import type { GameState, Side } from '../types';

/** 某边本次工资金额：基础 50 × 反击加成 ×（蓝方 AI 难度倍率） × 双倍工资 */
export function salaryAmount(state: GameState, side: Side): number {
    let amount = GAME_CONFIG.salary;
    if (state.comeback[side].active) {
        amount = Math.round(amount * GAME_CONFIG.comebackSalaryMult);
    }
    if (side === 'blue') {
        amount = Math.round(amount * GAME_CONFIG.aiIncomeMult[state.difficulty]);
    }
    // 双倍工资（仅对玩家方生效）
    if (side === 'red' && state.doubleSalary) {
        amount *= 2;
    }
    return amount;
}

export function stepEconomy(state: GameState, dt: number): void {
    state.salaryTimer.red -= dt;
    if (state.salaryTimer.red <= 0) {
        state.gold.red += salaryAmount(state, 'red');
        state.salaryTimer.red = GAME_CONFIG.salaryInterval;
    }
    state.salaryTimer.blue -= dt;
    if (state.salaryTimer.blue <= 0) {
        state.gold.blue += salaryAmount(state, 'blue');
        state.salaryTimer.blue = GAME_CONFIG.salaryInterval;
    }
}
