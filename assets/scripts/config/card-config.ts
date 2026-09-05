/**
 * 卡牌配置（M1 镜像旧灰盒数值；部分卡牌效果为简化版，M3 逐项对齐描述）
 *
 * v1.8：新增中立卡池（NEUTRAL_CARDS）——全阵营通用的机制卡（双刃剑/干扰/防御/补兵），
 * 不绑定阵营风味；抽卡时每个三选一槽位有概率从中立池混入（见 card-system.drawOffers）。
 */

import type { CardConfig, FactionId } from '../core/types';

export const CARD_CONFIG: Record<FactionId, CardConfig[]> = {
    fruit: [
        { id: 'heal', name: '鲜榨回复', icon: '🍹', desc: '全体治疗30%血量', rarity: 'rare' },
        { id: 'atkUp', name: '果香四溢', icon: '🌺', desc: '全体攻击+25%永久', rarity: 'epic' },
        { id: 'splash', name: '果弹飞溅', icon: '💥', desc: '攻击附带60%溅射', rarity: 'rare' },
        { id: 'sunburst', name: '阳光爆发', icon: '☀️', desc: '10秒内攻速翻倍', rarity: 'epic' },
        { id: 'tropical', name: '热带风暴', icon: '🌪️', desc: '对全场敌人造成200伤害', rarity: 'legendary' },
        { id: 'fruitRage', name: '果族狂怒', icon: '🔥', desc: '攻击+35%攻速+20%永久', rarity: 'legendary' },
        { id: 'shield', name: '果皮护盾', icon: '🛡️', desc: '全体获得150护盾', rarity: 'rare' },
        { id: 'regen', name: '光合再生', icon: '🌱', desc: '10秒内持续回血', rarity: 'epic' },
        { id: 'rain', name: '果雨纷飞', icon: '🌧️', desc: '每5秒对随机敌人造成100伤害', rarity: 'legendary' },
        // ==== 经济类（稀有）：三阵营同模板——+200金 / 击杀赏金+30%永久 ====
        { id: 'harvest', name: '丰收庆典', icon: '🍯', desc: '获得200金币，击杀赏金+30%永久', rarity: 'rare' },
        // ==== 召唤类（史诗）：三阵营同模板——召唤4个一级兵（兵种带阵营风味） ====
        { id: 'swarm', name: '蜂群出击', icon: '🐝', desc: '召唤4只一级远程兵', rarity: 'epic' },
        // ==== 特殊类（传说）：三阵营同模板——同归于尽 ====
        { id: 'coreBlast', name: '果核爆裂', icon: '💣', desc: '献祭全部己方单位，每个对全场敌人造成100伤害', rarity: 'legendary' },
    ],
    wood: [
        { id: 'rootNet', name: '根系网络', icon: '🌿', desc: '敌人减速40%持续8秒', rarity: 'rare' },
        { id: 'hpUp', name: '生命之树', icon: '🌳', desc: '全体血量+30%永久', rarity: 'epic' },
        { id: 'spore', name: '孢子爆发', icon: '💨', desc: '对周围敌人造成150伤害', rarity: 'rare' },
        { id: 'vine', name: '万木缠缚', icon: '🌾', desc: '敌人定身3秒', rarity: 'epic' },
        { id: 'bark', name: '树皮铠甲', icon: '🪵', desc: '全体减伤20%永久', rarity: 'legendary' },
        { id: 'bloom', name: '百花绽放', icon: '🌸', desc: '召唤3个二级树人（坦克，护盾200）', rarity: 'epic' },
        { id: 'thorn', name: '荆棘之甲', icon: '🌵', desc: '受击反弹20%伤害', rarity: 'rare' },
        { id: 'growth', name: '自然生长', icon: '🌱', desc: '出兵速度+30%永久', rarity: 'legendary' },
        { id: 'forest', name: '森林守护', icon: '🌲', desc: '水晶回血500', rarity: 'rare' },
        // ==== 经济类（稀有）：三阵营同模板——+200金 / 击杀赏金+30%永久 ====
        { id: 'acorn', name: '古树馈赠', icon: '🌰', desc: '获得200金币，击杀赏金+30%永久', rarity: 'rare' },
        // ==== 召唤类（史诗）：三阵营同模板——召唤4个一级兵（兵种带阵营风味） ====
        { id: 'vineGuard', name: '藤蔓卫士', icon: '🍃', desc: '召唤4个一级坦克', rarity: 'epic' },
        // ==== 特殊类（传说）：三阵营同模板——同归于尽 ====
        { id: 'forestWail', name: '森林悲鸣', icon: '🍄', desc: '献祭全部己方单位，每个对全场敌人造成100伤害', rarity: 'legendary' },
    ],
    animal: [
        { id: 'crit', name: '致命一击', icon: '🎯', desc: '全体暴击率+30%', rarity: 'rare' },
        { id: 'bloodlust', name: '嗜血狂潮', icon: '🩸', desc: '击杀回血20%', rarity: 'epic' },
        { id: 'frenzy', name: '狂暴本能', icon: '💢', desc: '攻击+40%攻速+30%永久', rarity: 'legendary' },
        { id: 'howl', name: '战嚎', icon: '📢', desc: '10秒内攻击+50%', rarity: 'epic' },
        { id: 'pack', name: '狼群战术', icon: '🐺', desc: '每有一个友军攻击+5%', rarity: 'rare' },
        { id: 'predator', name: '捕食者', icon: '🦅', desc: '对低血量敌人伤害+100%', rarity: 'epic' },
        { id: 'stampede', name: '兽群奔腾', icon: '🦬', desc: '全体加速50%持续10秒', rarity: 'rare' },
        { id: 'claw', name: '利爪撕裂', icon: '🦁', desc: '攻击附带流血效果', rarity: 'legendary' },
        { id: 'survival', name: '适者生存', icon: '🧬', desc: '死亡时对周围造成伤害', rarity: 'epic' },
        // ==== 经济类（稀有）：三阵营同模板——+200金 / 击杀赏金+30%永久 ====
        { id: 'hoard', name: '战利品囤积', icon: '🦴', desc: '获得200金币，击杀赏金+30%永久', rarity: 'rare' },
        // ==== 召唤类（史诗）：三阵营同模板——召唤4个一级兵（兵种带阵营风味） ====
        { id: 'boarRush', name: '野猪突袭', icon: '🐗', desc: '召唤4只一级冲锋兵', rarity: 'epic' },
        // ==== 特殊类（传说）：三阵营同模板——同归于尽 ====
        { id: 'lastRoar', name: '最后的怒吼', icon: '🐾', desc: '献祭全部己方单位，每个对全场敌人造成100伤害', rarity: 'legendary' },
    ],
};

/**
 * 中立卡池（v1.8，设计见 01-总纲 §10.7）：全阵营通用机制卡，无阵营风味。
 * 双刃剑（高收益+明确代价）：血量典当 / 战争债券
 * 干扰（削弱敌方生产/属性）：工厂瘫痪 / 士气打击
 * 防御：全线戒备；补兵：紧急征兵
 * 只做稀有/史诗两档（传说档保留给阵营招牌卡）。
 */
export const NEUTRAL_CARDS: CardConfig[] = [
    { id: 'bloodPawn', name: '血量典当', icon: '🩸', desc: '获得260金币，水晶损失12%血量（保底5%）', rarity: 'rare' },
    { id: 'warBond', name: '战争债券', icon: '🧾', desc: '获得150金币，60秒后偿还250金币（不足部分以水晶血量抵债）', rarity: 'epic' },
    { id: 'sabotage', name: '工厂瘫痪', icon: '🔧', desc: '随机1座敌方工厂停业10秒', rarity: 'epic' },
    { id: 'fullAlert', name: '全线戒备', icon: '🛡️', desc: '水晶受伤减少40%，持续15秒', rarity: 'rare' },
    { id: 'muster', name: '紧急征兵', icon: '📢', desc: '召唤2个随机兵种的一级兵', rarity: 'rare' },
    { id: 'demoralize', name: '士气打击', icon: '📉', desc: '敌方全体攻击降低25%，持续5秒', rarity: 'epic' },
];
