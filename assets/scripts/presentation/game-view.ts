/**
 * GameView —— 战场实体视觉同步（M5 增强版）
 *
 * 职责：
 *  - 维护 id → Node 映射，按实体 ID 精确创建/销毁节点
 *  - 每帧从 GameState 读取数据，同步位置与颜色
 *  - 不同兵种/建筑使用不同形状区分（灰盒阶段）
 *  - 集成对象池，避免频繁创建/销毁节点
 *  - 只负责视觉表现，不修改游戏数据
 *
 * 形状映射：
 *  - 水晶：六角形 60×60
 *  - 兵工厂：方形 40×40
 *  - 学院：六角形 44×44
 *  - 光环塔：圆形 36×36
 *  - 基地塔：三角形 30×30
 *  - 坦克：圆形 20×20
 *  - 远程：菱形 14×14
 *  - AOE：星形 18×18
 *  - 冲锋：三角形 18×18
 *  - 攻城：矩形 22×14
 */

import { Node, Color, Sprite, UIOpacity, Label, UITransform, Size, Vec2 } from 'cc';
import { ColorSpriteFactory, Shape } from './color-sprite-factory';
import { NodePool } from './node-pool';
import { setUniformScale } from './scale-helper';
import { BUILDING_CONFIG } from '../config/building-config';
import type { GameState, Side, UnitType, UnitState } from '../core/types';

/** 实体颜色表（按阵营边） */
const ENTITY_COLORS: Record<string, { red: Color; blue: Color }> = {
    crystal: { red: new Color(255, 100, 100), blue: new Color(100, 150, 255) },
    building: { red: new Color(200, 100, 100), blue: new Color(100, 150, 200) },
    academy: { red: new Color(220, 130, 100), blue: new Color(100, 170, 220) },
    aura: { red: new Color(255, 180, 100), blue: new Color(100, 200, 180) },
    tower: { red: new Color(220, 120, 120), blue: new Color(120, 170, 220) },
    unit: { red: new Color(255, 150, 150), blue: new Color(150, 200, 255) },
};

/** 兵种形状映射 */
const UNIT_SHAPES: Record<UnitType, { shape: Shape; w: number; h: number }> = {
    tank: { shape: 'circle', w: 20, h: 20 },
    ranged: { shape: 'diamond', w: 14, h: 14 },
    aoe: { shape: 'star', w: 18, h: 18 },
    rush: { shape: 'triangle', w: 18, h: 18 },
    siege: { shape: 'rect', w: 22, h: 14 },
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

/** 单位兵种图标（叠加在形状上，帮助区分 15 个兵种） */
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

export class GameView {

    /** id → Node 映射 */
    private crystalNodes: Map<string, Node> = new Map();
    private buildingNodes: Map<string, Node> = new Map();
    private towerNodes: Map<string, Node> = new Map();
    private unitNodes: Map<string, Node> = new Map();

    /** id → 当前渲染的重叠偏移（对目标偏移做指数平滑，消除量化边界跳变） */
    private unitOffsets: Map<string, { x: number; y: number }> = new Map();

    /** 对象池 */
    private pool: NodePool = new NodePool();

    private container: Node;
    private spriteFactory: ColorSpriteFactory;

    constructor(container: Node, spriteFactory: ColorSpriteFactory) {
        this.container = container;
        this.spriteFactory = spriteFactory;
    }

    /** 每帧调用：从 GameState 同步所有实体的视觉（dt 用于单位偏移平滑） */
    sync(state: GameState, dt: number = 1 / 60) {
        // 水晶
        this.syncCrystals(state);
        // 建筑（含学院/光环塔）
        this.syncBuildings(state);
        // 塔（基地塔）
        this.syncTowers(state);
        // 单位（按兵种形状）
        this.syncUnits(state, dt);
    }

    /** 销毁所有节点（重新开局时调用） */
    clear() {
        this.clearMap(this.crystalNodes, 'crystal');
        this.clearMap(this.buildingNodes, 'building');
        this.clearMap(this.towerNodes, 'tower');
        this.clearMap(this.unitNodes, 'unit');
        this.unitOffsets.clear();
        this.pool.clearAll();
    }

    /** 在节点中心叠加 emoji 图标（建筑/塔用） */
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

    // ==================== 各实体同步 ====================

    private syncCrystals(state: GameState) {
        const aliveIds = new Set<string>();
        for (const c of state.crystals) {
            aliveIds.add(c.id);
            let node = this.crystalNodes.get(c.id);
            if (!node) {
                const color = ENTITY_COLORS.crystal[c.side];
                node = this.pool.acquire('crystal_' + c.side, () =>
                    this.spriteFactory.createColorNode(color, 60, 60, 'hexagon'),
                );
                node.parent = this.container;
                this.crystalNodes.set(c.id, node);
            }
            node.setPosition(c.x, c.y, 0);
        }
        this.cleanupDead(aliveIds, this.crystalNodes, 'crystal');
    }

    private syncBuildings(state: GameState) {
        const aliveIds = new Set<string>();
        for (const b of state.buildings) {
            aliveIds.add(b.id);
            let node = this.buildingNodes.get(b.id);
            if (!node) {
                // 根据建筑类型选形状：工厂方形 40×40；学院六角 46×46
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
                node.parent = this.container;
                // 中心叠加建筑图标（🛡️🏹✨⚡🪨🎓，来自 building-config.icon）
                if (b.unitType !== null) {
                    this.addCenterIcon(node, BUILDING_CONFIG[b.unitType].icon, 16);
                } else if (b.kind === 'academy') {
                    this.addCenterIcon(node, '🎓', 16);
                }
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
                    badge.setPosition(0, 26, 0);
                }
                this.buildingNodes.set(b.id, node);
            }
            node.setPosition(b.x, b.y, 0);
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
                node.parent = this.container;
                if (t.kind === 'aura') {
                    this.addCenterIcon(node, '💠', 14);
                }
                this.towerNodes.set(t.id, node);
            }
            node.setPosition(t.x, t.y, 0);
        }
        this.cleanupDead(aliveIds, this.towerNodes, 'tower');
    }

    private syncUnits(state: GameState, dt: number) {
        const aliveIds = new Set<string>();

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
            let node = this.unitNodes.get(u.id);
            if (!node) {
                const spec = UNIT_SHAPES[u.type];
                const colors = ENTITY_COLORS.unit;
                node = this.pool.acquire(`unit_${u.type}_${u.side}`, () =>
                    this.spriteFactory.createColorNode(colors[u.side], spec.w, spec.h, spec.shape),
                );
                node.parent = this.container;
                this.addUnitIcon(node, u.type);
                this.addHpBar(node);
                this.addStatusBadge(node);
                this.unitNodes.set(u.id, node);
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

            // 渲染位置 = 逻辑位置（零延迟跟随）+ 平滑后的散开偏移
            node.setPosition(u.x + so.x, u.y + so.y, 0);

            // 精英等级用缩放表示
            const levelScale = u.level === 1 ? 1 : u.level === 2 ? 1.2 : 1.4;
            setUniformScale(node, levelScale);

            this.updateHpBar(node, u);
            this.updateStatusBadge(node, u);
        }

        // 清理死亡单位的偏移记录
        for (const id of this.unitOffsets.keys()) {
            if (!aliveIds.has(id)) this.unitOffsets.delete(id);
        }
        this.cleanupDead(aliveIds, this.unitNodes, 'unit');
    }

    /** 给单位节点中心叠加兵种 emoji 图标 */
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
        bar.setPosition(0, 15, 0);

        const bg = this.spriteFactory.createColorNode(new Color(20, 20, 20, 200), 22, 3);
        bg.name = 'HpBg';
        bg.parent = bar;

        const fill = this.spriteFactory.createColorNode(new Color(90, 220, 90), 22, 3);
        fill.name = 'HpFill';
        fill.parent = bar;
        // 填充条锚定左缘，缩放时从右向左缩短
        const fillUt = fill.getComponent(UITransform);
        fillUt.anchorPoint = new Vec2(0, 0.5);
        fill.setPosition(-11, 0, 0);
    }

    /** 每帧更新血条：满血隐藏，受损时按比例缩短并变色 */
    private updateHpBar(unitNode: Node, u: UnitState) {
        const bar = unitNode.getChildByName('HpBar');
        if (!bar) return;
        const damaged = u.hp < u.maxHp;
        bar.active = damaged;
        if (!damaged) return;

        const fill = bar.getChildByName('HpFill');
        if (!fill) return;
        const ratio = Math.max(0, Math.min(1, u.hp / u.maxHp));
        fill.setScale(ratio, 1, 1);
        const sp = fill.getComponent(Sprite);
        if (sp) {
            sp.color = ratio > 0.5 ? HP_GREEN : ratio > 0.25 ? HP_YELLOW : HP_RED;
        }
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
        badge.setPosition(0, 25, 0);
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
        if (u.level === 2) text += '★';
        else if (u.level === 3) text += '★★';
        label.string = text;
        badge.active = text.length > 0;
    }

    // ==================== 内部辅助 ====================

    /** 清理已不存在的实体节点（回收到对象池） */
    private cleanupDead(aliveIds: Set<string>, nodeMap: Map<string, Node>, poolKey: string) {
        for (const [id, node] of nodeMap) {
            if (!aliveIds.has(id)) {
                this.pool.release(node, poolKey);
                nodeMap.delete(id);
            }
        }
    }

    private clearMap(map: Map<string, Node>, poolKey: string) {
        for (const [, node] of map) {
            this.pool.release(node, poolKey);
        }
        map.clear();
    }
}
