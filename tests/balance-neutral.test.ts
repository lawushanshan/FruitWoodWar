/**
 * 中立卡平衡性验证（v1.8）
 *
 * 思路：同一批种子跑两组整局 AI 模拟，仅选卡策略不同——
 *  - 对照组（first）：卡牌暂停时自动选第一张（随机卡，代表阵营卡+中立卡混合期望）
 *  - 中立组（neutralFirst）：优先选可用中立卡，无中立卡时回退第一张
 *
 * 两组胜率差 = "主动选中立卡"相对"随机选卡"的增益上界估计
 * （对照组本身也含约 25% 槽位概率的中立卡，实际中立强度增益只会更接近 0）。
 * 验收：|Δ胜率| ≤ 15%（60 局样本的 95% 置信波动约 ±13%，阈值略高于噪声防误报）。
 *
 * 注意：红方为玩家侧（蓝方 AI 无卡为设计规则），两组同享该不对称，不引入额外偏差。
 */

import { describe, expect, it } from 'vitest';
import { GameEngine } from '../assets/scripts/core/game-engine';
import { SeededRandomSource } from '../assets/scripts/core/random';
import { NEUTRAL_CARDS } from '../assets/scripts/config/card-config';
import { buildingCostInState, cheapestFactoryId } from '../assets/scripts/config/building-config';
import { BUILD_GRID } from '../assets/scripts/config/build-grid';
import type { FactionId } from '../assets/scripts/core/types';

/** 单局时间上限（秒），与 simulation.test.ts 保持一致 */
const MATCH_CAP_S = 600;
/** 每方工厂策略上限（与 ai-system AI_FACTORY_CAP 一致） */
const FACTORY_CAP = 8;
/** 每组局数：60 局胜率噪声约 ±13%，够区分"明显超模"与"平衡" */
const MATCHES_PER_GROUP = 60;

const NEUTRAL_IDS = new Set(NEUTRAL_CARDS.map(c => c.id));

type PickStrategy = 'first' | 'neutralFirst';

/** 按策略从三选一中挑卡 */
function pickCard(offers: Array<{ id: string }>, strategy: PickStrategy): string {
    if (strategy === 'neutralFirst') {
        const neutral = offers.find(o => NEUTRAL_IDS.has(o.id));
        if (neutral) return neutral.id;
    }
    return offers[0].id;
}

/** 跑一局：红方镜像 AI 策略 + 指定选卡策略（其余与 simulation.test.ts 相同） */
function playMatch(red: FactionId, blue: FactionId, seed: number, strategy: PickStrategy): 'red' | 'blue' | 'unfinished' {
    const engine = new GameEngine(new SeededRandomSource(seed));
    engine.reset({ playerFaction: red, aiFaction: blue, difficulty: 'normal' });

    const dt = 1 / 30;
    while (engine.state.phase !== 'ended' && engine.state.time < MATCH_CAP_S) {
        const s = engine.state;
        const myBuildings = s.buildings.filter(b => b.side === 'red');
        if (myBuildings.length < FACTORY_CAP) {
            const itemId = cheapestFactoryId(s.factions.red);
            if (s.gold.red >= buildingCostInState(s, 'red', itemId)) {
                const occupied = new Set(myBuildings.map(b => `${Math.round(b.x)},${Math.round(b.y)}`));
                const cell = BUILD_GRID.cells().find(c => !occupied.has(`${c.x},${c.y}`)) ?? { x: -400, y: -100 };
                engine.execute({ type: 'build', itemId, position: cell });
            }
        }
        engine.step(dt);
        // 卡牌暂停时按策略选卡
        if (engine.state.phase === 'card-pause') {
            engine.execute({ type: 'choose-card', cardId: pickCard(engine.state.cards.offers, strategy) });
        }
    }

    const result = engine.state.stats.result;
    return result ? result.winner : 'unfinished';
}

describe('中立卡平衡性（v1.8）', () => {
    it('中立优先 vs 随机选卡：胜率差 ≤ 15%（fruit vs wood）', () => {
        const seeds = Array.from({ length: MATCHES_PER_GROUP }, (_, i) => 2000 + i);

        const winRate = (strategy: PickStrategy): number => {
            let wins = 0;
            for (const seed of seeds) {
                if (playMatch('fruit', 'wood', seed, strategy) === 'red') wins++;
            }
            return wins / seeds.length;
        };

        const baseline = winRate('first');
        const neutral = winRate('neutralFirst');
        const delta = neutral - baseline;

        console.log(
            `\n===== 中立卡平衡性报告（${MATCHES_PER_GROUP} 局/组，fruit vs wood）=====\n` +
            `对照组（随机选卡）红方胜率: ${(baseline * 100).toFixed(1)}%\n` +
            `中立组（中立优先）红方胜率: ${(neutral * 100).toFixed(1)}%\n` +
            `胜率差: ${(delta * 100).toFixed(1)}%（验收 ≤ 15%）`
        );

        expect(Math.abs(delta)).toBeLessThanOrEqual(0.15);
    }, 300_000);
});
