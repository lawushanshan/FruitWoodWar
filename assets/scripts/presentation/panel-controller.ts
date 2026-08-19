/**
 * PanelController —— 弹窗与浮面板管理
 *
 * 职责：
 *  - 开始面板（阵营选择、难度切换、开始按钮）
 *  - 卡牌选择面板（3 选 1，含卡牌节点动态创建）
 *  - 结算面板（胜负/星级/击杀/金币/用时/波次）
 *  - Toast 提示（3 秒自动消失）
 *  - 只负责视觉与事件路由，不修改游戏数据
 */

import {
    Node, Label, Color, UITransform, Size, Vec2, Button, EventHandler,
} from 'cc';
import { ColorSpriteFactory } from './color-sprite-factory';
import { FACTION_CONFIG, FACTION_IDS } from '../config/faction-config';
import { getCardPanelSubtitle } from '../core/systems/card-system';
import type { CardConfig, Difficulty, FactionId, GameState } from '../core/types';

/** 卡牌稀有度配色（表现层专属，不进入配置） */
const RARITY_COLORS: Record<string, Color> = {
    rare: new Color(123, 79, 184),
    epic: new Color(212, 116, 26),
    legendary: new Color(255, 215, 94),
};

export class PanelController {

    // ---- 面板节点 ----
    private startPanel: Node | null = null;
    private cardPanel: Node | null = null;
    private endPanel: Node | null = null;
    private reviveBtn: Node | null = null;

    // ---- 动态标签 ----
    private diffLabel: Label | null = null;
    private cardSubLabel: Label | null = null;
    private endStatsLabel: Label | null = null;
    private toastLabel: Label | null = null;

    /** Toast 自动隐藏定时器 */
    private toastTimer: ReturnType<typeof setTimeout> | null = null;

    /** 当前选中难度（面板内切换，通知 GameManager） */
    private difficulty: Difficulty = 'normal';
    /** 当前选中阵营 */
    private faction: FactionId = 'fruit';

    private container: Node;
    private spriteFactory: ColorSpriteFactory;
    private gmNode: Node;

    constructor(container: Node, spriteFactory: ColorSpriteFactory, gmNode: Node) {
        this.container = container;
        this.spriteFactory = spriteFactory;
        this.gmNode = gmNode;
    }

    /** 创建所有面板（初始化时调用一次） */
    create() {
        this.createStartPanel();
        this.createCardPanel();
        this.createEndPanel();
        this.createToast();
    }

    // ==================== 公开方法 ====================

    /** 显示开始面板 */
    showStart() {
        if (this.startPanel) this.startPanel.active = true;
    }

    /** 隐藏开始面板 */
    hideStart() {
        if (this.startPanel) this.startPanel.active = false;
    }

    /** 显示卡牌选择面板（引擎进入 card-pause 时调用） */
    showCards(state: GameState) {
        if (!this.cardPanel) return;
        this.cardPanel.active = true;

        // 清除旧卡牌节点
        const oldCards = this.cardPanel.children.filter(c => c.name.startsWith('Card_'));
        oldCards.forEach(c => { if (c.isValid) c.destroy(); });

        // 更新副标题
        if (this.cardSubLabel) {
            this.cardSubLabel.string = getCardPanelSubtitle(state);
        }

        // 创建卡牌节点
        state.cards.offers.forEach((card, i) => {
            const cardNode = this.createCardNode(card, i);
            cardNode.parent = this.cardPanel;
            cardNode.setPosition(-220 + i * 220, 0, 0);
        });
    }

    /** 隐藏卡牌面板 */
    hideCards() {
        if (this.cardPanel) this.cardPanel.active = false;
    }

    /** 显示结算面板（引擎进入 ended 时调用） */
    showEnd(state: GameState, canRevive: boolean = false) {
        if (!this.endPanel) return;
        this.endPanel.active = true;

        const result = state.stats.result;
        if (!result || !this.endStatsLabel) return;

        const won = result.winner === 'red';
        const minutes = Math.floor(result.duration / 60);
        const seconds = Math.floor(result.duration % 60);
        this.endStatsLabel.string =
            (won ? '🎉 胜利！' : '😢 失败\n') +
            '⭐'.repeat(result.stars) + '☆'.repeat(3 - result.stars) + '\n' +
            '击杀：' + state.stats.kills.red + '\n' +
            '剩余金币：' + result.playerGold + '\n' +
            '用时：' + minutes + ':' + (seconds < 10 ? '0' : '') + seconds + '\n' +
            '波次：第 ' + state.wave + ' 波';

        // 失败时显示复活按钮（如果还可以复活）
        if (this.reviveBtn) {
            this.reviveBtn.active = !won && canRevive;
        }
    }

    /** 隐藏结算面板 */
    hideEnd() {
        if (this.endPanel) this.endPanel.active = false;
    }

    /** 显示 Toast 提示（3 秒自动消失） */
    showToast(msg: string) {
        if (!this.toastLabel) return;
        this.toastLabel.string = msg;
        const toast = this.toastLabel.node;
        toast.active = true;

        // 清除旧定时器
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            if (toast) toast.active = false;
        }, 3000);
    }

    /** 获取当前选中的阵营 */
    getSelectedFaction(): FactionId {
        return this.faction;
    }

    /** 获取当前选中的难度 */
    getSelectedDifficulty(): Difficulty {
        return this.difficulty;
    }

    // ==================== EventHandler 回调（由 GameManager 路由） ====================

    /** 阵营选择按钮点击 */
    onFactionClick(_event: Event, faction: string) {
        this.faction = faction as FactionId;
        this.showToast('选择了：' + FACTION_CONFIG[this.faction].name);
    }

    /** 难度切换按钮点击 */
    onDiffClick(_event: Event) {
        const diffs: Difficulty[] = ['easy', 'normal', 'hard'];
        const names = ['简单', '普通', '困难'];
        const idx = diffs.indexOf(this.difficulty);
        this.difficulty = diffs[(idx + 1) % 3];
        if (this.diffLabel) {
            this.diffLabel.string = '难度：' + names[(idx + 1) % 3];
        }
        this.showToast('难度：' + names[(idx + 1) % 3]);
    }

    // ==================== 面板创建 ====================

    private createStartPanel() {
        this.startPanel = new Node('StartPanel');
        this.startPanel.layer = this.gmNode.layer;
        this.startPanel.parent = this.container;
        const ut = this.startPanel.addComponent(UITransform);
        ut.contentSize = new Size(1280, 720);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.spriteFactory.createColorNode(new Color(5, 10, 14, 210), 1280, 720);
        bg.parent = this.startPanel;

        // 标题
        this.makeLabel('果林大战', 0, 200, Color.WHITE, this.startPanel, 42);

        // 副标题
        this.makeLabel('选择你的阵营', 0, 150, new Color(159, 208, 255), this.startPanel, 20);

        // 阵营按钮
        const colors = [new Color(255, 112, 67), new Color(102, 187, 106), new Color(255, 202, 40)];
        FACTION_IDS.forEach((id, i) => {
            const f = FACTION_CONFIG[id];
            const btn = this.createFactionButton(f.name, f.passive, colors[i], id);
            btn.parent = this.startPanel;
            btn.setPosition(-240 + i * 240, 20, 0);
        });

        // 难度标签
        this.diffLabel = this.makeLabel('难度：普通', 0, -80, Color.WHITE, this.startPanel, 18);

        // 难度切换按钮
        const diffBtn = new Node();
        diffBtn.layer = this.gmNode.layer;
        diffBtn.parent = this.startPanel;
        const dbUt = diffBtn.addComponent(UITransform);
        dbUt.contentSize = new Size(160, 40);
        const dbBg = this.spriteFactory.createColorNode(new Color(46, 65, 82), 160, 40);
        dbBg.parent = diffBtn;
        const dbLabel = diffBtn.addComponent(Label);
        dbLabel.string = '切换难度';
        dbLabel.fontSize = 16;
        dbLabel.color = Color.WHITE;
        diffBtn.setPosition(0, -120, 0);

        const dbButton = diffBtn.addComponent(Button);
        dbButton.transition = Button.Transition.SCALE;
        const dbHandler = new EventHandler();
        dbHandler.target = this.gmNode;
        dbHandler.component = 'GameManager';
        dbHandler.handler = 'onDiffClick';
        dbButton.clickEvents = [dbHandler];

        // 双倍工资按钮（观看广告后本局工资翻倍）
        const doubleBtn = new Node('DoubleSalaryBtn');
        doubleBtn.layer = this.gmNode.layer;
        doubleBtn.parent = this.startPanel;
        const dsUt = doubleBtn.addComponent(UITransform);
        dsUt.contentSize = new Size(200, 40);
        const dsBg = this.spriteFactory.createColorNode(new Color(212, 116, 26), 200, 40);
        dsBg.parent = doubleBtn;
        const dsLabel = doubleBtn.addComponent(Label);
        dsLabel.string = '📺 双倍工资';
        dsLabel.fontSize = 16;
        dsLabel.color = Color.WHITE;
        doubleBtn.setPosition(0, -160, 0);

        const dsButton = doubleBtn.addComponent(Button);
        dsButton.transition = Button.Transition.SCALE;
        const dsHandler = new EventHandler();
        dsHandler.target = this.gmNode;
        dsHandler.component = 'GameManager';
        dsHandler.handler = 'onDoubleSalaryClick';
        dsButton.clickEvents = [dsHandler];

        // 开始按钮
        const startBtn = new Node();
        startBtn.layer = this.gmNode.layer;
        startBtn.parent = this.startPanel;
        const sbUt = startBtn.addComponent(UITransform);
        sbUt.contentSize = new Size(200, 50);
        const sbBg = this.spriteFactory.createColorNode(new Color(63, 109, 51), 200, 50);
        sbBg.parent = startBtn;
        const sbLabel = startBtn.addComponent(Label);
        sbLabel.string = '开始游戏';
        sbLabel.fontSize = 24;
        sbLabel.color = Color.WHITE;
        sbLabel.lineHeight = 30;
        startBtn.setPosition(0, -220, 0);

        const sButton = startBtn.addComponent(Button);
        sButton.transition = Button.Transition.SCALE;
        const sHandler = new EventHandler();
        sHandler.target = this.gmNode;
        sHandler.component = 'GameManager';
        sHandler.handler = 'onStartClick';
        sButton.clickEvents = [sHandler];
    }

    private createFactionButton(name: string, passive: string, color: Color, id: FactionId): Node {
        const btn = new Node('FactionBtn_' + id);
        btn.layer = this.gmNode.layer;
        const ut = btn.addComponent(UITransform);
        ut.contentSize = new Size(200, 120);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.spriteFactory.createColorNode(new Color(46, 65, 82), 200, 120);
        bg.parent = btn;

        this.makeLabel(name, 0, 25, color, btn, 22);
        this.makeLabel(passive, 0, -15, new Color(159, 180, 196), btn, 13);

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.05;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = 'onFactionClick';
        handler.customEventData = id;
        button.clickEvents = [handler];

        return btn;
    }

    private createCardPanel() {
        this.cardPanel = new Node('CardPanel');
        this.cardPanel.layer = this.gmNode.layer;
        this.cardPanel.parent = this.container;
        this.cardPanel.active = false;
        const ut = this.cardPanel.addComponent(UITransform);
        ut.contentSize = new Size(1280, 720);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.spriteFactory.createColorNode(new Color(5, 10, 14, 235), 1280, 720);
        bg.parent = this.cardPanel;

        this.makeLabel('选择一张卡牌', 0, 220, new Color(255, 215, 94), this.cardPanel, 30);

        // 副标题（动态内容）
        const sub = new Node();
        sub.layer = this.gmNode.layer;
        sub.parent = this.cardPanel;
        const sUt = sub.addComponent(UITransform);
        sUt.contentSize = new Size(400, 24);
        this.cardSubLabel = sub.addComponent(Label);
        this.cardSubLabel.string = '';
        this.cardSubLabel.fontSize = 16;
        this.cardSubLabel.color = new Color(159, 180, 196);
        this.cardSubLabel.lineHeight = 22;
        sub.setPosition(0, 180, 0);
    }

    private createEndPanel() {
        this.endPanel = new Node('EndPanel');
        this.endPanel.layer = this.gmNode.layer;
        this.endPanel.parent = this.container;
        this.endPanel.active = false;
        const ut = this.endPanel.addComponent(UITransform);
        ut.contentSize = new Size(1280, 720);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.spriteFactory.createColorNode(new Color(5, 10, 14, 210), 1280, 720);
        bg.parent = this.endPanel;

        this.makeLabel('游戏结束', 0, 150, Color.WHITE, this.endPanel, 36);

        // 统计标签
        const stats = new Node();
        stats.layer = this.gmNode.layer;
        stats.parent = this.endPanel;
        const stUt = stats.addComponent(UITransform);
        stUt.contentSize = new Size(400, 120);
        this.endStatsLabel = stats.addComponent(Label);
        this.endStatsLabel.string = '';
        this.endStatsLabel.fontSize = 20;
        this.endStatsLabel.color = new Color(207, 227, 240);
        this.endStatsLabel.lineHeight = 32;
        stats.setPosition(0, 30, 0);

        // 再来一局按钮
        const againBtn = new Node();
        againBtn.layer = this.gmNode.layer;
        againBtn.parent = this.endPanel;
        const abUt = againBtn.addComponent(UITransform);
        abUt.contentSize = new Size(180, 50);
        const abBg = this.spriteFactory.createColorNode(new Color(63, 109, 51), 180, 50);
        abBg.parent = againBtn;
        const abLabel = againBtn.addComponent(Label);
        abLabel.string = '再来一局';
        abLabel.fontSize = 22;
        abLabel.color = Color.WHITE;
        againBtn.setPosition(0, -100, 0);

        const abButton = againBtn.addComponent(Button);
        abButton.transition = Button.Transition.SCALE;
        const abHandler = new EventHandler();
        abHandler.target = this.gmNode;
        abHandler.component = 'GameManager';
        abHandler.handler = 'onAgainClick';
        abButton.clickEvents = [abHandler];

        // 复活按钮（失败时显示，观看广告后复活）
        this.reviveBtn = new Node('ReviveBtn');
        this.reviveBtn.layer = this.gmNode.layer;
        this.reviveBtn.parent = this.endPanel;
        this.reviveBtn.active = false; // 默认隐藏
        const rvUt = this.reviveBtn.addComponent(UITransform);
        rvUt.contentSize = new Size(200, 50);
        const rvBg = this.spriteFactory.createColorNode(new Color(212, 116, 26), 200, 50);
        rvBg.parent = this.reviveBtn;
        const rvLabel = this.reviveBtn.addComponent(Label);
        rvLabel.string = '📺 看广告复活';
        rvLabel.fontSize = 20;
        rvLabel.color = Color.WHITE;
        this.reviveBtn.setPosition(0, -160, 0);

        const rvButton = this.reviveBtn.addComponent(Button);
        rvButton.transition = Button.Transition.SCALE;
        const rvHandler = new EventHandler();
        rvHandler.target = this.gmNode;
        rvHandler.component = 'GameManager';
        rvHandler.handler = 'onReviveClick';
        rvButton.clickEvents = [rvHandler];
    }

    private createToast() {
        const toast = new Node('Toast');
        toast.layer = this.gmNode.layer;
        toast.parent = this.container;
        const tUt = toast.addComponent(UITransform);
        tUt.contentSize = new Size(400, 40);
        tUt.anchorPoint = new Vec2(0.5, 1);
        const tBg = this.spriteFactory.createColorNode(new Color(0, 0, 0, 180), 400, 40);
        tBg.parent = toast;
        this.toastLabel = toast.addComponent(Label);
        this.toastLabel.string = '';
        this.toastLabel.fontSize = 18;
        this.toastLabel.color = Color.WHITE;
        this.toastLabel.lineHeight = 24;
        toast.setPosition(0, 340, 0);
        toast.active = false;
    }

    // ==================== 卡牌节点 ====================

    private createCardNode(card: CardConfig, index: number): Node {
        const node = new Node('Card_' + index);
        node.layer = this.gmNode.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(200, 260);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        // 背景
        const bg = this.spriteFactory.createColorNode(new Color(30, 42, 54), 200, 260);
        bg.parent = node;

        // 稀有度边框
        const rarityColor = RARITY_COLORS[card.rarity] || new Color(100, 100, 100);
        const border = this.spriteFactory.createColorNode(rarityColor, 204, 264);
        border.parent = node;
        border.setPosition(0, 0, -1);

        // 图标
        this.makeLabel(card.icon, 0, 70, Color.WHITE, node, 42);

        // 名称
        this.makeLabel(card.name, 0, 20, Color.WHITE, node, 20);

        // 描述
        this.makeLabel(card.desc, 0, -40, new Color(159, 180, 196), node, 14);

        // 稀有度标签
        const rarNames: Record<string, string> = { rare: '稀有', epic: '史诗', legendary: '传说' };
        this.makeLabel(rarNames[card.rarity] || '普通', 60, 110, rarityColor, node, 12);

        // 点击
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.08;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = 'onCardClick';
        handler.customEventData = card.id;
        button.clickEvents = [handler];

        return node;
    }

    // ==================== 通用辅助 ====================

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
}
