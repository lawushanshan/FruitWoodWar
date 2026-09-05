/**
 * 局外解锁系统测试（v1.8，01-总纲 §10.6 约束 / §10.7 中立池）
 *
 * Node 环境无 localStorage，用内存 stub 模拟（覆盖读/写/解析/损坏存档路径）。
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
    cardUnlockRequirement,
    createProfile,
    isCardUnlocked,
    loadProfile,
    lockedCardIds,
    recordCardUse,
    recordMatchEnd,
    saveProfile,
    unlockProgress,
    unlockedCardIds,
} from '../assets/scripts/core/unlock-system';

// ---- 内存 localStorage stub（模块级单例，unlock-system 直接引用 globalThis.localStorage） ----
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
};

beforeEach(() => {
    store.clear();
});

describe('解锁条件（只锁后续新增内容，按稀有度分级）', () => {
    it('基础 27 张首发卡永久解锁（无解锁条件）', () => {
        const p = createProfile();
        expect(cardUnlockRequirement('heal')).toBeNull();
        expect(cardUnlockRequirement('atkUp')).toBeNull();
        expect(cardUnlockRequirement('growth')).toBeNull();
        expect(cardUnlockRequirement('frenzy')).toBeNull();
        expect(isCardUnlocked(p, 'heal')).toBe(true);
    });

    it('v1.7 新增 9 张与中立 6 张按稀有度分级：稀有 1 胜 / 史诗 3 胜 / 传说 5 胜', () => {
        // v1.7 三阵营同模板
        expect(cardUnlockRequirement('harvest')).toBe(1);      // rare
        expect(cardUnlockRequirement('swarm')).toBe(3);        // epic
        expect(cardUnlockRequirement('coreBlast')).toBe(5);    // legendary
        // 中立池
        expect(cardUnlockRequirement('bloodPawn')).toBe(1);    // rare
        expect(cardUnlockRequirement('fullAlert')).toBe(1);    // rare
        expect(cardUnlockRequirement('muster')).toBe(1);       // rare
        expect(cardUnlockRequirement('warBond')).toBe(3);      // epic
        expect(cardUnlockRequirement('sabotage')).toBe(3);     // epic
        expect(cardUnlockRequirement('demoralize')).toBe(3);   // epic
    });

    it('0 胜时 15 张新增卡全部锁定；锁定清单可枚举（供 UI"去解锁"展示）', () => {
        const p = createProfile();
        expect(lockedCardIds(p).length).toBe(15);
        expect(isCardUnlocked(p, 'harvest')).toBe(false);
        expect(isCardUnlocked(p, 'bloodPawn')).toBe(false);
    });

    it('解锁进度查询：progress 不超过 requirement', () => {
        const p = createProfile();
        p.wins = 2;
        const { requirement, progress } = unlockProgress(p, 'coreBlast');
        expect(requirement).toBe(5);
        expect(progress).toBe(2);
        // 永久解锁的卡无进度概念
        expect(unlockProgress(p, 'heal').requirement).toBeNull();
    });
});

describe('对局事件登记', () => {
    it('首胜解锁全部 6 张稀有档新增卡并返回清单', () => {
        const p = createProfile();
        const unlocked = recordMatchEnd(p, true);
        expect(unlocked.sort()).toEqual(['acorn', 'bloodPawn', 'fullAlert', 'harvest', 'hoard', 'muster'].sort());
        expect(p.wins).toBe(1);
        expect(lockedCardIds(p).length).toBe(9); // 剩史诗 6 + 传说 3
    });

    it('败场不涨胜场、不解锁', () => {
        const p = createProfile();
        expect(recordMatchEnd(p, false)).toEqual([]);
        expect(p.wins).toBe(0);
        expect(p.losses).toBe(1);
        expect(lockedCardIds(p).length).toBe(15);
    });

    it('3 胜解锁史诗档、5 胜解锁传说档（中间场次无新解锁返回空）', () => {
        const p = createProfile();
        recordMatchEnd(p, true); // 1 胜：rare
        const second = recordMatchEnd(p, true); // 2 胜：无门槛跨越
        expect(second).toEqual([]);
        const third = recordMatchEnd(p, true); // 3 胜：epic
        expect(third.sort()).toEqual(['boarRush', 'demoralize', 'sabotage', 'swarm', 'vineGuard', 'warBond'].sort());
        recordMatchEnd(p, true); // 4 胜
        const fifth = recordMatchEnd(p, true); // 5 胜：legendary
        expect(fifth.sort()).toEqual(['coreBlast', 'forestWail', 'lastRoar'].sort());
        expect(lockedCardIds(p)).toEqual([]);
    });

    it('用卡计数累积（为未来"使用次数解锁"积累数据）', () => {
        const p = createProfile();
        recordCardUse(p, 'heal');
        recordCardUse(p, 'heal');
        recordCardUse(p, 'bloodPawn');
        expect(p.cardUses['heal']).toBe(2);
        expect(p.cardUses['bloodPawn']).toBe(1);
    });
});

describe('档案持久化', () => {
    it('保存后读取往返一致', () => {
        const p = createProfile();
        p.wins = 3;
        p.losses = 1;
        recordCardUse(p, 'swarm');
        saveProfile(p);
        const loaded = loadProfile();
        expect(loaded).toEqual(p);
    });

    it('无存档返回全新档案；损坏存档按默认值补齐不崩溃', () => {
        expect(loadProfile()).toEqual(createProfile());
        store.set('fww_profile', '{不是合法JSON');
        const p = loadProfile();
        expect(p.wins).toBe(0);
        expect(p.cardUses).toEqual({});
        // 旧版本存档缺 cardUses 字段时补齐
        store.set('fww_profile', JSON.stringify({ version: 1, wins: 7 }));
        const legacy = loadProfile();
        expect(legacy.wins).toBe(7);
        expect(legacy.losses).toBe(0);
        expect(legacy.cardUses).toEqual({});
    });
});

describe('卡池快照（注入 GameState.cardUnlocks）', () => {
    it('0 胜 = 基础 27 张（不含任何新增卡与中立卡）；5 胜 = 全量 42 张', () => {
        const p0 = createProfile();
        const ids0 = unlockedCardIds(p0);
        expect(ids0.length).toBe(27);
        expect(ids0).not.toContain('harvest');
        expect(ids0).not.toContain('bloodPawn');

        const p5 = createProfile();
        p5.wins = 5;
        const ids5 = unlockedCardIds(p5);
        expect(ids5.length).toBe(42); // 27 基础 + 9 新增 + 6 中立
        expect(ids5).toContain('coreBlast');
        expect(ids5).toContain('sabotage');
    });
});
