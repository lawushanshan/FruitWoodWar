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
    Node, Label, Color, UITransform, Size, Vec2, Button, EventHandler, Sprite,
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

/** 卡牌选择倒计时（秒）：超时自动选第一张，防止选卡暂停导致游戏假死 */
const CARD_CHOICE_TIMEOUT_S = 15;

export class PanelController {

    // ---- 面板节点 ----
    private startPanel: Node | null = null;
    private cardPanel: Node | null = null;
    private endPanel: Node | null = null;
    private reviveBtn: Node | null = null;

    // ---- 动态标签 ----
    private diffLabel: Label | null = null;
    private cardSubLabel: Label | null = null;
    private cardCountdownLabel: Label | null = null;
    private endStatsLabel: Label | null = null;
    private toastLabel: Label | null = null;

    // ---- 卡牌倒计时 ----
    /** 倒计时剩余秒数；<=0 表示无进行中的选卡 */
    private cardTimeoutSeconds = 0;

    // ---- 建筑升级面板 ----
    private upgradePanel: Node | null = null;
    private upgradeInfoLabel: Label | null = null;
    private upgradeCostLabel: Label | null = null;
    private upgradeBtnNode: Node | null = null;
    /** 当前升级面板指向的建筑 id */
    private upgradeBuildingId: string | null = null;

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

    /** 显示卡牌选择面板（引擎进入 card-pause 时调用），启动 N 秒倒计时 */
    showCards(state: GameState) {
        if (!this.cardPanel) return;
        this.cardPanel.active = true;
        this.cardTimeoutSeconds = CARD_CHOICE_TIMEOUT_S;

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
        this.cardTimeoutSeconds = 0;
    }

    /**
     * 卡牌倒计时（GameManager 每帧调用，含 card-pause 阶段）。
     * 倒计时归零时回调 onTimeout（自动选第一张），防止选卡暂停导致游戏假死。
     */
    updateCardCountdown(dt: number, onTimeout: () => void) {
        if (this.cardTimeoutSeconds <= 0) return;
        this.cardTimeoutSeconds -= dt;
        if (this.cardCountdownLabel) {
            this.cardCountdownLabel.string =
                this.cardTimeoutSeconds > 0
                    ? `⏱ ${Math.ceil(this.cardTimeoutSeconds)} 秒后自动选择`
                    : '';
        }
        if (this.cardTimeoutSeconds <= 0) {
            this.cardTimeoutSeconds = 0;
            onTimeout();
        }
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

    // ==================== 建筑升级面板 ====================

    /** 当前升级面板指向的建筑 id（无面板时为 null） */
    getUpgradeBuildingId(): string | null {
        return this.upgradeBuildingId;
    }

    /**
     * 显示建筑升级面板（点击己方兵工厂时调用）。
     * - Lv3 满级：隐藏升级按钮，显示"已升至最高级"
     * - Lv2→3 无学院：按钮置灰 + 提前提示"需先建造战争学院"
     */
    showUpgrade(state: GameState, buildingId: string) {
        this.createUpgradePanelOnce();
        this.upgradeBuildingId = buildingId;
        this.refreshUpgrade(state);
        if (this.upgradePanel) this.upgradePanel.active = true;
    }

    /** 按最新状态刷新升级面板（升级/建学院后调用；面板显示中才刷新） */
    refreshUpgrade(state: GameState) {
        if (!this.upgradePanel || !this.upgradePanel.active || !this.upgradeBuildingId) return;
        const b = state.buildings.find(x => x.id === this.upgradeBuildingId && x.side === state.playerSide);
        if (!b || b.unitType === null) {
            this.hideUpgrade();
            return;
        }
        const stars = b.level === 2 ? '★' : b.level === 3 ? '★★' : '';
        if (this.upgradeInfoLabel) {
            this.upgradeInfoLabel.string =
                `兵工厂 Lv${b.level}${stars}` +
                (b.level === 3 ? '（已满级）' : b.level === 2 && state.academyLevel[state.playerSide] < 1 ? '（需战争学院 Lv1）' : '');
        }
        if (this.upgradeCostLabel) {
            this.upgradeCostLabel.string =
                b.level === 1 ? '升级费用：150 金（→Lv2★）'
                : b.level === 2
                    ? (state.academyLevel[state.playerSide] < 1
                        ? '⚠ 需先建造「战争学院」才能升到 Lv3'
                        : '升级费用：300 金（→Lv3★★）')
                    : '已升至最高级，不再升级';
        }
        if (this.upgradeBtnNode) {
            // 满级隐藏；无学院置灰
            this.upgradeBtnNode.active = b.level < 3;
            const bg = this.upgradeBtnNode.getChildByName('BtnBg');
            if (bg) {
                const sp = bg.getComponent(Sprite);
                if (sp) {
                    sp.color = b.level === 2 && state.academyLevel[state.playerSide] < 1
                        ? new Color(70, 80, 88)
                        : new Color(63, 109, 51);
                }
            }
        }
    }

    /** 隐藏升级面板 */
    hideUpgrade() {
        if (this.upgradePanel) this.upgradePanel.active = false;
        this.upgradeBuildingId = null;
    }

    private createUpgradePanelOnce() {
        if (this.upgradePanel) return;

        const panel = new Node('UpgradePanel');
        panel.layer = this.gmNode.layer;
        panel.parent = this.container;
        panel.active = false;
        const ut = panel.addComponent(UITransform);
        ut.contentSize = new Size(320, 200);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        panel.setPosition(0, -40, 0);

        const bg = this.spriteFactory.createColorNode(new Color(5, 10, 14, 220), 320, 200);
        bg.parent = panel;

        this.upgradeInfoLabel = this.makeLabel('兵工厂 Lv1', 0, 70, Color.WHITE, panel, 20);
        this.upgradeCostLabel = this.makeLabel('升级费用：150 金', 0, 20, new Color(255, 215, 94), panel, 16);

        // 升级按钮（含背景节点名 BtnBg，供置灰刷新）
        const btn = new Node('UpgradeBtn');
        btn.layer = this.gmNode.layer;
        btn.parent = panel;
        const bUt = btn.addComponent(UITransform);
        bUt.contentSize = new Size(160, 44);
        const btnBg = this.spriteFactory.createColorNode(new Color(63, 109, 51), 160, 44);
        btnBg.name = 'BtnBg';
        btnBg.parent = btn;
        // 文字必须是 bg 之后的子节点：Label 加在按钮节点自身会被子节点背景盖住
        this.makeLabel('⬆ 升级', 0, 0, Color.WHITE, btn, 18);
        btn.setPosition(0, -60, 0);

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = 'onBuildingUpgradeClick';
        button.clickEvents = [handler];

        this.upgradeBtnNode = btn;
        this.upgradePanel = panel;
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
        // 文字必须是 bg 之后的子节点（Label 在按钮节点自身会被 bg 子节点盖住）
        this.makeLabel('切换难度', 0, 0, Color.WHITE, diffBtn, 16);
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
        this.makeLabel('📺 双倍工资', 0, 0, Color.WHITE, doubleBtn, 16);
        doubleBtn.setPosition(0, -160, 0);

        const dsButton = doubleBtn.addComponent(Button);
        dsButton.transition = Button.Transition.SCALE;
        const dsHandler = new EventHandler();
        dsHandler.target = this.gmNode;
        dsHandler.component = 'GameManager';
        dsHandler.handler = 'onDoubleSalaryClick';
        dsButton.clickEvents = [dsHandler];

        // 联机对战按钮（P1：连接 ws 服务器匹配真人对手）
        const onlineBtn = new Node('OnlineBtn');
        onlineBtn.layer = this.gmNode.layer;
        onlineBtn.parent = this.startPanel;
        const onUt = onlineBtn.addComponent(UITransform);
        onUt.contentSize = new Size(200, 50);
        const onBg = this.spriteFactory.createColorNode(new Color(50, 90, 140), 200, 50);
        onBg.parent = onlineBtn;
        this.makeLabel('🌐 联机对战', 0, 0, Color.WHITE, onlineBtn, 24);
        onlineBtn.setPosition(0, -170, 0);

        const onButton = onlineBtn.addComponent(Button);
        onButton.transition = Button.Transition.SCALE;
        const onHandler = new EventHandler();
        onHandler.target = this.gmNode;
        onHandler.component = 'GameManager';
        onHandler.handler = 'onOnlineClick';
        onButton.clickEvents = [onHandler];

        // 开始按钮
        const startBtn = new Node();
        startBtn.layer = this.gmNode.layer;
        startBtn.parent = this.startPanel;
        const sbUt = startBtn.addComponent(UITransform);
        sbUt.contentSize = new Size(200, 50);
        const sbBg = this.spriteFactory.createColorNode(new Color(63, 109, 51), 200, 50);
        sbBg.parent = startBtn;
        this.makeLabel('开始游戏', 0, 0, Color.WHITE, startBtn, 24);
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

        // 倒计时标签（副标题下方）
        this.cardCountdownLabel = this.makeLabel('', 0, 150, new Color(255, 160, 90), this.cardPanel, 16);
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
        this.makeLabel('再来一局', 0, 0, Color.WHITE, againBtn, 22);
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
        this.makeLabel('📺 看广告复活', 0, 0, Color.WHITE, this.reviveBtn, 20);
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
        // toast 锚点在顶部，label 子节点放中间（bg 之后追加，避免被盖）
        this.toastLabel = this.makeLabel('', 0, -20, Color.WHITE, toast, 18);
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
