/**
 * 卡牌系统（M3：27 张卡牌效果全部实装，增益只作用于玩家方）
 *
 * 触发：第 5/10/15 波暂停，从玩家阵营卡池抽 3 选 1（每轮同一稀有度：稀有→史诗→传说，
 * 展示过的卡无论是否被选均永久移出卡池）。
 * 效果类型：永久增益 / 即时效果 / 召唤 / 临时 buff（攻速、攻击、速度、回血）/ 周期效果（果雨）
 * / 被动触发（反伤、狼群、流血、死亡爆炸、处决、击杀回血）。
 */

import { CARD_CONFIG } from '../../config/card-config';
import { FACTION_CONFIG } from '../../config/faction-config';
import { GAME_CONFIG } from '../../config/game-config';
import { makeUnit } from './spawn-system';
import type { CardConfig, CardRarity, CommandResult, GameState, TempBuff } from '../types';
import type { RandomSource } from '../random';

/** 果雨周期（秒） */
const RAIN_INTERVAL = 5;
/** 果雨单次伤害 */
const RAIN_DAMAGE = 100;
/** 果雨持续到对局结束（用大数表示"永久"） */
const RAIN_DURATION = 9999;

/**
 * 每轮抽卡的稀有度轮换表（按触发顺序）：
 * 第 1 轮（第 5 波）全稀有、第 2 轮（第 10 波）全史诗、第 3 轮（第 15 波）全传说。
 */
const ROUND_RARITY: readonly CardRarity[] = ['rare', 'epic', 'legendary'] as const;

/** 若当前波次命中卡牌触发点则进入暂停并抽 3 张卡；返回是否触发 */
export function triggerCardChoiceIfDue(state: GameState, random: RandomSource): boolean {
    if (state.disableCards) return false;
    const wave = state.wave;
    if (GAME_CONFIG.cardTriggerWaves.includes(wave) && !state.cards.triggeredWaves[wave]) {
        state.cards.triggeredWaves[wave] = true;
        drawOffers(state, random);
        state.phase = 'card-pause';
        return true;
    }
    return false;
}

/**
 * 从卡池中不重复抽取 3 张（当前轮全部为同一稀有度，展示过的卡永久移出卡池）。
 * 稀有度按轮次递进：第 1 轮全稀有 → 第 2 轮全史诗 → 第 3 轮全传说（超出后循环）；
 * 轮次由 drawCount 显式计数，正常触发与 QA 调试触发（debugTriggerCardChoice）口径一致。
 * 单机：玩家自己阵营的卡池（保留阵营风味）。
 * 联机一致性（aiEnabled=false）：卡池 = 双方阵营卡池的并集（排序去重），
 * 保证双端 offers 完全相同——否则红蓝引擎各按自己阵营抽卡，
 * 选卡命令无法在对端 offers 中命中（chooseCard 查 offers 会失败）。
 * 展示即弃：本轮展示的 3 张（无论是否被选）全部登记进 usedCardIds，
 * 后续轮次不再出现。导出供引擎 debugTriggerCardChoice（QA 调试参数 ?fww_card）复用。
 */
export function drawOffers(state: GameState, random: RandomSource): void {
    const mine = CARD_CONFIG[state.factions[state.playerSide]] ?? [];
    let candidates = mine;
    if (!state.aiEnabled) {
        const theirs = CARD_CONFIG[state.factions[state.playerSide === 'red' ? 'blue' : 'red']] ?? [];
        candidates = [...mine, ...theirs];
    }
    // 当前轮次对应的稀有度（drawCount 显式计数，超出表长时循环取模）
    const roundIndex = state.cards.drawCount % ROUND_RARITY.length;
    const rarity = ROUND_RARITY[roundIndex];
    const seen = new Set<string>();
    const pool = candidates
        .filter(c => {
            // 去重：同阵营重复 id 跳过；展示过/选过的卡永久移出卡池；只保留当前轮稀有度
            if (seen.has(c.id) || state.cards.usedCardIds.includes(c.id)) return false;
            if (c.rarity !== rarity) return false;
            seen.add(c.id);
            return true;
        })
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    const offers: CardConfig[] = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
        offers.push(pool.splice(random.int(pool.length), 1)[0]);
    }
    // 展示即弃：本轮展示过的卡（含未被选中的）在后续游戏中不得再次出现
    for (const c of offers) {
        if (!state.cards.usedCardIds.includes(c.id)) {
            state.cards.usedCardIds.push(c.id);
        }
    }
    // 登记本轮抽卡完成，下一轮稀有度递进
    state.cards.drawCount += 1;
    state.cards.offers = offers;
}

/** 处理选卡命令：应用效果、登记已用卡并恢复对战 */
export function chooseCard(state: GameState, cardId: string, random: RandomSource, side: 'red' | 'blue' = state.playerSide): CommandResult {
    // 联机锁步：双方在各自引擎执行同一条 choose-card 命令，效果按选卡方的真实边结算
    const card = state.cards.offers.find(c => c.id === cardId);
    if (!card) {
        return { ok: false };
    }
    state.cards.offers = [];
    // 防重登记（drawOffers 已登记展示的卡；此处兜底覆盖直接构造 offers 的调试路径）
    if (!state.cards.usedCardIds.includes(card.id)) {
        state.cards.usedCardIds.push(card.id);
    }
    // 登记玩家实际选中的卡（"本局卡牌"面板与顶部图标行只展示选中的；联机只记玩家方）
    if (side === state.playerSide && !state.cards.chosenCardIds.includes(card.id)) {
        state.cards.chosenCardIds.push(card.id);
    }
    applyCardEffect(state, cardId, random, side);
    state.phase = 'playing';
    return { ok: true };
}

/** 构造临时 buff 的便捷方法 */
function tempBuff(side: TempBuff['side'], type: TempBuff['type'], mult: number, dur: number): TempBuff {
    return { side, type, mult, damage: 0, interval: 0, tickTimer: 0, dur };
}

/** 卡牌效果结算：作用于选卡方所在边（单机=玩家方；联机=选卡方的真实边）；spawnRandom 供召唤类效果取位置 */
function applyCardEffect(state: GameState, cardId: string, spawnRandom: RandomSource, side: 'red' | 'blue' = state.playerSide): void {
    const buff = state.buffs[side]; // 选卡方增益
    const myUnits = () => state.units.filter(u => u.side === side);
    const enemyUnits = () => state.units.filter(u => u.side !== side);

    switch (cardId) {
        // ================= 水果王国 =================
        case 'heal': // 全体治疗 30%
            myUnits().forEach(u => {
                u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3);
            });
            break;
        case 'atkUp': // 全体攻击 +25% 永久
            buff.atk *= 1.25;
            break;
        case 'splash': // 攻击附带 60% 溅射
            buff.splashMult *= 1.6;
            break;
        case 'sunburst': // 10 秒内攻速翻倍
            state.tempBuffs.push(tempBuff(side, 'attackSpeedMult', 2, 10));
            break;
        case 'tropical': // 全场敌方 -200
            enemyUnits().forEach(u => {
                u.hp -= 200;
            });
            break;
        case 'fruitRage': // 攻击 +35% 攻速 +20% 永久
            buff.atk *= 1.35;
            buff.attackSpeed *= 1.2;
            break;
        case 'shield': // 全体获得 150 护盾
            myUnits().forEach(u => {
                u.shield += 150;
            });
            break;
        case 'regen': // 10 秒内持续回血（每秒 3% 最大血量）
            state.tempBuffs.push(tempBuff(side, 'regen', 0.03, 10));
            break;
        case 'rain': // 每 5 秒对随机敌人造成 100 伤害（持续到对局结束）
            state.tempBuffs.push({ side, type: 'rain', mult: 0, damage: RAIN_DAMAGE, interval: RAIN_INTERVAL, tickTimer: RAIN_INTERVAL, dur: RAIN_DURATION });
            break;
        // ================= 绿木林 =================
        case 'rootNet': // 敌人减速 40% 持续 8 秒
            enemyUnits().forEach(u => {
                u.slowMult = 0.6;
                u.slowDur = 8;
            });
            break;
        case 'hpUp': // 全体血量 +30% 永久（作用于新出单位）
            buff.hp *= 1.3;
            break;
        case 'spore': // 全场敌方 -150（灰盒简化：无释放位置概念）
            enemyUnits().forEach(u => {
                u.hp -= 150;
            });
            break;
        case 'vine': // 敌人定身 3 秒
            enemyUnits().forEach(u => {
                u.stunDur = 3;
            });
            break;
        case 'bark': // 全体减伤 20% 永久
            buff.damageReduce *= 0.8;
            break;
        case 'bloom': { // 召唤 3 个二级树人（属性与工厂 Lv2 出兵同源公式；"二级"★ 标为卡片召唤专属）
            for (let i = 0; i < 3; i++) {
                // 复用 makeUnit：二级属性（×1.5）× 阵营修正 × 己方血量 buff 出兵烘焙，
                // 与兵工厂升级后的出兵属性同源，避免召唤单位数值与描述不符；
                // 工厂出兵等级标识恒 1 级，level=2（头顶 ★★）只有卡片召唤单位使用；
                // 位置经注入随机源（帧同步确定性；禁 Math.random），坐标基于 side 对称生成
                const treant = makeUnit(state, side, 'tank', 2,
                    (side === 'red' ? -1 : 1) * (300 + spawnRandom.range(0, 100)),
                    -50 + spawnRandom.range(-30, 30),
                    spawnRandom);
                treant.firstStrikeDone = true; // 树人不享受冲锋首击
                treant.shield = 200;           // 高护甲：召唤树人定位为前排肉盾
                state.units.push(treant);
            }
            break;
        }
        case 'thorn': // 受击反弹 20% 伤害
            buff.thorn = 0.2;
            break;
        case 'growth': // 出兵速度 +30% 永久（仅己方工厂）
            buff.waveIntervalMult *= 0.7;
            break;
        case 'forest': // 水晶回血 500
        {
            const rc = state.crystals.find(c => c.side === side);
            if (rc) rc.hp = Math.min(rc.maxHp, rc.hp + 500);
            break;
        }
        // ================= 动物庄园 =================
        case 'crit': // 全体暴击率 +30%
            buff.crit += 0.3;
            break;
        case 'bloodlust': // 击杀回血 20%
            buff.lifeOnKill = 0.2;
            break;
        case 'frenzy': // 攻击 +40% 攻速 +30% 永久
            buff.atk *= 1.4;
            buff.attackSpeed *= 1.3;
            break;
        case 'howl': // 10 秒内攻击 +50%
            state.tempBuffs.push(tempBuff(side, 'atkMult', 1.5, 10));
            break;
        case 'pack': // 每有一个友军攻击 +5%
            buff.packBonus = 0.05;
            break;
        case 'predator': // 对低血量敌人伤害 +100%
            buff.execute = true;
            break;
        case 'stampede': // 全体加速 50% 持续 10 秒
            state.tempBuffs.push(tempBuff(side, 'speedMult', 1.5, 10));
            break;
        case 'claw': // 攻击附带流血（3 秒内造成 20% 伤害）
            buff.bleed = 0.2;
            break;
        case 'survival': // 死亡时对周围敌人造成 150 伤害
            buff.deathExplode = 150;
            break;
        default:
            // 不应到达：所有卡牌已有专属分支
            buff.atk *= 1.1;
            break;
    }
}

/**
 * 推进临时 buff：回血 / 果雨周期效果生效，计时衰减。
 * 由引擎每帧调用。
 */
export function stepTempBuffs(state: GameState, dt: number, random: RandomSource): void {
    for (let i = state.tempBuffs.length - 1; i >= 0; i--) {
        const tb = state.tempBuffs[i];
        tb.dur -= dt;

        // 持续回血：每秒回复 mult 比例最大血量
        if (tb.type === 'regen') {
            for (const u of state.units) {
                if (u.side === tb.side && u.hp > 0) {
                    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * tb.mult * dt);
                }
            }
        }

        // 果雨：每 interval 秒对随机敌人造成 damage 伤害
        if (tb.type === 'rain') {
            tb.tickTimer -= dt;
            if (tb.tickTimer <= 0) {
                tb.tickTimer += tb.interval;
                const enemies = state.units.filter(u => u.side !== tb.side && u.hp > 0);
                if (enemies.length > 0) {
                    enemies[random.int(enemies.length)].hp -= tb.damage;
                }
            }
        }

        if (tb.dur <= 0) state.tempBuffs.splice(i, 1);
    }
}

/** 供表现层显示卡牌面板副标题：如"第 5 波 · 水果王国" */
export function getCardPanelSubtitle(state: GameState): string {
    return `第 ${state.wave} 波 · ${FACTION_CONFIG[state.factions[state.playerSide]].name}`;
}
