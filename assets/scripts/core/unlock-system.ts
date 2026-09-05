/**
 * unlock-system —— 局外解锁系统（v1.8，设计约束见 01-总纲 §10.6）
 *
 * 职责：
 *  - 玩家局外档案（PlayerProfile）的读写与持久化（localStorage，键 fww_profile）
 *  - 卡牌解锁判定：只锁"后续新增内容"（v1.7 的 9 张 + v1.8 中立 6 张），
 *    基础 27 张首发卡永久开放；解锁条件按稀有度分级（横向解锁：短平快的目标感）
 *  - 对局事件登记：选卡使用次数、胜负场次 → 结算时返回"本局新解锁"供 UI 提示
 *
 * 确定性边界（重要）：
 *  - 本模块只做局外进度，不进入帧同步模拟；GameState.cardUnlocks 由表现层
 *    开局时从档案算好注入（数据快照），模拟核心不读 localStorage。
 *  - 联机对局必须传 cardUnlocks=null（不过滤），保证双端卡池一致（06-联机 §2.3 S6）。
 *
 * 注意：本模块不导入 cc，可在 Node 环境运行（测试）。
 */

import { CARD_CONFIG } from '../config/card-config';
import { NEUTRAL_CARDS } from '../config/card-config';
import type { CardRarity } from './types';

/** 玩家局外档案（可序列化） */
export interface PlayerProfile {
    /** 存档结构版本（未来字段迁移用） */
    version: 1;
    /** 累计胜场 */
    wins: number;
    /** 累计败场 */
    losses: number;
    /** 每张卡的使用次数（为未来"使用次数解锁"条件预留） */
    cardUses: Record<string, number>;
}

/** 存档键（与 save-system 的 fww_best_* 前缀区分） */
const PROFILE_KEY = 'fww_profile';

/**
 * 按稀有度分级的默认解锁条件（胜场数）：
 * 稀有 1 胜 / 史诗 3 胜 / 传说 5 胜——新玩家首胜即有反馈，传说给中期目标。
 * 横向解锁原则：解锁只意味着"多一种玩法选择"，卡牌强度与基础卡同级对齐。
 */
const RARITY_WIN_REQUIREMENT: Record<CardRarity, number> = {
    rare: 1,
    epic: 3,
    legendary: 5,
};

/**
 * 纳入解锁范围的卡池（"只锁后续新增内容"原则）：
 * v1.7 新增 9 张（经济/召唤/同归于尽）+ v1.8 中立 6 张。
 * 不在此列表中的卡（基础 27 张首发卡）永久解锁。
 */
const UNLOCKABLE_CARD_IDS: ReadonlySet<string> = new Set<string>([
    // v1.7 经济类 / 召唤类 / 同归于尽（三阵营同模板）
    'harvest', 'acorn', 'hoard',
    'swarm', 'vineGuard', 'boarRush',
    'coreBlast', 'forestWail', 'lastRoar',
    // v1.8 中立池（双刃剑 / 干扰 / 防御 / 补兵）
    ...NEUTRAL_CARDS.map(c => c.id),
]);

/** 全量卡表（id → 稀有度），解锁条件查询用 */
const ALL_CARD_RARITY: ReadonlyMap<string, CardRarity> = (() => {
    const map = new Map<string, CardRarity>();
    for (const list of Object.values(CARD_CONFIG)) {
        for (const c of list) map.set(c.id, c.rarity);
    }
    for (const c of NEUTRAL_CARDS) map.set(c.id, c.rarity);
    return map;
})();

/**
 * 查询一张卡的解锁条件（所需胜场数）。
 * 返回 null 表示该卡永久解锁（基础内容，不在解锁范围内）。
 */
export function cardUnlockRequirement(cardId: string): number | null {
    if (!UNLOCKABLE_CARD_IDS.has(cardId)) return null;
    const rarity = ALL_CARD_RARITY.get(cardId);
    // 配置缺失防御：纳入解锁范围但查不到稀有度时按最高门槛处理（不会发生于正常配置）
    return rarity ? RARITY_WIN_REQUIREMENT[rarity] : RARITY_WIN_REQUIREMENT.legendary;
}

/** 卡牌是否已解锁（无条件的卡恒 true） */
export function isCardUnlocked(profile: PlayerProfile, cardId: string): boolean {
    const req = cardUnlockRequirement(cardId);
    return req === null || profile.wins >= req;
}

/**
 * 解锁进度（UI 展示"去解锁"目标用）。
 * requirement 为 null 时表示永久解锁（无进度概念）。
 */
export function unlockProgress(profile: PlayerProfile, cardId: string): { requirement: number | null; progress: number } {
    const req = cardUnlockRequirement(cardId);
    return { requirement: req, progress: Math.min(profile.wins, req ?? profile.wins) };
}

/**
 * 当前已解锁的全部卡 id（单机开局注入 GameState.cardUnlocks 用）。
 * 返回的是全量卡池中已解锁的子集（含基础卡）。
 */
export function unlockedCardIds(profile: PlayerProfile): string[] {
    const ids: string[] = [];
    for (const [id] of ALL_CARD_RARITY) {
        if (isCardUnlocked(profile, id)) ids.push(id);
    }
    return ids;
}

/** 仍处于锁定状态的卡 id（调试/UI 展示"锁定→去解锁"用） */
export function lockedCardIds(profile: PlayerProfile): string[] {
    const ids: string[] = [];
    for (const id of UNLOCKABLE_CARD_IDS) {
        if (!isCardUnlocked(profile, id)) ids.push(id);
    }
    return ids;
}

/** 登记一次选卡使用（选卡成功后调用；为未来"使用次数解锁"条件积累数据） */
export function recordCardUse(profile: PlayerProfile, cardId: string): void {
    profile.cardUses[cardId] = (profile.cardUses[cardId] ?? 0) + 1;
}

/**
 * 登记一局结束并返回"本局新解锁"的卡 id 列表（结算界面提示 🔓 用）。
 * 只在胜负真正分出时调用（投降/重开不计入）。
 */
export function recordMatchEnd(profile: PlayerProfile, won: boolean): string[] {
    const before = lockedCardIds(profile);
    if (won) profile.wins += 1;
    else profile.losses += 1;
    const after = lockedCardIds(profile);
    // before - after = 本局跨过门槛新解锁的卡
    return before.filter(id => !after.includes(id));
}

// ==================== 持久化 ====================

/** 新档案（无存档/存档损坏时使用） */
export function createProfile(): PlayerProfile {
    return { version: 1, wins: 0, losses: 0, cardUses: {} };
}

/** 读取档案（无存档或解析失败返回全新档案；localStorage 不可用静默降级） */
export function loadProfile(): PlayerProfile {
    try {
        const raw = localStorage.getItem(PROFILE_KEY);
        if (!raw) return createProfile();
        const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
        // 字段防御：缺字段按默认值补齐，避免旧版本存档缺 cardUses 等字段崩溃
        return {
            version: 1,
            wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
            losses: typeof parsed.losses === 'number' ? parsed.losses : 0,
            cardUses: parsed.cardUses && typeof parsed.cardUses === 'object' ? parsed.cardUses : {},
        };
    } catch {
        return createProfile();
    }
}

/** 保存档案（localStorage 不可用静默失败，测试环境无副作用） */
export function saveProfile(profile: PlayerProfile): void {
    try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
        // 静默失败（无 localStorage 环境等）
    }
}
