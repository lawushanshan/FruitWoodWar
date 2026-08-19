/**
 * 确定性测试：相同种子 + 相同命令 → 完全一致的状态
 */

import { describe, expect, it } from 'vitest';
import { GameEngine } from '../assets/scripts/core/game-engine';
import { SeededRandomSource } from '../assets/scripts/core/random';

function simulate(seed: number, seconds: number): string {
    const engine = new GameEngine(new SeededRandomSource(seed));
    engine.reset({ playerFaction: 'fruit', difficulty: 'normal' });
    const dt = 1 / 60;
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) {
        engine.step(dt);
        // 模拟玩家在第 10 秒造一座坦克厂
        if (i === Math.round(10 / dt)) {
            engine.execute({ type: 'build', itemId: 'tank', position: { x: -300, y: -20 } });
        }
    }
    return JSON.stringify(engine.state);
}

describe('确定性', () => {
    it('相同种子产生完全相同的状态', () => {
        const a = simulate(123, 60);
        const b = simulate(123, 60);
        expect(a).toBe(b);
    });

    it('不同种子产生不同的战场', () => {
        const a = simulate(123, 60);
        const b = simulate(456, 60);
        expect(a).not.toBe(b);
    });

    it('长时间对局状态可序列化（无运行时对象泄漏）', () => {
        const engine = new GameEngine(new SeededRandomSource(7));
        engine.reset({ playerFaction: 'wood', difficulty: 'hard' });
        const dt = 1 / 60;
        for (let i = 0; i < 130 * 60; i++) {
            engine.step(dt);
            // 自动过卡牌关，验证跨暂停的连续模拟
            if (engine.state.phase === 'card-pause') {
                engine.execute({ type: 'choose-card', cardId: engine.state.cards.offers[0].id });
            }
        }
        const snapshot = JSON.stringify(engine.state);
        expect(snapshot.length).toBeGreaterThan(100);
        // 无死锁：要么时间正常推进（跨过第 5 波暂停），要么对局已自然分出胜负
        if (engine.state.phase !== 'ended') {
            expect(engine.state.time).toBeGreaterThan(129);
            expect(engine.state.wave).toBeGreaterThanOrEqual(6);
        } else {
            expect(engine.state.stats.result).not.toBeNull();
        }
    });
});
