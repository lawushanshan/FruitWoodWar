/**
 * 卡牌系统测试：触发暂停、抽牌、选卡效果（M3 全效果版）
 */

import { describe, expect, it } from 'vitest';
import { CARD_CONFIG, NEUTRAL_CARDS } from '../assets/scripts/config/card-config';
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

/** 中立卡查找（中立池不属于任何阵营） */
function findNeutral(id: string): CardConfig {
    return NEUTRAL_CARDS.find(c => c.id === id)!;
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

    it('debugTriggerCardChoice：QA 调试入口走真实抽牌与暂停路径', () => {
        const engine = makeEngine();
        // 开局（第 1 波，非触发波次）直接调试触发
        expect(engine.debugTriggerCardChoice()).toBe(true);
        expect(engine.state.phase).toBe('card-pause');
        expect(engine.state.cards.offers.length).toBe(3);
        // 有待选卡牌时不可重复触发；选卡后恢复 playing 可再次触发
        expect(engine.debugTriggerCardChoice()).toBe(false);
        const pick = engine.state.cards.offers[0].id;
        expect(engine.execute({ type: 'choose-card', cardId: pick }).ok).toBe(true);
        expect(engine.state.phase).toBe('playing');
        expect(engine.debugTriggerCardChoice()).toBe(true);
        expect(engine.state.cards.offers.length).toBe(3);
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

    it('效果：百花绽放 召唤 3 个二级树人', () => {
        const engine = makeEngine();
        engine.reset({ playerFaction: 'wood' });
        const s = writableState(engine);
        s.units = [];
        forceChooseCard(engine, findCard('wood', 'bloom'));
        expect(s.units.filter(u => u.side === 'red').length).toBe(3);
        // 二级树人：与工厂 Lv2 精英坦克同源公式（400 × 1.10 木系血量修正 × 1.5 精英倍率 = 660）
        expect(s.units[0].type).toBe('tank');
        expect(s.units[0].level).toBe(2);
        expect(s.units[0].hp).toBeCloseTo(660);
        expect(s.units[0].maxHp).toBeCloseTo(660);
        expect(s.units[0].atk).toBeCloseTo(22.5);
        expect(s.units[0].shield).toBe(200);
        expect(s.units[0].firstStrikeDone).toBe(true);
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

    it('跨波次去重：展示过的卡不再出现在备选', async () => {
        const { triggerCardChoiceIfDue } = await import('../assets/scripts/core/systems/card-system');
        const engine = makeEngine();
        engine.reset({ playerFaction: 'wood' });
        const s = writableState(engine);
        // 已展示弃置 7 张 wood 卡 + 3 张中立稀有卡（排掉混池随机性，保证断言确定性：
        // 中立池空时该轮 offers 只能来自 wood 阵营池剩余的 2 张稀有卡）
        const used = [...CARD_CONFIG.wood.slice(0, 7).map(c => c.id), 'bloodPawn', 'fullAlert', 'muster'];
        s.cards.usedCardIds = used;
        s.wave = 10;
        s.cards.triggeredWaves[10] = false;
        const triggered = triggerCardChoiceIfDue(s, engine.random);
        expect(triggered).toBe(true);
        // 第 1 轮抽稀有卡：wood 共 5 张 rare（含新增经济卡），其中 3 张已弃置 → 剩 2 张可抽
        expect(s.cards.offers.length).toBe(2);
        // 注意：used 与 state.cards.usedCardIds 同引用（展示即弃会向其追加），断言用快照
        for (const c of s.cards.offers) {
            expect(CARD_CONFIG.wood.slice(0, 7).map(x => x.id)).not.toContain(c.id);
        }
    });

    it('稀有度轮换：三轮依次全稀有、全史诗、全传说', async () => {
        const { triggerCardChoiceIfDue } = await import('../assets/scripts/core/systems/card-system');
        const engine = makeEngine();
        engine.reset({ playerFaction: 'fruit' });
        const s = writableState(engine);
        s.crystals.forEach(c => { c.hp = 1e9; c.maxHp = 1e9; });
        const expectRarity = (rarity: string) => {
            expect(s.cards.offers.length).toBeGreaterThan(0);
            for (const c of s.cards.offers) expect(c.rarity).toBe(rarity);
        };
        // 第 1 轮（第 5 波）：全稀有
        s.wave = 5; s.cards.triggeredWaves[5] = false;
        expect(triggerCardChoiceIfDue(s, engine.random)).toBe(true);
        expectRarity('rare');
        engine.execute({ type: 'choose-card', cardId: s.cards.offers[0].id });
        // 第 2 轮（第 10 波）：全史诗
        s.wave = 10; s.cards.triggeredWaves[10] = false;
        expect(triggerCardChoiceIfDue(s, engine.random)).toBe(true);
        expectRarity('epic');
        engine.execute({ type: 'choose-card', cardId: s.cards.offers[0].id });
        // 第 3 轮（第 15 波）：全传说（legendary 仅 3 张，可能不足 3 张展示）
        s.wave = 15; s.cards.triggeredWaves[15] = false;
        expect(triggerCardChoiceIfDue(s, engine.random)).toBe(true);
        expectRarity('legendary');
    });

    it('展示即弃：未被选中的卡在后续轮次不再出现', async () => {
        const { triggerCardChoiceIfDue } = await import('../assets/scripts/core/systems/card-system');
        const engine = makeEngine();
        engine.reset({ playerFaction: 'fruit' });
        const s = writableState(engine);
        s.crystals.forEach(c => { c.hp = 1e9; c.maxHp = 1e9; });
        // 第 1 轮：记录展示的全部卡后只选 1 张
        s.wave = 5; s.cards.triggeredWaves[5] = false;
        expect(triggerCardChoiceIfDue(s, engine.random)).toBe(true);
        const shown = s.cards.offers.map(c => c.id);
        expect(shown.length).toBe(3);
        engine.execute({ type: 'choose-card', cardId: shown[0] });
        // 第 2 轮：3 张展示过的卡（含未选中的 2 张）均不得再出现
        s.wave = 10; s.cards.triggeredWaves[10] = false;
        expect(triggerCardChoiceIfDue(s, engine.random)).toBe(true);
        for (const c of s.cards.offers) {
            expect(shown).not.toContain(c.id);
        }
    });

    it('本局卡牌记录：chosenCardIds 只含选中的卡，不含展示未选的卡', async () => {
        const { triggerCardChoiceIfDue } = await import('../assets/scripts/core/systems/card-system');
        const engine = makeEngine();
        engine.reset({ playerFaction: 'fruit' });
        const s = writableState(engine);
        s.crystals.forEach(c => { c.hp = 1e9; c.maxHp = 1e9; });
        // 第 1 轮：展示 3 张只选 1 张
        s.wave = 5; s.cards.triggeredWaves[5] = false;
        expect(triggerCardChoiceIfDue(s, engine.random)).toBe(true);
        const shown = s.cards.offers.map(c => c.id);
        engine.execute({ type: 'choose-card', cardId: shown[0] });
        // usedCardIds 收录全部展示的卡；chosenCardIds 只有选中的那张
        expect(s.cards.usedCardIds.length).toBe(3);
        expect(s.cards.chosenCardIds).toEqual([shown[0]]);
        // 第 2 轮再选 1 张：chosenCardIds 按选择顺序累积
        s.wave = 10; s.cards.triggeredWaves[10] = false;
        expect(triggerCardChoiceIfDue(s, engine.random)).toBe(true);
        const secondPick = s.cards.offers[0].id;
        engine.execute({ type: 'choose-card', cardId: secondPick });
        expect(s.cards.chosenCardIds).toEqual([shown[0], secondPick]);
    });

    // ================= 新增三类卡牌（经济 / 召唤 / 同归于尽）：三阵营同模板平衡 =================

    it.each([
        ['fruit', 'harvest'],
        ['wood', 'acorn'],
        ['animal', 'hoard'],
    ] as const)('经济类（%s/%s）：+200 金，击杀赏金 +30%% 永久', (faction, id) => {
        const engine = makeEngine();
        engine.reset({ playerFaction: faction });
        const s = writableState(engine);
        const goldBefore = s.gold.red;
        forceChooseCard(engine, findCard(faction, id));
        expect(s.gold.red).toBe(goldBefore + 200);
        expect(s.buffs.red.bountyMult).toBeCloseTo(1.3, 5);
    });

    it.each([
        ['fruit', 'swarm', 'ranged'],
        ['wood', 'vineGuard', 'tank'],
        ['animal', 'boarRush', 'rush'],
    ] as const)('召唤类（%s/%s）：召唤 4 个一级兵（%s）', (faction, id, unitType) => {
        const engine = makeEngine();
        engine.reset({ playerFaction: faction });
        const s = writableState(engine);
        const before = s.units.length;
        forceChooseCard(engine, findCard(faction, id));
        const added = s.units.slice(before);
        expect(added.length).toBe(4);
        for (const u of added) {
            expect(u.type).toBe(unitType);
            expect(u.level).toBe(1);
            expect(u.side).toBe('red');
        }
    });

    it.each([
        ['fruit', 'coreBlast'],
        ['wood', 'forestWail'],
        ['animal', 'lastRoar'],
    ] as const)('同归于尽（%s/%s）：己方全灭，全场敌人按己方单位数×100 扣血', (faction, id) => {
        const engine = makeEngine();
        engine.reset({ playerFaction: faction });
        const s = writableState(engine);
        s.units = [];
        // 造 3 个己方 + 2 个敌方（字段对齐 spawn-system.makeUnit）
        for (let i = 0; i < 3; i++) {
            s.units.push({ id: 'mine' + i, side: 'red', type: 'tank', level: 1, x: -300 + i * 20, y: 0, hp: 400, maxHp: 400, atk: 15, speed: 50, range: 50, atkSpeed: 1, atkCd: 0, firstStrikeDone: true, shield: 0, stunDur: 0, slowMult: 1, slowDur: 0, bleedDps: 0, bleedDur: 0 });
        }
        for (let i = 0; i < 2; i++) {
            s.units.push({ id: 'foe' + i, side: 'blue', type: 'ranged', level: 1, x: 300 + i * 20, y: 0, hp: 150, maxHp: 150, atk: 25, speed: 50, range: 200, atkSpeed: 1, atkCd: 0, firstStrikeDone: true, shield: 0, stunDur: 0, slowMult: 1, slowDur: 0, bleedDps: 0, bleedDur: 0 });
        }
        forceChooseCard(engine, findCard(faction, id));
        // 己方 3 个全部阵亡，敌方各扣 3×100=300（150 血已死透为负值）
        for (const u of s.units.filter(u => u.side === 'red')) {
            expect(u.hp).toBe(0);
        }
        for (const u of s.units.filter(u => u.side === 'blue')) {
            expect(u.hp).toBe(150 - 300);
        }
    });
});

// ==================== 中立卡池（v1.8：双刃剑与干扰卡，01-总纲 §10.7） ====================

describe('中立卡池', () => {
    it('配置：6 张中立卡齐全，稀有度分布为稀有×3 + 史诗×3', () => {
        expect(NEUTRAL_CARDS.length).toBe(6);
        expect(NEUTRAL_CARDS.filter(c => c.rarity === 'rare').length).toBe(3);
        expect(NEUTRAL_CARDS.filter(c => c.rarity === 'epic').length).toBe(3);
        // 中立卡 id 不得与阵营卡冲突（drawOffers 依赖 id 全局唯一去重）
        const factionIds = new Set(Object.values(CARD_CONFIG).flat().map(c => c.id));
        for (const c of NEUTRAL_CARDS) {
            expect(factionIds.has(c.id)).toBe(false);
        }
    });

    it('血量典当：+260 金，水晶当前血量 -12%', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        s.gold.red = 100;
        s.crystals.find(c => c.side === 'red')!.hp = 4000;
        forceChooseCard(engine, findNeutral('bloodPawn'));
        expect(s.gold.red).toBe(360);
        expect(s.crystals.find(c => c.side === 'red')!.hp).toBeCloseTo(3520, 5); // 4000 × 0.88
    });

    it('血量典当：低血量保底不低于最大血量 5%（禁止选卡瞬间自杀）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        s.crystals.find(c => c.side === 'red')!.hp = 100;
        forceChooseCard(engine, findNeutral('bloodPawn'));
        // 100 × 0.88 = 88 < 200（5% 保底）→ 取保底 200
        expect(s.crystals.find(c => c.side === 'red')!.hp).toBeCloseTo(200, 5);
    });

    it('战争债券：+150 金并挂 60 秒债务；到期金币足够则直接扣款', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        // 冻结工资与卡牌触发，隔离 60 秒推进期间的干扰
        s.disableCards = true;
        s.salaryTimer.red = 9999;
        s.salaryTimer.blue = 9999;
        s.gold.red = 50;
        forceChooseCard(engine, findNeutral('warBond'));
        expect(s.gold.red).toBe(200);
        expect(s.tempBuffs.some(tb => tb.type === 'debt' && tb.damage === 250 && tb.dur === 60)).toBe(true);
        s.gold.red = 400;
        runSeconds(engine, 60.2);
        expect(s.tempBuffs.some(tb => tb.type === 'debt')).toBe(false);
        expect(s.gold.red).toBe(400 - 250);
    });

    it('战争债券：到期金币不足时差额以水晶血量抵债（每差 10 金 = 1% 最大血量）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        s.disableCards = true;
        s.salaryTimer.red = 9999;
        s.salaryTimer.blue = 9999;
        forceChooseCard(engine, findNeutral('warBond'));
        s.gold.red = 100; // 差 150 金 → 水晶 -15% × 4000 = 600
        runSeconds(engine, 60.2);
        expect(s.gold.red).toBe(0);
        expect(s.crystals.find(c => c.side === 'red')!.hp).toBeCloseTo(3400, 5);
    });

    it('工厂瘫痪：随机 1 座敌方工厂停业 10 秒，学院不受影响', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        const timeBefore = s.time;
        s.buildings.push(
            { id: 'f-blue-1', side: 'blue', unitType: 'tank', x: 400, y: -50, hp: 800, maxHp: 800, waveTimer: 99, level: 1 },
            { id: 'f-blue-2', side: 'blue', unitType: 'ranged', x: 420, y: 50, hp: 800, maxHp: 800, waveTimer: 99, level: 1 },
            { id: 'a-blue', side: 'blue', unitType: null, x: 440, y: -150, hp: 800, maxHp: 800, waveTimer: 99, level: 1, kind: 'academy' },
        );
        forceChooseCard(engine, findNeutral('sabotage'));
        const disabled = s.buildings.filter(b => b.disabledUntil !== undefined);
        expect(disabled.length).toBe(1); // 恰好 1 座
        expect(disabled[0].side).toBe('blue');
        expect(disabled[0].kind ?? 'factory').toBe('factory'); // 学院不可被瘫痪
        expect(disabled[0].disabledUntil).toBeCloseTo(timeBefore + 10, 5);
    });

    it('工厂瘫痪：停业期间出兵倒计时冻结，到期自动恢复', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        const factory = { id: 'f-blue-1', side: 'blue', unitType: 'tank', x: 400, y: -50, hp: 800, maxHp: 800, waveTimer: 0.001, level: 1 } as const;
        s.buildings.push({ ...factory });
        // 红方选卡瘫痪蓝方工厂
        forceChooseCard(engine, findNeutral('sabotage'));
        expect(s.units.length).toBe(0); // 停业中：倒计时冻结，不出兵
        expect(s.buildings[0].waveTimer).toBeCloseTo(0.001, 6);
        // 到期（人为把停业时间拨回过去）→ 倒计时恢复推进并正常出兵
        s.buildings[0].disabledUntil = s.time - 0.001;
        engine.step(0.01);
        engine.step(0.01);
        // 停业解除后 0.001 的倒计时立刻走完 → 出兵并把倒计时重置为阵营间隔（wood 20s）
        expect(s.units.filter(u => u.side === 'blue').length).toBeGreaterThan(0);
        expect(s.buildings[0].waveTimer).toBeGreaterThan(1);
    });

    it('全线戒备：水晶受伤 -40%（结算验证：同一攻击 75 → 45）', () => {
        // 无 buff 基准：非攻城打水晶 ×0.75 → 100 攻击造成 75 伤害
        const base = makeEngine();
        {
            const s = writableState(base);
            clearBattlefieldForCards(s);
            s.towers = []; // 拆掉红方基地塔，水晶才可被攻击
            s.units = [makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: -444, y: 0, atk: 100, range: 55, speed: 0, atkSpeed: 1, atkCd: 0 })];
            base.step(1 / 60);
            expect(s.crystals.find(c => c.side === 'red')!.hp).toBeCloseTo(4000 - 75, 5);
        }
        // 有 buff：75 × 0.6 = 45
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        s.towers = [];
        forceChooseCard(engine, findNeutral('fullAlert'));
        expect(s.tempBuffs.some(tb => tb.type === 'crystalDamageReduce' && tb.side === 'red' && tb.mult === 0.6)).toBe(true);
        s.units = [makeUnit({ side: 'blue', id: 'b1', type: 'tank', x: -444, y: 0, atk: 100, range: 55, speed: 0, atkSpeed: 1, atkCd: 0 })];
        engine.step(1 / 60);
        expect(s.crystals.find(c => c.side === 'red')!.hp).toBeCloseTo(4000 - 45, 5);
    });

    it('紧急征兵：立即召唤 2 个随机兵种的一级兵（位置经注入随机源）', () => {
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        s.units = [];
        forceChooseCard(engine, findNeutral('muster'));
        expect(s.units.length).toBe(2);
        for (const u of s.units) {
            expect(u.side).toBe('red');
            expect(u.level).toBe(1);
            expect(['tank', 'ranged', 'aoe', 'rush', 'siege']).toContain(u.type);
        }
    });

    it('士气打击：敌方全体攻击 -25% 持续 5 秒（按敌方边结算，到期消失）', async () => {
        const { effectiveAtkMult } = await import('../assets/scripts/core/systems/combat-system');
        const engine = makeEngine();
        const s = writableState(engine);
        clearBattlefieldForCards(s);
        s.disableCards = true;
        forceChooseCard(engine, findNeutral('demoralize'));
        expect(s.tempBuffs.some(tb => tb.type === 'atkMult' && tb.side === 'blue' && tb.mult === 0.75)).toBe(true);
        expect(effectiveAtkMult(s, 'blue')).toBeCloseTo(0.75, 5); // 敌方攻击被压
        expect(effectiveAtkMult(s, 'red')).toBeCloseTo(1, 5);    // 己方不受影响
        runSeconds(engine, 5.1);
        expect(s.tempBuffs.some(tb => tb.type === 'atkMult' && tb.side === 'blue')).toBe(false);
        expect(effectiveAtkMult(s, 'blue')).toBeCloseTo(1, 5);
    });
});

describe('中立卡池混入与解锁过滤', () => {
    it('混入：阵营稀有卡耗尽时，三选一全部来自中立池（对称回退）', async () => {
        const { drawOffers } = await import('../assets/scripts/core/systems/card-system');
        const engine = makeEngine();
        const s = writableState(engine);
        // fruit 全部 5 张稀有卡标记为已展示 → 阵营池空，只能出中立稀有 3 张
        s.cards.usedCardIds = CARD_CONFIG.fruit.filter(c => c.rarity === 'rare').map(c => c.id);
        drawOffers(s, engine.random);
        expect(s.cards.offers.length).toBe(3);
        const neutralRareIds = NEUTRAL_CARDS.filter(c => c.rarity === 'rare').map(c => c.id);
        for (const c of s.cards.offers) {
            expect(neutralRareIds).toContain(c.id);
        }
    });

    it('混入：传说轮中立池为空（v1 中立只做稀有/史诗），offers 全为阵营传说卡', async () => {
        const { triggerCardChoiceIfDue } = await import('../assets/scripts/core/systems/card-system');
        const engine = makeEngine();
        const s = writableState(engine);
        s.wave = 5;
        s.cards.drawCount = 2; // 第 3 轮 → 传说
        expect(triggerCardChoiceIfDue(s, engine.random)).toBe(true);
        for (const c of s.cards.offers) {
            expect(c.rarity).toBe('legendary');
            expect(NEUTRAL_CARDS.some(n => n.id === c.id)).toBe(false);
        }
    });

    it('确定性：同种子同状态两次抽卡结果完全一致（联机双端一致前提）', () => {
        const a = makeEngine(42);
        const b = makeEngine(42);
        a.debugTriggerCardChoice();
        b.debugTriggerCardChoice();
        expect(a.state.cards.offers.map(c => c.id)).toEqual(b.state.cards.offers.map(c => c.id));
        // 再抽一轮（史诗）仍然一致
        a.execute({ type: 'choose-card', cardId: a.state.cards.offers[0].id });
        b.execute({ type: 'choose-card', cardId: b.state.cards.offers[0].id });
        a.debugTriggerCardChoice();
        b.debugTriggerCardChoice();
        expect(a.state.cards.offers.map(c => c.id)).toEqual(b.state.cards.offers.map(c => c.id));
    });

    it('解锁过滤：cardUnlocks 非 null 时锁定卡不进池，null 时全量', async () => {
        const { drawOffers } = await import('../assets/scripts/core/systems/card-system');
        const engine = makeEngine();
        const s = writableState(engine);
        // 只解锁 4 张 fruit 稀有基础卡：harvest（锁定）与全部中立卡不得出现
        s.cardUnlocks = ['heal', 'splash', 'shield', 'forest'];
        drawOffers(s, engine.random);
        expect(s.cards.offers.length).toBe(3);
        for (const c of s.cards.offers) {
            expect(c.id).not.toBe('harvest');
            expect(NEUTRAL_CARDS.some(n => n.id === c.id)).toBe(false);
        }
        // null = 不过滤（联机口径）：harvest 可出现（多次抽样验证可达性）
        s.cardUnlocks = null;
        s.cards.usedCardIds = [];
        s.cards.drawCount = 0;
        let seenHarvest = false;
        for (let i = 0; i < 40 && !seenHarvest; i++) {
            drawOffers(s, engine.random);
            seenHarvest = s.cards.offers.some(c => c.id === 'harvest') || seenHarvest;
        }
        expect(seenHarvest).toBe(true);
    });
});
