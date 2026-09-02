/**
 * FloatingText —— 伤害跳字 / 金币提示 等浮动文字系统
 *
 * 职责：
 *  - 在指定位置生成浮动文字，自动上升并淡出
 *  - 支持不同颜色（伤害=红、治疗=绿、金币=黄）
 *  - 使用对象池复用节点，避免频繁创建/销毁
 *  - 纯表现层，不影响游戏数据
 *
 * 设计规范（来自 01-玩法设计总纲 §全龄化）：
 *  - "数字清晰：伤害跳字用大号气泡"
 *  - "兵被打败 = 弹飞 + 变星星/果粒消散，禁止血腥"
 */

import { Node, Label, Color, UITransform, Size, Vec2, UIOpacity } from 'cc';
import { NodePool } from './node-pool';

/** 浮动文字配置 */
interface FloatConfig {
    text: string;
    x: number;
    y: number;
    color: Color;
    fontSize: number;
    /** 动画时长（秒） */
    duration: number;
}

/** easeOutBack：带轻微过冲的弹入曲线（浮动文字出生手感） */
function easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** 弹入缩放耗时（秒）：前 0.18s 从 0 过冲弹到 1 */
const POP_IN_DURATION = 0.18;

export class FloatingText {

    /** 活跃浮动文字列表 */
    private active: Array<{ node: Node; elapsed: number; config: FloatConfig }> = [];
    /** 对象池 */
    private pool: NodePool = new NodePool();

    private container: Node;
    private layer: number;

    constructor(container: Node, layer: number) {
        this.container = container;
        this.layer = layer;
    }

    /** 在指定位置显示浮动文字 */
    show(text: string, x: number, y: number, color: Color = Color.WHITE, fontSize: number = 16, duration: number = 0.8) {
        const config: FloatConfig = { text, x, y, color, fontSize, duration };
        const node = this.pool.acquire('float', () => this.createNode());
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        // 从 0 弹入（update 中 easeOutBack 展开到 1）
        node.setScale(0, 0, 1);

        const label = node.getComponent(Label)!;
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;

        const opacity = node.getComponent(UIOpacity)!;
        opacity.opacity = 255;

        this.active.push({ node, elapsed: 0, config });
    }

    /** 显示伤害数字（红色） */
    showDamage(damage: number, x: number, y: number) {
        this.show('-' + Math.floor(damage), x, y, new Color(255, 80, 80), 14, 0.6);
    }

    /** 显示金币获取（金色） */
    showGold(amount: number, x: number, y: number) {
        this.show('+' + amount + '金', x, y, new Color(255, 215, 94), 14, 0.8);
    }

    /** 显示治疗（绿色） */
    showHeal(amount: number, x: number, y: number) {
        this.show('+' + Math.floor(amount), x, y, new Color(100, 255, 100), 14, 0.6);
    }

    /** 每帧更新：驱动浮动动画（弹入 → 缓出上升 → 后半段淡出） */
    update(dt: number) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const item = this.active[i];
            item.elapsed += dt;
            const progress = item.elapsed / item.config.duration;

            if (progress >= 1) {
                // 动画结束，回收节点
                this.pool.release(item.node, 'float');
                this.active.splice(i, 1);
                continue;
            }

            // 弹入缩放：前 0.18s 从 0 过冲弹到 1，第一眼就抓住视线
            const pop = Math.min(1, item.elapsed / POP_IN_DURATION);
            const s = easeOutBack(pop);
            item.node.setScale(s, s, 1);

            // 上升：easeOutCubic（起跳快、到顶缓停），比线性上升更轻快
            const ease = 1 - Math.pow(1 - progress, 3);
            item.node.setPosition(item.config.x, item.config.y + ease * 44, 0);

            // 淡出：前 55% 保持完全不透明（保证数字可读），后 45% 匀速淡出
            const opacity = item.node.getComponent(UIOpacity);
            if (opacity) {
                opacity.opacity = progress < 0.55
                    ? 255
                    : Math.floor(255 * (1 - (progress - 0.55) / 0.45));
            }
        }
    }

    /** 清理所有浮动文字 */
    clear() {
        for (const item of this.active) {
            this.pool.release(item.node, 'float');
        }
        this.active.length = 0;
        this.pool.clearAll();
    }

    // ==================== 内部 ====================

    private createNode(): Node {
        const node = new Node();
        node.layer = this.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(100, 30);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const label = node.addComponent(Label);
        label.fontSize = 16;
        label.color = Color.WHITE;
        label.lineHeight = 20;
        // 深色描边：复杂战场背景下保证数字清晰可读（01 总纲：伤害跳字要清晰）
        label.enableOutline = true;
        label.outlineColor = new Color(15, 18, 24, 220);
        label.outlineWidth = 2;
        node.addComponent(UIOpacity);
        return node;
    }
}
