/**
 * 核心类型契约（M1 建立，M3 扩展：阵营独立 buff、精英等级、学院/科研/绝地反击/AI 记忆）
 *
 * 规则：core 目录不允许导入 cc，保持纯数据可在 Node 环境独立运行。
 * 数值以《02-数值设计表》v0.3 为唯一来源。
 */

// ==================== 基础枚举 ====================

/** 阵营边：红方为玩家，蓝方为 AI */
export type Side = 'red' | 'blue';

/** 阵营 ID：水果王国 / 绿木林 / 动物庄园 */
export type FactionId = 'fruit' | 'wood' | 'animal';

/** AI 难度：简单 / 普通 / 困难 */
export type Difficulty = 'easy' | 'normal' | 'hard';

/** 兵种定位：坦克 / 远程 / AOE / 冲锋 / 攻城 */
export type UnitType = 'tank' | 'ranged' | 'aoe' | 'rush' | 'siege';

/** 可建造项：五种兵工厂 + 战争学院 + 光环塔 */
export type BuildingItemId = UnitType | 'academy' | 'aura';

/** 卡牌稀有度 */
export type CardRarity = 'rare' | 'epic' | 'legendary';

/** 对局阶段：待开始 / 对战中 / 卡牌暂停 / 已结束 */
export type Phase = 'idle' | 'playing' | 'card-pause' | 'ended';

// ==================== 通用结构 ====================

/**
 * 战斗表现事件（由 combat-system 结算产生，供表现层消费）。
 * 不写入 GameState（避免影响确定性序列化），而是经 GameEngine.drainFx() 一次性读取并清空。
 */
export type FxEvent =
    | { type: 'hit'; x: number; y: number; side: Side }
    | { type: 'aoe'; x: number; y: number; radius: number; side: Side }
    | { type: 'tower'; x: number; y: number; radius: number; side: Side };

/** 平面坐标（像素） */
export interface Position {
    x: number;
    y: number;
}

// ==================== 配置结构 ====================

/** 阵营配置：修正系数 + 被动 + 表现色（已对齐 v0.3 文档） */
export interface FactionConfig {
    id: FactionId;
    name: string;
    /** 被动描述文案 */
    passive: string;
    /** 建筑价格倍率 */
    priceMult: number;
    /** 兵血量倍率 */
    hpMult: number;
    /** 兵攻击倍率 */
    atkMult: number;
    /** 兵速度倍率 */
    speedMult: number;
    /** 出兵波次间隔（秒） */
    waveInterval: number;
    /** 每厂每波概率加兵的触发概率（绿木 0.5） */
    extraCountChance: number;
    /** 每厂每波概率加兵的数量（绿木 +2） */
    extraCount: number;
    /** 冲锋兵种首击倍率（基准 2.0，动物 2.5） */
    firstStrikeMult: number;
    /** 表现层主题色（十六进制） */
    color: string;
}

/** 兵种模板（阵营修正前的基准） */
export interface UnitConfig {
    type: UnitType;
    name: string;
    hp: number;
    atk: number;
    /** 移动速度（像素/秒，1 格/秒 = 50px） */
    speed: number;
    /** 攻击射程（像素） */
    range: number;
    /** 攻击速度（次/秒） */
    atkSpeed: number;
    /** 对应兵工厂基准价格（实际价格按阵营倍率结算） */
    cost: number;
    /** 击杀赏金（金） */
    bounty: number;
    /** 一级工厂每波出兵数 */
    unitsPerWave: number;
    /** 溅射半径（像素，AOE 兵种 75，其余 0） */
    splashRadius: number;
    icon: string;
}

/** 建筑配置 */
export interface BuildingConfig {
    id: BuildingItemId;
    /** 建筑类别：兵工厂 / 战争学院 / 光环塔 */
    kind: 'factory' | 'academy' | 'aura';
    name: string;
    hp: number;
    cost: number;
    icon: string;
    /** 兵工厂对应的兵种 */
    unitType?: UnitType;
}

/** 卡牌配置 */
export interface CardConfig {
    id: string;
    name: string;
    icon: string;
    desc: string;
    rarity: CardRarity;
}

// ==================== 实体状态 ====================

/** 单位运行时状态 */
export interface UnitState {
    id: string;
    side: Side;
    type: UnitType;
    /** 精英等级（工厂 Lv2/Lv3 出的兵为 2/3，影响属性与赏金） */
    level: 1 | 2 | 3;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    atk: number;
    speed: number;
    range: number;
    atkSpeed: number;
    /** 攻击冷却剩余时间 */
    atkCd: number;
    /** 是否已使用首击（冲锋兵种首击倍率只生效一次） */
    firstStrikeDone: boolean;
    /** 护盾值（卡牌"果皮护盾"） */
    shield: number;
    /** 定身剩余时间（卡牌"万木缠缚"） */
    stunDur: number;
    /** 减速倍率（卡牌"根系网络"） */
    slowMult: number;
    /** 减速剩余时间 */
    slowDur: number;
    /** 流血每秒伤害（卡牌"利爪撕裂"） */
    bleedDps: number;
    /** 流血剩余时间 */
    bleedDur: number;
}

/** 兵工厂运行时状态 */
export interface BuildingState {
    id: string;
    side: Side;
    /** 出兵兵种；null 表示每波随机兵种（随机工厂行为） */
    unitType: UnitType | null;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    /** 出兵倒计时 */
    waveTimer: number;
    /** 工厂等级（1~3，等级影响出兵属性与建筑血量） */
    level: 1 | 2 | 3;
    /** 建筑类别标记：工厂无此字段；学院为可被拆除的实体建筑 */
    kind?: 'academy';
}

/** 防御塔运行时状态 */
export interface TowerState {
    id: string;
    side: Side;
    /** 塔类别：基地固定塔 / 玩家建造的光环塔 */
    kind: 'base' | 'aura';
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    range: number;
    atk: number;
    atkSpeed: number;
    atkCd: number;
}

/** 大本营水晶运行时状态 */
export interface CrystalState {
    id: string;
    side: Side;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
}

/** 可被攻击对象的公共字段 */
export interface Hittable {
    hp: number;
    maxHp: number;
    x: number;
    y: number;
}

// ==================== Buff ====================

/** 单边阵营的永久增益（学院/科研/卡牌永久效果） */
export interface SideBuffs {
    /** 攻击倍率（攻击结算时生效） */
    atk: number;
    /** 血量倍率（出兵时烘焙） */
    hp: number;
    /** 攻速倍率（攻击冷却结算时生效，不含光环塔） */
    attackSpeed: number;
    /** 受伤倍率（<1 为减伤，防御方结算时生效） */
    damageReduce: number;
    /** 暴击率（0~1） */
    crit: number;
    /** 溅射倍率（>1 时攻击附带卡牌溅射） */
    splashMult: number;
    /** 出兵间隔倍率（<1 为加快，仅己方工厂生效） */
    waveIntervalMult: number;
    /** 是否启用"捕食者"处决效果 */
    execute: boolean;
    /** 击杀回血比例 */
    lifeOnKill: number;
    /** 反伤比例（荆棘之甲：受击反弹） */
    thorn: number;
    /** 每个友军提供的攻击加成（狼群战术） */
    packBonus: number;
    /** 攻击附带的流血强度（利爪撕裂：流血每秒 = 攻击力 × 该值） */
    bleed: number;
    /** 死亡爆炸伤害（适者生存） */
    deathExplode: number;
}

/** 临时 buff（限时效果，统一由引擎按帧驱动） */
export interface TempBuff {
    side: Side;
    /** 攻速倍增 / 攻击倍增 / 速度倍增 / 持续回血 / 周期性果雨 */
    type: 'attackSpeedMult' | 'atkMult' | 'speedMult' | 'regen' | 'rain';
    /** 倍率（mult 类） */
    mult: number;
    /** 周期效果的伤害值（rain） */
    damage: number;
    /** 周期效果的触发间隔（rain：5 秒） */
    interval: number;
    /** 周期效果计时器 */
    tickTimer: number;
    /** 剩余时间（秒） */
    dur: number;
}

// ==================== 卡牌与战绩 ====================

/** 卡牌选择状态 */
export interface CardChoiceState {
    /** 当前供选择的 3 张卡 */
    offers: CardConfig[];
    /** 各触发波次是否已触发 */
    triggeredWaves: Record<number, boolean>;
    /** 已抽中/已被选用的卡牌 id（跨波次去重，抽过的不再出现） */
    usedCardIds: string[];
}

/** 对局结果 */
export interface MatchResult {
    winner: Side;
    /** 星级 1~3 */
    stars: number;
    /** 对局用时（秒） */
    duration: number;
    /** 玩家方剩余金币（结算展示） */
    playerGold: number;
}

/** 对局统计 */
export interface MatchStats {
    kills: Record<Side, number>;
    result: MatchResult | null;
}

// ==================== AI 与翻盘 ====================

/** AI 决策记忆（快照玩家兵种构成，用于延迟克制） */
export interface AiMemory {
    /** 玩家方兵种构成快照（上一个波次结算时） */
    playerCompSnapshot: Record<UnitType, number>;
}

/** 绝地反击状态（连续 3 波被推回己方高地 → 工资 +50%） */
export interface ComebackState {
    /** 连续被推回己方高地的波数 */
    streak: number;
    /** 反击工资是否生效 */
    active: boolean;
}

// ==================== 游戏总状态 ====================

/** 模拟核心的唯一状态容器 */
export interface GameState {
    phase: Phase;
    /** 已经过的对局时间（秒） */
    time: number;
    /** 当前全局波次 */
    wave: number;
    /** 全局波次倒计时 */
    waveTimer: number;
    /** 玩家所在边（固定 red，保留字段便于扩展） */
    playerSide: Side;
    /** 双方阵营 */
    factions: Record<Side, FactionId>;
    difficulty: Difficulty;
    /** 双方金币 */
    gold: Record<Side, number>;
    /** 双方工资倒计时 */
    salaryTimer: Record<Side, number>;
    units: UnitState[];
    buildings: BuildingState[];
    towers: TowerState[];
    crystals: CrystalState[];
    /** 双方各自的永久增益（M3 起按阵营隔离） */
    buffs: Record<Side, SideBuffs>;
    tempBuffs: TempBuff[];
    /** 战争学院等级（0/1/2） */
    academyLevel: Record<Side, number>;
    /** 全军强化层数（无限叠加的后期金币出口） */
    researchLayers: Record<Side, number>;
    /** 绝地反击状态 */
    comeback: Record<Side, ComebackState>;
    cards: CardChoiceState;
    stats: MatchStats;
    /** AI 决策记忆 */
    aiMemory: AiMemory;
    /** 实体自增 ID 计数器 */
    nextId: number;
    /** 是否启用双倍工资（广告激励） */
    doubleSalary: boolean;
    /** 禁用卡牌触发（批量平衡模拟用） */
    disableCards: boolean;
}

// ==================== 命令 ====================

/** UI / AI 提交给引擎的类型化命令 */
export type GameCommand =
    | { type: 'build'; itemId: BuildingItemId; position: Position }
    | { type: 'upgrade'; buildingId: string }
    | { type: 'research' }
    | { type: 'choose-card'; cardId: string };

/** 命令执行结果 */
export interface CommandResult {
    ok: boolean;
    /** 展示层可直接使用的提示文案 */
    message?: string;
}

/** 开局参数 */
export interface StartOptions {
    playerFaction: FactionId;
    /** 不传则按阵营顺序取玩家的下一个阵营 */
    aiFaction?: FactionId;
    difficulty?: Difficulty;
    /** 是否启用双倍工资（广告激励，表现层在开局前确认后传入） */
    doubleSalary?: boolean;
    /** 禁用卡牌触发（批量平衡模拟用：隔离玩家卡牌优势，纯测阵营强度） */
    disableCards?: boolean;
}
