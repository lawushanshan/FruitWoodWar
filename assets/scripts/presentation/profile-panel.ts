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
    Node, Label, Color, UITransform, Size, Vec2, UIOpacity,
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

/** 图鉴网格：6 列，卡 150×190 列距 180，两行 y */
const GRID_COLS = 6;
const GRID_COL_STEP = 180;
const GRID_ROW_Y = [95, -125];
const GRID_CARD_W = 150;
const GRID_CARD_H = 190;

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

    /** 隐藏档案 */
    hide() {
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
        this.refreshTabs();
        this.rebuildGrid();
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
            const node = this.createCardCell(card, group.faction, isCardUnlocked(profile, card.id));
            node.parent = this.gridNode;
            node.setPosition(-2.5 * GRID_COL_STEP + col * GRID_COL_STEP, GRID_ROW_Y[row] ?? GRID_ROW_Y[0], 0);
        });
    }

    /** 构建图鉴格子：小卡（立绘 + 名称 + 稀有度色条；锁定置灰 + 解锁条件） */
    private createCardCell(card: CardConfig, faction: FactionId | null, unlocked: boolean): Node {
        const node = new Node('Cell_' + card.id);
        node.layer = this.gmNode.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(GRID_CARD_W, GRID_CARD_H);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        // 卡底板（与选卡面板同款九宫格卡底）
        this.ui.makePanelBg(node, 'ui/ui_panel_card', GRID_CARD_W, GRID_CARD_H, new Color(30, 42, 54));

        const rarityColor = RARITY_COLORS[card.rarity] ?? new Color(100, 100, 100);

        // 稀有度底部分隔色条（与选卡面板同规格比例）
        const accent = this.spriteFactory.createColorNode(rarityColor.clone(), 120, 4);
        accent.parent = node;
        accent.setPosition(0, -86, 0);

        // 立绘（阵营卡按阵营路径；中立卡无立绘路径走 emoji 回退）
        const artFaction = faction ?? CARD_FACTION[card.id] ?? null;
        const artNode = artFaction
            ? this.art?.createSpriteNode(`cards/card_${artFaction}_${card.id}`, 88, 88) ?? null
            : null;
        if (artNode) {
            artNode.setPosition(0, 38, 0);
            artNode.parent = node;
        } else {
            this.ui.makeLabel(card.icon, 0, 38, Color.WHITE, node, 34);
        }

        // 名称与稀有度
        this.ui.makeLabel(card.name, 0, -26, Color.WHITE, node, 15);
        this.ui.makeLabel(RARITY_NAMES[card.rarity] ?? '普通', 0, -50, rarityColor.clone(), node, 12);

        // 锁定态：整卡置灰 + 锁角标 + 解锁条件（基础卡永解锁不会进此分支）
        if (!unlocked) {
            const req = cardUnlockRequirement(card.id);
            this.ui.makeLabel('🔒', 40, 60, Color.WHITE, node, 22);
            this.ui.makeLabel(`胜 ${req} 场解锁`, 0, -72, new Color(150, 165, 180), node, 11);
            const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            op.opacity = 130;
        }
        return node;
    }
}
