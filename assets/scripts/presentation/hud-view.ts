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
    Node, Label, Color, UITransform, Size, Vec2, Vec3, Button, EventHandler, view,
    HorizontalTextAlignment, UIOpacity, tween, Tween,
} from 'cc';
import { ColorSpriteFactory } from './color-sprite-factory';
import { ArtLibrary } from './art-library';
import { setUniformScale } from './scale-helper';
import { GAME_CONFIG } from '../config/game-config';
import { BUILDING_CONFIG, BUILDING_IDS, auraCostInState, buildingCostInState, researchCost, shieldCost } from '../config/building-config';
import { CARD_CONFIG } from '../config/card-config';
import type { BuildingItemId, GameState } from '../core/types';

/** 图标槽：登记一个可升级的图标位置（emoji → 贴图） */
interface IconSlot {
    parent: Node;
    artPath: string;
    emoji: string;
    x: number;
    y: number;
    size: number;
    emojiFontSize: number;
    node: Node | null;
}

/** 顶部栏数值标签的默认色（变化脉冲/警示色恢复时使用，需与 createTopBar 保持一致） */
const TOP_LABEL_BASE: Record<string, Color> = {
    gold: new Color(255, 215, 94),
    red: new Color(255, 138, 122),
    blue: new Color(122, 184, 255),
};
/** 金币消费警示色（短暂变红，提示"钱花出去了"） */
const GOLD_SPEND_COLOR = new Color(255, 110, 95);
/** 水晶低血量警示阈值（低于 30% 血量数字转红） */
const CRYSTAL_LOW_RATIO = 0.3;

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
    /** 建筑按钮同类已建数量标签（价格递增可视化） */
    private buildCountLabels: Map<BuildingItemId, Label> = new Map();
    /** 科研按钮价格标签 */
    private researchCostLabel: Label | null = null;
    /** 护盾按钮价格标签 */
    private shieldCostLabel: Label | null = null;

    /** 已抽卡牌历史行（顶部栏下方，展示玩家本局已选卡图标） */
    private cardHistoryLabel: Label | null = null;
    private lastCardCount = -1;

    // ---- 数值变化反馈（脉冲 + 消费变色） ----
    private lastGold = -1;
    private lastPop = -1;
    private lastKills = -1;
    /** 金币消费变红的截止时刻（state.time，秒；-1 表示无） */
    private goldTintUntil = -1;

    /** 联机身份标识（你是红方/蓝方），显示在顶部栏下方左侧 */
    private sideBadgeLabel: Label | null = null;
    /** 联机延迟指示（ping ms），显示在身份标识旁 */
    private pingLabel: Label | null = null;
    private onlineBadgeNode: Node | null = null;

    /** 波次横幅（居中大字提示：wave 变化时弹入 → 停留 → 淡出） */
    private waveBanner: Node | null = null;
    private waveBannerLabel: Label | null = null;
    /** 上次显示的波次数（变化检测触发横幅） */
    private lastWave = 0;

    /** 上次可视高度（用于检测屏幕变化） */
    private lastVisibleHeight: number = 0;

    private container: Node;
    private spriteFactory: ColorSpriteFactory;
    /** 美术资源库（可选：图标贴图可用时替换 emoji） */
    private art: ArtLibrary | null = null;
    /** 图标槽（预载完成后可升级 emoji → 贴图） */
    private iconSlots: IconSlot[] = [];
    /** GameManager 所在节点（EventHandler 的 target） */
    private gmNode: Node;

    constructor(container: Node, spriteFactory: ColorSpriteFactory, gmNode: Node, art?: ArtLibrary | null) {
        this.container = container;
        this.spriteFactory = spriteFactory;
        this.gmNode = gmNode;
        this.art = art ?? null;
    }

    /**
     * 在父节点下创建图标：美术贴图可用则用精灵（size×size），否则用 emoji 文字。
     * 返回创建的子节点（已挂到 parent）。同时登记到 iconSlots，供预载完成后升级。
     */
    private makeIcon(parent: Node, artPath: string, emoji: string, x: number, y: number, size: number, emojiFontSize: number): Node {
        const slot: IconSlot = { parent, artPath, emoji, x, y, size, emojiFontSize, node: null };
        this.iconSlots.push(slot);
        slot.node = this.buildIcon(slot);
        return slot.node;
    }

    /** 按 slot 构建图标节点（贴图优先，emoji 兜底） */
    private buildIcon(slot: IconSlot): Node {
        if (this.art?.has(slot.artPath)) {
            const sprite = this.art.createSpriteNode(slot.artPath, slot.size, slot.size);
            if (sprite) {
                sprite.parent = slot.parent;
                sprite.setPosition(slot.x, slot.y, 0);
                return sprite;
            }
        }
        // emoji 兜底
        const node = new Node('Icon_' + slot.emoji);
        node.layer = this.gmNode.layer;
        node.parent = slot.parent;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(slot.size, slot.size);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const label = node.addComponent(Label);
        label.string = slot.emoji;
        label.fontSize = slot.emojiFontSize;
        label.lineHeight = slot.emojiFontSize;
        node.setPosition(slot.x, slot.y, 0);
        return node;
    }

    /** 美术资源预载完成后调用：把 emoji 兜底图标升级为贴图图标 */
    refreshIcons() {
        if (!this.art?.isLoaded()) return;
        for (const slot of this.iconSlots) {
            slot.node?.destroy();
            slot.node = this.buildIcon(slot);
        }
    }

    /** 创建顶部状态栏和底部建造栏（初始化时调用一次） */
    create() {
        this.createTopBar();
        this.createBuildBar();
        this.createCardHistory();
        this.createOnlineBadge();
        this.createWaveBanner();
    }

    /** 联机身份标识 + ping 指示（顶部栏下方左侧；仅联机对局显示） */
    private createOnlineBadge() {
        const node = new Node('OnlineBadge');
        node.layer = this.gmNode.layer;
        node.parent = this.container;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(360, 22);
        ut.anchorPoint = new Vec2(0, 1);

        const badge = new Node('SideBadge');
        badge.layer = this.gmNode.layer;
        badge.parent = node;
        const bUt = badge.addComponent(UITransform);
        bUt.contentSize = new Size(150, 22);
        this.sideBadgeLabel = badge.addComponent(Label);
        this.sideBadgeLabel.string = '';
        this.sideBadgeLabel.fontSize = 15;
        this.sideBadgeLabel.lineHeight = 20;
        this.sideBadgeLabel.color = new Color(255, 220, 120);
        badge.setPosition(0, 0, 0);

        const ping = new Node('PingLabel');
        ping.layer = this.gmNode.layer;
        ping.parent = node;
        const pUt = ping.addComponent(UITransform);
        pUt.contentSize = new Size(120, 22);
        this.pingLabel = ping.addComponent(Label);
        this.pingLabel.string = '';
        this.pingLabel.fontSize = 14;
        this.pingLabel.lineHeight = 20;
        this.pingLabel.color = new Color(159, 200, 180);
        ping.setPosition(170, 0, 0);

        node.active = false;
        this.onlineBadgeNode = node;
    }

    /** 联机对局开始时调用：显示身份（你是红方/蓝方） */
    showOnlineBadge(side: 'red' | 'blue') {
        if (!this.sideBadgeLabel) return;
        this.sideBadgeLabel.string = side === 'red' ? '🔴 你是红方' : '🔵 你是蓝方';
        if (this.onlineBadgeNode) this.onlineBadgeNode.active = true;
    }

    /** 联机结束时隐藏 */
    hideOnlineBadge() {
        if (this.onlineBadgeNode) this.onlineBadgeNode.active = false;
        if (this.pingLabel) this.pingLabel.string = '';
    }

    /** 更新 ping 显示（GameManager 测得 RTT 后调用；<0 清除） */
    updatePing(rttMs: number) {
        if (!this.pingLabel) return;
        if (rttMs < 0) { this.pingLabel.string = ''; return; }
        this.pingLabel.string = `📶 ${Math.round(rttMs)}ms`;
        this.pingLabel.color = rttMs < 80
            ? new Color(120, 230, 140)
            : rttMs < 200
                ? new Color(255, 210, 100)
                : new Color(255, 130, 120);
    }

    /** 顶部栏下方的已抽卡牌历史行（图标串联，点击查看卡牌详情面板） */
    private createCardHistory() {
        const node = new Node('CardHistory');
        node.layer = this.gmNode.layer;
        node.parent = this.container;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(420, 36); // 加大点击热区，方便点开查看
        ut.anchorPoint = new Vec2(1, 1);
        this.cardHistoryLabel = node.addComponent(Label);
        this.cardHistoryLabel.string = '';
        this.cardHistoryLabel.fontSize = 14;
        this.cardHistoryLabel.lineHeight = 16;
        this.cardHistoryLabel.color = new Color(230, 210, 250);

        // 点击 → 打开卡牌详情面板（GameManager 路由到 PanelController.showCardHistory）
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.93;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = 'onCardHistoryClick';
        button.clickEvents = [this.makeClickSoundHandler(), handler];
    }

    // ==================== 波次横幅 ====================

    /** 波次横幅节点：居中偏上的大字提示条（创建一次，重复播放） */
    private createWaveBanner() {
        const banner = new Node('WaveBanner');
        banner.layer = this.gmNode.layer;
        banner.parent = this.container;
        const ut = banner.addComponent(UITransform);
        ut.contentSize = new Size(420, 64);
        banner.setPosition(0, 60, 0);

        // 半透明深色底条：压住战场背景，保证大字可读
        const bg = this.spriteFactory.createColorNode(new Color(15, 22, 30, 200), 420, 60);
        bg.name = 'WaveBannerBg';
        bg.parent = banner;

        const labelNode = new Node('WaveBannerLabel');
        labelNode.layer = this.gmNode.layer;
        labelNode.parent = banner;
        labelNode.addComponent(UITransform).contentSize = new Size(400, 44);
        const label = labelNode.addComponent(Label);
        label.string = '';
        label.fontSize = 34;
        label.lineHeight = 40;
        label.color = new Color(255, 225, 130);
        // 描边增强在战场上的可读性
        label.enableOutline = true;
        label.outlineColor = new Color(20, 16, 8, 230);
        label.outlineWidth = 3;
        this.waveBannerLabel = label;

        banner.active = false;
        this.waveBanner = banner;
    }

    /** 播放波次横幅：缩放弹入（backOut 过冲）→ 停留 → 上移淡出（UI 层允许 tween） */
    private showWaveBanner(wave: number) {
        const banner = this.waveBanner;
        if (!banner || !this.waveBannerLabel) return;
        this.waveBannerLabel.string = `第 ${wave} 波`;
        banner.active = true;

        // 重复触发时停掉上一次动画再重放（节点与 UIOpacity 都要停）
        Tween.stopAllByTarget(banner);
        let op = banner.getComponent(UIOpacity);
        if (op) Tween.stopAllByTarget(op);
        if (!op) op = banner.addComponent(UIOpacity);
        banner.setScale(0, 0, 1);
        banner.setPosition(0, 60, 0);
        op.opacity = 0;

        tween(banner)
            .parallel(
                tween(banner).to(0.28, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }),
                tween(op).to(0.15, { opacity: 255 }),
            )
            .delay(1.0)
            .parallel(
                tween(banner).to(0.35, { position: new Vec3(0, 110, 0) }, { easing: 'sineIn' }),
                tween(op).to(0.35, { opacity: 0 }),
            )
            .call(() => { banner.active = false; })
            .start();
    }

    // ==================== 每帧更新 ====================

    /** 每帧更新顶部状态栏（只读快照） */
    update(state: GameState) {
        // 检测屏幕尺寸变化，调整布局
        this.checkResponsiveLayout();

        // 已选中卡牌图标（数量变化时才重建，避免每帧拼字符串；只显示选中的，不含展示未选的）
        const used = state.cards.chosenCardIds;
        if (used.length !== this.lastCardCount && this.cardHistoryLabel) {
            this.lastCardCount = used.length;
            const icons = used.map(id => {
                for (const list of Object.values(CARD_CONFIG)) {
                    const c = list.find(x => x.id === id);
                    if (c) return c.icon;
                }
                return '';
            });
            this.cardHistoryLabel.string = used.length > 0 ? '🃏 ' + icons.join(' ') + '（点击查看）' : '';
        }

        const ps = state.playerSide;

        // 金币：变化弹跳脉冲；花钱时短暂变红（恢复由下方计时驱动）
        if (this.goldLabel) {
            const gold = state.gold[ps];
            if (gold !== this.lastGold) {
                const spent = this.lastGold >= 0 && gold < this.lastGold;
                this.lastGold = gold;
                this.goldLabel.string = String(gold);
                this.pulseLabel(this.goldLabel);
                if (spent) {
                    this.goldLabel.color = GOLD_SPEND_COLOR.clone();
                    this.goldTintUntil = state.time + 0.35;
                }
            } else if (this.goldTintUntil >= 0 && state.time >= this.goldTintUntil) {
                // 消费红色到期，恢复默认金色
                this.goldLabel.color = TOP_LABEL_BASE.gold.clone();
                this.goldTintUntil = -1;
            }
        }

        if (this.waveLabel) this.waveLabel.string = '第 ' + state.wave + ' 波';

        // 波次横幅：wave 变化且非 0 时在战场中央弹入提示（wave=0 为初始化态，不触发）
        if (state.wave !== this.lastWave) {
            this.lastWave = state.wave;
            if (state.wave > 0) this.showWaveBanner(state.wave);
        }
        if (this.popLabel) {
            const pop = state.units.filter(u => u.side === ps).length;
            if (pop !== this.lastPop) {
                this.lastPop = pop;
                this.popLabel.string = pop + '/' + GAME_CONFIG.unitCap;
                this.pulseLabel(this.popLabel);
            }
        }
        if (this.killsLabel) {
            const kills = state.stats.kills[ps];
            if (kills !== this.lastKills) {
                this.lastKills = kills;
                this.killsLabel.string = String(kills);
                this.pulseLabel(this.killsLabel);
            }
        }

        // 水晶血量：数字更新 + 低于 30% 转红常亮（核心目标告急的直观警示）
        const rc = state.crystals.find(c => c.side === 'red');
        const bc = state.crystals.find(c => c.side === 'blue');
        if (this.hpRedLabel && rc) {
            this.hpRedLabel.string = String(Math.max(0, Math.floor(rc.hp)));
            const low = rc.hp / rc.maxHp <= CRYSTAL_LOW_RATIO;
            this.hpRedLabel.color = low ? new Color(255, 86, 74) : TOP_LABEL_BASE.red.clone();
        }
        if (this.hpBlueLabel && bc) {
            this.hpBlueLabel.string = String(Math.max(0, Math.floor(bc.hp)));
            const low = bc.hp / bc.maxHp <= CRYSTAL_LOW_RATIO;
            this.hpBlueLabel.color = low ? new Color(255, 86, 74) : TOP_LABEL_BASE.blue.clone();
        }
    }

    // ==================== 数值变化反馈 ====================

    /** 数值变化反馈：标签节点快速弹跳一次（重复触发时重放，避免叠加） */
    private pulseLabel(label: Label) {
        const node = label.node;
        Tween.stopAllByTarget(node);
        node.setScale(1.22, 1.22, 1);
        tween(node).to(0.14, { scale: new Vec3(1, 1, 1) }).start();
    }

    /** 按当前游戏状态刷新建造栏价格（建造/升级/科研后调用） */
    updatePrices(state: GameState) {
        const side = state.playerSide;

        for (const id of BUILDING_IDS) {
            const label = this.buildCostLabels.get(id);
            const conf = BUILDING_CONFIG[id];
            if (!label || !conf) continue;

            if (conf.kind === 'factory') {
                // 工厂：显示实际下一座价格（含同类递增，与建造判定一致）
                const cost = buildingCostInState(state, side, id);
                label.string = cost + '金';
                // 同类已建数量：让价格递增对玩家透明
                const countLabel = this.buildCountLabels.get(id);
                if (countLabel) {
                    const built = state.buildings.filter(
                        b => b.side === side && b.unitType === conf.unitType,
                    ).length;
                    countLabel.string = built > 0 ? `已建${built}座·递增` : '';
                }
            } else if (conf.kind === 'academy') {
                const level = state.academyLevel[side];
                if (level >= 2) {
                    label.string = '满级';
                } else {
                    const cost = level === 0 ? GAME_CONFIG.academyLv1Cost : GAME_CONFIG.academyLv2Cost;
                    label.string = cost + '金';
                }
            } else if (conf.kind === 'aura') {
                // 光环塔：显示下一座实际价格（含逐座递增），达上限显示"已满"（与 quoteBuild 判定一致）
                const owned = state.towers.filter(t => t.side === side && t.kind === 'aura').length;
                const countLabel = this.buildCountLabels.get(id);
                if (owned >= GAME_CONFIG.auraTowerLimit) {
                    label.string = '已满';
                } else {
                    label.string = auraCostInState(state, side) + '金';
                }
                if (countLabel) countLabel.string = owned > 0 ? `已建${owned}座·递增` : '';
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

        // 护盾按钮价格（激活中显示剩余秒数）
        if (this.shieldCostLabel) {
            const myCrystal = state.crystals.find(c => c.side === side);
            if (myCrystal && myCrystal.shieldDur > 0) {
                this.shieldCostLabel.string = `盾${Math.ceil(myCrystal.shieldDur)}秒`;
            } else {
                this.shieldCostLabel.string = shieldCost(state.shieldLayers[side]) + '金';
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
        bg.name = 'TopBarBg';
        bg.parent = bar;
        bg.setPosition(0, -22, 0);

        // 左起：金币 / 人口 / 击杀；右侧：波次 / 红水晶 / 蓝水晶
        // 每项 = 图标贴图（22px）+ 左对齐文字（emoji 为缺图兜底）
        this.goldLabel = this.makeTopLabel('GoldLabel', '200', -584, -22, new Color(255, 215, 94), bar);
        this.makeIcon(bar, 'ui/ico_coin', '💰', -608, -22, 22, 15);

        this.popLabel = this.makeTopLabel('PopLabel', '0/' + GAME_CONFIG.unitCap, -424, -22, Color.WHITE, bar);
        this.makeIcon(bar, 'ui/ico_pop', '👥', -448, -22, 22, 15);

        this.killsLabel = this.makeTopLabel('KillsLabel', '0', -264, -22, Color.WHITE, bar);
        this.makeIcon(bar, 'ui/ico_kill', '⚔', -288, -22, 22, 15);

        this.waveLabel = this.makeTopLabel('WaveLabel', '第 0 波', 168, -22, Color.WHITE, bar);
        this.makeIcon(bar, 'ui/ico_wave', '🌊', 144, -22, 22, 15);

        this.hpRedLabel = this.makeTopLabel('HpRedLabel', String(GAME_CONFIG.crystalHp), 366, -22, new Color(255, 138, 122), bar);
        this.makeIcon(bar, 'ui/ico_hp_red', '🔴', 342, -22, 22, 15);

        this.hpBlueLabel = this.makeTopLabel('HpBlueLabel', String(GAME_CONFIG.crystalHp), 534, -22, new Color(122, 184, 255), bar);
        this.makeIcon(bar, 'ui/ico_hp_blue', '🔵', 510, -22, 22, 15);

        // 音效开关（顶部栏最右端；状态由 GameManager 初始化时同步）
        this.muteBtn = this.makeMuteButton(bar, 612, -22);
    }

    /** 静音按钮节点引用（setMuteIcon 用） */
    private muteBtn: Node | null = null;

    /** 创建音效开关按钮（🔊/🔇 文字按钮，点击走 GameManager.onMuteClick 统一处理） */
    private makeMuteButton(parent: Node, x: number, y: number): Node {
        const btn = new Node('MuteBtn');
        btn.layer = this.gmNode.layer;
        btn.parent = parent;
        const ut = btn.addComponent(UITransform);
        ut.contentSize = new Size(40, 40);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.spriteFactory.createColorNode(new Color(46, 65, 82), 40, 40);
        bg.parent = btn;

        const labelNode = new Node('MuteIcon');
        labelNode.layer = this.gmNode.layer;
        labelNode.parent = btn;
        labelNode.addComponent(UITransform).contentSize = new Size(36, 36);
        const label = labelNode.addComponent(Label);
        label.string = '🔊';
        label.fontSize = 20;
        label.lineHeight = 20;

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.93;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = 'onMuteClick';
        button.clickEvents = [this.makeClickSoundHandler(), handler];

        btn.setPosition(x, y, 0);
        return btn;
    }

    /**
     * 生成统一点击音事件（插入各按钮 clickEvents 首位）。
     * 点击任何按钮都会先触发 GameManager.onUiClick 播放确认音，再执行各自逻辑。
     */
    private makeClickSoundHandler(): EventHandler {
        const h = new EventHandler();
        h.target = this.gmNode;
        h.component = 'GameManager';
        h.handler = 'onUiClick';
        return h;
    }

    /** 更新静音按钮显示（ GameManager 切换后回调） */
    setMuteIcon(muted: boolean) {
        const label = this.muteBtn?.getChildByName('MuteIcon')?.getComponent(Label);
        if (label) label.string = muted ? '🔇' : '🔊';
    }

    /** 顶部栏专用标签：左锚点 + 左对齐（跟随在图标右侧），带节点名便于调试/重叠检测 */
    private makeTopLabel(name: string, text: string, x: number, y: number, color: Color, parent: Node, size: number = 18): Label {
        const node = new Node(name);
        node.layer = this.gmNode.layer;
        node.parent = parent;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(150, 30);
        ut.anchorPoint = new Vec2(0, 0.5);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = size;
        label.color = color;
        label.lineHeight = size;
        label.horizontalAlign = HorizontalTextAlignment.LEFT;
        node.setPosition(x, y, 0);
        return label;
    }

    // ==================== 响应式布局 ====================

    /**
     * 检测屏幕尺寸变化，调整 UI 布局防止重叠
     * - 窄屏（< 16:9）：缩小建造栏按钮，调整间距
     * - 超宽屏（> 21:9）：战场区域向两侧扩展
     */
    private checkResponsiveLayout() {
        const visHeight = view.getVisibleSize().height;
        const visWidth = view.getVisibleSize().width;

        // 只在尺寸变化时重新计算
        if (visHeight === this.lastVisibleHeight) return;
        this.lastVisibleHeight = visHeight;

        const aspectRatio = visWidth / visHeight;
        const isNarrow = aspectRatio < 16 / 9;

        // 顶部栏始终固定在屏幕顶部
        if (this.topBar) {
            this.topBar.setPosition(0, visHeight / 2, 0);
        }
        // 卡牌历史行：顶部栏下方、右侧对齐
        if (this.cardHistoryLabel) {
            this.cardHistoryLabel.node.setPosition(visWidth / 2 - 12, visHeight / 2 - 50, 0);
        }
        // 联机身份标识：顶部栏下方、左侧对齐
        if (this.onlineBadgeNode) {
            this.onlineBadgeNode.setPosition(-visWidth / 2 + 12, visHeight / 2 - 50, 0);
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
        ut.contentSize = new Size(1280, 96);
        ut.anchorPoint = new Vec2(0.5, 0);

        const bg = this.spriteFactory.createColorNode(new Color(34, 48, 58), 1280, 96);
        bg.name = 'BuildBarBg';
        bg.parent = this.buildBar;
        bg.setPosition(0, 48, 0);

        // 10 个按钮（7 建筑 + 3 操作）等间距水平居中：
        // 首个中心 = -(N-1)/2 × gap，按钮整体关于屏幕中轴对称（v1.4.2 布局修正）
        const startX = -((BUILDING_IDS.length + 3 - 1) / 2) * 96;
        const gap = 96;

        // 7 种建筑按钮
        BUILDING_IDS.forEach((id, i) => {
            const conf = BUILDING_CONFIG[id];
            const btn = this.createBuildButton(conf.icon, conf.name, conf.cost, id);
            btn.parent = this.buildBar;
            btn.setPosition(startX + i * gap, 48, 0);
        });

        // 操作按钮：升级工厂 / 全军强化 / 水晶护盾
        const upgradeBtn = this.createActionButton('ui/ico_up', '⬆️', '升级工厂', '150金', 'onUpgradeClick');
        upgradeBtn.parent = this.buildBar;
        upgradeBtn.setPosition(startX + BUILDING_IDS.length * gap, 48, 0);

        const researchBtn = this.createActionButton('ui/ico_research', '🔬', '全军强化', '400金', 'onResearchClick');
        researchBtn.parent = this.buildBar;
        researchBtn.setPosition(startX + (BUILDING_IDS.length + 1) * gap, 48, 0);
        // 记录科研价格标签
        const costNode = researchBtn.children[researchBtn.children.length - 1];
        this.researchCostLabel = costNode.getComponent(Label);

        const shieldBtn = this.createActionButton('ui/ico_shield', '🛡️', '水晶护盾', '300金', 'onShieldClick');
        shieldBtn.parent = this.buildBar;
        shieldBtn.setPosition(startX + (BUILDING_IDS.length + 2) * gap, 48, 0);
        // 记录护盾价格标签
        const sCostNode = shieldBtn.children[shieldBtn.children.length - 1];
        this.shieldCostLabel = sCostNode.getComponent(Label);
    }

    // ==================== 按钮创建辅助 ====================

    /** 创建建筑按钮（图标 + 名称 + 价格） */
    private createBuildButton(icon: string, name: string, cost: number, id: BuildingItemId): Node {
        const btn = new Node('BuildBtn_' + id);
        btn.layer = this.gmNode.layer;
        const ut = btn.addComponent(UITransform);
        ut.contentSize = new Size(90, 84);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.spriteFactory.createColorNode(new Color(46, 65, 82), 90, 84);
        bg.parent = btn;

        // 图标（美术贴图优先，emoji 兜底）
        this.makeIcon(btn, 'ui/ico_build_' + id, icon, 0, 26, 38, 20);

        // 名称
        const nameLabel = this.createLabel(name, 12, new Color(223, 233, 240), new Size(80, 16));
        nameLabel.node.parent = btn;
        nameLabel.node.setPosition(0, -10, 0);

        // 价格
        const costLabel = this.createLabel(cost + '金', 11, new Color(255, 215, 94), new Size(82, 14));
        costLabel.node.parent = btn;
        costLabel.node.setPosition(0, -24, 0);
        this.buildCostLabels.set(id, costLabel);

        // 同类已建数量（价格递增可视化：已建 N 座 → 下一座更贵）
        const countLabel = this.createLabel('', 9, new Color(160, 180, 200), new Size(82, 12));
        countLabel.node.parent = btn;
        countLabel.node.setPosition(0, -35, 0);
        this.buildCountLabels.set(id, countLabel);

        // 点击事件 → GameManager.onBuildClick
        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.93;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = 'onBuildClick';
        handler.customEventData = id;
        button.clickEvents = [this.makeClickSoundHandler(), handler];

        return btn;
    }

    /** 创建操作按钮（升级/科研等非建造命令） */
    private createActionButton(artPath: string, icon: string, name: string, cost: string, handlerName: string): Node {
        const btn = new Node('ActionBtn_' + handlerName);
        btn.layer = this.gmNode.layer;
        const ut = btn.addComponent(UITransform);
        ut.contentSize = new Size(90, 84);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.spriteFactory.createColorNode(new Color(60, 82, 60), 90, 84);
        bg.parent = btn;

        // 图标（美术贴图优先，emoji 兜底）
        this.makeIcon(btn, artPath, icon, 0, 26, 36, 20);

        const nameLabel = this.createLabel(name, 12, new Color(223, 233, 240), new Size(80, 16));
        nameLabel.node.parent = btn;
        nameLabel.node.setPosition(0, -10, 0);

        const costLabel = this.createLabel(cost, 11, new Color(255, 215, 94), new Size(60, 14));
        costLabel.node.parent = btn;
        costLabel.node.setPosition(0, -24, 0);

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.93;
        const handler = new EventHandler();
        handler.target = this.gmNode;
        handler.component = 'GameManager';
        handler.handler = handlerName;
        button.clickEvents = [this.makeClickSoundHandler(), handler];

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
