/**
 * GameView —— 战场实体视觉同步（M3 美术版）
 *
 * 职责：
 *  - 维护 id → Node 映射，按实体 ID 精确创建/销毁节点
 *  - 每帧从 GameState 读取数据，同步位置与视觉
 *  - M3 美术接入：优先使用 ArtLibrary 的 Q 版立绘（units/buildings/hq），
 *    资源缺失时回退到灰盒色块 + emoji 表现（07 方案 §7.2 的兜底约定）
 *  - 蓝方单位水平翻转（scaleX=-1），敌我用脚底红/蓝小色环区分（§7.2）
 *  - 程序动画（07 方案 §6）：待机浮动 / 行走弹跳微倾，纯数学计算无 Tween 对象
 *  - 集成对象池，避免频繁创建/销毁节点
 *  - 只负责视觉表现，不修改游戏数据
 */

import { Node, Color, Sprite, UIOpacity, Label, UITransform, Size, Vec2 } from 'cc';
import { ColorSpriteFactory, Shape } from './color-sprite-factory';
import { NodePool } from './node-pool';
import { setUniformScale } from './scale-helper';
import { BUILDING_CONFIG } from '../config/building-config';
import { UNIT_CONFIG } from '../config/unit-config';
import { GAME_CONFIG } from '../config/game-config';
import { ArtLibrary } from './art-library';
import type { GameState, Side, UnitType, UnitState, FactionId } from '../core/types';

/** 实体颜色表（按阵营边；灰盒兜底与敌我色环共用） */
const ENTITY_COLORS: Record<string, { red: Color; blue: Color }> = {
    crystal: { red: new Color(255, 100, 100), blue: new Color(100, 150, 255) },
    building: { red: new Color(200, 100, 100), blue: new Color(100, 150, 200) },
    academy: { red: new Color(220, 130, 100), blue: new Color(100, 170, 220) },
    aura: { red: new Color(255, 180, 100), blue: new Color(100, 200, 180) },
    tower: { red: new Color(220, 120, 120), blue: new Color(120, 170, 220) },
    unit: { red: new Color(255, 150, 150), blue: new Color(150, 200, 255) },
};

/** 兵种形状映射（灰盒兜底） */
const UNIT_SHAPES: Record<UnitType, { shape: Shape; w: number; h: number }> = {
    tank: { shape: 'circle', w: 20, h: 20 },
    ranged: { shape: 'diamond', w: 14, h: 14 },
    aoe: { shape: 'star', w: 18, h: 18 },
    rush: { shape: 'triangle', w: 18, h: 18 },
    siege: { shape: 'rect', w: 22, h: 14 },
};

/** 兵种立绘显示尺寸（07 方案 §8：接入 128，战场显示最大 ~36px） */
const UNIT_ART_SIZES: Record<UnitType, { w: number; h: number }> = {
    tank: { w: 36, h: 36 },
    ranged: { w: 30, h: 30 },
    aoe: { w: 32, h: 32 },
    rush: { w: 30, h: 30 },
    siege: { w: 38, h: 38 },
};

/**
 * 重叠散开偏移（v1.3.0）：同格堆叠的单位按此序列错开渲染，
 * 逻辑位置不变，只改视觉位置，解决"多个单位叠成一个点"的问题。
 */
const OVERLAP_SPREAD: ReadonlyArray<[number, number]> = [
    [0, 0], [7, 0], [-7, 0], [0, 7], [0, -7],
    [7, 7], [-7, 7], [7, -7], [-7, -7],
    [4, 4], [-4, -4], [4, -4], [-4, 4],
];

/** 重叠量化粒度（px）：在此范围内视为同格 */
const OVERLAP_GRID = 12;

/** easeOutBack：带轻微过冲的弹入曲线（出生动画手感） */
function easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** 建筑/塔/水晶出生弹入时长（秒） */
const STRUCTURE_SPAWN_DUR = 0.38;
/** 单位出生弹入时长（秒）：战场高频刷兵，用更短时长避免视觉噪音 */
const UNIT_SPAWN_DUR = 0.25;

/** 单位兵种图标（灰盒兜底：叠加在形状上帮助区分兵种） */
const UNIT_ICONS: Record<UnitType, string> = {
    tank: '🛡️',
    ranged: '🏹',
    aoe: '✨',
    rush: '⚡',
    siege: '🏰',
};

/** 血条颜色缓存（避免每帧 new Color 造成 GC 压力） */
const HP_GREEN = new Color(90, 220, 90);
const HP_YELLOW = new Color(235, 190, 70);
const HP_RED = new Color(235, 80, 70);

/** 敌我脚底色环颜色 */
const SIDE_RING: Record<Side, Color> = {
    red: new Color(255, 70, 70, 150),
    blue: new Color(70, 130, 255, 150),
};

/** 单位程序动画状态（每单位一份，随对象池复用重置） */
interface UnitAnimState {
    phase: number; lastX: number; lastY: number; movingHold: number; walkBlend: number;
    lunge: { t: number; dur: number; ox: number; oy: number } | null;
    spawnT: number; ghost: number;
}

export class GameView {

    /** id → Node 映射 */
    private crystalNodes: Map<string, Node> = new Map();
    private buildingNodes: Map<string, Node> = new Map();
    private towerNodes: Map<string, Node> = new Map();
    private unitNodes: Map<string, Node> = new Map();

    /** id → 当前渲染的重叠偏移（对目标偏移做指数平滑，消除量化边界跳变） */
    private unitOffsets: Map<string, { x: number; y: number }> = new Map();
    /** id → 插值后的渲染位置（联机锁步 10Hz 帧间平滑，消除阶梯卡顿） */
    private unitRenderPos: Map<string, { x: number; y: number }> = new Map();
    /** id → 程序动画状态（随机相位 + 上帧位置；movingHold 行走保持；walkBlend 行走/待机平滑过渡；lunge 近战冲锋动作；spawnT 出生弹入进度；ghost 血条拖尾比例） */
    private unitAnim: Map<string, UnitAnimState> = new Map();
    /** 建筑/塔/水晶出生弹入动画（id → 计时 + 节点；纯程序曲线，不创建 Tween 对象） */
    private spawnAnims: Map<string, { t: number; dur: number; node: Node }> = new Map();
    /** 程序动画累计时间 */
    private animTime = 0;

    /** 对象池 */
    private pool: NodePool = new NodePool();

    private container: Node;
    private spriteFactory: ColorSpriteFactory;
    /** 美术资源库（可选：未注入或资源缺失时全部走灰盒兜底） */
    private art: ArtLibrary | null = null;

    constructor(container: Node, spriteFactory: ColorSpriteFactory, art?: ArtLibrary | null) {
        this.container = container;
        this.spriteFactory = spriteFactory;
        this.art = art ?? null;
    }

    /** 每帧调用：从 GameState 同步所有实体的视觉（dt 用于单位偏移平滑与程序动画） */
    sync(state: GameState, dt: number = 1 / 60, interpolate: boolean = false) {
        this.animTime += dt;
        // 出生弹入动画（建筑/塔/水晶）
        this.tickSpawnAnims(dt);
        // 水晶
        this.syncCrystals(state);
        // 建筑（含学院/光环塔）
        this.syncBuildings(state);
        // 塔（基地塔）
        this.syncTowers(state);
        // 单位（立绘 + 程序动画）
        this.syncUnits(state, dt, interpolate);
    }

    /** 销毁所有节点（重新开局时调用） */
    clear() {
        this.clearMap(this.crystalNodes, 'crystal');
        this.clearMap(this.buildingNodes, 'building');
        this.clearMap(this.towerNodes, 'tower');
        this.clearMap(this.unitNodes, 'unit');
        this.unitOffsets.clear();
        this.unitRenderPos.clear();
        this.unitAnim.clear();
        this.spawnAnims.clear();
        this.pool.clearAll();
    }

    /**
     * 近战冲锋表现：单位 Body 向目标方向突进 7px 再弹回（0.2s sin 半周期）。
     * 由 GameManager 消费 hit 事件（tank/rush）时调用；与行走/待机动画叠加。
     */
    playMeleeLunge(unitId: string, fromX: number, fromY: number, toX: number, toY: number) {
        const anim = this.unitAnim.get(unitId);
        if (!anim) return; // 单位节点尚未创建（同帧出生即攻击等边缘情况）
        const dx = toX - fromX, dy = toY - fromY;
        const len = Math.hypot(dx, dy);
        if (len < 1) return;
        anim.lunge = { t: 0, dur: 0.2, ox: (dx / len) * 7, oy: (dy / len) * 7 };
    }

    /** 开始一段出生弹入动画（建筑/塔/水晶创建时调用） */
    private beginSpawn(id: string, node: Node, dur: number = STRUCTURE_SPAWN_DUR) {
        node.setScale(0, 0, 1);
        this.spawnAnims.set(id, { t: 0, dur, node });
    }

    /** 推进出生弹入动画：easeOutBack 从 0 过冲弹到 1（纯程序曲线，无 Tween 对象） */
    private tickSpawnAnims(dt: number) {
        for (const [id, anim] of this.spawnAnims) {
            // 实体可能在动画中途死亡：节点已销毁则直接丢弃
            if (!anim.node.isValid) {
                this.spawnAnims.delete(id);
                continue;
            }
            anim.t += dt;
            const p = Math.min(1, anim.t / anim.dur);
            const s = Math.max(0, easeOutBack(p));
            anim.node.setScale(s, s, 1);
            if (p >= 1) this.spawnAnims.delete(id);
        }
    }

    /** 在节点中心叠加 emoji 图标（灰盒兜底：建筑/塔用） */
    private addCenterIcon(parent: Node, icon: string, fontSize: number) {
        const node = new Node('Icon');
        node.layer = parent.layer;
        node.parent = parent;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(24, 18);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const label = node.addComponent(Label);
        label.string = icon;
        label.fontSize = fontSize;
        label.lineHeight = fontSize;
        node.setPosition(0, 0, 0);
    }

    /** 单位立绘路径：u_{阵营}_{定位} */
    private unitArtPath(faction: FactionId, type: UnitType): string {
        return `units/u_${faction}_${type}`;
    }

    /** 大本营立绘路径：hq_{阵营} */
    private hqArtPath(faction: FactionId): string {
        return `units/hq_${faction}`;
    }

    /** 尝试创建美术精灵节点；资源缺失返回 null（调用方走灰盒兜底） */
    private makeArtNode(path: string, w: number, h: number): Node | null {
        if (!this.art || !this.art.isLoaded()) return null;
        return this.art.createSpriteNode(path, w, h);
    }

    /** 敌我识别：脚底红/蓝小色环（07 方案 §3.2，程序绘制） */
    private addSideRing(parent: Node, side: Side, footY: number) {
        const ring = this.spriteFactory.createColorNode(SIDE_RING[side].clone(), 30, 30, 'circle');
        ring.name = 'SideRing';
        ring.parent = parent;
        ring.setScale(1, 0.32, 1); // 圆压扁成椭圆环垫在脚下
        ring.setPosition(0, footY, 0);
    }

    // ==================== 各实体同步 ====================

    private syncCrystals(state: GameState) {
        const aliveIds = new Set<string>();
        for (const c of state.crystals) {
            aliveIds.add(c.id);
            let node = this.crystalNodes.get(c.id);
            if (!node) {
                const faction = state.factions[c.side];
                // 优先 Q 版大本营立绘（80px），缺失回退六角色块
                node = this.makeArtNode(this.hqArtPath(faction), 80, 80)
                    ?? this.pool.acquire('crystal_' + c.side, () =>
                        this.spriteFactory.createColorNode(ENTITY_COLORS.crystal[c.side], 60, 60, 'hexagon'),
                    );
                if (node.name !== 'crystal_' + c.side) {
                    // 美术节点不入池（池按 key 复用灰盒节点，混用会破坏类型）
                    node.name = 'ArtCrystal_' + c.side;
                }

                // 护盾罩：半透明蓝圆环，激活时显示（水晶护盾命令）
                const shieldFx = this.spriteFactory.createColorNode(new Color(110, 190, 255, 90), 96, 96, 'circle');
                shieldFx.name = 'ShieldFx';
                shieldFx.parent = node;
                shieldFx.active = false;

                // 决战警示罩：半透明红圆，决战时刻起呼吸闪烁（水晶掉血可视化归因）
                const dangerFx = this.spriteFactory.createColorNode(new Color(255, 82, 82, 70), 104, 104, 'circle');
                dangerFx.name = 'DangerFx';
                dangerFx.parent = node;
                dangerFx.active = false;

                node.parent = this.container;
                this.crystalNodes.set(c.id, node);
                // 水晶（大本营）出生弹入：开局仪式感
                this.beginSpawn(c.id, node, 0.45);
                // 大本营血条：核心目标受损必须一眼可见
                this.addStructureHpBar(node, 56, 48);
            }
            node.setPosition(c.x, c.y, 0);
            this.updateStructureHpBar(node, c.hp, c.maxHp);
            // 护盾罩跟随护盾状态（呼吸脉冲表现活力）
            const shieldFx = node.getChildByName('ShieldFx');
            if (shieldFx) {
                shieldFx.active = c.shield > 0;
                if (c.shield > 0) {
                    const pulse = 1 + Math.sin(state.time * 6) * 0.06;
                    shieldFx.setScale(pulse, pulse, 1);
                }
            }
            // 决战警示罩：决战时刻起红色呼吸闪烁，提示水晶正在持续崩解
            const dangerFx = node.getChildByName('DangerFx');
            if (dangerFx) {
                const inDanger = state.time >= GAME_CONFIG.suddenDeathTime;
                dangerFx.active = inDanger;
                if (inDanger) {
                    const pulse = 1 + Math.sin(state.time * 8) * 0.12;
                    dangerFx.setScale(pulse, pulse, 1);
                }
            }
        }
        this.cleanupDead(aliveIds, this.crystalNodes, 'crystal');
    }

    private syncBuildings(state: GameState) {
        const aliveIds = new Set<string>();
        for (const b of state.buildings) {
            aliveIds.add(b.id);
            let node = this.buildingNodes.get(b.id);
            if (!node) {
                // 优先建筑立绘：工厂按兵种、学院用专属图；缺失回退灰盒形状
                const artPath = b.unitType !== null
                    ? `buildings/b_factory_${b.unitType}`
                    : (b.kind === 'academy' ? 'buildings/b_academy' : null);
                const artSize = b.kind === 'academy' ? 54 : 50;
                let created: Node | null = artPath ? this.makeArtNode(artPath, artSize, artSize) : null;
                if (created) {
                    node = created;
                    node.name = 'ArtBuilding_' + (b.kind ?? 'factory') + '_' + b.side;
                } else {
                    // 灰盒兜底：工厂方形 40×40；学院六角 46×46
                    let shape: Shape = 'rect';
                    let w = 40, h = 40;
                    let colorKey = 'building';
                    if (b.kind === 'academy') {
                        shape = 'hexagon';
                        w = 46; h = 46;
                        colorKey = 'academy';
                    }
                    const colors = ENTITY_COLORS[colorKey];
                    node = this.pool.acquire(`building_${b.kind ?? 'factory'}_${b.side}`, () =>
                        this.spriteFactory.createColorNode(colors[b.side], w, h, shape),
                    );
                    // 中心叠加建筑图标（灰盒表现）
                    if (b.unitType !== null) {
                        this.addCenterIcon(node, BUILDING_CONFIG[b.unitType].icon, 16);
                    } else if (b.kind === 'academy') {
                        this.addCenterIcon(node, '🎓', 16);
                    }
                }
                node.parent = this.container;
                // 工厂挂星标子节点（Lv2 ★ / Lv3 ★★）
                if (b.kind !== 'academy') {
                    const badge = new Node('StarBadge');
                    badge.layer = node.layer;
                    badge.parent = node;
                    const ut = badge.addComponent(UITransform);
                    ut.contentSize = new Size(40, 14);
                    const label = badge.addComponent(Label);
                    label.string = '';
                    label.fontSize = 12;
                    label.color = new Color(255, 215, 94);
                    label.lineHeight = 12;
                    badge.setPosition(0, 28, 0);
                }
                this.buildingNodes.set(b.id, node);
                // 建筑出生弹入：落地弹一下，强化"刚建成"的反馈
                this.beginSpawn(b.id, node);
                // 建筑血条：被打时能直观看到耐久变化
                this.addStructureHpBar(node, 36, 38);
            }
            node.setPosition(b.x, b.y, 0);
            this.updateStructureHpBar(node, b.hp, b.maxHp);
            // 工厂等级用星标区分（v0.5：建筑不再随等级变大，避免视觉挤压）
            const badge = node.getChildByName('StarBadge');
            if (badge) {
                const label = badge.getComponent(Label);
                if (label) label.string = b.level === 2 ? '★' : b.level === 3 ? '★★' : '';
            }
        }
        this.cleanupDead(aliveIds, this.buildingNodes, 'building');
    }

    private syncTowers(state: GameState) {
        const aliveIds = new Set<string>();
        for (const t of state.towers) {
            aliveIds.add(t.id);
            let node = this.towerNodes.get(t.id);
            if (!node) {
                // 优先立绘：光环塔 b_aura / 基地塔 b_tower；缺失回退灰盒形状
                const artPath = t.kind === 'aura' ? 'buildings/b_aura' : 'buildings/b_tower';
                const artSize = t.kind === 'aura' ? 50 : 44;
                let created: Node | null = this.makeArtNode(artPath, artSize, artSize);
                if (created) {
                    node = created;
                    node.name = 'ArtTower_' + t.kind + '_' + t.side;
                } else {
                    let shape: Shape = 'triangle';
                    let w = 30, h = 30;
                    let colorKey = 'tower';
                    if (t.kind === 'aura') {
                        shape = 'circle';
                        w = 36; h = 36;
                        colorKey = 'aura';
                    }
                    const colors = ENTITY_COLORS[colorKey];
                    node = this.pool.acquire(`tower_${t.kind}_${t.side}`, () =>
                        this.spriteFactory.createColorNode(colors[t.side], w, h, shape),
                    );
                    if (t.kind === 'aura') {
                        this.addCenterIcon(node, '💠', 14);
                    }
                }
                node.parent = this.container;
                this.towerNodes.set(t.id, node);
                // 塔出生弹入：与建筑一致的"刚建成"反馈
                this.beginSpawn(t.id, node);
                // 塔血条：与建筑/水晶统一
                this.addStructureHpBar(node, 34, 30);
            }
            node.setPosition(t.x, t.y, 0);
            this.updateStructureHpBar(node, t.hp, t.maxHp);
        }
        this.cleanupDead(aliveIds, this.towerNodes, 'tower');
    }

    private syncUnits(state: GameState, dt: number, interpolate: boolean) {
        const aliveIds = new Set<string>();
        const hasArt = this.art?.isLoaded() === true;

        // 第一遍：统计同格单位数量（重叠判定）
        const gridCount = new Map<string, number>();
        for (const u of state.units) {
            const key = `${Math.round(u.x / OVERLAP_GRID)},${Math.round(u.y / OVERLAP_GRID)}`;
            gridCount.set(key, (gridCount.get(key) ?? 0) + 1);
        }

        // 平滑系数：帧率无关的指数趋近（约 8 帧收敛 90%）
        const smooth = 1 - Math.pow(0.001, dt);

        // 第二遍：按同格内序号错开渲染（偏移做平滑，消除量化边界跳变导致的卡顿感）
        const gridIndex = new Map<string, number>();
        for (const u of state.units) {
            aliveIds.add(u.id);
            const faction = state.factions[u.side];
            let node = this.unitNodes.get(u.id);
            if (!node) {
                if (hasArt) {
                    node = this.createArtUnitNode(u, faction);
                }
                if (!node) {
                    node = this.createFallbackUnitNode(u);
                }
                node.parent = this.container;
                this.unitNodes.set(u.id, node);
                // 程序动画初始状态（随机相位：避免全场整齐划一地浮动）
                this.unitAnim.set(u.id, {
                    phase: Math.random() * Math.PI * 2,
                    lastX: u.x, lastY: u.y, movingHold: 0, walkBlend: 0,
                    lunge: null,
                    spawnT: 0, // 出生弹入从 0 开始
                    ghost: 1,  // 血条拖尾从满血开始
                });
            }

            // 重叠散开：同格内多个单位按固定序列偏移视觉位置；偏移经指数平滑，
            // 单位跨过量化格边界或桶内顺序变化时不再产生位置跳变
            const key = `${Math.round(u.x / OVERLAP_GRID)},${Math.round(u.y / OVERLAP_GRID)}`;
            const idx = gridIndex.get(key) ?? 0;
            gridIndex.set(key, idx + 1);
            const target = (gridCount.get(key) ?? 1) > 1 ? OVERLAP_SPREAD[idx % OVERLAP_SPREAD.length] : [0, 0];

            let so = this.unitOffsets.get(u.id);
            if (!so) {
                so = { x: target[0], y: target[1] };
                this.unitOffsets.set(u.id, so);
            } else {
                so.x += (target[0] - so.x) * smooth;
                so.y += (target[1] - so.y) * smooth;
            }

            // 渲染位置 = 逻辑位置（始终插值：逻辑 30Hz→渲染 60Hz 平滑，消除跳步）+ 散开偏移
            let rx = u.x, ry = u.y;
            {
                let rp = this.unitRenderPos.get(u.id);
                if (!rp) { rp = { x: u.x, y: u.y }; this.unitRenderPos.set(u.id, rp); }
                rp.x += (u.x - rp.x) * smooth;
                rp.y += (u.y - rp.y) * smooth;
                rx = rp.x; ry = rp.y;
            }
            node.setPosition(rx + so.x, ry + so.y, 0);

            // 程序动画（07 方案 §6）：待机 sin 浮动 ±3px/2s；行走弹跳 + 挤压拉伸 + 前倾摇摆
            // 纯数学计算在 Body 子节点上叠加，不创建 Tween 对象（120 单位性能守则）
            const anim = this.unitAnim.get(u.id);
            if (anim) {
                // 出生弹入计时：独立于行走/待机动画推进，期间整体缩放从 0 弹到等级尺寸
                if (anim.spawnT < UNIT_SPAWN_DUR) anim.spawnT = Math.min(UNIT_SPAWN_DUR, anim.spawnT + dt);

                // 行走保持计时（v1.4.3）：逻辑 30Hz / 渲染 60Hz 下隔帧 dx=0，
                // 直接按"本帧是否位移"判定会让行走/待机动画逐帧翻转（视觉闪烁）。
                // 改为检测到位移后保持 0.2s 行走态，逻辑帧间隙不再回退到待机。
                const moved = (u.x - anim.lastX) ** 2 + (u.y - anim.lastY) ** 2 > 0.01;
                if (moved) anim.movingHold = 0.2;
                else anim.movingHold = Math.max(0, anim.movingHold - dt);
                anim.lastX = u.x; anim.lastY = u.y;
                const moving = anim.movingHold > 0;

                // 近战冲锋（lunge）：sin 半周期冲向目标再弹回，与行走动画叠加
                let lungeX = 0, lungeY = 0;
                if (anim.lunge) {
                    anim.lunge.t += dt;
                    const lp = anim.lunge.t / anim.lunge.dur;
                    if (lp >= 1) {
                        anim.lunge = null;
                    } else {
                        const k = Math.sin(lp * Math.PI);
                        lungeX = anim.lunge.ox * k;
                        lungeY = anim.lunge.oy * k;
                    }
                }

                const body = node.getChildByName('Body');
                if (body) {
                    // 蓝方立绘 scaleX=-1，挤压拉伸必须保留翻转方向
                    const dirX = u.side === 'blue' ? -1 : 1;

                    // 行走/待机平滑过渡：直接硬切换会跳相位（弹跳高度/角度突变），
                    // 用 walkBlend 0..1 以约 0.12s 指数趋近，动画参数按混合系数插值
                    const blend = anim.walkBlend;
                    anim.walkBlend += ((moving ? 1 : 0) - blend) * Math.min(1, dt * 8);

                    // 步频匹配移速（游戏动画最佳实践：脚步动画节奏应与位移速度成正比，
                    // 否则慢单位"滑步"、快单位"慢动作滑冰"）：siege 25 → 3.5Hz，rush 100 → 9Hz
                    const speed = UNIT_CONFIG[u.type].speed;
                    const freq = Math.min(10, Math.max(3.5, speed * 0.09));
                    const bounceH = Math.min(3.4, Math.max(2, speed / 30)); // 弹跳高度随移速微调

                    // 行走分量：弹跳 + 前倾 4° + 步幅滚动 ±2.5° + 挤压拉伸
                    const tw = this.animTime * Math.PI * 2 * freq + anim.phase;
                    const wk = Math.sin(tw);
                    const walkY = Math.abs(wk) * bounceH;
                    const walkAngle = wk * 2.5 + dirX * 4;
                    const walkSx = 1 - wk * 0.05;
                    const walkSy = 1 + wk * 0.05;

                    // 待机分量：2.4s 周期浮动 ±3px + 呼吸缩放 ±1.5%（生命感）
                    const ti = this.animTime * Math.PI * 2 / 2.4 + anim.phase;
                    const idleY = Math.sin(ti) * 3;
                    const breathe = 1 + Math.sin(ti) * 0.015;
                    const idleSx = 1 - (breathe - 1) * 0.6;

                    // 混合输出（lunge 位移全额叠加，冲锋瞬间保留前倾）
                    const lungeTilt = lungeX !== 0 || lungeY !== 0 ? dirX * 4 : 0;
                    body.setPosition(lungeX, (idleY * (1 - blend) + walkY * blend) + lungeY, 0);
                    body.angle = walkAngle * blend + lungeTilt * (1 - blend);
                    body.setScale(
                        dirX * (idleSx * (1 - blend) + walkSx * blend),
                        breathe * (1 - blend) + walkSy * blend,
                        1,
                    );
                }
            }

            // 精英等级用缩放表示；出生弹入期间叠加 easeOutBack 缩放（从 0 过冲弹到等级尺寸）
            const levelScale = u.level === 1 ? 1 : u.level === 2 ? 1.2 : 1.4;
            const spawnK = anim && anim.spawnT < UNIT_SPAWN_DUR
                ? Math.max(0, easeOutBack(anim.spawnT / UNIT_SPAWN_DUR))
                : 1;
            setUniformScale(node, levelScale * spawnK);

            this.updateHpBar(node, u, dt, anim);
            this.updateStatusBadge(node, u);
        }

        // 清理死亡单位的偏移与插值记录
        for (const id of this.unitOffsets.keys()) {
            if (!aliveIds.has(id)) this.unitOffsets.delete(id);
        }
        for (const id of this.unitRenderPos.keys()) {
            if (!aliveIds.has(id)) this.unitRenderPos.delete(id);
        }
        for (const id of this.unitAnim.keys()) {
            if (!aliveIds.has(id)) this.unitAnim.delete(id);
        }
        this.cleanupDead(aliveIds, this.unitNodes, 'unit');
    }

    /**
     * 创建美术版单位节点（M3.1）：
     * 根容器（定位/缩放）→ Body（立绘，蓝方水平翻转，程序动画作用点）
     *                      → SideRing（敌我色环）/ HpBar / StatusBadge
     */
    private createArtUnitNode(u: UnitState, faction: FactionId): Node {
        const size = UNIT_ART_SIZES[u.type];
        const root = new Node('Unit_' + u.id);
        root.layer = this.container.layer;
        root.addComponent(UITransform).contentSize = new Size(size.w, size.h);

        const sprite = this.art!.createSpriteNode(this.unitArtPath(faction, u.type), size.w, size.h);
        if (!sprite) return this.createFallbackUnitNode(u);
        sprite.name = 'Body';
        sprite.parent = root;
        // 蓝方向左进攻：水平翻转（08 指南 §2.2，不生成两套图）
        if (u.side === 'blue') sprite.setScale(-1, 1, 1);
        this.addSideRing(root, u.side, -size.h * 0.42);
        this.addHpBar(root);
        this.addStatusBadge(root);
        return root;
    }

    /** 灰盒兜底单位节点（原 v1.3 表现，美术缺失时使用） */
    private createFallbackUnitNode(u: UnitState): Node {
        const spec = UNIT_SHAPES[u.type];
        const colors = ENTITY_COLORS.unit;
        const node = this.pool.acquire(`unit_${u.type}_${u.side}`, () =>
            this.spriteFactory.createColorNode(colors[u.side], spec.w, spec.h, spec.shape),
        );
        node.name = 'Unit_' + u.id;
        this.addUnitIcon(node, u.type);
        this.addHpBar(node);
        this.addStatusBadge(node);
        return node;
    }

    /** 给单位节点中心叠加兵种 emoji 图标（灰盒兜底） */
    private addUnitIcon(unitNode: Node, type: UnitType) {
        const icon = new Node('TypeIcon');
        icon.layer = unitNode.layer;
        icon.parent = unitNode;
        const ut = icon.addComponent(UITransform);
        ut.contentSize = new Size(20, 12);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const label = icon.addComponent(Label);
        label.string = UNIT_ICONS[type];
        label.fontSize = 10;
        label.lineHeight = 10;
        icon.setPosition(0, 0, 0);
    }

    // ==================== 单位附属 UI（血条 / 状态图标） ====================

    /** 给单位节点挂血条子节点（创建时调用一次） */
    private addHpBar(unitNode: Node) {
        const bar = new Node('HpBar');
        bar.layer = unitNode.layer;
        bar.parent = unitNode;
        const barUt = bar.addComponent(UITransform);
        barUt.contentSize = new Size(22, 3);
        barUt.anchorPoint = new Vec2(0.5, 0.5);
        bar.setPosition(0, 17, 0);

        const bg = this.spriteFactory.createColorNode(new Color(20, 20, 20, 200), 22, 3);
        bg.name = 'HpBg';
        bg.parent = bar;

        // 拖尾残影条（ghost bar）：位于底色与填充条之间，受伤后缓慢追赶实际血量，
        // 直观表现"这一下掉了多少血"
        const ghost = this.spriteFactory.createColorNode(new Color(255, 120, 110, 220), 22, 3);
        ghost.name = 'HpGhost';
        ghost.parent = bar;
        const ghostUt = ghost.getComponent(UITransform);
        ghostUt.anchorPoint = new Vec2(0, 0.5);
        ghost.setPosition(-11, 0, 0);

        const fill = this.spriteFactory.createColorNode(new Color(90, 220, 90), 22, 3);
        fill.name = 'HpFill';
        fill.parent = bar;
        // 填充条锚定左缘，缩放时从右向左缩短
        const fillUt = fill.getComponent(UITransform);
        fillUt.anchorPoint = new Vec2(0, 0.5);
        fill.setPosition(-11, 0, 0);
    }

    /** 每帧更新血条：满血隐藏，受损时按比例缩短并变色；拖尾条缓慢追赶表现伤害量 */
    private updateHpBar(unitNode: Node, u: UnitState, dt: number, anim?: UnitAnimState) {
        const bar = unitNode.getChildByName('HpBar');
        if (!bar) return;
        const damaged = u.hp < u.maxHp;
        bar.active = damaged;
        if (!damaged) {
            // 满血时重置拖尾，下次受伤从满血残影开始追赶
            if (anim) anim.ghost = 1;
            return;
        }

        const fill = bar.getChildByName('HpFill');
        if (!fill) return;
        const ratio = Math.max(0, Math.min(1, u.hp / u.maxHp));
        fill.setScale(ratio, 1, 1);
        const sp = fill.getComponent(Sprite);
        if (sp) {
            sp.color = ratio > 0.5 ? HP_GREEN : ratio > 0.25 ? HP_YELLOW : HP_RED;
        }

        // 拖尾追赶：受伤时残影以固定速率向实际比例收敛；治疗/回升立即贴合
        let ghost = anim ? anim.ghost : ratio;
        if (ratio >= ghost) {
            ghost = ratio;
        } else {
            ghost += (ratio - ghost) * Math.min(1, dt * 3.5);
        }
        if (anim) anim.ghost = ghost;

        // 残影只在实际血量明显更低时显示，避免与填充条重叠时露边
        const ghostNode = bar.getChildByName('HpGhost');
        if (ghostNode) {
            const showGhost = ghost > ratio + 0.02;
            ghostNode.active = showGhost;
            if (showGhost) ghostNode.setScale(ghost, 1, 1);
        }
    }

    // ==================== 结构体血条（水晶 / 建筑 / 塔） ====================

    /** 给结构节点挂血条（创建时调用一次）：底条 + 填充条（锚定左缘，从右向左缩短） */
    private addStructureHpBar(node: Node, width: number, y: number) {
        const bar = new Node('StructHpBar');
        bar.layer = node.layer;
        bar.parent = node;
        const barUt = bar.addComponent(UITransform);
        barUt.contentSize = new Size(width, 4);
        barUt.anchorPoint = new Vec2(0.5, 0.5);
        bar.setPosition(0, y, 0);

        const bg = this.spriteFactory.createColorNode(new Color(20, 20, 20, 200), width, 4);
        bg.name = 'HpBg';
        bg.parent = bar;

        const fill = this.spriteFactory.createColorNode(HP_GREEN, width, 4);
        fill.name = 'HpFill';
        fill.parent = bar;
        const fillUt = fill.getComponent(UITransform);
        fillUt.anchorPoint = new Vec2(0, 0.5);
        fill.setPosition(-width / 2, 0, 0);

        // 满血隐藏，受损才出现（与单位血条同规则，避免满屏血条噪音）
        bar.active = false;
    }

    /** 每帧更新结构血条：满血隐藏，受损时按比例缩短并三段变色 */
    private updateStructureHpBar(node: Node, hp: number, maxHp: number) {
        const bar = node.getChildByName('StructHpBar');
        if (!bar) return;
        const damaged = hp < maxHp;
        bar.active = damaged;
        if (!damaged) return;
        const fill = bar.getChildByName('HpFill');
        if (!fill) return;
        const ratio = Math.max(0, Math.min(1, hp / maxHp));
        fill.setScale(ratio, 1, 1);
        const sp = fill.getComponent(Sprite);
        if (sp) sp.color = ratio > 0.5 ? HP_GREEN : ratio > 0.25 ? HP_YELLOW : HP_RED;
    }

    /** 给单位节点挂状态图标子节点（创建时调用一次） */
    private addStatusBadge(unitNode: Node) {
        const badge = new Node('StatusBadge');
        badge.layer = unitNode.layer;
        badge.parent = unitNode;
        const ut = badge.addComponent(UITransform);
        ut.contentSize = new Size(30, 14);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const label = badge.addComponent(Label);
        label.string = '';
        label.fontSize = 11;
        label.color = new Color(255, 235, 160);
        label.lineHeight = 12;
        badge.setPosition(0, 26, 0);
        badge.active = false;
    }

    /** 每帧更新状态图标：精英星标 / 减速 / 定身等临时 UI */
    private updateStatusBadge(unitNode: Node, u: UnitState) {
        const badge = unitNode.getChildByName('StatusBadge');
        if (!badge) return;
        const label = badge.getComponent(Label);
        if (!label) return;

        let text = '';
        if (u.stunDur > 0) text += '💫';
        else if (u.slowDur > 0) text += '🐌';
        // 星级与等级一致：二级=★★、三级=★★★（与信息面板口径统一）
        if (u.level === 2) text += '★★';
        else if (u.level === 3) text += '★★★';
        label.string = text;
        badge.active = text.length > 0;
    }

    // ==================== 内部辅助 ====================

    /** 清理已不存在的实体节点（回收到对象池；美术节点直接销毁） */
    private cleanupDead(aliveIds: Set<string>, nodeMap: Map<string, Node>, poolKey: string) {
        for (const [id, node] of nodeMap) {
            if (!aliveIds.has(id)) {
                if (node.name.startsWith('Art') || node.name.startsWith('Unit_')) {
                    node.destroy();
                } else {
                    this.pool.release(node, poolKey);
                }
                nodeMap.delete(id);
            }
        }
    }

    private clearMap(map: Map<string, Node>, poolKey: string) {
        for (const [, node] of map) {
            if (node.name.startsWith('Art') || node.name.startsWith('Unit_')) {
                node.destroy();
            } else {
                this.pool.release(node, poolKey);
            }
        }
        map.clear();
    }
}
