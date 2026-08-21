/**
 * 批量模拟测试（M2 验收）：三阵营各 100 局 AI 对战
 *
 * 红方使用与蓝方 AI 相同的镜像策略（攒钱买最便宜工厂，上限 8 座，自动选卡），
 * 输出胜率 / 平均时长 / 胜方水晶剩余，并断言无数量无限增长。
 *
 * 注意：红方为玩家侧会触发卡牌（蓝方无卡），存在轻微不对称，属设计规则。
 */

import { describe, expect, it } from 'vitest';
import { GameEngine } from '../assets/scripts/core/game-engine';
import { SeededRandomSource } from '../assets/scripts/core/random';
import { buildingCostInState, cheapestFactoryId } from '../assets/scripts/config/building-config';
import { BUILD_GRID } from '../assets/scripts/config/build-grid';
import type { FactionId } from '../assets/scripts/core/types';

/** 单局时间上限（秒）；决战时刻为 M3 范围，超时记为未分胜负 */
const MATCH_CAP_S = 600;
/** 每方工厂策略上限（与 ai-system AI_FACTORY_CAP 一致） */
const FACTORY_CAP = 8;
/** 每个阵营的对局数 */
const MATCHES_PER_FACTION = 100;

interface MatchSummary {
    winner: 'red' | 'blue' | 'unfinished';
    duration: number;
    /** 胜方水晶剩余比例（未分胜负为 -1） */
    winnerCrystalRatio: number;
    maxGold: number;
    maxUnits: number;
    maxBuildings: number;
}

/** 跑一局：红方镜像 AI 策略 + 自动选卡 */
function playMatch(red: FactionId, blue: FactionId, seed: number): MatchSummary {
    const engine = new GameEngine(new SeededRandomSource(seed));
    engine.reset({ playerFaction: red, aiFaction: blue, difficulty: 'normal', disableCards: true });

    const dt = 1 / 30;
    let maxGold = 0;
    let maxUnits = 0;
    let maxBuildings = 0;

    while (engine.state.phase !== 'ended' && engine.state.time < MATCH_CAP_S) {
        const s = engine.state;
        // 红方自动策略：与蓝方 AI 同款（最便宜工厂，上限 8 座），建造位置同样走网格
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
        // 卡牌暂停时自动选第一张
        if (engine.state.phase === 'card-pause') {
            engine.execute({ type: 'choose-card', cardId: engine.state.cards.offers[0].id });
        }
        maxGold = Math.max(maxGold, s.gold.red, s.gold.blue);
        maxUnits = Math.max(maxUnits, s.units.length);
        maxBuildings = Math.max(maxBuildings, s.buildings.length);
    }

    const s = engine.state;
    const result = s.stats.result;
    let winnerCrystalRatio = -1;
    if (result) {
        const wc = s.crystals.find(c => c.side === result.winner)!;
        winnerCrystalRatio = wc.hp / wc.maxHp;
    }
    return {
        winner: result ? result.winner : 'unfinished',
        duration: s.time,
        winnerCrystalRatio,
        maxGold,
        maxUnits,
        maxBuildings,
    };
}

describe('批量模拟（M2 验收）', () => {
    it('三阵营各 100 局：输出胜率/时长/水晶剩余，无数量无限增长', () => {
        const matchups: Array<[FactionId, FactionId]> = [
            ['fruit', 'wood'],
            ['wood', 'animal'],
            ['animal', 'fruit'],
        ];

        const globalMax = { gold: 0, units: 0, buildings: 0 };
        const reportLines: string[] = [];

        for (const [red, blue] of matchups) {
            const summaries: MatchSummary[] = [];
            for (let i = 0; i < MATCHES_PER_FACTION; i++) {
                summaries.push(playMatch(red, blue, 1000 + i));
            }

            const redWins = summaries.filter(s => s.winner === 'red').length;
            const blueWins = summaries.filter(s => s.winner === 'blue').length;
            const unfinished = summaries.filter(s => s.winner === 'unfinished').length;
            const finished = summaries.filter(s => s.winner !== 'unfinished');
            const avgDur = finished.length
                ? (finished.reduce((acc, s) => acc + s.duration, 0) / finished.length).toFixed(1)
                : '-';
            const avgCrystal = finished.length
                ? (finished.reduce((acc, s) => acc + s.winnerCrystalRatio, 0) / finished.length * 100).toFixed(1) + '%'
                : '-';
            const maxGold = Math.max(...summaries.map(s => s.maxGold));
            const maxUnits = Math.max(...summaries.map(s => s.maxUnits));
            const maxBuildings = Math.max(...summaries.map(s => s.maxBuildings));

            globalMax.gold = Math.max(globalMax.gold, maxGold);
            globalMax.units = Math.max(globalMax.units, maxUnits);
            globalMax.buildings = Math.max(globalMax.buildings, maxBuildings);

            reportLines.push(
                `${red} vs ${blue}: 红方 ${redWins} 胜 / 蓝方 ${blueWins} 胜 / 未分胜负 ${unfinished}` +
                ` | 平均时长 ${avgDur}s | 胜方水晶剩余 ${avgCrystal}` +
                ` | 峰值 金币${maxGold} 单位${maxUnits} 建筑${maxBuildings}`
            );
        }

        console.log('\n===== M2 批量模拟报告（每对阵 100 局）=====\n' + reportLines.join('\n'));

        // 验收：单位不超双方人口上限
        expect(globalMax.units).toBeLessThanOrEqual(120);
        // 验收：建筑数量受策略上限约束
        expect(globalMax.buildings).toBeLessThanOrEqual(FACTORY_CAP * 2);
        // 验收：金币无指数膨胀（对照 v0.2 失控案例 56 万金，线性工资上界远低于此）
        expect(globalMax.gold).toBeLessThan(20000);
    }, 300_000);
});
