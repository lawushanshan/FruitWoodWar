/**
 * 全局参数配置（M2 已对齐《02-数值设计表》v0.3 §1）
 *
 * 像素换算约定：设计分辨率 1280x720，主路长 20 格 = 双方水晶间距 1000px，
 * 因此 1 格 = 50px。文档中以"格"给出的数值在此统一换算为像素。
 */

import type { Difficulty } from '../core/types';

export interface GameConfig {
    /** 格子尺寸（像素/格），用于文档"格"数值换算 */
    cellPx: number;
    /** 全局波次间隔（秒），阵营被动可覆盖（水果 16 秒） */
    waveInterval: number;
    /** 工资间隔（秒） */
    salaryInterval: number;
    /** 每次工资金额 */
    salary: number;
    /** 开局资金 */
    startGold: number;
    /** 大本营（水晶）血量：4000 */
    crystalHp: number;
    /** 非攻城兵对水晶伤害倍率（×0.75） */
    crystalDamageReduce: number;
    /** 每方单位人口上限（含精英） */
    unitCap: number;
    /** 拆掉对方兵工厂的赏金 */
    razeBounty: number;
    /** 单位仇恨范围（像素，文档 5.8 格 ≈ 260px，身后敌人不纠缠） */
    aggroRangePx: number;
    /** 兵种克制伤害倍率（×1.4） */
    counterMult: number;
    /** 攻城单位对建筑（工厂/防御塔/水晶）伤害倍率（×15） */
    siegeVsBuildingMult: number;
    /** AOE 单位溅射伤害比例（文档未明确，暂定 50%，待真人试玩校准） */
    aoeSplashRatio: number;
    /** 冲锋首击冲击波半径（px）：首次撞击对周围敌人造成范围伤害 */
    rushFirstStrikeSplashRadius: number;
    /** 冲锋首击冲击波伤害比例（按基础攻击的百分比，不吃首击倍率） */
    rushFirstStrikeSplashRatio: number;
    /** 同阵营单位间最小间距（px）：分离推挤保持的间隔，减少行军/集结时重叠 */
    unitSeparateDist: number;
    /** 同阵营单位分离推挤速度（px/秒）：限制每帧推开量，避免瞬移抖动 */
    unitSeparateSpeed: number;
    /** 水晶（主城堡）本体视觉半径（px）：单位停靠/阻挡按本体边缘判定，防止叠在城堡上 */
    crystalBodyRadius: number;
    /** 单位本体视觉半径（px）：与水晶本体半径共同构成最小停靠间距 */
    unitBodyRadius: number;
    /** 卡牌触发波次 */
    cardTriggerWaves: readonly number[];
    /** 同类建筑价格递增步长（+25%/座） */
    priceEscalateStep: number;
    /** 工厂 Lv1→Lv2 升级费用 */
    upgradeLv2Cost: number;
    /** 工厂 Lv2→Lv3 升级费用 */
    upgradeLv3Cost: number;
    /** Lv2 工厂属性倍率 */
    lv2StatMult: number;
    /** Lv3 工厂属性倍率 */
    lv3StatMult: number;
    /** 精英等级赏金倍率 */
    eliteBountyMult: Record<string, number>;
    /** 光环塔攻速加成 */
    auraAttackSpeedBonus: number;
    /** 每方光环塔数量上限（v0.7：放开到 3 座，价格逐座递增，攻速光环不叠加） */
    auraTowerLimit: number;
    /** 战争学院 Lv1 费用 */
    academyLv1Cost: number;
    /** 战争学院 Lv2 费用 */
    academyLv2Cost: number;
    /** 全军强化基础费用 */
    researchBaseCost: number;
    /** 全军强化费用增长系数 */
    researchCostGrowth: number;
    /** 全军强化每层攻击加成 */
    researchAtkBonus: number;
    /** 水晶护盾基准费用 */
    shieldBaseCost: number;
    /** 水晶护盾费用增长系数 */
    shieldCostGrowth: number;
    /** 水晶护盾护盾值 */
    shieldAmount: number;
    /** 水晶护盾持续秒数 */
    shieldDuration: number;
    /** 绝地反击触发所需连续退守波数 */
    comebackWaves: number;
    /** 绝地反击工资倍率 */
    comebackSalaryMult: number;
    /** 决战时刻触发时间（秒） */
    suddenDeathTime: number;
    /** 决战时刻每秒水晶掉血比例 */
    suddenDeathDps: number;
    /** AI 收入倍率（按难度） */
    aiIncomeMult: Record<Difficulty, number>;
    /** AI 延迟出兵波数（按难度） */
    aiDelayWaves: Record<Difficulty, number>;
}

export const GAME_CONFIG: GameConfig = {
    cellPx: 50,
    waveInterval: 20,
    salaryInterval: 15,
    salary: 50,
    startGold: 200,
    crystalHp: 4000,
    crystalDamageReduce: 0.75,
    unitCap: 40,
    razeBounty: 50,
    aggroRangePx: 260,
    counterMult: 1.4,
    siegeVsBuildingMult: 15,
    aoeSplashRatio: 0.5,
    // 冲锋首击冲击波：撞击点 90px 内敌人受基础攻击 50%（不吃首击倍率，避免数值爆炸）
    rushFirstStrikeSplashRadius: 90,
    rushFirstStrikeSplashRatio: 0.5,
    // 同族单位分离：保持 30px 间距，以 90px/秒 的速度缓缓推开（避免重叠成一团）
    unitSeparateDist: 30,
    unitSeparateSpeed: 90,
    // 水晶本体阻挡：水晶立绘 80×80（半径 40）+ 单位半径 16 = 最小停靠 56px，
    // 近战射程 50 < 56 时按本体边缘停靠攻击，不再叠进主城堡身体
    crystalBodyRadius: 40,
    unitBodyRadius: 16,
    cardTriggerWaves: [5, 10, 15],
    priceEscalateStep: 0.25,
    upgradeLv2Cost: 150,
    upgradeLv3Cost: 300,
    lv2StatMult: 1.5,
    lv3StatMult: 2.2,
    eliteBountyMult: { '2': 1.5, '3': 2 },
    auraAttackSpeedBonus: 0.15,
    auraTowerLimit: 3,
    academyLv1Cost: 200,
    academyLv2Cost: 400,
    researchBaseCost: 400,
    researchCostGrowth: 1.25,
    researchAtkBonus: 0.08,
    // 水晶护盾（问题 #5 金币出口）：300 起步 ×1.25 递增，+800 护盾持续 15 秒
    shieldBaseCost: 300,
    shieldCostGrowth: 1.25,
    shieldAmount: 800,
    shieldDuration: 15,
    comebackWaves: 3,
    comebackSalaryMult: 1.5,
    suddenDeathTime: 300,
    suddenDeathDps: 0.01,
    aiIncomeMult: { easy: 0.8, normal: 1.0, hard: 1.15 },
    aiDelayWaves: { easy: 2, normal: 1, hard: 0 },
};
