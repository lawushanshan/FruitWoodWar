/**
 * 阵营配置（M2 已对齐《02-数值设计表》v0.3 §3 终版）
 *
 * 首击倍率：仅冲锋兵种第一次攻击生效（基准 ×2，动物 ×2.5）。
 */

import type { FactionConfig, FactionId } from '../core/types';

/** 阵营顺序（影响 AI 阵营选取与随机池顺序） */
export const FACTION_IDS: FactionId[] = ['fruit', 'wood', 'animal'];

export const FACTION_CONFIG: Record<FactionId, FactionConfig> = {
    fruit: {
        id: 'fruit',
        name: '水果王国',
        passive: '阳光生长·出兵快20%',
        priceMult: 0.95,
        hpMult: 0.85,
        atkMult: 0.95,
        speedMult: 1.0,
        waveInterval: 16,
        extraCountChance: 0,
        extraCount: 0,
        firstStrikeMult: 2.0,
        color: '#ff7043',
    },
    wood: {
        id: 'wood',
        name: '绿木林',
        passive: '生生不息·每厂40%概率+2兵',
        priceMult: 1.1,
        hpMult: 1.25,
        atkMult: 1.0,
        speedMult: 0.8,
        waveInterval: 20,
        extraCountChance: 0.40,
        extraCount: 2,
        firstStrikeMult: 2.0,
        color: '#66bb6a',
    },
    animal: {
        id: 'animal',
        name: '动物庄园',
        passive: '野性力量·攻击+55%',
        priceMult: 1.0,
        hpMult: 0.95,
        atkMult: 1.55,
        speedMult: 1.35,
        waveInterval: 20,
        extraCountChance: 0,
        extraCount: 0,
        firstStrikeMult: 2.5,
        color: '#ffca28',
    },
};
