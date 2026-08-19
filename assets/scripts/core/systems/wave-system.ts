/**
 * 波次系统：全局波次计时（M1 镜像旧灰盒行为）
 *
 * 注意：旧灰盒中每个兵工厂还有独立的出兵倒计时（见 spawn-system），
 * 本系统只推进全局波次计数，用于卡牌触发等全局事件。
 */

import { GAME_CONFIG } from '../../config/game-config';
import type { GameState } from '../types';

/** 推进全局波次计时；若跨波则返回新波次号，否则返回 null */
export function stepWaveTimer(state: GameState, dt: number): number | null {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) {
        state.wave++;
        state.waveTimer = GAME_CONFIG.waveInterval;
        return state.wave;
    }
    return null;
}
