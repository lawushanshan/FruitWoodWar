/**
 * EntityInfoPanel —— 实体信息面板（点击查看单位/建筑/塔/水晶详情）
 *
 * 设计（用户需求：敌我单位的建筑、单位信息，展示攻防/等级/血量/特效）：
 *  - 点击战场任意实体 → 右下浮出信息卡（ui_panel_dark 九宫格）+ 战场选中脉冲圈
 *  - 单位：Q版立绘头像 + 15兵种专名 + Lv★ + 敌我/阵营 + 血条 + 攻击/攻速/射程/移速
 *          + 当前生效特效（减速/定身/流血/护盾）
 *  - 建筑：名称 + Lv★ + 血条 + 产出兵种；塔：攻击/射程/攻速；水晶：血量
 *  - 实体死亡自动隐藏；点击空地隐藏；进入建造模式隐藏
 *  - 己方工厂点击仍走升级面板（原有交互），此处只补足其余实体的查看
 */

import { Node, Label, Color, UITransform, Size, Vec2, Sprite } from 'cc';
import { ColorSpriteFactory } from './color-sprite-factory';
import { ArtLibrary } from './art-library';
import { UNIT_CONFIG } from '../config/unit-config';
import { BUILDING_CONFIG } from '../config/building-config';
import { FACTION_CONFIG } from '../config/faction-config';
import type { GameState, FactionId, UnitType, Side } from '../core/types';

/** 15 兵种 Q 版专名（表现层专属；来自 01 玩法总纲 §4 兵种表） */
const UNIT_NAMES: Record<FactionId, Record<UnitType, string>> = {
    fruit: { tank: '西瓜壮汉', ranged: '香蕉神箭手', aoe: '榴莲炸弹人', rush: '草莓疾风兵', siege: '椰子投石车' },
    wood: { tank: '老橡树守卫', ranged: '蒲公英射手', aoe: '毒蘑菇术士', rush: '竹笋突击兵', siege: '南瓜重锤车' },
    animal: { tank: '犀牛铁卫', ranged: '松鼠弹弓手', aoe: '猫头鹰星术师', rush: '猎豹斥候', siege: '大象破城槌' },
};

/** 选中目标描述 */
export type EntityTarget =
    | { kind: 'unit'; id: string }
    | { kind: 'building'; id: string }
    | { kind: 'tower'; id: string }
    | { kind: 'crystal'; side: Side };

/** 面板尺寸/位置（右下，建造栏上方）。
 *  九宫格 ui_panel_dark 切片边框 36px：内容必须落在中央安全区（约 ±124×±72）内，
 *  否则会像 v1.8 之前那样把标题/头像压在粗木框上，视觉上像被裁切。 */
const PANEL_W = 320;
const PANEL_H = 216;
const PANEL_POS: [number, number] = [458, -160];

const HP_GREEN = new Color(96, 220, 96);
const HP_YELLOW = new Color(235, 190, 70);
const HP_RED = new Color(235, 90, 80);

export class EntityInfoPanel {

    private target: EntityTarget | null = null;
    private panel: Node | null = null;
    private ring: Node | null = null;
    private time = 0;

    // 动态标签
    private portrait: Node | null = null;
    private nameLabel: Label | null = null;
    private sideLabel: Label | null = null;
    private hpFill: Node | null = null;
    private hpText: Label | null = null;
    private statsL1: Label | null = null;
    private statsL2: Label | null = null;
    private fxLabel: Label | null = null;

    private ui: Node;
    private field: Node;
    private spriteFactory: ColorSpriteFactory;
    private art: ArtLibrary | null;
    private gmNode: Node;

    constructor(ui: Node, field: Node, spriteFactory: ColorSpriteFactory, art: ArtLibrary | null, gmNode: Node) {
        this.ui = ui;
        this.field = field;
        this.spriteFactory = spriteFactory;
        this.art = art;
        this.gmNode = gmNode;
    }

    getTarget(): EntityTarget | null {
        return this.target;
    }

    /** 选中一个实体（GameManager 点击判定后调用） */
    show(state: GameState, t: EntityTarget) {
        this.target = t;
        this.createOnce();
        if (this.panel) this.panel.active = true;
        this.refresh(state);
    }

    hide() {
        this.target = null;
        if (this.panel) this.panel.active = false;
        if (this.ring) this.ring.active = false;
    }

    /** 每帧：实体死亡自动隐藏；刷新血量/特效；选中圈跟随 + 脉冲 */
    update(state: GameState, dt: number) {
        this.time += dt;
        if (!this.target) return;
        const pos = this.resolve(state);
        if (!pos) { this.hide(); return; }   // 实体已消失
        this.refresh(state);
        this.setRingColor(pos.side);
        // 选中圈跟随 + 呼吸脉冲
        if (this.ring) {
            this.ring.active = true;
            this.ring.setPosition(pos.x, pos.y - 12, 0);
            const pulse = 1 + Math.sin(this.time * 5) * 0.08;
            this.ring.setScale(pulse, pulse * 0.38, 1);
        }
    }

    // ==================== 内部 ====================

    /** 解析目标当前实体：存在则返回其位置与敌我色，死亡/不存在返回 null */
    private resolve(state: GameState): { x: number; y: number; side: Side } | null {
        const t = this.target!;
        if (t.kind === 'unit') {
            const u = state.units.find(e => e.id === t.id);
            return u ? { x: u.x, y: u.y, side: u.side } : null;
        }
        if (t.kind === 'building') {
            const b = state.buildings.find(e => e.id === t.id);
            return b ? { x: b.x, y: b.y, side: b.side } : null;
        }
        if (t.kind === 'tower') {
            const w = state.towers.find(e => e.id === t.id);
            return w ? { x: w.x, y: w.y, side: w.side } : null;
        }
        const c = state.crystals.find(e => e.side === t.side);
        return c ? { x: c.x, y: c.y, side: c.side } : null;
    }

    /** 刷新面板内容（标签全量重写，量小无 GC 压力） */
    private refresh(state: GameState) {
        const t = this.target;
        if (!t || !this.nameLabel) return;

        const sideColor = (side: Side) => side === 'red'
            ? new Color(255, 138, 122) : new Color(122, 184, 255);

        if (t.kind === 'unit') {
            const u = state.units.find(e => e.id === t.id);
            if (!u) return;
            const fac = state.factions[u.side];
            const stars = u.level === 3 ? ' ★★' : u.level === 2 ? ' ★' : '';
            this.setPortrait(`units/u_${fac}_${u.type}`, UNIT_CONFIG[u.type].icon);
            this.nameLabel.string = UNIT_NAMES[fac][u.type] + stars;
            this.nameLabel.color = Color.WHITE;
            if (this.sideLabel) {
                this.sideLabel.string = (u.side === 'red' ? '红方·' : '蓝方·') + FACTION_CONFIG[fac].name
                    + (u.side === state.playerSide ? '（我方）' : '（敌方）');
                this.sideLabel.color = sideColor(u.side);
            }
            this.setHp(u.hp, u.maxHp, u.shield);
            if (this.statsL1) this.statsL1.string = `攻击 ${Math.round(u.atk)}    攻速 ${u.atkSpeed.toFixed(1)}/秒`;
            if (this.statsL2) this.statsL2.string = `射程 ${Math.round(u.range)}    移速 ${Math.round(u.speed)}`;
            this.setFx(u);
        } else if (t.kind === 'building') {
            const b = state.buildings.find(e => e.id === t.id);
            if (!b) return;
            const fac = state.factions[b.side];
            const stars = b.level === 3 ? ' ★★' : b.level === 2 ? ' ★' : '';
            const isFactory = b.unitType !== null;
            const name = isFactory && BUILDING_CONFIG[b.unitType]
                ? BUILDING_CONFIG[b.unitType].name : (b.kind === 'academy' ? '战争学院' : '建筑');
            this.setPortrait(isFactory ? `buildings/b_factory_${b.unitType}` : 'buildings/b_academy', '🏭');
            this.nameLabel.string = name + stars;
            this.nameLabel.color = Color.WHITE;
            if (this.sideLabel) {
                this.sideLabel.string = (b.side === 'red' ? '红方·' : '蓝方·') + FACTION_CONFIG[fac].name
                    + (b.side === state.playerSide ? '（我方）' : '（敌方）');
                this.sideLabel.color = sideColor(b.side);
            }
            this.setHp(b.hp, b.maxHp, 0);
            if (this.statsL1) {
                this.statsL1.string = isFactory && b.unitType !== null
                    ? `产出 ${BUILDING_CONFIG[b.unitType].icon}${BUILDING_CONFIG[b.unitType].name} ×${UNIT_CONFIG[b.unitType].unitsPerWave}/波`
                    : '解锁 Lv3 工厂与全军强化';
            }
            if (this.statsL2) {
                this.statsL2.string = b.side === state.playerSide && isFactory
                    ? '提示：点击己方工厂可升级' : '被拆后停止产出';
            }
            if (this.fxLabel) { this.fxLabel.string = ''; this.fxLabel.node.active = false; }
        } else if (t.kind === 'tower') {
            const w = state.towers.find(e => e.id === t.id);
            if (!w) return;
            const fac = state.factions[w.side];
            this.setPortrait(w.kind === 'aura' ? 'buildings/b_aura' : 'buildings/b_tower', '🗼');
            this.nameLabel.string = w.kind === 'aura' ? '光环塔' : '基地防御塔';
            this.nameLabel.color = Color.WHITE;
            if (this.sideLabel) {
                this.sideLabel.string = (w.side === 'red' ? '红方·' : '蓝方·') + FACTION_CONFIG[fac].name
                    + (w.side === state.playerSide ? '（我方）' : '（敌方）');
                this.sideLabel.color = sideColor(w.side);
            }
            this.setHp(w.hp, w.maxHp, 0);
            if (this.statsL1) this.statsL1.string = `攻击 ${w.atk}    射程 ${w.range}`;
            if (this.statsL2) this.statsL2.string = w.kind === 'aura' ? '全体我方攻速 +15%' : '攻击附带范围溅射';
            if (this.fxLabel) { this.fxLabel.string = ''; this.fxLabel.node.active = false; }
        } else {
            const c = state.crystals.find(e => e.side === t.side);
            if (!c) return;
            const fac = state.factions[c.side];
            this.setPortrait(`units/hq_${fac}`, '💠');
            this.nameLabel.string = FACTION_CONFIG[fac].name + '·大本营';
            if (this.sideLabel) {
                this.sideLabel.string = c.side === 'red' ? '红方大本营' : '蓝方大本营';
                this.sideLabel.color = sideColor(c.side);
            }
            this.setHp(c.hp, c.maxHp, 0);
            if (this.statsL1) this.statsL1.string = '水晶被拆即失败';
            if (this.statsL2) this.statsL2.string = c.side === state.playerSide ? '守住你的水晶！' : '推平它！';
            if (this.fxLabel) { this.fxLabel.string = ''; this.fxLabel.node.active = false; }
        }
    }

    /** 头像缓存键：避免 refresh 每帧销毁/重建头像节点（v1.8.1 性能修复） */
    private portraitKey = '';

    private setPortrait(artPath: string, fallbackEmoji: string) {
        // 内容未变化且节点仍有效时直接复用（refresh 每帧调用，不可反复重建）
        const key = artPath ? `art:${artPath}` : `emoji:${fallbackEmoji}`;
        if (this.portrait?.isValid && this.portraitKey === key) return;
        this.portraitKey = key;

        if (this.portrait?.isValid) this.portrait.destroy();
        const node = this.art?.createSpriteNode(artPath, 44, 44) ?? null;
        if (node) {
            node.name = 'Portrait';
            node.parent = this.panel;
            node.setPosition(-92, 50, 0);
        } else {
            const n = new Node('Portrait');
            n.layer = this.gmNode.layer;
            n.parent = this.panel!;
            const ut = n.addComponent(UITransform);
            ut.contentSize = new Size(44, 44);
            const lb = n.addComponent(Label);
            lb.string = fallbackEmoji;
            lb.fontSize = 26;
            lb.lineHeight = 30;
            n.setPosition(-92, 50, 0);
        }
        this.portrait = node ?? this.panel!.getChildByName('Portrait');
    }

    private setHp(hp: number, maxHp: number, shield: number) {
        const ratio = Math.max(0, Math.min(1, hp / maxHp));
        if (this.hpFill) {
            this.hpFill.setScale(ratio, 1, 1);
            const sp = this.hpFill.getComponent(Sprite);
            if (sp) sp.color = ratio > 0.5 ? HP_GREEN : ratio > 0.25 ? HP_YELLOW : HP_RED;
        }
        if (this.hpText) {
            this.hpText.string = `HP ${Math.max(0, Math.ceil(hp))}/${maxHp}` + (shield > 0 ? `  🛡${Math.ceil(shield)}` : '');
        }
    }

    private setFx(u: { stunDur: number; slowDur: number; slowMult: number; bleedDur: number; bleedDps: number; shield: number }) {
        if (!this.fxLabel) return;
        const parts: string[] = [];
        if (u.stunDur > 0) parts.push('💫定身 ' + u.stunDur.toFixed(1) + 's');
        if (u.slowDur > 0) parts.push('🐌减速 ' + Math.round((1 - u.slowMult) * 100) + '% ' + u.slowDur.toFixed(1) + 's');
        if (u.bleedDur > 0) parts.push('🩸流血 ' + Math.round(u.bleedDps) + '/s ' + u.bleedDur.toFixed(1) + 's');
        if (u.shield > 0) parts.push('🛡护盾 ' + Math.ceil(u.shield));
        this.fxLabel.string = parts.length > 0 ? parts.join('   ') : '无特殊状态';
        this.fxLabel.color = parts.length > 0 ? new Color(255, 210, 130) : new Color(130, 150, 168);
        this.fxLabel.node.active = true;
    }

    /** 面板与选中圈只建一次（懒创建） */
    private createOnce() {
        if (this.panel) return;

        // ---- 信息卡（UI 层，右下）。布局：内容全部落在九宫格 36px 边框内的安全区 ----
        // 纵向节奏：头像/标题 50 → 阵营 28 → 血条 4 → 属性 -22/-46 → 特效 -70
        const panel = new Node('EntityInfoPanel');
        panel.layer = this.gmNode.layer;
        panel.parent = this.ui;
        panel.active = false;
        const ut = panel.addComponent(UITransform);
        ut.contentSize = new Size(PANEL_W, PANEL_H);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        panel.setPosition(PANEL_POS[0], PANEL_POS[1], 0);

        // 底板：九宫格贴图优先，纯色兜底
        const bgNode = this.art?.createPanelNode('ui/ui_panel_dark', PANEL_W, PANEL_H, 36);
        if (bgNode) {
            bgNode.parent = panel;
        } else {
            const bg = this.spriteFactory.createColorNode(new Color(5, 10, 14, 225), PANEL_W, PANEL_H);
            bg.parent = panel;
        }

        // 名称（头像右侧，与头像同排）
        this.nameLabel = this.mkLabel(panel, '', 16, 22, Color.WHITE, 14, 56);
        // 敌我/阵营（名称下一行）
        this.sideLabel = this.mkLabel(panel, '', 12, 18, new Color(159, 180, 196), 14, 34);

        // 血条（左锚点填充；整体左移留出边框内边距，右端给 HP 数字让位）
        const barBg = this.spriteFactory.createColorNode(new Color(20, 20, 20, 220), 150, 10);
        barBg.parent = panel;
        barBg.setPosition(-30, 6, 0);
        const fill = this.spriteFactory.createColorNode(HP_GREEN.clone(), 150, 10);
        fill.name = 'HpFill';
        fill.parent = panel;
        const fut = fill.getComponent(UITransform);
        fut.anchorPoint = new Vec2(0, 0.5);
        fill.setPosition(-105, 6, 0);
        this.hpFill = fill;
        this.hpText = this.mkLabel(panel, '', 12, 16, new Color(207, 227, 240), 78, 6);

        // 属性行 ×2（水平居中）
        this.statsL1 = this.mkLabel(panel, '', 13, 20, new Color(223, 233, 240), 0, -22);
        this.statsL2 = this.mkLabel(panel, '', 13, 20, new Color(190, 205, 218), 0, -46);

        // 特效行
        this.fxLabel = this.mkLabel(panel, '', 12, 16, new Color(130, 150, 168), 0, -70);

        this.panel = panel;

        // ---- 选中圈（战场层，跟随实体） ----
        const ring = this.spriteFactory.createColorNode(new Color(120, 255, 150, 220), 62, 62, 'circle');
        ring.name = 'SelectionRing';
        ring.parent = this.field;
        ring.active = false;
        // 外圈光环（更大更淡）
        const halo = this.spriteFactory.createColorNode(new Color(120, 255, 150, 80), 82, 82, 'circle');
        halo.parent = ring;
        this.ring = ring;
    }

    /** 选中圈按敌我换色（show 后由 refresh/update 间接调用；在 resolve 后设置） */
    setRingColor(side: Side) {
        if (!this.ring) return;
        const c = side === 'red' ? new Color(255, 120, 110, 220) : new Color(110, 170, 255, 220);
        const sp = this.ring.getComponent(Sprite);
        if (sp) sp.color = c;
        const halo = this.ring.children[0];
        if (halo) {
            const hsp = halo.getComponent(Sprite);
            if (hsp) hsp.color = new Color(c.r, c.g, c.b, 80);
        }
    }

    private mkLabel(parent: Node, text: string, fontSize: number, lh: number, color: Color, x: number, y: number): Label {
        const node = new Node();
        node.layer = this.gmNode.layer;
        node.parent = parent;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(260, lh + 4);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.lineHeight = lh;
        node.setPosition(x, y, 0);
        return label;
    }
}
