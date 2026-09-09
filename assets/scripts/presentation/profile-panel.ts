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
import { UNIT_NAMES } from './entity-info-panel';
import { CARD_CONFIG, NEUTRAL_CARDS } from '../config/card-config';
import { UNIT_CONFIG, UNIT_TYPES } from '../config/unit-config';
import { FACTION_CONFIG, FACTION_IDS } from '../config/faction-config';
import {
    cardUnlockRequirement, isCardUnlocked, loadProfile,
} from '../core/unlock-system';
import type { CardConfig, FactionId, UnitType } from '../core/types';

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

/** 图鉴网格：4 列 × 2 行，卡 210×230（8 张/页；12 张组分两页翻页浏览） */
const GRID_COLS = 4;
const GRID_COL_STEP = 280;
const GRID_ROW_Y = [112, -112];
const GRID_CARD_W = 210;
const GRID_CARD_H = 230;
/** 每页卡格数（4 列 × 2 行） */
const PAGE_SIZE = GRID_COLS * GRID_ROW_Y.length;

/** 页签按钮排列（5 个 210×50，行距 230） */
const TAB_W = 210;
const TAB_STEP = 230;

// ==================== 兵种图鉴（第 5 页签，全部可见无锁定） ====================

/** 兵种图鉴页签 id（与卡池页签区分；卡格点击路由用 `u:{faction}:{type}` 编码） */
const UNITS_TAB = 'units';

/** 阵营图鉴主色（FACTION_CONFIG.color 为 hex 字符串，UI 需 Color 实例，此处展开） */
const FACTION_RGB: Record<FactionId, Color> = {
    fruit: new Color(255, 112, 67),
    wood: new Color(102, 187, 106),
    animal: new Color(255, 202, 40),
};

/** 阵营列头图标 */
const FACTION_ICON: Record<FactionId, string> = { fruit: '🍎', wood: '🌲', animal: '🐗' };

/** 兵种定位一句话（小卡特效行与大卡描述共用） */
const ROLE_DESC: Record<UnitType, string> = {
    tank: '血厚前锋，顶在一线吸收伤害',
    ranged: '后排稳定输出，安全距离点杀',
    aoe: '范围溅射，一打一群清兵线',
    rush: '高速突进，首击爆发切后排',
    siege: '超远程抛射，专门拆防御建筑',
};

/** 兵种特效短句（小卡一行，克制关系来自 COUNTER_MATRIX） */
const UNIT_ABILITY: Record<UnitType, string> = {
    tank: '坚盾挡线 · 克⚡冲锋+40%',
    ranged: '后排点射 · 克🛡️坦克+40%',
    aoe: '💥 溅射周围50%伤害',
    rush: '⚡ 首击爆发 · 克🏹远程/✨AOE',
    siege: '🪨 对建筑伤害×15',
};

/** 兵种大卡特效详述（机制来源：combat-system 结算规则） */
const UNIT_DETAIL: Record<UnitType, string> = {
    tank: '克制冲锋兵种：对其伤害+40%',
    ranged: '克制坦克兵种：对其伤害+40%',
    aoe: '溅射攻击：对目标周围 75 范围内敌人造成 50% 伤害',
    rush: '首次攻击伤害按阵营倍率放大并冲击周围敌人；克制远程/AOE（+40%）',
    siege: '攻城专精：对建筑伤害×15，但攻速慢、近身脆弱',
};

/** 兵种竖卡：当前阵营 5 张一行（230×300，列距 250，与卡池卡同量级看得清） */
const UNIT_CARD_W = 230;
const UNIT_CARD_H = 300;
const UNIT_COL_STEP = 250;

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
    /** 卡池分页（每页 8 张，切页签归零） */
    private page = 0;
    /** 兵种图鉴当前阵营（子页签切换） */
    private unitFac: FactionId = 'fruit';
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

        // ---- 页签行（四组卡池 + 兵种图鉴） ----
        const tabIds = [...this.groups.map(g => g.id), UNITS_TAB];
        tabIds.forEach((id, i) => {
            const g = this.groups.find(gr => gr.id === id);
            const btn = this.ui.makeButton('ProfileTab_' + id, g ? g.icon + ' ' + g.name : '⚔️ 兵种图鉴',
                TAB_W, 50, 'onProfileTabClick', 'ui/ui_btn_blue', new Color(46, 65, 82), 16, id);
            btn.parent = panel;
            btn.setPosition((i - (tabIds.length - 1) / 2) * TAB_STEP, 212, 0);
            this.tabButtons.set(id, btn);
        });

        // ---- 图鉴网格容器（切页签时重建内容） ----
        const grid = new Node('ProfileGrid');
        grid.layer = this.gmNode.layer;
        grid.parent = panel;
        grid.addComponent(UITransform).contentSize = new Size(1280, 460);
        grid.setPosition(0, -52, 0); // 下移让开页签行（顶行卡上沿 175 < 页签底 187，不再压字）
        this.gridNode = grid;

        // ---- 关闭按钮 ----
        const closeBtn = this.ui.makeButton('ProfileCloseBtn', '返 回', 200, 56, 'onProfileCloseClick',
            'ui/ui_btn_green', new Color(63, 109, 51), 20);
        closeBtn.parent = panel;
        closeBtn.setPosition(0, -330, 0); // 下移给页码标签让位

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

    /** 页签切换（GameManager 路由 onProfileTabClick；兵种图鉴页签无收集概念） */
    onTabClick(tabId: string) {
        if (tabId !== UNITS_TAB && !this.groups.some(g => g.id === tabId)) return;
        this.activeTab = tabId;
        this.selectedCardId = null;
        this.page = 0; // 切页签回到第一页
        this.closeDetail();
        this.refreshTabs();
        this.rebuildGrid();
    }

    /** 点击卡格（GameManager 路由 onProfileCardClick）：选中高亮 + 弹出大卡详情
     *  卡牌 id 原样路由；兵种 id 为 `u:{faction}:{type}` 编码走兵种详情 */
    onCardClick(cardId: string) {
        if (cardId.startsWith('u:')) {
            const [, faction, type] = cardId.split(':');
            if (!FACTION_IDS.includes(faction as FactionId) || !(type in UNIT_CONFIG)) return;
            const changed = this.selectedCardId !== cardId;
            this.selectedCardId = cardId;
            if (changed) this.rebuildGrid(); // 走统一重建刷新选中光晕，避免节点叠加
            this.showUnitDetail(faction as FactionId, type as UnitType);
            return;
        }
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
        for (const [id, btn] of this.tabButtons) {
            const l = btn.getChildByName('BtnLabel')?.getComponent(Label) ?? null;
            if (!l) continue;
            const g = this.groups.find(gr => gr.id === id);
            // 兵种图鉴页签无收集概念，固定文案；卡池页签显示收集进度
            l.string = g
                ? `${g.icon} ${g.name} ${g.cards.filter(c => isCardUnlocked(profile, c.id)).length}/${g.cards.length}`
                : '⚔️ 兵种图鉴';
            // 选中态：不透明全亮，未选中压暗（底板贴图不变，避免重建）
            const op = btn.getComponent(UIOpacity) ?? btn.addComponent(UIOpacity);
            op.opacity = id === this.activeTab ? 255 : 160;
        }
    }

    /** 重建当前页签的图鉴网格（卡池走卡格，兵种图鉴走行卡） */
    private rebuildGrid() {
        if (!this.gridNode) return;
        // 清除旧卡
        for (const child of [...this.gridNode.children]) {
            if (child.isValid) child.destroy();
        }
        if (this.activeTab === UNITS_TAB) {
            this.rebuildUnitGrid();
            return;
        }
        const group = this.groups.find(g => g.id === this.activeTab);
        if (!group) return;
        const profile = loadProfile();

        // 分页切片（每页 8 张），页码越界时收敛到最后一页
        const pages = Math.max(1, Math.ceil(group.cards.length / PAGE_SIZE));
        if (this.page >= pages) this.page = pages - 1;
        const start = this.page * PAGE_SIZE;

        group.cards.slice(start, start + PAGE_SIZE).forEach((card, i) => {
            const col = i % GRID_COLS;
            const row = Math.floor(i / GRID_COLS);
            const selected = card.id === this.selectedCardId;
            const node = this.createCardCell(card, group.faction, isCardUnlocked(profile, card.id), selected);
            node.parent = this.gridNode;
            node.setPosition((col - (GRID_COLS - 1) / 2) * GRID_COL_STEP, GRID_ROW_Y[row] ?? GRID_ROW_Y[0], 0);
        });

        // 超过一页时显示翻页控件
        if (pages > 1) this.buildPager(pages);
    }

    /** 翻页控件（左右箭头 + 页码；纯面板内行为，本地监听不走 GameManager） */
    private buildPager(pages: number) {
        if (!this.gridNode) return;
        const flip = (dir: number) => {
            const next = this.page + dir;
            if (next < 0 || next >= pages) return;
            this.page = next;
            this.rebuildGrid();
        };
        const prev = this.makeLocalBtn('ProfilePrev', '◀', 64, 56, () => flip(-1));
        prev.parent = this.gridNode;
        prev.setPosition(-590, 0, 0); // 网格左右两侧竖直居中，不挡卡列（最外列卡边 525）
        const next = this.makeLocalBtn('ProfileNext', '▶', 64, 56, () => flip(1));
        next.parent = this.gridNode;
        next.setPosition(590, 0, 0);
        this.ui.makeLabel(`第 ${this.page + 1}/${pages} 页`, 0, -236, new Color(255, 215, 94), this.gridNode, 14);
    }

    /** 面板内本地按钮（makeButton 默认路由 GameManager，此处清空改为本地监听，省 GameManager 行数预算） */
    private makeLocalBtn(name: string, text: string, w: number, h: number, cb: () => void): Node {
        const btn = this.ui.makeButton(name, text, w, h, '', 'ui/ui_btn_blue', new Color(46, 65, 82), 20);
        const b = btn.getComponent(Button);
        if (b) b.clickEvents = [];
        btn.on(Button.EventType.CLICK, cb, this);
        return btn;
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

        // ---- 立绘（上部）：素材已转透明底，直接印在卡面上 ----
        const artFaction = faction ?? CARD_FACTION[card.id] ?? null;
        const artNode = artFaction
            ? this.art?.createSpriteNode(`cards/card_${artFaction}_${card.id}`, 88, 88) ?? null
            : null;
        let iconLabel: Label | null = null;
        if (artNode) {
            artNode.setPosition(0, 48, 0);
            artNode.parent = node;
        } else {
            iconLabel = this.ui.makeLabel(card.icon, 0, 48, Color.WHITE, node, 34);
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
            [bgNode, artNode, iconLabel?.node, nameLabel.node, rarityLabel.node].forEach(n => { if (n) dim(n); });
            const req = cardUnlockRequirement(card.id);
            this.ui.makeLabel('🔒', 0, 48, Color.WHITE, node, 28); // 立绘区中央大锁，未解锁信息不剧透
            this.ui.makeLabel(`胜 ${req} 场解锁`, 0, -75, new Color(185, 200, 215), node, 12); // 描述区居中
        }
        return node;
    }

    // ==================== 大卡详情弹窗 ====================

    /** 弹出大卡详情（半透明遮罩 + 居中大卡，点遮罩关闭、点大卡不关） */
    private showCardDetail(card: CardConfig, faction: FactionId | null) {
        this.openDetailLayer('ProfileCardDetail', () =>
            this.createDetailCard(card, faction, isCardUnlocked(loadProfile(), card.id)));
    }

    /** 详情弹窗公共骨架：遮罩 + 居中内容 + 弹入动画（卡牌/兵种共用） */
    private openDetailLayer(name: string, buildContent: () => Node) {
        if (!this.panel) return;
        this.closeDetail();
        const layer = new Node(name);
        layer.layer = this.gmNode.layer;
        layer.parent = this.panel; // 挂面板根节点末尾 → 渲染在网格之上
        layer.addComponent(UITransform).contentSize = new Size(1280, 720);

        // 全屏半透明遮罩（点击任意处关闭，本地监听即可——纯 UI 行为不走 GameManager 路由）
        this.spriteFactory.createColorNode(new Color(5, 10, 14, 225), 1280, 720).parent = layer;
        const maskBtn = layer.addComponent(Button);
        maskBtn.transition = Button.Transition.NONE;
        layer.on(Button.EventType.CLICK, () => this.closeDetail(), this);

        // 居中内容 + 弹入动画
        const big = buildContent();
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

        // ---- 立绘（上部）：素材已转透明底，直接印在卡面上，无需深色垫板 ----
        const artFaction = faction ?? CARD_FACTION[card.id] ?? null;
        const artNode = artFaction
            ? this.art?.createSpriteNode(`cards/card_${artFaction}_${card.id}`, 120, 120) ?? null
            : null;
        if (artNode) {
            artNode.setPosition(0, 60, 0);
            artNode.parent = node;
        } else {
            this.ui.makeLabel(card.icon, 0, 60, Color.WHITE, node, 56);
        }

        // 锁定卡：立绘位置盖大锁（信息不剧透），解锁后正常展示
        if (!unlocked) {
            this.ui.makeLabel('🔒', 0, 60, Color.WHITE, node, 44);
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

        // 锁定态压暗底板/立绘（解锁条件已全亮展示在描述区）
        if (!unlocked) {
            const dim = (n: Node) => {
                const o = n.getComponent(UIOpacity) ?? n.addComponent(UIOpacity);
                o.opacity = 130;
            };
            [bgNode, artNode].forEach(n => { if (n) dim(n); });
        }

        // 空 Button 吞触摸：点击大卡本体不触发遮罩关闭
        const swallow = node.addComponent(Button);
        swallow.transition = Button.Transition.NONE;
        return node;
    }

    // ==================== 兵种图鉴（第 5 页签） ====================

    /** 重建兵种网格：阵营子页签 + 种族被动 + 当前阵营 5 张兵种竖卡 */
    private rebuildUnitGrid() {
        if (!this.gridNode) return;
        const fc = FACTION_CONFIG[this.unitFac];

        // 阵营子页签（本地监听切换种族）
        FACTION_IDS.forEach((fac, i) => {
            const sub = this.makeLocalBtn('UnitSub_' + fac, `${FACTION_ICON[fac]} ${FACTION_CONFIG[fac].name}`,
                150, 44, () => {
                    if (this.unitFac === fac) return;
                    this.unitFac = fac;
                    this.selectedCardId = null;
                    this.rebuildGrid(); // 走统一重建：先清理旧阵营节点再重建，避免文字叠加
                });
            sub.parent = this.gridNode;
            sub.setPosition((i - 1) * 170, 195, 0);
            const op = sub.getComponent(UIOpacity) ?? sub.addComponent(UIOpacity);
            op.opacity = fac === this.unitFac ? 255 : 160;
        });

        // 种族被动一句话（阵营色，让玩家认识种族特色）
        this.ui.makeLabel(fc.passive, 0, 160, FACTION_RGB[this.unitFac].clone(), this.gridNode, 12);

        // 5 张兵种竖卡一行
        UNIT_TYPES.forEach((t, i) => {
            const cell = this.createUnitCell(this.unitFac, t);
            cell.parent = this.gridNode;
            cell.setPosition((i - 2) * UNIT_COL_STEP, -35, 0);
        });
    }

    /** 构建兵种竖卡（230×300：大立绘 + 名称 + 定位 + 属性两行 + 特效短句；点击弹大卡） */
    private createUnitCell(fac: FactionId, type: UnitType): Node {
        const node = new Node(`Unit_${fac}_${type}`);
        node.layer = this.gmNode.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(UNIT_CARD_W, UNIT_CARD_H);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const facColor = FACTION_RGB[fac];
        const base = UNIT_CONFIG[type];
        const unitId = `u:${fac}:${type}`;

        // 选中标记：阵营色光晕垫底 + 微放大（与卡牌图鉴同一套选中语言）
        if (this.selectedCardId === unitId) {
            const halo = this.spriteFactory.createColorNode(facColor.clone(), UNIT_CARD_W + 14, UNIT_CARD_H + 14);
            halo.parent = node;
            const haloOp = halo.getComponent(UIOpacity) ?? halo.addComponent(UIOpacity);
            haloOp.opacity = 120;
            node.setScale(1.04, 1.04, 1);
        }

        // 底板 + 大立绘（素材已转透明底，直接印在卡面上，不再垫深色板以免黑块压住画框装饰）
        this.ui.makePanelBg(node, 'ui/ui_panel_card', UNIT_CARD_W, UNIT_CARD_H, new Color(30, 42, 54));
        const artNode = this.art?.createSpriteNode(`units/u_${fac}_${type}`, 108, 108) ?? null;
        if (artNode) {
            artNode.setPosition(0, 76, 0);
            artNode.parent = node;
        } else {
            this.ui.makeLabel(base.icon, 0, 76, Color.WHITE, node, 52);
        }

        // 名称 + 定位副题（阵营色）
        this.ui.makeLabel(UNIT_NAMES[fac][type], 0, 8, Color.WHITE, node, 17);
        this.ui.makeLabel(`${base.icon} ${base.name}`, 0, -12, facColor.clone(), node, 11);

        // 属性两行（Lv1 实际值：基准 × 阵营修正，与开局出兵口径一致）
        const fc = FACTION_CONFIG[fac];
        const hp = Math.round(base.hp * fc.hpMult);
        const atk = Math.round(base.atk * fc.atkMult);
        this.ui.makeLabel(`血 ${hp} · 攻 ${atk}`, 0, -34, new Color(223, 233, 240), node, 11);
        this.ui.makeLabel(`攻速 ${base.atkSpeed} · 射程 ${base.range}`, 0, -52, new Color(223, 233, 240), node, 11);

        // 特效短句（RESIZE_HEIGHT 自适应：先设 overflow 再定尺寸，换行才生效）
        const abilNode = new Node('UnitAbility');
        abilNode.layer = this.gmNode.layer;
        abilNode.parent = node;
        const aUt = abilNode.addComponent(UITransform);
        const abil = abilNode.addComponent(Label);
        abil.overflow = Label.Overflow.RESIZE_HEIGHT;
        abil.string = UNIT_ABILITY[type];
        abil.fontSize = 10;
        abil.lineHeight = 13;
        abil.color = facColor.clone();
        abil.horizontalAlign = HorizontalTextAlignment.CENTER;
        aUt.anchorPoint = new Vec2(0.5, 1); // 顶锚：内容向下自然生长
        aUt.setContentSize(200, 13);
        abilNode.setPosition(0, -72, 0);

        // 底部阵营色条
        const accent = this.spriteFactory.createColorNode(facColor.clone(), 180, 4);
        accent.parent = node;
        accent.setPosition(0, -126, 0);

        // 整卡可点（复用卡牌图鉴的 onProfileCardClick 路由，u: 前缀区分兵种）
        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.95;
        const eh = new EventHandler();
        eh.target = this.gmNode;
        eh.component = 'GameManager';
        eh.handler = 'onProfileCardClick';
        eh.customEventData = unitId;
        btn.clickEvents = [eh];
        return node;
    }

    /** 弹出兵种大卡详情（复用卡牌详情弹窗骨架） */
    private showUnitDetail(fac: FactionId, type: UnitType) {
        this.openDetailLayer('ProfileUnitDetail', () => this.createUnitDetailCard(fac, type));
    }

    /** 构建兵种大卡（260×340：立绘 + 属性四栏 + 特效详述 + 克制 + 阵营被动） */
    private createUnitDetailCard(fac: FactionId, type: UnitType): Node {
        const node = new Node(`UnitDetail_${fac}_${type}`);
        node.layer = this.gmNode.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(260, 340);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const fc = FACTION_CONFIG[fac];
        const base = UNIT_CONFIG[type];
        const facColor = FACTION_RGB[fac];

        this.ui.makePanelBg(node, 'ui/ui_panel_card', 260, 340, new Color(30, 42, 54));

        // 立绘（透明底直接印卡面，无需深色垫板，位置微降避开顶部画框装饰）
        const artNode = this.art?.createSpriteNode(`units/u_${fac}_${type}`, 120, 120) ?? null;
        if (artNode) {
            artNode.setPosition(0, 88, 0);
            artNode.parent = node;
        } else {
            this.ui.makeLabel(base.icon, 0, 88, Color.WHITE, node, 56);
        }

        // 名称 + 定位副题
        this.ui.makeLabel(UNIT_NAMES[fac][type], 0, 2, Color.WHITE, node, 20);
        this.ui.makeLabel(`${base.icon}${base.name} · ${fc.name}`, 0, -18, facColor, node, 12);

        // 属性两行（Lv1 实际值；拆短行宽防溢出 260 卡面）
        const hp = Math.round(base.hp * fc.hpMult);
        const atk = Math.round(base.atk * fc.atkMult);
        const speed = Math.round(base.speed * fc.speedMult);
        const price = Math.round(base.cost * fc.priceMult);
        this.ui.makeLabel(`血 ${hp} · 攻 ${atk} · 攻速 ${base.atkSpeed}/秒`, 0, -36,
            new Color(223, 233, 240), node, 11);
        this.ui.makeLabel(`射程 ${base.range} · 移速 ${speed} · 价 ${price}`, 0, -52,
            new Color(223, 233, 240), node, 11);

        // 阵营色条分隔
        const accent = this.spriteFactory.createColorNode(facColor.clone(), 200, 5);
        accent.parent = node;
        accent.setPosition(0, -70, 0);

        // 定位 + 特效详述（RESIZE_HEIGHT 自适应：先设 overflow 再定尺寸）
        const descNode = new Node('UnitDesc');
        descNode.layer = this.gmNode.layer;
        descNode.parent = node;
        const dUt = descNode.addComponent(UITransform);
        const desc = descNode.addComponent(Label);
        desc.overflow = Label.Overflow.RESIZE_HEIGHT;
        desc.string = `${ROLE_DESC[type]}\n${UNIT_DETAIL[type]}`;
        desc.fontSize = 12;
        desc.lineHeight = 17;
        desc.color = new Color(192, 210, 224);
        desc.horizontalAlign = HorizontalTextAlignment.CENTER;
        dUt.anchorPoint = new Vec2(0.5, 1); // 顶锚：内容向下自然生长
        dUt.setContentSize(224, 17);
        descNode.setPosition(0, -84, 0);

        // 阵营被动（金色高亮，让玩家记住种族特色）
        this.ui.makeLabel(`阵营被动 · ${fc.passive}`, 0, -148, new Color(255, 215, 94), node, 11);

        // 空 Button 吞触摸：点击大卡本体不触发遮罩关闭
        const swallow = node.addComponent(Button);
        swallow.transition = Button.Transition.NONE;
        return node;
    }
}
