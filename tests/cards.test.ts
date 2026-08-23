/**
 * 卡牌系统测试：触发暂停、抽牌、选卡效果（M3 全效果版）
 */

import { describe, expect, it } from 'vitest';
import { CARD_CONFIG } from '../assets/scripts/config/card-config';
import type { CardConfig } from '../assets/scripts/core/types';
import { makeEngine, makeUnit, runSeconds, writableState } from './helpers';

/** 直接把指定卡牌塞进备选并选它 */
function forceChooseCard(engine: ReturnType<typeof makeEngine>, card: CardConfig) {
    const s = writableState(engine);
    s.cards.offers = [card];
    return engine.execute({ type: 'choose-card', cardId: card.id });
}

function findCard(faction: 'fruit' | 'wood' | 'animal', id: string): CardConfig {
    return CARD_CONFIG[faction].find(c => c.id === id)!;
}

describe('卡牌系统', () => {
    it('第 5 波触发卡牌选择并暂停游戏', () => {
        const engine = makeEngine();
        // 加厚水晶，避免提前分出胜负
        writableState(engine).crystals.forEach(c => { c.hp = 1e9; c.maxHp = 1e9; });
        runSeconds(engine, 100); // 5 波 × 20 秒
        expect(engine.state.wave).toBe(5);
        expect(engine.state.phase).toBe('card-pause');
        expect(engine.state.cards.offers.length).toBe(3);
        expect(engine.state.cards.triggeredWaves[5]).toBe(true);
        // 暂停期间世界冻结
        const goldBefore = engine.state.gold.red;
        runSeconds(engine, 10);
        expect(engine.state.gold.red).toBe(goldBefore);
    });

    it('选卡后恢复对战且备选清空', () => {
        const engine = makeEngine();
        writableState(engine).crystals.forEach(c => { c.hp = 1e9; c.maxHp = 1e9; });
        runSeconds(engine, 100);
        expect(engine.state.phase).toBe('card-pause');
        const offer = engine.state.cards.offers[0];
        const result = engine.execute({ type: 'choose-card', cardId: offer.id });
        expect(result.ok).toBe(true);
        expect(engine.state.phase).toBe('playing');
        expect(engine.state.cards.offers.length).toBe(0);
    });

    it('波次到达触发点时进入暂停且只触发一次', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.wave = 4;
        s.waveTimer = 0.01;
        engine.step(0.02); // wave 4 → 5，触发第 5 波卡牌
        expect(s.wave).toBe(5);
        expect(s.cards.triggeredWaves[5]).toBe(true);
        expect(s.phase).toBe('card-pause');
        expect(s.cards.offers.length).toBe(3);
    });

    it('非备选卡牌无法选择', () => {
        const engine = makeEngine();
        const result = engine.execute({ type: 'choose-card', cardId: 'not-exist' });
        expect(result.ok).toBe(false);
    });

    it('卡牌增益只作用于玩家方：果香四溢攻击 +25%', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('fruit', 'atkUp'));
        expect(s.buffs.red.atk).toBeCloseTo(1.25, 5);
        expect(s.buffs.blue.atk).toBe(1); // AI 方不受玩家卡牌影响
        expect(s.phase).toBe('playing');
    });

    it('效果：果皮护盾 全体 +150 护盾', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [
            makeUnit({ side: 'red', id: 'r1' }),
            makeUnit({ side: 'blue', id: 'b1', x: 900 }),
        ];
        forceChooseCard(engine, findCard('fruit', 'shield'));
        expect(s.units.find(u => u.id === 'r1')!.shield).toBe(150);
        expect(s.units.find(u => u.id === 'b1')!.shield).toBe(0);
    });

    it('效果：热带风暴 全场敌方 -200', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [makeUnit({ side: 'blue', id: 'b1', hp: 500, maxHp: 500, x: 900 })];
        forceChooseCard(engine, findCard('fruit', 'tropical'));
        expect(s.units[0].hp).toBeCloseTo(300, 5);
    });

    it('效果：阳光爆发 攻速翻倍 10 秒后消失', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('fruit', 'sunburst'));
        expect(s.tempBuffs.length).toBe(1);
        expect(s.tempBuffs[0].mult).toBe(2);
        runSeconds(engine, 10.1);
        expect(s.tempBuffs.length).toBe(0);
    });

    it('效果：战嚎 攻击 +50% 临时；兽群奔腾 速度 +50% 临时', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('animal', 'howl'));
        expect(s.tempBuffs.some(t => t.type === 'atkMult' && t.mult === 1.5)).toBe(true);
        forceChooseCard(engine, findCard('animal', 'stampede'));
        expect(s.tempBuffs.some(t => t.type === 'speedMult' && t.mult === 1.5)).toBe(true);
    });

    it('效果：荆棘之甲 反弹 20% 伤害给攻击者', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        forceChooseCard(engine, findCard('wood', 'thorn'));
        // 蓝方单位打红方单位：蓝方应受反伤
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 0, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, atk: 100, range: 55, speed: 0 }),
        ];
        engine.step(1 / 60);
        // 蓝方攻击 100（tank vs tank ×1.0），红方受 100；蓝方反伤 100×0.2 = 20
        expect(s.units.find(u => u.id === 'r1')!.hp).toBeCloseTo(400, 5);
        expect(s.units.find(u => u.id === 'b1')!.hp).toBeCloseTo(480, 5);
    });

    it('效果：狼群战术 每个友军 +5% 攻击', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        forceChooseCard(engine, findCard('animal', 'pack'));
        s.units = [
            makeUnit({ side: 'red', id: 'r1', x: 900 }), // 不参战，只计人数
            makeUnit({ side: 'red', id: 'r2', type: 'tank', x: 0, y: 0, atk: 100, range: 55, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60);
        // 2 个友军 → 100 × (1 + 0.05×2) = 110
        expect(s.units.find(u => u.id === 'b1')!.hp).toBeCloseTo(390, 5);
    });

    it('效果：利爪撕裂 攻击附带流血（3 秒 20% 伤害）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        forceChooseCard(engine, findCard('animal', 'claw'));
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 0, y: 0, atk: 100, range: 55, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, atk: 0, range: 10, speed: 0 }),
        ];
        engine.step(1 / 60); // 命中 100，附带流血 dps = 20
        expect(s.units.find(u => u.id === 'b1')!.bleedDps).toBeCloseTo(20, 5);
        const hpAfterHit = s.units.find(u => u.id === 'b1')!.hp;
        // 拉长攻击者冷却，避免第二击干扰流血观察
        s.units.find(u => u.id === 'r1')!.atkCd = 99;
        engine.step(1); // 仅流血 1 秒 → -20
        expect(s.units.find(u => u.id === 'b1')!.hp).toBeCloseTo(hpAfterHit - 20, 5);
    });

    it('效果：适者生存 阵亡时对周围敌人造成 150 伤害', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        forceChooseCard(engine, findCard('animal', 'survival'));
        s.units = [
            makeUnit({ side: 'red', id: 'r1', type: 'tank', x: 0, y: 0, hp: 10, maxHp: 10, atk: 0, range: 10, speed: 0 }),
            makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: 30, y: 0, hp: 500, maxHp: 500, atk: 999, range: 55, speed: 0 }),
        ];
        engine.step(1 / 60); // 红方被击杀 → 死亡爆炸
        // 蓝方 500 血 - 999 击杀红方（无伤害反馈）→ 但红方死亡爆炸对 80px 内蓝方 -150
        expect(s.units.length).toBe(1);
        expect(s.units[0].hp).toBeCloseTo(350, 5);
    });

    it('效果：光合再生 持续回血（每秒 3% 最大血量，持续 10 秒）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        forceChooseCard(engine, findCard('fruit', 'regen'));
        s.units = [makeUnit({ side: 'red', id: 'r1', x: 900, hp: 100, maxHp: 1000 })];
        engine.step(1); // 回 1000×3%×1 = 30
        expect(s.units[0].hp).toBeCloseTo(130, 5);
    });

    it('效果：果雨纷飞 每 5 秒对随机敌人 100 伤害', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        forceChooseCard(engine, findCard('fruit', 'rain'));
        s.units = [makeUnit({ side: 'blue', id: 'b1', x: 900, hp: 500, maxHp: 500 })];
        engine.step(5.1); // 首次 tick 在 5 秒
        expect(s.units[0].hp).toBeCloseTo(400, 5);
    });

    it('效果：万木缠缚 敌方定身 3 秒', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [makeUnit({ side: 'blue', id: 'b1', x: 900 })];
        forceChooseCard(engine, findCard('wood', 'vine'));
        expect(s.units[0].stunDur).toBe(3);
    });

    it('效果：百花绽放 召唤 3 个高护甲树人', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [];
        forceChooseCard(engine, findCard('wood', 'bloom'));
        expect(s.units.filter(u => u.side === 'red').length).toBe(3);
        expect(s.units[0].hp).toBe(400);
        expect(s.units[0].shield).toBe(200);
        expect(s.units[0].atk).toBe(20);
    });

    it('效果：森林守护 水晶回血 500（不超上限）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.crystals.find(c => c.side === 'red')!.hp = 1000;
        forceChooseCard(engine, findCard('wood', 'forest'));
        expect(s.crystals.find(c => c.side === 'red')!.hp).toBe(1500);
    });

    it('效果：自然生长 出兵速度 +30%（只影响己方工厂间隔）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.buildings.push({ id: 'f-red', side: 'red', unitType: 'tank', x: -400, y: -50, hp: 800, maxHp: 800, waveTimer: 99, level: 1 });
        s.buildings.push({ id: 'f-blue', side: 'blue', unitType: 'tank', x: 400, y: -50, hp: 800, maxHp: 800, waveTimer: 99, level: 1 });
        forceChooseCard(engine, findCard('wood', 'growth'));
        s.buildings.forEach(b => { b.waveTimer = 0.001; });
        engine.step(0.002);
        // 红方（fruit）工厂：15 × 0.7 = 10.5；蓝方（wood）工厂不受影响：20
        expect(s.buildings.find(b => b.id === 'f-red')!.waveTimer).toBeCloseTo(10.5, 5);
        expect(s.buildings.find(b => b.id === 'f-blue')!.waveTimer).toBeCloseTo(20, 5);
    });
});

/** 卡牌测试专用：清空战场并冻结 AI（避免同帧干扰） */
function clearBattlefieldForCards(s: ReturnType<typeof writableState>) {
    s.units = [];
    s.buildings = [];
    s.towers = [];
    s.gold.blue = 0;
}

describe('卡牌效果补全（v1.6.3 覆盖剩余 11 张）', () => {
    it('效果：鲜榨回复 全体治疗 30% 血量', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [makeUnit({ side: 'red', id: 'r1', hp: 100, maxHp: 1000 })];
        forceChooseCard(engine, findCard('fruit', 'heal'));
        expect(s.units[0].hp).toBeCloseTo(400, 5); // 100 + 300
    });

    it('效果：果弹飞溅 攻击附带 60% 溅射', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('fruit', 'splash'));
        expect(s.buffs.red.splashMult).toBeCloseTo(1.6, 5);
    });

    it('效果：果族狂怒 攻击+35% 攻速+20% 永久', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('fruit', 'fruitRage'));
        expect(s.buffs.red.atk).toBeCloseTo(1.35, 5);
        expect(s.buffs.red.attackSpeed).toBeCloseTo(1.2, 5);
    });

    it('效果：根系网络 敌人减速 40% 持续 8 秒', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [makeUnit({ side: 'blue', id: 'b1', x: 900 })];
        forceChooseCard(engine, findCard('wood', 'rootNet'));
        expect(s.units[0].slowMult).toBeCloseTo(0.6, 5);
        expect(s.units[0].slowDur).toBe(8);
    });

    it('效果：生命之树 全体血量 +30% 永久（作用于新出单位）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('wood', 'hpUp'));
        expect(s.buffs.red.hp).toBeCloseTo(1.3, 5);
    });

    it('效果：孢子爆发 全场敌方 -150', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        s.units = [makeUnit({ side: 'blue', id: 'b1', hp: 500, maxHp: 500, x: 900 })];
        forceChooseCard(engine, findCard('wood', 'spore'));
        expect(s.units[0].hp).toBe(350);
    });

    it('效果：树皮铠甲 全体减伤 20% 永久', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('wood', 'bark'));
        expect(s.buffs.red.damageReduce).toBeCloseTo(0.8, 5);
    });

    it('效果：致命一击 全体暴击率 +30%', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('animal', 'crit'));
        expect(s.buffs.red.crit).toBeCloseTo(0.3, 5);
    });

    it('效果：嗜血狂潮 击杀回血 20%', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('animal', 'bloodlust'));
        expect(s.buffs.red.lifeOnKill).toBeCloseTo(0.2, 5);
    });

    it('效果：狂暴本能 攻击+40% 攻速+30% 永久', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('animal', 'frenzy'));
        expect(s.buffs.red.atk).toBeCloseTo(1.4, 5);
        expect(s.buffs.red.attackSpeed).toBeCloseTo(1.3, 5);
    });

    it('效果：捕食者 对低血量敌人伤害 +100%', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        forceChooseCard(engine, findCard('animal', 'predator'));
        expect(s.buffs.red.execute).toBe(true);
    });

    it('跨波次去重：抽过的卡不再出现在备选', async () => {
        const { triggerCardChoiceIfDue } = await import('../assets/scripts/core/systems/card-system');
        const engine = makeEngine();
        engine.reset({ playerFaction: 'wood' });
        const s = writableState(engine);
        const used = CARD_CONFIG.wood.slice(0, 7).map(c => c.id); // 已用 7 张
        s.cards.usedCardIds = used;
        s.wave = 10;
        s.cards.triggeredWaves[10] = false;
        const triggered = triggerCardChoiceIfDue(s, engine.random);
        expect(triggered).toBe(true);
        // 卡池 9 张，已用 7 张 → 只剩 2 张可抽
        expect(s.cards.offers.length).toBe(2);
        for (const c of s.cards.offers) {
            expect(used).not.toContain(c.id);
        }
    });
});
