/**
 * 卡牌配置（M1 镜像旧灰盒数值；部分卡牌效果为简化版，M3 逐项对齐描述）
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
    ],
};
