/**
 * 阵营配置（v1.7 平衡调整：三阵营综合胜率收敛至 58%~65% 带，见 问题/游戏测试报告.md）
 *
 * 关键改动（对比 v0.3 数值表）：
 * - fruit：hpMult 0.85→0.95、waveInterval 16→15（兵量补偿）
 * - wood：hpMult 1.25→1.10、extraCountChance 0.40→0.30（量雪球收敛）
 * - animal：speedMult 1.35→1.25、priceMult 1.0→0.92（移速换经济）
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
        priceMult: 0.94,
        hpMult: 0.95,
        atkMult: 0.95,
        speedMult: 1.0,
        waveInterval: 15,
        extraCountChance: 0,
        extraCount: 0,
        firstStrikeMult: 2.0,
        color: '#ff7043',
    },
    wood: {
        id: 'wood',
        name: '绿木林',
        passive: '生生不息·每厂30%概率+2兵',
        priceMult: 1.1,
        hpMult: 1.10,
        atkMult: 1.0,
        speedMult: 0.8,
        waveInterval: 20,
        extraCountChance: 0.30,
        extraCount: 2,
        firstStrikeMult: 2.0,
        color: '#66bb6a',
    },
    animal: {
        id: 'animal',
        name: '动物庄园',
        passive: '野性力量·攻击+55%',
        priceMult: 0.92,
        hpMult: 0.95,
        atkMult: 1.55,
        speedMult: 1.25,
        waveInterval: 20,
        extraCountChance: 0,
        extraCount: 0,
        firstStrikeMult: 2.5,
        color: '#ffca28',
    },
};
