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
    Node, Label, Color, UITransform, Size, Vec2, Vec3, Button, EventHandler, Sprite, HorizontalTextAlignment, UIOpacity, tween, Tween,
} from 'cc';
import { ColorSpriteFactory } from './color-sprite-factory';
import { ArtLibrary } from './art-library';
import { FACTION_CONFIG, FACTION_IDS } from '../config/faction-config';
import { BUILDING_CONFIG } from '../config/building-config';
import { CARD_CONFIG } from '../config/card-config';
import { getCardPanelSubtitle } from '../core/systems/card-system';
import type { CardConfig, Difficulty, FactionId, GameState } from '../core/types';

/** 面板底板槽：登记一个可升级的面板背景位置（纯色 → 九宫格贴图） */
interface PanelBgSlot {
    parent: Node;
    artPath: string;
    w: number;
    h: number;
    fallbackColor: Color;
    inset: number;
    node: Node | null;
}

/** 卡牌稀有度配色（表现层专属，不进入配置） */
const RARITY_COLORS: Record<string, Color> = {
    rare: new Color(123, 79, 184),
    epic: new Color(212, 116, 26),
    legendary: new Color(255, 215, 94),
};

/** 卡牌选择倒计时（秒）：超时自动选第一张，防止选卡暂停导致游戏假死 */
const CARD_CHOICE_TIMEOUT_S = 15;

/** 卡牌 id → 阵营映射（卡牌立绘路径 cards/card_{faction}_{id}.png 用） */
const CARD_FACTION: Record<string, FactionId> = (() => {
    const map: Record<string, FactionId> = {};
    for (const f of Object.keys(CARD_CONFIG) as FactionId[]) {
        for (const c of CARD_CONFIG[f]) map[c.id] = f;
    }
    return map;
})();

export class PanelController {

    // ---- 面板节点 ----
    private startPanel: Node | null = null;
    private cardPanel: Node | null = null;
    private endPanel: Node | null = null;
    private reviveBtn: Node | null = null;

    // ---- 动态标签 ----
    private diffLabel: Label | null = null;
    private onlineStatusLabel: Label | null = null;
    private cardSubLabel: Label | null = null;
    private cardCountdownLabel: Label | null = null;
    private endStatsLabel: Label | null = null;
    private toastLabel: Label | null = null;
    /** Toast 根节点（含黑色底条；只激活子 label 不够，根节点必须一起激活） */
    private toastNode: Node | null = null;

    // ---- 卡牌倒计时 ----
    /** 倒计时剩余秒数；<=0 表示无进行中的选卡 */
    private cardTimeoutSeconds = 0;
    /** 倒计时上次显示的整秒数（跨秒时触发紧急脉冲；-1 表示非紧急态） */
    private lastCountdownSec = -1;

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
    /** 阵营牌节点（选中标记刷新用） */
    private factionCards: Map<FactionId, { border: Node; check: Node }> = new Map();

    private container: Node;
    private spriteFactory: ColorSpriteFactory;
    /** 美术资源库（可选：面板底板贴图可用时替换纯色） */
    private art: ArtLibrary | null = null;
    /** 面板底板槽（预载完成后可升级纯色 → 九宫格贴图） */
    private panelBgSlots: PanelBgSlot[] = [];
    private gmNode: Node;

    constructor(container: Node, spriteFactory: ColorSpriteFactory, gmNode: Node, art?: ArtLibrary | null) {
        this.container = container;
        this.spriteFactory = spriteFactory;
        this.gmNode = gmNode;
        this.art = art ?? null;
    }

    /**
     * 面板底板：美术贴图（ui_panel_*）可用则九宫格拉伸，否则纯色兜底。
     * 已挂到 parent 并居中（z=0），返回该节点；同时登记到槽位供预载后刷新。
     */
    private makePanelBg(parent: Node, artPath: string, w: number, h: number, fallbackColor: Color, inset = 40): Node {
        const slot: PanelBgSlot = { parent, artPath, w, h, fallbackColor, inset, node: null };
        this.panelBgSlots.push(slot);
        slot.node = this.buildPanelBg(slot);
        slot.node.parent = parent;
        slot.node.setPosition(0, 0, 0);
        return slot.node;
    }

    /** 按槽位构建面板底板节点（九宫格贴图优先，纯色兜底） */
    private buildPanelBg(slot: PanelBgSlot): Node {
        if (this.art?.has(slot.artPath)) {
            const panel = this.art.createPanelNode(slot.artPath, slot.w, slot.h, slot.inset);
            if (panel) return panel;
        }
        return this.spriteFactory.createColorNode(slot.fallbackColor, slot.w, slot.h);
    }

    /** 美术资源预载完成后调用：把纯色兜底底板升级为九宫格贴图（保持原层级顺序） */
    refreshPanels() {
        if (!this.art?.isLoaded()) return;
        for (const slot of this.panelBgSlots) {
            // 已是九宫格贴图（名字以 _panel 结尾）则跳过，避免重复重建
            if (slot.node?.name.endsWith('_panel')) continue;
            const idx = slot.node ? slot.node.getSiblingIndex() : 0;
            slot.node?.destroy();
            slot.node = this.buildPanelBg(slot);
            slot.node.parent = slot.parent;
            slot.node.setSiblingIndex(idx);
            slot.node.setPosition(0, 0, 0);
        }
    }

    /**
     * 统一按钮组件（企业级体验）：
     *  - 底板 = ui_btn_green / ui_btn_blue 九宫格贴图（纯色兜底，预载后自动升级）
     *  - 点击反馈 = SCALE 缩放（按压缩到 0.93，松手回弹）
     *  - 返回未挂父的按钮节点；label 子节点名为 BtnLabel（便于外部刷新文案）
     */
    private makeButton(
        name: string, text: string, w: number, h: number,
        handler: string, artPath: string, fallbackColor: Color,
        fontSize: number, customData?: string,
    ): Node {
        const btn = new Node(name);
        btn.layer = this.gmNode.layer;
        const ut = btn.addComponent(UITransform);
        ut.contentSize = new Size(w, h);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        // 按钮底板用九宫格胶囊贴图（ui_btn_*）：inset 8 裁剪后的胶囊源图仅 ~42/48px 高，
        // 过大的 inset 会侵吞中部导致按钮被压成细线（M3 美术回归）。
        this.makePanelBg(btn, artPath, w, h, fallbackColor, 8);

        const label = this.makeLabel(text, 0, 0, Color.WHITE, btn, fontSize);
        label.node.name = 'BtnLabel';

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.93; // 按压缩放反馈
        button.duration = 0.08;
        const eh = new EventHandler();
        eh.target = this.gmNode;
        eh.component = 'GameManager';
        eh.handler = handler;
        if (customData !== undefined) eh.customEventData = customData;
        button.clickEvents = [this.makeClickSoundHandler(), eh];
        return btn;
    }

    /** UI 按钮统一点击音：插入 clickEvents 首位，任何按钮按下都有确认反馈（不影响业务 handler） */
    private makeClickSoundHandler(): EventHandler {
        const h = new EventHandler();
        h.target = this.gmNode;
        h.component = 'GameManager';
        h.handler = 'onUiClick';
        return h;
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

        // 创建卡牌节点（依次弹入：卡牌游戏标配的开箱感，每张延迟 0.07s）
        state.cards.offers.forEach((card, i) => {
            const cardNode = this.createCardNode(card, i);
            cardNode.parent = this.cardPanel;
            cardNode.setPosition(-220 + i * 220, 0, 0);
            cardNode.setScale(0, 0, 0);
            tween(cardNode)
                .delay(i * 0.07)
                .to(0.32, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
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
     * 最后 5 秒进入紧急态：数字转红 + 每跨一秒放大脉冲，催促玩家决策。
     */
    updateCardCountdown(dt: number, onTimeout: () => void) {
        if (this.cardTimeoutSeconds <= 0) return;
        this.cardTimeoutSeconds -= dt;
        if (this.cardCountdownLabel) {
            const label = this.cardCountdownLabel;
            label.string =
                this.cardTimeoutSeconds > 0
                    ? `⏱ ${Math.ceil(this.cardTimeoutSeconds)} 秒后自动选择`
                    : '';
            const urgent = this.cardTimeoutSeconds > 0 && this.cardTimeoutSeconds <= 5;
            if (urgent) {
                // 紧急态：红色 + 跨秒脉冲（0.18s backOut 回弹，与全局弹入手感一致）
                label.color = new Color(255, 84, 74);
                const sec = Math.ceil(this.cardTimeoutSeconds);
                if (sec !== this.lastCountdownSec) {
                    this.lastCountdownSec = sec;
                    Tween.stopAllByTarget(label.node);
                    label.node.setScale(1.35, 1.35, 1);
                    tween(label.node).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
                }
            } else if (this.lastCountdownSec !== -1) {
                // 退出紧急态（理论上只在重新开局时发生）：恢复默认橙色
                label.color = new Color(255, 160, 90);
                this.lastCountdownSec = -1;
            }
        }
        if (this.cardTimeoutSeconds <= 0) {
            this.cardTimeoutSeconds = 0;
            onTimeout();
        }
    }

    /**
     * 显示结算面板（引擎进入 ended 时调用）。
     * @param onlineResult 联机模式：本地引擎可能尚未跑出 stats.result（如对手投降），
     *                     用服务器权威结果兜底展示。
     */
    showEnd(state: GameState, canRevive: boolean = false, onlineResult?: { winner: 'red' | 'blue'; reason: string }) {
        if (!this.endPanel) return;
        this.endPanel.active = true;
        // 面板入场动画：缩放弹入 + 淡入（每次展示都重放）
        this.animateEndPanelIn();

        const result = state.stats.result;
        if (!this.endStatsLabel) return;

        // 胜负按玩家所在边判定（联机时玩家可能是蓝方；旧逻辑固定 red 会导致蓝方玩家赢了也显示失败）
        const won = result
            ? result.winner === state.playerSide
            : onlineResult
                ? onlineResult.winner === state.playerSide
                : false;
        if (!result && onlineResult) {
            // 本地模拟未结束（服务器判胜负）：展示服务器结果
            this.endStatsLabel.string =
                (won ? '🎉 胜利！' : '😢 失败\n') +
                `（服务器判定：${onlineResult.reason}）`;
            this.updateStarsRow(this.endPanel?.getChildByName('EndStars') ?? null, 0);
            if (this.reviveBtn) this.reviveBtn.active = false;
            return;
        }
        if (!result) return;

        const minutes = Math.floor(result.duration / 60);
        const seconds = Math.floor(result.duration % 60);
        this.endStatsLabel.string =
            (won ? '🎉 胜利！' : '😢 失败\n') +
            '击杀：' + state.stats.kills.red + '\n' +
            '剩余金币：' + result.playerGold + '\n' +
            '用时：' + minutes + ':' + (seconds < 10 ? '0' : '') + seconds + '\n' +
            '波次：第 ' + state.wave + ' 波';
        // 星级独立图标行（ico_star 贴图）
        this.updateStarsRow(this.endPanel?.getChildByName('EndStars') ?? null, result.stars);
        // 点亮的星星逐颗弹出（胜利仪式感）
        this.popEndStars(result.stars);

        // 失败时显示复活按钮（如果还可以复活）
        if (this.reviveBtn) {
            this.reviveBtn.active = !won && canRevive;
        }
    }

    /** 结算面板入场：整体从 82% 缩放 + 透明弹到原位（backOut 过冲，UI 层允许 tween） */
    private animateEndPanelIn() {
        const panel = this.endPanel;
        if (!panel) return;
        Tween.stopAllByTarget(panel);
        let op = panel.getComponent(UIOpacity);
        if (op) Tween.stopAllByTarget(op);
        if (!op) op = panel.addComponent(UIOpacity);
        panel.setScale(0.82, 0.82, 1);
        op.opacity = 0;
        tween(panel).parallel(
            tween(panel).to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }),
            tween(op).to(0.2, { opacity: 255 }),
        ).start();
    }

    /** 结算星星逐颗弹出：点亮的星从 0 弹到 1（延迟错开），灰星保持原尺寸 */
    private popEndStars(litCount: number) {
        const row = this.endPanel?.getChildByName('EndStars');
        if (!row) return;
        for (let i = 0; i < 3; i++) {
            const star = row.getChildByName('Star_' + i);
            if (!star) continue;
            Tween.stopAllByTarget(star);
            if (i < litCount) {
                star.setScale(0, 0, 1);
                tween(star)
                    .delay(0.35 + i * 0.14)
                    .to(0.26, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                    .start();
            } else {
                // 灰星与上次残留动画复位
                star.setScale(1, 1, 1);
            }
        }
    }

    /** 隐藏结算面板（停掉入场/星星动画，避免隐藏后 tween 继续跑） */
    hideEnd() {
        if (!this.endPanel) return;
        Tween.stopAllByTarget(this.endPanel);
        const op = this.endPanel.getComponent(UIOpacity);
        if (op) Tween.stopAllByTarget(op);
        const row = this.endPanel.getChildByName('EndStars');
        if (row) for (const star of row.children) Tween.stopAllByTarget(star);
        this.endPanel.active = false;
    }

    /** 显示 Toast 提示（默认 3 秒自动消失，可指定时长） */
    showToast(msg: string, durationMs: number = 3000) {
        if (!this.toastLabel || !this.toastNode) return;
        this.toastLabel.string = msg;
        // v0.7 修复：此前只激活了子 label 节点，Toast 根节点仍是 inactive，
        // 导致所有提示（金币不足/建造结果/联机状态…）实际不可见
        const toast = this.toastNode;
        toast.active = true;

        // 轻量淡入 + 到期淡出（复用结算面板同款 tween 手法）
        const op = toast.getComponent(UIOpacity) ?? toast.addComponent(UIOpacity);
        Tween.stopAllByTarget(op);
        op.opacity = 0;
        tween(op).to(0.15, { opacity: 255 }).start();

        // 清除旧定时器
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            Tween.stopAllByTarget(op);
            tween(op).to(0.25, { opacity: 0 }).start();
        }, durationMs);
    }

    /** 获取当前选中的阵营 */
    getSelectedFaction(): FactionId {
        return this.faction;
    }

    /** 获取当前选中的难度 */
    getSelectedDifficulty(): Difficulty {
        return this.difficulty;
    }

    /** 更新联机状态提示（房号/等待等），显示在开始面板下方 */
    updateOnlineStatus(text: string) {
        if (!this.onlineStatusLabel) return;
        this.onlineStatusLabel.string = text;
        this.onlineStatusLabel.node.active = text.length > 0;
    }

    // ==================== 房号大卡片（创建房间后展示） ====================

    private roomCard: Node | null = null;
    private roomCodeLabel: Label | null = null;

    /** 醒目展示好友房房号：建房后调用，让玩家一眼看到要把哪个号发给好友 */
    showRoomCode(code: string) {
        this.createRoomCardOnce();
        if (this.roomCodeLabel) this.roomCodeLabel.string = code;
        if (this.roomCard) this.roomCard.active = true;
    }

    hideRoomCode() {
        if (this.roomCard) this.roomCard.active = false;
    }

    private createRoomCardOnce() {
        if (this.roomCard) return;
        const card = new Node('RoomCard');
        card.layer = this.gmNode.layer;
        card.parent = this.container;
        card.active = false;
        const ut = card.addComponent(UITransform);
        ut.contentSize = new Size(520, 150);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        card.setPosition(0, 140, 0); // 开始面板中上部，覆盖副标题位置（建房等待时这是最优先信息）

        // 深色底 + 亮边框
        const bg = this.makePanelBg(card, 'ui/ui_panel_dark', 520, 150, new Color(10, 24, 16, 245));
        const border = this.spriteFactory.createColorNode(new Color(80, 220, 120), 528, 158);
        border.parent = card;
        border.setPosition(0, 0, -1); // 边框垫底

        this.makeLabel('房间已创建，等待好友加入', 0, 52, new Color(120, 255, 159), card, 20);
        this.roomCodeLabel = this.makeLabel('------', 0, 0, new Color(255, 215, 94), card, 44);
        this.makeLabel('把房号发给好友，对方点「🔢 加入房间」输入即可', 0, -46, new Color(200, 220, 200), card, 15);

        // 取消等待按钮（反悔入口：取消排队并关闭连接）
        const cancelBtn = new Node('CancelRoomBtn');
        cancelBtn.layer = this.gmNode.layer;
        cancelBtn.parent = card;
        const cxUt = cancelBtn.addComponent(UITransform);
        cxUt.contentSize = new Size(110, 32);
        cancelBtn.setPosition(200, 55, 0);
        const cxBg = this.spriteFactory.createColorNode(new Color(120, 60, 50, 230), 110, 32);
        cxBg.parent = cancelBtn;
        this.makeLabel('✕ 取消', 0, 0, Color.WHITE, cancelBtn, 14);
        const cxButton = cancelBtn.addComponent(Button);
        cxButton.transition = Button.Transition.SCALE;
        cxButton.zoomScale = 0.93;
        const cxHandler = new EventHandler();
        cxHandler.target = this.gmNode;
        cxHandler.component = 'GameManager';
        cxHandler.handler = 'onCancelRoomClick';
        cxButton.clickEvents = [this.makeClickSoundHandler(), cxHandler];

        this.roomCard = card;
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
        // 先激活再刷新：refreshUpgrade 有 active 守卫，先 refresh 会被跳过（首开显示旧文案的根因）
        if (this.upgradePanel) this.upgradePanel.active = true;
        this.refreshUpgrade(state);
    }

    /** 按最新状态刷新升级面板（升级/建学院后调用；面板显示中才刷新） */
    refreshUpgrade(state: GameState) {
        if (!this.upgradePanel || !this.upgradePanel.active || !this.upgradeBuildingId) return;
        const b = state.buildings.find(x => x.id === this.upgradeBuildingId && x.side === state.playerSide);
        if (!b || b.unitType === null) {
            this.hideUpgrade();
            return;
        }
        // 等级星标：Lv2 亮一颗，Lv3 亮两颗（Lv1 无星）
        this.updateStarsRow(this.upgradePanel!.getChildByName('UpgradeStars'), Math.max(0, b.level - 1));
        // 建筑显示自己的名字（坦克厂/远程厂/……），不再统一叫"兵工厂"
        const bName = (b.unitType !== null && BUILDING_CONFIG[b.unitType]) ? BUILDING_CONFIG[b.unitType].name : '兵工厂';
        if (this.upgradeInfoLabel) {
            this.upgradeInfoLabel.string =
                `${bName} Lv${b.level}` +
                (b.level === 3 ? '（已满级）' : '');
        }
        if (this.upgradeCostLabel) {
            this.upgradeCostLabel.string =
                b.level === 1 ? '升级费用：150 金（→Lv2★）'
                : b.level === 2
                    ? (state.academyLevel[state.playerSide] < 1
                        ? '需先建造「战争学院」\n才能升到 Lv3'
                        : '升级费用：300 金（→Lv3★★）')
                    : '已升至最高级，不再升级';
        }
        // 学院缺失提示独立小字行（原来拼在大标题后把文字顶出面板）
        const academyHint = this.upgradePanel!.getChildByName('AcademyHint');
        if (academyHint) {
            const hintL = academyHint.getComponent(Label);
            if (hintL) {
                hintL.string = b.level === 2 && state.academyLevel[state.playerSide] < 1 ? '（需战争学院 Lv1）' : '';
            }
        }
        if (this.upgradeBtnNode) {
            // 满级隐藏；无学院置灰并显示锁定角标
            this.upgradeBtnNode.active = b.level < 3;
            const locked = b.level === 2 && state.academyLevel[state.playerSide] < 1;
            const lock = this.upgradeBtnNode.getChildByName('LockIcon');
            if (lock) lock.active = locked;
            const bg = this.upgradeBtnNode.getChildByName('BtnBg');
            if (bg) {
                const sp = bg.getComponent(Sprite);
                if (sp) {
                    sp.color = locked
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

    // ==================== 卡牌历史查看面板 ====================

    /** 卡牌历史面板（点顶部卡牌图标行打开） */
    private cardHistoryPanel: Node | null = null;
    private cardHistoryContent: Node | null = null;

    /** 查找卡牌配置（跨稀有度类别搜索） */
    private findCardConfig(id: string): CardConfig | null {
        for (const list of Object.values(CARD_CONFIG)) {
            const c = list.find(x => x.id === id);
            if (c) return c;
        }
        return null;
    }

    /** 显示本局已抽卡牌详情（名称 + 描述），点顶部 🃏 图标行打开 */
    showCardHistory(state: GameState) {
        this.createCardHistoryPanelOnce();
        // 重建列表
        if (this.cardHistoryContent) {
            this.cardHistoryContent.removeAllChildren();
            // 只展示玩家实际选中的卡（usedCardIds 含展示未选的卡，不在此列）
            const chosen = state.cards.chosenCardIds;
            if (chosen.length === 0) {
                this.makeLabel('本局还没有选中卡牌（第 5/10/15 波触发）', 0, 0, new Color(159, 180, 196), this.cardHistoryContent, 16);
            } else {
                chosen.forEach((id, i) => {
                    const c = this.findCardConfig(id);
                    if (!c) return;
                    const y = 130 - i * 52;
                    this.makeLabel(`${c.icon} ${c.name}`, -170, y, Color.WHITE, this.cardHistoryContent, 18);
                    this.makeLabel(c.desc, 60, y, new Color(159, 180, 196), this.cardHistoryContent, 14);
                });
            }
            // 对手卡牌说明（当前设计：卡牌只作用于玩家方；联机模式卡牌整体禁用）
            const oppNote = state.aiEnabled ? '对手（AI）没有卡牌' : '联机模式：卡牌已禁用';
            this.makeLabel(oppNote, 0, -240, new Color(120, 140, 160), this.cardHistoryContent, 13);
        }
        if (this.cardHistoryPanel) this.cardHistoryPanel.active = true;
    }

    hideCardHistory() {
        if (this.cardHistoryPanel) this.cardHistoryPanel.active = false;
    }

    private createCardHistoryPanelOnce() {
        if (this.cardHistoryPanel) return;
        const panel = new Node('CardHistoryPanel');
        panel.layer = this.gmNode.layer;
        panel.parent = this.container;
        panel.active = false;
        const ut = panel.addComponent(UITransform);
        ut.contentSize = new Size(560, 580);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.makePanelBg(panel, 'ui/ui_panel_dark', 560, 580, new Color(5, 10, 14, 230));

        this.makeLabel('🃏 本局卡牌', 0, 250, new Color(255, 215, 94), panel, 24);

        // 滚动不便实现，列表容器预留 8 张的展示空间（超出截断展示前 8 张 + 提示）
        const content = new Node('Content');
        content.layer = this.gmNode.layer;
        content.parent = panel;
        const cUt = content.addComponent(UITransform);
        cUt.contentSize = new Size(520, 480);
        this.cardHistoryContent = content;

        // 关闭按钮
        const closeBtn = new Node('CloseBtn');
        closeBtn.layer = this.gmNode.layer;
        closeBtn.parent = panel;
        const cbUt = closeBtn.addComponent(UITransform);
        cbUt.contentSize = new Size(120, 40);
        const cbBg = this.spriteFactory.createColorNode(new Color(70, 80, 88), 120, 40);
        cbBg.parent = closeBtn;
        this.makeLabel('关闭', 0, 0, Color.WHITE, closeBtn, 16);
        closeBtn.setPosition(0, -255, 0);
        const cButton = closeBtn.addComponent(Button);
        cButton.transition = Button.Transition.SCALE;
        cButton.zoomScale = 0.93;
        const cHandler = new EventHandler();
        cHandler.target = this.gmNode;
        cHandler.component = 'GameManager';
        cHandler.handler = 'onCloseCardHistoryClick';
        cButton.clickEvents = [this.makeClickSoundHandler(), cHandler];

        this.cardHistoryPanel = panel;
    }

    private createUpgradePanelOnce() {
        if (this.upgradePanel) return;

        const panel = new Node('UpgradePanel');
        panel.layer = this.gmNode.layer;
        panel.parent = this.container;
        panel.active = false;
        const ut = panel.addComponent(UITransform);
        ut.contentSize = new Size(380, 230);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        panel.setPosition(0, -40, 0);

        const bg = this.makePanelBg(panel, 'ui/ui_panel_dark', 380, 230, new Color(5, 10, 14, 220));

        this.upgradeInfoLabel = this.makeLabel('兵工厂 Lv1', 0, 78, Color.WHITE, panel, 18);
        // 等级星标行（ico_star 贴图，Lv2 亮一颗 / Lv3 亮两颗）
        this.buildStarsRow(panel, 'UpgradeStars', 0, 57, 18);
        this.upgradeCostLabel = this.makeLabel('升级费用：150 金', 0, 16, new Color(255, 215, 94), panel, 15);
        this.upgradeCostLabel.lineHeight = 20;
        this.upgradeCostLabel.overflow = Label.Overflow.SHRINK;
        // 学院缺失提示行（独立小字，避免长后缀把标题顶出面板）
        const hint = this.makeLabel('', 0, 42, new Color(255, 170, 120), panel, 13);
        hint.node.name = 'AcademyHint';

        // 升级按钮（含背景节点名 BtnBg，供置灰刷新；锁定角标供 ico_lock 显示）
        const btn = new Node('UpgradeBtn');
        btn.layer = this.gmNode.layer;
        btn.parent = panel;
        const bUt = btn.addComponent(UITransform);
        bUt.contentSize = new Size(180, 52);
        const btnBg = this.spriteFactory.createColorNode(new Color(63, 109, 51), 180, 52);
        btnBg.name = 'BtnBg';
        btnBg.parent = btn;
        // 图标与文字必须是 bg 之后的子节点：Label 加在按钮节点自身会被子节点背景盖住
        this.makeArtIcon(btn, 'ui/ico_up', 26, -52, 0, '⬆');
        this.makeLabel('升级', 10, 0, Color.WHITE, btn, 18);
        const lockIcon = this.makeArtIcon(btn, 'ui/ico_lock', 28, 76, 22, '🔒');
        lockIcon.name = 'LockIcon';
        lockIcon.active = false;
        btn.setPosition(0, -72, 0);

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = 'onBuildingUpgradeClick';
        button.zoomScale = 0.93; // 统一按压缩放标准
        button.clickEvents = [this.makeClickSoundHandler(), handler];

        this.upgradeBtnNode = btn;
        this.upgradePanel = panel;
    }

    // ==================== EventHandler 回调（由 GameManager 路由） ====================

    /** 阵营选择按钮点击 */
    onFactionClick(_event: Event, faction: string) {
        this.faction = faction as FactionId;
        this.updateFactionSelection();
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

        // ---- 标题区 ----
        this.makeLabel('果林大战', 0, 252, Color.WHITE, this.startPanel, 44);
        this.makeLabel('选择你的阵营', 0, 204, new Color(159, 208, 255), this.startPanel, 20);

        // ---- 阵营牌（280×180，选中带 ✓ 与阵营色描边）----
        const colors = [new Color(255, 112, 67), new Color(102, 187, 106), new Color(255, 202, 40)];
        FACTION_IDS.forEach((id, i) => {
            const f = FACTION_CONFIG[id];
            const btn = this.createFactionButton(f.name, f.passive, colors[i], id);
            btn.parent = this.startPanel;
            btn.setPosition(-300 + i * 300, 80, 0);
        });
        this.updateFactionSelection();

        // ---- 难度（按钮文案即当前难度，点击循环）----
        const diffBtn = this.makeButton('DiffBtn', '难度：普通 ▸', 220, 56, 'onDiffClick',
            'ui/ui_btn_blue', new Color(46, 65, 82), 16);
        diffBtn.parent = this.startPanel;
        diffBtn.setPosition(0, -86, 0);        this.diffLabel = diffBtn.getChildByName('BtnLabel')?.getComponent(Label) ?? null;

        // ---- 双倍工资（次要）----
        const doubleBtn = this.makeButton('DoubleSalaryBtn', '📺 双倍工资', 200, 56, 'onDoubleSalaryClick',
            'ui/ui_btn_blue', new Color(46, 65, 82), 16);
        doubleBtn.parent = this.startPanel;
        doubleBtn.setPosition(0, -146, 0);

        // ---- 联机入口（创建/加入，只保留这两个：快速匹配容易"自己匹配到自己"）----
        const createBtn = this.makeButton('CreateRoomBtn', '🔑 创建房间', 215, 60, 'onCreateRoomClick',
            'ui/ui_btn_blue', new Color(46, 90, 60), 17);
        createBtn.parent = this.startPanel;
        createBtn.setPosition(-118, -208, 0);

        const joinBtn = this.makeButton('JoinRoomBtn', '🔢 加入房间', 215, 60, 'onJoinRoomClick',
            'ui/ui_btn_blue', new Color(50, 90, 140), 17);
        joinBtn.parent = this.startPanel;
        joinBtn.setPosition(118, -208, 0);

        // 联机状态标签（等待提示等；房号用大卡片展示，见 showRoomCode）
        this.onlineStatusLabel = this.makeLabel('', 0, -252, new Color(120, 255, 159), this.startPanel, 16);
        this.onlineStatusLabel.node.active = false;

        // ---- 开始游戏（主 CTA，最大最醒目）----
        const startBtn = this.makeButton('StartBtn', '开 始 游 戏', 280, 72, 'onStartClick',
            'ui/ui_btn_green', new Color(63, 109, 51), 26);
        startBtn.parent = this.startPanel;
        startBtn.setPosition(0, -306, 0);
    }

    /** 刷新阵营牌选中状态：选中的牌显示 ✓ 与阵营色描边，并放大 5% */
    private updateFactionSelection() {
        for (const [id, parts] of this.factionCards) {
            const selected = id === this.faction;
            parts.border.active = selected;
            parts.check.active = selected;
        }
    }

    private createFactionButton(name: string, passive: string, color: Color, id: FactionId): Node {
        const btn = new Node('FactionBtn_' + id);
        btn.layer = this.gmNode.layer;
        const ut = btn.addComponent(UITransform);
        ut.contentSize = new Size(280, 180);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        // 选中描边（阵营色 2px 细边，紧贴牌面 z=-1；默认隐藏）
        const border = this.spriteFactory.createColorNode(color.clone(), 284, 184);
        border.name = 'SelBorder';
        border.parent = btn;
        border.setPosition(0, 0, -1);
        border.active = false;

        // 底板
        this.makePanelBg(btn, 'ui/ui_panel_dark', 280, 180, new Color(46, 65, 82), 28);

        // 阵营名（阵营主题色）+ 被动描述
        const nameL = this.makeLabel(name, 0, 52, color, btn, 28);
        nameL.node.getComponent(UITransform)!.contentSize = new Size(260, 36);
        const passL = this.makeLabel(passive, 0, 2, new Color(199, 214, 228), btn, 14);
        passL.node.getComponent(UITransform)!.contentSize = new Size(256, 20);

        // 底部提示（未选中时引导）
        const hint = this.makeLabel('点击选择', 0, -62, new Color(130, 150, 168), btn, 13);
        hint.node.name = 'HintLabel';

        // 选中标记（✓，右上角；默认隐藏）
        const check = new Node('SelCheck');
        check.layer = this.gmNode.layer;
        check.parent = btn;
        const ckUt = check.addComponent(UITransform);
        ckUt.contentSize = new Size(48, 48);
        const ckLabel = check.addComponent(Label);
        ckLabel.string = '✓';
        ckLabel.fontSize = 32;
        ckLabel.color = new Color(255, 230, 120);
        ckLabel.lineHeight = 34;
        check.setPosition(112, 68, 0);
        check.active = false;

        this.factionCards.set(id, { border, check });

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.93;
        button.duration = 0.08;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = 'onFactionClick';
        handler.customEventData = id;
        button.clickEvents = [this.makeClickSoundHandler(), handler];

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
        stats.setPosition(0, 40, 0);

        // 星级图标行（结算时按星级点亮，ico_star 贴图）
        this.buildStarsRow(this.endPanel, 'EndStars', 0, -58, 30);

        // 再来一局按钮（主 CTA 统一样式）
        const againBtn = this.makeButton('AgainBtn', '再来一局', 210, 62, 'onAgainClick',
            'ui/ui_btn_green', new Color(63, 109, 51), 22);
        againBtn.parent = this.endPanel;
        againBtn.setPosition(0, -100, 0);

        // 复活按钮（失败时显示，观看广告后复活；次级样式）
        this.reviveBtn = this.makeButton('ReviveBtn', '📺 看广告复活', 220, 58, 'onReviveClick',
            'ui/ui_btn_blue', new Color(212, 116, 26), 17);
        this.reviveBtn.parent = this.endPanel;
        this.reviveBtn.active = false; // 默认隐藏
        this.reviveBtn.setPosition(0, -160, 0);
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
        this.toastNode = toast;
    }

    // ==================== 卡牌节点 ====================

    private createCardNode(card: CardConfig, index: number): Node {
        const node = new Node('Card_' + index);
        node.layer = this.gmNode.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(200, 260);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const rarityColor = RARITY_COLORS[card.rarity] || new Color(100, 100, 100);

        // 背景（卡牌底板九宫格；v1.8 移除纯色稀有度外框，观感更干净）
        const bg = this.makePanelBg(node, 'ui/ui_panel_card', 200, 260, new Color(30, 42, 54));

        // 稀有度底部分隔色条（加粗至 150×6 且不透明，增强稀有度辨识度）
        const accent = this.spriteFactory.createColorNode(rarityColor.clone(), 150, 6);
        accent.parent = node;
        accent.setPosition(0, -108, 0);
        const accentOpacity = accent.getComponent(UIOpacity) ?? accent.addComponent(UIOpacity);
        accentOpacity.opacity = 255;

        // 卡牌立绘（缺失时回退 emoji 图标）
        const artNode = this.art?.createSpriteNode(
            `cards/card_${CARD_FACTION[card.id]}_${card.id}`, 110, 110) ?? null;
        if (artNode) {
            artNode.setPosition(0, 66, 0);
            artNode.parent = node;
        } else {
            this.makeLabel(card.icon, 0, 62, Color.WHITE, node, 42);
        }

        // 名称
        this.makeLabel(card.name, 0, 4, Color.WHITE, node, 20);

        // 描述：固定宽度自动换行 + 水平居中（提亮一档，与深底对比更清晰）
        // 注意顺序：必须先设 overflow 再写 contentSize——若 Label 以默认 NONE 模式渲染过一帧，
        // 会把 UITransform 宽度撑成文本自然宽度，之后换行永久失效导致文字横向溢出卡牌
        const descNode = new Node('CardDesc');
        descNode.layer = this.gmNode.layer;
        descNode.parent = node;
        const dUt = descNode.addComponent(UITransform);
        const desc = descNode.addComponent(Label);
        desc.overflow = Label.Overflow.RESIZE_HEIGHT; // 限宽自动换行、高度自适应
        desc.string = card.desc;
        desc.fontSize = 12;
        desc.lineHeight = 17;
        desc.color = new Color(192, 210, 224);
        desc.horizontalAlign = HorizontalTextAlignment.CENTER;
        dUt.anchorPoint = new Vec2(0.5, 1); // 顶部锚点：多行向下延展
        dUt.setContentSize(164, 17); // 换行限宽（卡牌 200 留边距），再设一次确保生效
        descNode.setPosition(0, -24, 0); // 名称下方起始；最长描述 2 行底缘约 -58，远离色条(-110)

        // 稀有度标签：底部色条下方居中，加衬底胶囊 + 加大字号（13→16）增强辨识度
        const rarNames: Record<string, string> = { rare: '稀有', epic: '史诗', legendary: '传说' };
        // 衬底胶囊：稀有度色低透明度打底，把文字从卡底板里衬出来
        const chip = this.spriteFactory.createColorNode(rarityColor.clone(), 64, 26, 'rect');
        chip.parent = node;
        chip.setPosition(0, -127, 0);
        const chipOpacity = chip.getComponent(UIOpacity) ?? chip.addComponent(UIOpacity);
        chipOpacity.opacity = 64;
        this.makeLabel(rarNames[card.rarity] || '普通', 0, -127, Color.WHITE, node, 16);

        // 点击
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.93;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = 'onCardClick';
        handler.customEventData = card.id;
        button.clickEvents = [this.makeClickSoundHandler(), handler];

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

    /** 创建贴图图标（缺失时回退 emoji 文字；两者都无则返回空占位以保持布局）。返回节点（已挂到 parent） */
    private makeArtIcon(parent: Node, artPath: string, size: number, x: number, y: number, fallbackEmoji?: string): Node {
        const sprite = this.art?.createSpriteNode(artPath, size, size) ?? null;
        if (sprite) {
            sprite.parent = parent;
            sprite.setPosition(x, y, 0);
            return sprite;
        }
        if (fallbackEmoji) {
            const label = this.makeLabel(fallbackEmoji, x, y, Color.WHITE, parent, Math.round(size * 0.8));
            return label.node;
        }
        const empty = new Node('IconPlaceholder_' + artPath);
        empty.layer = this.gmNode.layer;
        empty.parent = parent;
        empty.addComponent(UITransform).contentSize = new Size(size, size);
        empty.setPosition(x, y, 0);
        return empty;
    }

    /** 构建三颗星图标行（结算/升级面板用），子节点名 Star_0/1/2 */
    private buildStarsRow(parent: Node, name: string, x: number, y: number, size: number): Node {
        const row = new Node(name);
        row.layer = this.gmNode.layer;
        row.parent = parent;
        row.addComponent(UITransform).contentSize = new Size(size * 3 + 16, size);
        for (let i = 0; i < 3; i++) {
            const star = this.makeArtIcon(row, 'ui/ico_star', size, (i - 1) * (size + 8), 0, '⭐');
            star.name = 'Star_' + i;
        }
        row.setPosition(x, y, 0);
        return row;
    }

    /** 更新星行点亮状态：前 litCount 颗原色点亮，其余灰暗半透明 */
    private updateStarsRow(row: Node | null, litCount: number) {
        if (!row) return;
        for (let i = 0; i < 3; i++) {
            const star = row.getChildByName('Star_' + i);
            if (!star) continue;
            const lit = i < litCount;
            const tint = lit ? new Color(255, 255, 255, 255) : new Color(130, 130, 130, 100);
            const sp = star.getComponent(Sprite);
            if (sp) {
                sp.color = tint;
            } else {
                const l = star.getComponent(Label);
                if (l) l.color = tint;
            }
        }
    }
}
