/**
 * 水晶护盾测试（问题 #5 后期金币出口）
 *
 * 覆盖：
 *  - 购买扣金 + 定价递增（×1.25/次）
 *  - 护盾激活期间不可重复购买
 *  - 护盾吸收水晶伤害（先盾后血）
 *  - 到期自动清零
 *  - 金币不足拒绝
 *  - AI 在水晶濒危时购买（普通/困难），简单 AI 不买
 */

import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../assets/scripts/config/game-config';
import { shieldCost } from '../assets/scripts/config/building-config';
import { tryShield } from '../assets/scripts/core/systems/building-system';
import { makeEngine, runSeconds, writableState } from './helpers';

describe('水晶护盾：命令与定价', () => {
    it('定价按 1.25 指数递增', () => {
        expect(shieldCost(0)).toBe(GAME_CONFIG.shieldBaseCost);
        expect(shieldCost(1)).toBe(Math.round(GAME_CONFIG.shieldBaseCost * 1.25));
        expect(shieldCost(2)).toBe(Math.round(GAME_CONFIG.shieldBaseCost * 1.25 * 1.25));
    });

    it('购买扣金并激活护盾，层数 +1', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.red = 1000;

        const r = tryShield(s, 'red');
        expect(r.ok).toBe(true);
        expect(s.gold.red).toBe(1000 - GAME_CONFIG.shieldBaseCost);
        expect(s.shieldLayers.red).toBe(1);
        const crystal = s.crystals.find(c => c.side === 'red')!;
        expect(crystal.shield).toBe(GAME_CONFIG.shieldAmount);
        expect(crystal.shieldDur).toBe(GAME_CONFIG.shieldDuration);
    });

    it('激活期间不可重复购买', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.red = 5000;
        expect(tryShield(s, 'red').ok).toBe(true);
        const gold = s.gold.red;
        const r = tryShield(s, 'red');
        expect(r.ok).toBe(false);
        expect(s.gold.red).toBe(gold);
    });

    it('金币不足拒绝且不改状态', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.red = 100; // < 300
        const r = tryShield(s, 'red');
        expect(r.ok).toBe(false);
        expect(s.shieldLayers.red).toBe(0);
        const crystal = s.crystals.find(c => c.side === 'red')!;
        expect(crystal.shield).toBe(0);
    });
});

describe('水晶护盾：伤害吸收与到期', () => {
    it('护盾先于血量吸收伤害（真实战斗路径：敌方攻城兵打护盾水晶）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        const crystal = s.crystals.find(c => c.side === 'red')!;
        crystal.shield = 100;
        crystal.shieldDur = 10;

        // 清掉红方基地塔（否则水晶受塔保护不可被攻击），放一个蓝方攻城兵贴脸
        s.towers = s.towers.filter(t => t.side !== 'red');
        s.units.push({
            id: 'siege-test', side: 'blue', type: 'siege', level: 1,
            x: crystal.x + 40, y: 0,
            hp: 500, maxHp: 500,
            atk: 4, speed: 0, range: 60, atkSpeed: 1, atkCd: 0,
            firstStrikeDone: true, shield: 0, stunDur: 0, slowMult: 1, slowDur: 0,
            bleedDps: 0, bleedDur: 0,
        });

        // 攻城对建筑 ×15：4 × 15 = 60 伤害，全部由护盾吸收
        runSeconds(engine, 1 / 30);

        expect(crystal.shield).toBe(40);
        expect(crystal.hp).toBe(crystal.maxHp); // 血量未动
    });

    it('护盾到期由引擎步进清零', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.red = 1000;
        expect(tryShield(s, 'red').ok).toBe(true);
        const crystal = s.crystals.find(c => c.side === 'red')!;

        runSeconds(engine, GAME_CONFIG.shieldDuration + 0.5);
        expect(crystal.shieldDur).toBe(0);
        expect(crystal.shield).toBe(0);
    });

    it('到期后可再次购买（第二价 375）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.gold.red = 5000;
        tryShield(s, 'red');
        runSeconds(engine, GAME_CONFIG.shieldDuration + 0.5);

        const goldBefore = s.gold.red;
        const r = tryShield(s, 'red');
        expect(r.ok).toBe(true);
        expect(s.gold.red).toBe(goldBefore - shieldCost(1));
    });
});

describe('水晶护盾：AI 行为', () => {
    it('普通 AI 水晶濒危且金币足够时购买', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.wave = 2; // 越过 AI 开局延迟门（普通 1 波）
        s.gold.blue = 1000;
        const blue = s.crystals.find(c => c.side === 'blue')!;
        blue.hp = blue.maxHp * 0.5; // < 70%

        runSeconds(engine, 1 / 60);
        expect(s.shieldLayers.blue).toBe(1);
        expect(blue.shield).toBe(GAME_CONFIG.shieldAmount);
    });

    it('简单 AI 不购买护盾', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.difficulty = 'easy';
        s.wave = 2;
        s.gold.blue = 1000;
        const blue = s.crystals.find(c => c.side === 'blue')!;
        blue.hp = blue.maxHp * 0.5;

        runSeconds(engine, 1 / 60);
        expect(s.shieldLayers.blue).toBe(0);
    });

    it('水晶健康（>70%）时 AI 不购买', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.wave = 2;
        s.gold.blue = 1000;
        const blue = s.crystals.find(c => c.side === 'blue')!;
        blue.hp = blue.maxHp * 0.9;

        runSeconds(engine, 1 / 60);
        expect(s.shieldLayers.blue).toBe(0);
    });
});
