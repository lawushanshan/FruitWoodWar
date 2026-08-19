/**
 * 测试辅助工具
 */

import { GameEngine } from '../assets/scripts/core/game-engine';
import { SeededRandomSource } from '../assets/scripts/core/random';
import type { GameState, Side, UnitState } from '../assets/scripts/core/types';

/** 创建固定种子引擎（默认水果 vs 绿木，普通难度） */
export function makeEngine(seed = 42): GameEngine {
    const engine = new GameEngine(new SeededRandomSource(seed));
    engine.reset({ playerFaction: 'fruit', difficulty: 'normal' });
    return engine;
}

/** 获取可写状态（仅供测试布置场景使用；业务代码禁止这样改状态） */
export function writableState(engine: GameEngine): GameState {
    return engine.state as GameState;
}

/** 以固定步长推进引擎若干秒 */
export function runSeconds(engine: GameEngine, seconds: number, dt = 1 / 60): void {
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) engine.step(dt);
}

/** 快速构造一个测试用单位 */
export function makeUnit(overrides: Partial<UnitState> & { side: Side }): UnitState {
    return {
        id: overrides.id ?? 'test-unit',
        side: overrides.side,
        type: overrides.type ?? 'tank',
        level: overrides.level ?? 1,
        x: overrides.x ?? 0,
        y: overrides.y ?? 0,
        hp: overrides.hp ?? 1000,
        maxHp: overrides.maxHp ?? 1000,
        atk: overrides.atk ?? 10,
        speed: overrides.speed ?? 1,
        range: overrides.range ?? 55,
        atkSpeed: overrides.atkSpeed ?? 1,
        atkCd: overrides.atkCd ?? 0,
        firstStrikeDone: overrides.firstStrikeDone ?? false,
        shield: overrides.shield ?? 0,
        stunDur: overrides.stunDur ?? 0,
        slowMult: overrides.slowMult ?? 1,
        slowDur: overrides.slowDur ?? 0,
        bleedDps: overrides.bleedDps ?? 0,
        bleedDur: overrides.bleedDur ?? 0,
    };
}

/** 清空战场（保留水晶），便于布置确定性场景 */
export function clearBattlefield(state: GameState): void {
    state.units = [];
    state.buildings = [];
    state.towers = [];
}
