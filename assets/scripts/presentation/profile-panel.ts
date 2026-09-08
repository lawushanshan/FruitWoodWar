/**
 * ProfilePanel —— 指挥官档案面板（局外解锁进度界面，v1.8.1）
 *
 * 职责：
 *  - 战绩摘要：累计胜/负场次、全卡池收集进度
 *  - 卡牌图鉴：四页签（三阵营 + 中立卡池），锁定卡置灰显示解锁条件
 *  - 只读展示，不修改档案数据（档案读写全部经 core/unlock-system）
 *
 * 架构：独立于 PanelController 的新面板文件（D2 债务偿还——新功能不再进
 * panel-controller）；UI 构建复用 ui-kit.ts 共享基础设施。
 */

import {
    Node, Label, Color, UITransform, Size, Vec2, Vec3, UIOpacity, HorizontalTextAlignment, EventHandler, Button, tween,
} from 'cc';
import { ColorSpriteFactory } from './color-sprite-factory';
import { ArtLibrary } from './art-library';
import { UiKit, RARITY_COLORS } from './ui-kit';
import { CARD_CONFIG, NEUTRAL_CARDS } from '../config/card-config';
import {
    cardUnlockRequirement, isCardUnlocked, loadProfile,
} from '../core/unlock-system';
import type { CardConfig, FactionId } from '../core/types';

/** 图鉴页签分组（顺序即页签排列顺序） */
interface CardGroup {
    id: string;
    name: string;
    icon: string;
    cards: CardConfig[];
    /** 阵营卡的立绘阵营（中立卡无阵营立绘，走 emoji 回退） */
    faction: FactionId | null;
}

/** 稀有度展示顺序：与三轮抽卡递进一致（rare → epic → legendary），同级保持配置顺序 */
const RARITY_ORDER: Record<string, number> = { rare: 0, epic: 1, legendary: 2 };

const RARITY_NAMES: Record<string, string> = { rare: '稀有', epic: '史诗', legendary: '传说' };

/** 卡 id → 所属阵营（阵营卡立绘路径 cards/card_{faction}_{id} 用；中立卡不在其中） */
const CARD_FACTION: Record<string, FactionId> = (() => {
    const map: Record<string, FactionId> = {};
    for (const f of Object.keys(CARD_CONFIG) as FactionId[]) {
        for (const c of CARD_CONFIG[f]) map[c.id] = f;
    }
    return map;
})();

/** 图鉴网格：4 列，卡 210×230 列距 280（用户反馈 6 列窄卡拥挤，加宽后描述/名称舒展） */
const GRID_COLS = 4;
const GRID_COL_STEP = 280;
const GRID_ROW_Y = [115, -115];
const GRID_CARD_W = 210;
const GRID_CARD_H = 230;

/** 页签按钮排列（4 个 210×50，行距 230） */
const TAB_W = 210;
const TAB_STEP = 230;

export class ProfilePanel {

    private container: Node;
    private gmNode: Node;
    private ui: UiKit;
    private art: ArtLibrary | null = null;
    private spriteFactory: ColorSpriteFactory;

    private panel: Node | null = null;
    private statsLabel: Label | null = null;
    private gridNode: Node | null = null;
    /** 页签按钮节点（id → 按钮） */
    private tabButtons: Map<string, Node> = new Map();
    private groups: CardGroup[] = [];
    private activeTab = '';
    /** 当前选中的卡 id（选中光晕标记 + 大卡详情） */
    private selectedCardId: string | null = null;
    /** 大卡详情弹窗（每次打开重建，点击遮罩关闭） */
    private detailNode: Node | null = null;

    constructor(container: Node, spriteFactory: ColorSpriteFactory, gmNode: Node, art?: ArtLibrary | null) {
        this.container = container;
        this.spriteFactory = spriteFactory;
        this.gmNode = gmNode;
        this.art = art ?? null;
        this.ui = new UiKit(spriteFactory, gmNode, art);
        this.initGroups();
    }

    /** 组装图鉴分组数据（按稀有度升序排列，与抽卡轮进节奏一致） */
    private initGroups() {
        const byRarity = (a: CardConfig, b: CardConfig) => (RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0);
        this.groups = [
            { id: 'fruit', name: '水果王国', icon: '🍎', cards: [...CARD_CONFIG.fruit].sort(byRarity), faction: 'fruit' },
            { id: 'wood', name: '绿木林', icon: '🌲', cards: [...CARD_CONFIG.wood].sort(byRarity), faction: 'wood' },
            { id: 'animal', name: '动物庄园', icon: '🐗', cards: [...CARD_CONFIG.animal].sort(byRarity), faction: 'animal' },
            { id: 'neutral', name: '中立卡池', icon: '⚖️', cards: [...NEUTRAL_CARDS].sort(byRarity), faction: null },
        ];
    }

    /** 创建面板骨架（初始化时调用一次，默认隐藏） */
    create() {
        const panel = new Node('ProfilePanel');
        panel.layer = this.gmNode.layer;
        panel.parent = this.container;
        panel.active = false;
        const ut = panel.addComponent(UITransform);
        ut.contentSize = new Size(1280, 720);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        // 全屏遮罩底（与开始面板同风格的深色底）
        const bg = this.spriteFactory.createColorNode(new Color(5, 10, 14, 235), 1280, 720);
        bg.parent = panel;

        // ---- 标题与战绩摘要 ----
        this.ui.makeLabel('📋 指挥官档案', 0, 318, Color.WHITE, panel, 38);
        this.statsLabel = this.ui.makeLabel('', 0, 268, new Color(255, 215, 94), panel, 20);

        // ---- 页签行（四组卡池） ----
        this.groups.forEach((g, i) => {
            const btn = this.ui.makeButton('ProfileTab_' + g.id, g.icon + ' ' + g.name, TAB_W, 50, 'onProfileTabClick',
                'ui/ui_btn_blue', new Color(46, 65, 82), 16, g.id);
            btn.parent = panel;
            btn.setPosition(-1.5 * TAB_STEP + i * TAB_STEP, 205, 0);
            this.tabButtons.set(g.id, btn);
        });

        // ---- 图鉴网格容器（切页签时重建内容） ----
        const grid = new Node('ProfileGrid');
        grid.layer = this.gmNode.layer;
        grid.parent = panel;
        grid.addComponent(UITransform).contentSize = new Size(1280, 460);
        grid.setPosition(0, -35, 0);
        this.gridNode = grid;

        // ---- 关闭按钮 ----
        const closeBtn = this.ui.makeButton('ProfileCloseBtn', '返 回', 200, 56, 'onProfileCloseClick',
            'ui/ui_btn_green', new Color(63, 109, 51), 20);
        closeBtn.parent = panel;
        closeBtn.setPosition(0, -318, 0);

        this.panel = panel;
    }

    // ==================== 公开方法 ====================

    /** 显示档案（每次打开重读档案刷新战绩与网格） */
    show() {
        this.refresh();
        if (this.panel) this.panel.active = true;
    }

    /** 隐藏档案（同时收起大卡详情与选中态） */
    hide() {
        this.closeDetail();
        this.selectedCardId = null;
        if (this.panel) this.panel.active = false;
    }

    /** 美术预载完成后调用：纯色兜底底板升级为九宫格贴图（UiKit 槽位机制） */
    refreshPanels() {
        this.ui.refreshPanels();
    }

    isShowing(): boolean {
        return this.panel?.active ?? false;
    }

    /** 页签切换（GameManager 路由 onProfileTabClick） */
    onTabClick(tabId: string) {
        if (!this.groups.some(g => g.id === tabId)) return;
        this.activeTab = tabId;
        this.selectedCardId = null;
        this.closeDetail();
        this.refreshTabs();
        this.rebuildGrid();
    }

    /** 点击卡格（GameManager 路由 onProfileCardClick）：选中高亮 + 弹出大卡详情 */
    onCardClick(cardId: string) {
        const group = this.groups.find(g => g.cards.some(c => c.id === cardId));
        const card = group?.cards.find(c => c.id === cardId);
        if (!group || !card) return;
        const changed = this.selectedCardId !== cardId;
        this.selectedCardId = cardId;
        if (changed) this.rebuildGrid(); // 刷新光晕高亮
        this.showCardDetail(card, group.faction);
    }

    /** 关闭大卡详情弹窗 */
    closeDetail() {
        if (this.detailNode?.isValid) this.detailNode.destroy();
        this.detailNode = null;
    }

    // ==================== 内部刷新 ====================

    /** 重读档案并刷新战绩 / 页签 / 网格 */
    private refresh() {
        const profile = loadProfile();
        const total = this.groups.reduce((sum, g) => sum + g.cards.length, 0);
        const unlocked = this.groups.reduce((sum, g) =>
            sum + g.cards.filter(c => isCardUnlocked(profile, c.id)).length, 0);

        if (this.statsLabel) {
            this.statsLabel.string = `胜 ${profile.wins} · 负 ${profile.losses} · 卡牌收集 ${unlocked}/${total}`;
        }

        if (!this.activeTab) this.activeTab = this.groups[0].id;
        this.refreshTabs();
        this.rebuildGrid();
    }

    /** 刷新页签文案（含各组收集进度）与高亮态 */
    private refreshTabs() {
        const profile = loadProfile();
        for (const g of this.groups) {
            const btn = this.tabButtons.get(g.id);
            if (!btn) continue;
            const l = btn.getChildByName('BtnLabel')?.getComponent(Label) ?? null;
            if (!l) continue;
            const got = g.cards.filter(c => isCardUnlocked(profile, c.id)).length;
            l.string = `${g.icon} ${g.name} ${got}/${g.cards.length}`;
            // 选中态：不透明全亮，未选中压暗（底板贴图不变，避免重建）
            const op = btn.getComponent(UIOpacity) ?? btn.addComponent(UIOpacity);
            op.opacity = g.id === this.activeTab ? 255 : 160;
        }
    }

    /** 重建当前页签的图鉴网格 */
    private rebuildGrid() {
        if (!this.gridNode) return;
        // 清除旧卡
        for (const child of [...this.gridNode.children]) {
            if (child.isValid) child.destroy();
        }
        const group = this.groups.find(g => g.id === this.activeTab);
        if (!group) return;
        const profile = loadProfile();

        group.cards.forEach((card, i) => {
            const col = i % GRID_COLS;
            const row = Math.floor(i / GRID_COLS);
            const selected = card.id === this.selectedCardId;
            const node = this.createCardCell(card, group.faction, isCardUnlocked(profile, card.id), selected);
            node.parent = this.gridNode;
            node.setPosition((col - (GRID_COLS - 1) / 2) * GRID_COL_STEP, GRID_ROW_Y[row] ?? GRID_ROW_Y[0], 0);
        });
    }

    /** 构建图鉴格子：小卡（立绘画框 + 名称 + 稀有度 + 描述 + 色条；选中光晕；锁定置灰） */
    private createCardCell(card: CardConfig, faction: FactionId | null, unlocked: boolean, selected: boolean): Node {
        const node = new Node('Cell_' + card.id);
        node.layer = this.gmNode.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(GRID_CARD_W, GRID_CARD_H);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const rarityColor = RARITY_COLORS[card.rarity] ?? new Color(100, 100, 100);

        // 选中标记：稀有度色光晕垫底（第一个子节点渲染在最下）+ 整卡微放大，一眼可辨
        if (selected) {
            const halo = this.spriteFactory.createColorNode(rarityColor.clone(), GRID_CARD_W + 14, GRID_CARD_H + 14);
            halo.parent = node;
            halo.setPosition(0, 0, 0);
            const haloOp = halo.getComponent(UIOpacity) ?? halo.addComponent(UIOpacity);
            haloOp.opacity = 120;
            node.setScale(1.05, 1.05, 1);
        }

        // 卡底板（与选卡面板同款九宫格卡底）
        const bgNode = this.ui.makePanelBg(node, 'ui/ui_panel_card', GRID_CARD_W, GRID_CARD_H, new Color(30, 42, 54));

        // ---- 立绘画框（上部）：深色衬底垫底 + 居中立绘 ----
        // 满铺底色的方形贴图（如"适者生存"）四周留出深色边，形成画框感而不是色块怼金边
        const frame = this.spriteFactory.createColorNode(new Color(10, 16, 24, 210), 96, 96);
        frame.parent = node;
        frame.setPosition(0, 50, 0);

        const artFaction = faction ?? CARD_FACTION[card.id] ?? null;
        const artNode = artFaction
            ? this.art?.createSpriteNode(`cards/card_${artFaction}_${card.id}`, 80, 80) ?? null
            : null;
        let iconLabel: Label | null = null;
        if (artNode) {
            artNode.setPosition(0, 50, 0);
            artNode.parent = node;
        } else {
            iconLabel = this.ui.makeLabel(card.icon, 0, 50, Color.WHITE, node, 34);
        }

        // ---- 名称（卡加宽后升到 16 号，更易读） ----
        const nameLabel = this.ui.makeLabel(card.name, 0, -26, Color.WHITE, node, 16);

        // ---- 稀有度（纯色文字，紧跟名称） ----
        const rarityLabel = this.ui.makeLabel(RARITY_NAMES[card.rarity] ?? '普通', 0, -48, rarityColor.clone(), node, 12);

        // ---- 描述（RESIZE_HEIGHT 自适应行数：先设 overflow 再定尺寸，换行才生效） ----
        if (unlocked) {
            const descNode = new Node('CellDesc');
            descNode.layer = this.gmNode.layer;
            descNode.parent = node;
            const dUt = descNode.addComponent(UITransform);
            const desc = descNode.addComponent(Label);
            desc.overflow = Label.Overflow.RESIZE_HEIGHT;
            desc.string = card.desc;
            desc.fontSize = 10;
            desc.lineHeight = 13;
            desc.color = new Color(192, 210, 224);
            desc.horizontalAlign = HorizontalTextAlignment.CENTER;
            dUt.anchorPoint = new Vec2(0.5, 1); // 顶锚：内容向下自然生长，多行不挤压色条
            dUt.setContentSize(150, 13); // 限宽 150（卡加宽后紫色区内余量充足，不压金边）
            descNode.setPosition(0, -62, 0); // 区域从 -62 向下，与色条(-96)留白
        }

        // ---- 稀有度色条（卡底座位置，宽 150 收进紫色区内不压金边） ----
        const accent = this.spriteFactory.createColorNode(rarityColor.clone(), 150, 4);
        accent.parent = node;
        accent.setPosition(0, -96, 0);

        // 整卡可点（GameManager 路由 onProfileCardClick）：选中高亮 + 弹大卡详情，按下微缩反馈
        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.95;
        const eh = new EventHandler();
        eh.target = this.gmNode;
        eh.component = 'GameManager';
        eh.handler = 'onProfileCardClick';
        eh.customEventData = card.id;
        btn.clickEvents = [eh];

        // 锁定态：仅压暗底板/画框/立绘/名称/稀有度，锁角标与解锁条件保持全亮可读
        // （基础卡永解锁不会进此分支；UIOpacity 逐层相乘，故压暗只作用于子节点而非整卡）
        if (!unlocked) {
            const dim = (n: Node) => {
                const o = n.getComponent(UIOpacity) ?? n.addComponent(UIOpacity);
                o.opacity = 130;
            };
            [bgNode, frame, artNode, iconLabel?.node, nameLabel.node, rarityLabel.node].forEach(n => { if (n) dim(n); });
            const req = cardUnlockRequirement(card.id);
            this.ui.makeLabel('🔒', 0, 50, Color.WHITE, node, 28); // 画框中央大锁，未解锁信息不剧透
            this.ui.makeLabel(`胜 ${req} 场解锁`, 0, -75, new Color(185, 200, 215), node, 12); // 描述区居中
        }
        return node;
    }

    // ==================== 大卡详情弹窗 ====================

    /** 弹出大卡详情（半透明遮罩 + 居中大卡，点遮罩关闭、点大卡不关） */
    private showCardDetail(card: CardConfig, faction: FactionId | null) {
        if (!this.panel) return;
        this.closeDetail();
        const layer = new Node('ProfileCardDetail');
        layer.layer = this.gmNode.layer;
        layer.parent = this.panel; // 挂面板根节点末尾 → 渲染在网格之上
        layer.addComponent(UITransform).contentSize = new Size(1280, 720);

        // 全屏半透明遮罩（点击任意处关闭）
        this.spriteFactory.createColorNode(new Color(5, 10, 14, 225), 1280, 720).parent = layer;
        const maskBtn = layer.addComponent(Button);
        maskBtn.transition = Button.Transition.NONE;
        const eh = new EventHandler();
        eh.target = this.gmNode;
        eh.component = 'GameManager';
        eh.handler = 'onProfileCardClose';
        maskBtn.clickEvents = [eh];

        // 居中大卡 + 弹入动画
        const unlocked = isCardUnlocked(loadProfile(), card.id);
        const big = this.createDetailCard(card, faction, unlocked);
        big.parent = layer;
        big.setScale(0.85, 0.85, 1);
        tween(big).to(0.12, { scale: new Vec3(1, 1, 1) }).start();
        this.detailNode = layer;
    }

    /** 构建大卡详情卡（260×260，与选卡面板已验证卡规格一致） */
    private createDetailCard(card: CardConfig, faction: FactionId | null, unlocked: boolean): Node {
        const node = new Node('DetailCard_' + card.id);
        node.layer = this.gmNode.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(260, 260);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bgNode = this.ui.makePanelBg(node, 'ui/ui_panel_card', 260, 260, new Color(30, 42, 54));
        const rarityColor = RARITY_COLORS[card.rarity] ?? new Color(100, 100, 100);

        // 深色衬底画框 + 立绘（满铺底色的方形贴图四周留深边，画框感）
        const frame = this.spriteFactory.createColorNode(new Color(10, 16, 24, 210), 132, 132);
        frame.parent = node;
        frame.setPosition(0, 66, 0);

        const artFaction = faction ?? CARD_FACTION[card.id] ?? null;
        const artNode = artFaction
            ? this.art?.createSpriteNode(`cards/card_${artFaction}_${card.id}`, 120, 120) ?? null
            : null;
        if (artNode) {
            artNode.setPosition(0, 66, 0);
            artNode.parent = node;
        } else {
            this.ui.makeLabel(card.icon, 0, 66, Color.WHITE, node, 56);
        }

        // 锁定卡：立绘位置盖大锁（信息不剧透），解锁后正常展示
        if (!unlocked) {
            this.ui.makeLabel('🔒', 0, 66, Color.WHITE, node, 44);
        }

        // 名称
        this.ui.makeLabel(card.name, 0, 2, Color.WHITE, node, 20);

        // 描述：锁定卡不剧透描述，显示解锁条件；RESIZE_HEIGHT 自适应行数
        const descNode = new Node('DetailDesc');
        descNode.layer = this.gmNode.layer;
        descNode.parent = node;
        const dUt = descNode.addComponent(UITransform);
        const desc = descNode.addComponent(Label);
        desc.overflow = Label.Overflow.RESIZE_HEIGHT;
        desc.string = unlocked ? card.desc : `胜 ${cardUnlockRequirement(card.id)} 场解锁`;
        desc.fontSize = 12;
        desc.lineHeight = 17;
        desc.color = new Color(192, 210, 224);
        desc.horizontalAlign = HorizontalTextAlignment.CENTER;
        dUt.anchorPoint = new Vec2(0.5, 1); // 顶锚：内容向下自然生长
        dUt.setContentSize(224, 17); // 先定 overflow 再设尺寸，换行才生效
        descNode.setPosition(0, -22, 0);

        // 稀有度色条 + 稀有度胶囊（白字标稀有度）
        const accent = this.spriteFactory.createColorNode(rarityColor.clone(), 200, 6);
        accent.parent = node;
        accent.setPosition(0, -108, 0);

        const pill = this.spriteFactory.createColorNode(rarityColor.clone(), 64, 26);
        pill.parent = node;
        pill.setPosition(0, -127, 0);
        const pillOp = pill.getComponent(UIOpacity) ?? pill.addComponent(UIOpacity);
        pillOp.opacity = 72;
        this.ui.makeLabel(RARITY_NAMES[card.rarity] ?? '普通', 0, -127, Color.WHITE, node, 16);

        // 锁定态压暗底板/画框/立绘（解锁条件已全亮展示在描述区）
        if (!unlocked) {
            const dim = (n: Node) => {
                const o = n.getComponent(UIOpacity) ?? n.addComponent(UIOpacity);
                o.opacity = 130;
            };
            [bgNode, frame, artNode].forEach(n => { if (n) dim(n); });
        }

        // 空 Button 吞触摸：点击大卡本体不触发遮罩关闭
        const swallow = node.addComponent(Button);
        swallow.transition = Button.Transition.NONE;
        return node;
    }
}
