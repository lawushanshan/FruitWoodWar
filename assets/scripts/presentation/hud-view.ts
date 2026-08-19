/**
 * HudView —— 顶部状态栏 + 底部建造栏
 *
 * 职责：
 *  - 创建并更新顶部状态栏（金币/人口/击杀/波次/水晶血量）
 *  - 创建并更新底部建造栏（7 种建筑按钮 + 升级/科研操作按钮）
 *  - 按当前阵营与游戏状态动态刷新建筑价格
 *  - 只负责视觉，不修改游戏数据；按钮点击通过 EventHandler 路由到 GameManager
 */

import {
    Node, Label, Color, UITransform, Size, Vec2, Button, EventHandler, view, visibleSize,
} from 'cc';
import { ColorSpriteFactory } from './color-sprite-factory';
import { setUniformScale } from './scale-helper';
import { GAME_CONFIG } from '../config/game-config';
import { BUILDING_CONFIG, BUILDING_IDS, buildingCost, researchCost } from '../config/building-config';
import type { BuildingItemId, GameState } from '../core/types';

export class HudView {

    // ---- 顶部状态栏标签 ----
    private goldLabel: Label | null = null;
    private waveLabel: Label | null = null;
    private popLabel: Label | null = null;
    private killsLabel: Label | null = null;
    private hpRedLabel: Label | null = null;
    private hpBlueLabel: Label | null = null;

    // ---- 建造栏 ----
    private buildBar: Node | null = null;
    private topBar: Node | null = null;
    /** 建筑按钮价格标签（按 BuildingItemId 索引） */
    private buildCostLabels: Map<BuildingItemId, Label> = new Map();
    /** 科研按钮价格标签 */
    private researchCostLabel: Label | null = null;

    /** 上次可视高度（用于检测屏幕变化） */
    private lastVisibleHeight: number = 0;

    private container: Node;
    private spriteFactory: ColorSpriteFactory;
    /** GameManager 所在节点（EventHandler 的 target） */
    private gmNode: Node;

    constructor(container: Node, spriteFactory: ColorSpriteFactory, gmNode: Node) {
        this.container = container;
        this.spriteFactory = spriteFactory;
        this.gmNode = gmNode;
    }

    /** 创建顶部状态栏和底部建造栏（初始化时调用一次） */
    create() {
        this.createTopBar();
        this.createBuildBar();
    }

    // ==================== 每帧更新 ====================

    /** 每帧更新顶部状态栏（只读快照） */
    update(state: GameState) {
        // 检测屏幕尺寸变化，调整布局
        this.checkResponsiveLayout();

        const ps = state.playerSide;
        if (this.goldLabel) this.goldLabel.string = '💰 ' + state.gold[ps];
        if (this.waveLabel) this.waveLabel.string = '🌊 第 ' + state.wave + ' 波';
        if (this.popLabel) {
            const pop = state.units.filter(u => u.side === ps).length;
            this.popLabel.string = '👥 ' + pop + '/' + GAME_CONFIG.unitCap;
        }
        if (this.killsLabel) this.killsLabel.string = '⚔ ' + state.stats.kills[ps];

        const rc = state.crystals.find(c => c.side === 'red');
        const bc = state.crystals.find(c => c.side === 'blue');
        if (this.hpRedLabel && rc) this.hpRedLabel.string = '🔴 ' + Math.max(0, Math.floor(rc.hp));
        if (this.hpBlueLabel && bc) this.hpBlueLabel.string = '🔵 ' + Math.max(0, Math.floor(bc.hp));
    }

    /** 按当前游戏状态刷新建造栏价格（建造/升级/科研后调用） */
    updatePrices(state: GameState) {
        const faction = state.factions[state.playerSide];
        const side = state.playerSide;

        for (const id of BUILDING_IDS) {
            const label = this.buildCostLabels.get(id);
            const conf = BUILDING_CONFIG[id];
            if (!label || !conf) continue;

            if (conf.kind === 'factory') {
                // 工厂：显示首座价格（同类递增在实际建造时生效）
                const cost = buildingCost(id, faction, 0);
                label.string = cost + '金';
            } else if (conf.kind === 'academy') {
                const level = state.academyLevel[side];
                if (level >= 2) {
                    label.string = '满级';
                } else {
                    const cost = level === 0 ? GAME_CONFIG.academyLv1Cost : GAME_CONFIG.academyLv2Cost;
                    label.string = cost + '金';
                }
            } else {
                label.string = conf.cost + '金';
            }
        }

        // 科研按钮价格
        if (this.researchCostLabel) {
            if (state.academyLevel[side] < 2) {
                this.researchCostLabel.string = '需学院2';
            } else {
                this.researchCostLabel.string = researchCost(state.researchLayers[side]) + '金';
            }
        }
    }

    // ==================== 创建顶部状态栏 ====================

    private createTopBar() {
        const bar = new Node('TopBar');
        bar.layer = this.gmNode.layer;
        bar.parent = this.container;
        const ut = bar.addComponent(UITransform);
        ut.contentSize = new Size(1280, 44);
        ut.anchorPoint = new Vec2(0.5, 1);
        this.topBar = bar;

        const bg = this.spriteFactory.createColorNode(new Color(34, 48, 58), 1280, 44);
        bg.parent = bar;
        bg.setPosition(0, -22, 0);

        this.goldLabel = this.makeLabel('💰 200', -550, -22, new Color(255, 215, 94), bar);
        this.popLabel = this.makeLabel('👥 0/60', -380, -22, Color.WHITE, bar);
        this.killsLabel = this.makeLabel('⚔ 0', -220, -22, Color.WHITE, bar);
        this.waveLabel = this.makeLabel('🌊 第 0 波', 200, -22, Color.WHITE, bar);
        this.hpRedLabel = this.makeLabel('🔴 ' + GAME_CONFIG.crystalHp, 400, -22, new Color(255, 138, 122), bar);
        this.hpBlueLabel = this.makeLabel('🔵 ' + GAME_CONFIG.crystalHp, 560, -22, new Color(122, 184, 255), bar);
    }

    // ==================== 响应式布局 ====================

    /**
     * 检测屏幕尺寸变化，调整 UI 布局防止重叠
     * - 窄屏（< 16:9）：缩小建造栏按钮，调整间距
     * - 超宽屏（> 21:9）：战场区域向两侧扩展
     */
    private checkResponsiveLayout() {
        const visHeight = visibleSize.height;
        const visWidth = visibleSize.width;

        // 只在尺寸变化时重新计算
        if (visHeight === this.lastVisibleHeight) return;
        this.lastVisibleHeight = visHeight;

        const aspectRatio = visWidth / visHeight;
        const isNarrow = aspectRatio < 16 / 9;

        // 顶部栏始终固定在屏幕顶部
        if (this.topBar) {
            this.topBar.setPosition(0, visHeight / 2, 0);
        }

        // 底部建造栏始终固定在屏幕底部
        if (this.buildBar) {
            this.buildBar.setPosition(0, -visHeight / 2, 0);

            // 窄屏时缩小建造栏
            if (isNarrow) {
                const scale = Math.max(0.7, aspectRatio / (16 / 9));
                setUniformScale(this.buildBar, scale);
            } else {
                setUniformScale(this.buildBar, 1);
            }
        }

        // 极端窄屏检测：如果可视高度 < 140px，顶部栏和底部栏会重叠
        // 此时隐藏部分非关键 UI 元素（暂不实现，仅记录日志）
        if (visHeight < 140) {
            console.warn('[HudView] 极端窄屏：可视高度', visHeight, 'px，UI 可能重叠');
        }
    }

    // ==================== 创建底部建造栏 ====================

    private createBuildBar() {
        this.buildBar = new Node('BuildBar');
        this.buildBar.layer = this.gmNode.layer;
        this.buildBar.parent = this.container;
        const ut = this.buildBar.addComponent(UITransform);
        ut.contentSize = new Size(1280, 76);
        ut.anchorPoint = new Vec2(0.5, 0);

        const bg = this.spriteFactory.createColorNode(new Color(34, 48, 58), 1280, 76);
        bg.parent = this.buildBar;
        bg.setPosition(0, 38, 0);

        const startX = -480;
        const gap = 96;

        // 7 种建筑按钮
        BUILDING_IDS.forEach((id, i) => {
            const conf = BUILDING_CONFIG[id];
            const btn = this.createBuildButton(conf.icon, conf.name, conf.cost, id);
            btn.parent = this.buildBar;
            btn.setPosition(startX + i * gap, 38, 0);
        });

        // 操作按钮：升级工厂 / 全军强化
        const upgradeBtn = this.createActionButton('⬆️', '升级工厂', '150金', 'onUpgradeClick');
        upgradeBtn.parent = this.buildBar;
        upgradeBtn.setPosition(startX + BUILDING_IDS.length * gap, 38, 0);

        const researchBtn = this.createActionButton('🔬', '全军强化', '400金', 'onResearchClick');
        researchBtn.parent = this.buildBar;
        researchBtn.setPosition(startX + (BUILDING_IDS.length + 1) * gap, 38, 0);
        // 记录科研价格标签
        const costNode = researchBtn.children[researchBtn.children.length - 1];
        this.researchCostLabel = costNode.getComponent(Label);
    }

    // ==================== 按钮创建辅助 ====================

    /** 创建建筑按钮（图标 + 名称 + 价格） */
    private createBuildButton(icon: string, name: string, cost: number, id: BuildingItemId): Node {
        const btn = new Node('BuildBtn_' + id);
        btn.layer = this.gmNode.layer;
        const ut = btn.addComponent(UITransform);
        ut.contentSize = new Size(86, 64);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.spriteFactory.createColorNode(new Color(46, 65, 82), 86, 64);
        bg.parent = btn;

        // 图标
        const iconLabel = this.createLabel(icon, 20, Color.WHITE, new Size(60, 24));
        iconLabel.node.parent = btn;
        iconLabel.node.setPosition(0, 10, 0);

        // 名称
        const nameLabel = this.createLabel(name, 12, new Color(223, 233, 240), new Size(80, 16));
        nameLabel.node.parent = btn;
        nameLabel.node.setPosition(0, -8, 0);

        // 价格
        const costLabel = this.createLabel(cost + '金', 11, new Color(255, 215, 94), new Size(60, 14));
        costLabel.node.parent = btn;
        costLabel.node.setPosition(0, -22, 0);
        this.buildCostLabels.set(id, costLabel);

        // 点击事件 → GameManager.onBuildClick
        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.1;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = 'onBuildClick';
        handler.customEventData = id;
        button.clickEvents = [handler];

        return btn;
    }

    /** 创建操作按钮（升级/科研等非建造命令） */
    private createActionButton(icon: string, name: string, cost: string, handlerName: string): Node {
        const btn = new Node('ActionBtn_' + handlerName);
        btn.layer = this.gmNode.layer;
        const ut = btn.addComponent(UITransform);
        ut.contentSize = new Size(86, 64);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.spriteFactory.createColorNode(new Color(60, 82, 60), 86, 64);
        bg.parent = btn;

        const iconLabel = this.createLabel(icon, 20, Color.WHITE, new Size(60, 24));
        iconLabel.node.parent = btn;
        iconLabel.node.setPosition(0, 10, 0);

        const nameLabel = this.createLabel(name, 12, new Color(223, 233, 240), new Size(80, 16));
        nameLabel.node.parent = btn;
        nameLabel.node.setPosition(0, -8, 0);

        const costLabel = this.createLabel(cost, 11, new Color(255, 215, 94), new Size(60, 14));
        costLabel.node.parent = btn;
        costLabel.node.setPosition(0, -22, 0);

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.1;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = handlerName;
        button.clickEvents = [handler];

        return btn;
    }

    // ==================== 通用辅助 ====================

    /** 在指定父节点下创建文本标签 */
    private makeLabel(text: string, x: number, y: number, color: Color, parent: Node, size: number = 18): Label {
        const node = new Node();
        node.layer = this.gmNode.layer;
        node.parent = parent;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(200, 30);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = size;
        label.color = color;
        label.lineHeight = size;
        node.setPosition(x, y, 0);
        return label;
    }

    /** 创建一个带 Label 组件的节点（不挂父，由调用方决定） */
    private createLabel(text: string, fontSize: number, color: Color, contentSize: Size): Label {
        const node = new Node();
        node.layer = this.gmNode.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = contentSize;
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.lineHeight = fontSize;
        return label;
    }
}
