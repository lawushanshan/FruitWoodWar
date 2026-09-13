/**
 * UiKit —— 表现层共享 UI 基础设施（D2 债务偿还第一步，2026-09-06 抽取）
 *
 * 职责：标签 / 九宫格面板底板（含预载升级槽位）/ 统一按钮 / 贴图图标 / 星级行
 * 等跨面板通用构建工具。PanelController 与 ProfilePanel 共用一套，杜绝复制。
 *
 * 约定：
 *  - 按钮点击反馈统一 SCALE 0.93（全 UI 一致的按压标准）
 *  - 面板底板九宫格贴图优先、纯色兜底，美术预载完成后 refreshPanels() 原位升级
 */

import {
    Node, Label, Color, UITransform, Size, Vec2, Button, EventHandler, Sprite,
} from 'cc';
import { ColorSpriteFactory } from './color-sprite-factory';
import { ArtLibrary } from './art-library';

/** 面板底板槽：登记一个可升级的面板背景位置（纯色 → 九宫格贴图） */
export interface PanelBgSlot {
    parent: Node;
    artPath: string;
    w: number;
    h: number;
    fallbackColor: Color;
    inset: number;
    node: Node | null;
}

/** 卡牌稀有度配色（表现层专属，不进入配置） */
export const RARITY_COLORS: Record<string, Color> = {
    rare: new Color(64, 156, 255), // 天蓝色：原紫色与紫色卡底冲突，改为高对比蓝
    epic: new Color(212, 116, 26),
    legendary: new Color(255, 215, 94),
};

export class UiKit {

    private spriteFactory: ColorSpriteFactory;
    private gmNode: Node;
    /** 美术资源库（可选：面板底板贴图可用时替换纯色） */
    private art: ArtLibrary | null = null;
    /** 面板底板槽（预载完成后可升级纯色 → 九宫格贴图） */
    private panelBgSlots: PanelBgSlot[] = [];

    constructor(spriteFactory: ColorSpriteFactory, gmNode: Node, art?: ArtLibrary | null) {
        this.spriteFactory = spriteFactory;
        this.gmNode = gmNode;
        this.art = art ?? null;
    }

    /**
     * 面板底板：美术贴图（ui_panel_*）可用则九宫格拉伸，否则纯色兜底。
     * 已挂到 parent 并居中（z=0），返回该节点；同时登记到槽位供预载后刷新。
     */
    makePanelBg(parent: Node, artPath: string, w: number, h: number, fallbackColor: Color, inset = 40): Node {
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
    makeButton(
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
    makeClickSoundHandler(): EventHandler {
        const h = new EventHandler();
        h.target = this.gmNode;
        h.component = 'GameManager';
        h.handler = 'onUiClick';
        return h;
    }

    makeLabel(text: string, x: number, y: number, color: Color, parent: Node, size: number = 18): Label {
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
    makeArtIcon(parent: Node, artPath: string, size: number, x: number, y: number, fallbackEmoji?: string): Node {
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
    buildStarsRow(parent: Node, name: string, x: number, y: number, size: number): Node {
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
    updateStarsRow(row: Node | null, litCount: number) {
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
