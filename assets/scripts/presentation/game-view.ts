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

import { Node, Color, Sprite, UIOpacity } from 'cc';
import { ColorSpriteFactory, Shape } from './color-sprite-factory';
import { NodePool } from './node-pool';
import { setUniformScale } from './scale-helper';
import type { GameState, Side, UnitType } from '../core/types';

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

export class GameView {

    /** id → Node 映射 */
    private crystalNodes: Map<string, Node> = new Map();
    private buildingNodes: Map<string, Node> = new Map();
    private towerNodes: Map<string, Node> = new Map();
    private unitNodes: Map<string, Node> = new Map();

    /** 对象池 */
    private pool: NodePool = new NodePool();

    private container: Node;
    private spriteFactory: ColorSpriteFactory;

    constructor(container: Node, spriteFactory: ColorSpriteFactory) {
        this.container = container;
        this.spriteFactory = spriteFactory;
    }

    /** 每帧调用：从 GameState 同步所有实体的视觉 */
    sync(state: GameState) {
        // 水晶
        this.syncCrystals(state);
        // 建筑（含学院/光环塔）
        this.syncBuildings(state);
        // 塔（基地塔）
        this.syncTowers(state);
        // 单位（按兵种形状）
        this.syncUnits(state);
    }

    /** 销毁所有节点（重新开局时调用） */
    clear() {
        this.clearMap(this.crystalNodes, 'crystal');
        this.clearMap(this.buildingNodes, 'building');
        this.clearMap(this.towerNodes, 'tower');
        this.clearMap(this.unitNodes, 'unit');
        this.pool.clearAll();
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
                // 根据建筑类型选形状
                let shape: Shape = 'rect';
                let w = 40, h = 40;
                let colorKey = 'building';
                if (!b.unitType) {
                    // 非兵工厂（不应该出现在 buildings 里，但防御性处理）
                    shape = 'rect';
                }
                const colors = ENTITY_COLORS[colorKey];
                node = this.pool.acquire(`building_${b.side}`, () =>
                    this.spriteFactory.createColorNode(colors[b.side], w, h, shape),
                );
                node.parent = this.container;
                this.buildingNodes.set(b.id, node);
            }
            node.setPosition(b.x, b.y, 0);
            // 精英等级用缩放表示
            const levelScale = b.level === 1 ? 1 : b.level === 2 ? 1.15 : 1.3;
            setUniformScale(node, levelScale);
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
                this.towerNodes.set(t.id, node);
            }
            node.setPosition(t.x, t.y, 0);
        }
        this.cleanupDead(aliveIds, this.towerNodes, 'tower');
    }

    private syncUnits(state: GameState) {
        const aliveIds = new Set<string>();
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
                this.unitNodes.set(u.id, node);
            }
            node.setPosition(u.x, u.y, 0);
            // 精英等级用缩放表示
            const levelScale = u.level === 1 ? 1 : u.level === 2 ? 1.2 : 1.4;
            setUniformScale(node, levelScale);
        }
        this.cleanupDead(aliveIds, this.unitNodes, 'unit');
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
