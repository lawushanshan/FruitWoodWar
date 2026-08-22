/**
 * 状态哈希（联机 P0-S3）：把 GameState 核心模拟字段压成稳定哈希。
 *
 * 用途：帧同步双端每 N 帧各算一次哈希上报服务器比对，不同即判定不同步。
 * 约定：
 *  - 只纳入影响模拟的字段（表现/卡牌备选 UI 态不纳入——offers 由随机源决定，
 *    但其消费过程已体现在 usedCardIds 与 buff 中）
 *  - 数字统一 toFixed(3) 消除浮点尾差在序列化层面的抖动（双端同代码同输入
 *    时浮点结果本应一致，格式化只是双保险）
 *  - 实体按 nextId 递增创建、数组序稳定，直接按序拼接即可（两端一致的前提
 *    已由确定性测试守护）
 */

import type { GameState } from './types';

/** FNV-1a 32 位滚动哈希 */
class Hasher {
    private h = 0x811c9dc5;
    push(str: string): void {
        for (let i = 0; i < str.length; i++) {
            this.h ^= str.charCodeAt(i);
            this.h = Math.imul(this.h, 0x01000193) >>> 0;
        }
        this.h = Math.imul(this.h ^ (str.length & 0xff), 0x01000193) >>> 0;
    }
    pushNum(n: number): void {
        this.push((Math.round(n * 1000) / 1000).toString() + ',');
    }
    digest(): string {
        return (this.h >>> 0).toString(16).padStart(8, '0');
    }
}

const n3 = (n: number) => Math.round(n * 1000) / 1000;

/** 计算对局状态哈希（hex 字符串） */
export function stateHash(state: GameState): string {
    const h = new Hasher();

    h.push(state.phase);
    h.pushNum(state.time);
    h.pushNum(state.wave);
    h.pushNum(state.waveTimer);
    h.pushNum(state.nextId);

    for (const side of ['red', 'blue'] as const) {
        h.pushNum(state.gold[side]);
        h.pushNum(state.salaryTimer[side]);
        h.pushNum(state.academyLevel[side]);
        h.pushNum(state.researchLayers[side]);
        const cb = state.comeback[side];
        h.pushNum(cb.streak);
        h.push(cb.active ? '1' : '0');
        const b = state.buffs[side];
        for (const key of Object.keys(b) as Array<keyof typeof b>) {
            const v = b[key];
            h.push(typeof v === 'boolean' ? (v ? '1' : '0') : n3(v as number).toString());
        }
    }

    h.pushNum(state.units.length);
    for (const u of state.units) {
        h.push(u.id);
        h.push(u.side + u.type + u.level);
        h.pushNum(u.x); h.pushNum(u.y); h.pushNum(u.hp); h.pushNum(u.maxHp);
        h.pushNum(u.atk); h.pushNum(u.atkCd); h.pushNum(u.shield);
        h.pushNum(u.stunDur); h.pushNum(u.slowDur); h.pushNum(u.bleedDur);
    }

    h.pushNum(state.buildings.length);
    for (const b of state.buildings) {
        h.push(b.id);
        h.push(b.side + (b.unitType ?? 'x') + b.level + (b.kind ?? ''));
        h.pushNum(b.x); h.pushNum(b.y); h.pushNum(b.hp); h.pushNum(b.waveTimer);
    }

    h.pushNum(state.towers.length);
    for (const t of state.towers) {
        h.push(t.id);
        h.push(t.side + t.kind);
        h.pushNum(t.x); h.pushNum(t.y); h.pushNum(t.hp); h.pushNum(t.atkCd);
    }

    for (const c of state.crystals) {
        h.push(c.id + c.side);
        h.pushNum(c.hp);
    }

    h.pushNum(state.tempBuffs.length);
    for (const tb of state.tempBuffs) {
        h.push(tb.side + tb.type);
        h.pushNum(tb.mult); h.pushNum(tb.damage); h.pushNum(tb.dur); h.pushNum(tb.tickTimer);
    }

    h.pushNum(state.stats.kills.red);
    h.pushNum(state.stats.kills.blue);

    return h.digest();
}
