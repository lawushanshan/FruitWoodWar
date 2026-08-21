/**
 * TutorialController —— 新手首局引导
 *
 * 职责：
 *  - 首局自动弹出引导提示，30 秒内让玩家建造第一座工厂并看到出兵
 *  - 引导步骤：选阵营 → 点建造 → 放战场 → 等出兵
 *  - 使用 localStorage 记录是否已完成引导（只引导一次）
 *  - 纯表现层，不修改游戏数据
 *
 * 设计目标（来自路线图 §8 M4 工作项 5）：
 *  "完成新手首局引导：30 秒内建造第一座工厂并看到第一波出兵"
 */

import { Node, Label, Color, UITransform, Size, Vec2, UIOpacity } from 'cc';
import { ColorSpriteFactory } from './color-sprite-factory';

/** 引导步骤 */
export type TutorialStep = 'idle' | 'build_factory' | 'wait_spawn' | 'done';

const STORAGE_KEY = 'fww_tutorial_done';

export class TutorialController {

    /** 当前引导步骤 */
    private step: TutorialStep = 'idle';

    /** 引导提示节点 */
    private hintNode: Node | null = null;
    private hintLabel: Label | null = null;

    /** 是否正在引导中 */
    private active: boolean = false;

    /** 引导开始时间（用于超时检测） */
    private startTime: number = 0;

    private container: Node;
    private spriteFactory: ColorSpriteFactory;
    private layer: number;

    constructor(container: Node, spriteFactory: ColorSpriteFactory, layer: number) {
        this.container = container;
        this.spriteFactory = spriteFactory;
        this.layer = layer;
    }

    /**
     * 检查是否需要显示引导（首局玩家）
     * 在游戏开始后调用，如果是首局则启动引导
     */
    checkAndStart(): boolean {
        if (this.hasCompletedTutorial()) {
            this.step = 'done';
            return false;
        }

        this.active = true;
        this.startTime = Date.now();
        this.showHint('👇 点击底部「兵工厂」按钮建造第一座工厂！');
        this.step = 'build_factory';
        return true;
    }

    /** 玩家成功建造了第一座工厂 */
    onFactoryBuilt() {
        if (!this.active || this.step !== 'build_factory') return;

        this.showHint('⏳ 工厂已建造！等待第一波出兵...');
        this.step = 'wait_spawn';
    }

    /** 第一波兵已出动 */
    onFirstWaveSpawned() {
        if (!this.active || this.step !== 'wait_spawn') return;

        this.showHint('🎉 出兵了！你的军队正在前进！\n引导完成，祝你好运！');
        this.step = 'done';
        this.markTutorialDone();

        // 3 秒后隐藏提示
        setTimeout(() => {
            this.hideHint();
            this.active = false;
        }, 3000);
    }

    /** 每帧更新（检测超时） */
    update(_dt: number) {
        if (!this.active) return;

        // 超时检测：60 秒未完成引导则自动结束
        const elapsed = (Date.now() - this.startTime) / 1000;
        if (elapsed > 60 && this.step !== 'done') {
            this.showHint('💡 提示：点击底部按钮建造兵工厂');
        }
    }

    /** 是否正在引导中 */
    isActive(): boolean {
        return this.active;
    }

    /** 当前步骤 */
    getStep(): TutorialStep {
        return this.step;
    }

    /** 清理（场景切换时） */
    dispose() {
        this.hideHint();
        this.active = false;
        this.step = 'idle';
    }

    // ==================== 内部方法 ====================

    private showHint(text: string) {
        if (!this.hintNode) {
            this.hintNode = new Node('TutorialHint');
            this.hintNode.layer = this.layer;
            this.hintNode.parent = this.container;

            const ut = this.hintNode.addComponent(UITransform);
            ut.contentSize = new Size(500, 80);
            ut.anchorPoint = new Vec2(0.5, 0.5);

            // 半透明背景
            const bg = this.spriteFactory.createColorNode(new Color(0, 0, 0, 200), 500, 80);
            bg.parent = this.hintNode;

            // 文字必须是 bg 之后的子节点（Label 在 hintNode 自身会被 bg 子节点盖住）
            const labelNode = new Node('HintLabel');
            labelNode.layer = this.layer;
            labelNode.parent = this.hintNode;
            const lUt = labelNode.addComponent(UITransform);
            lUt.contentSize = new Size(480, 70);
            lUt.anchorPoint = new Vec2(0.5, 0.5);
            this.hintLabel = labelNode.addComponent(Label);
            this.hintLabel.fontSize = 18;
            this.hintLabel.color = new Color(255, 215, 94);
            this.hintLabel.lineHeight = 24;
            this.hintLabel.overflow = Label.Overflow.CLAMP;
        }

        this.hintNode.active = true;
        this.hintNode.setPosition(0, 200, 0); // 屏幕中上方
        if (this.hintLabel) {
            this.hintLabel.string = text;
        }
    }

    private hideHint() {
        if (this.hintNode?.isValid) {
            this.hintNode.active = false;
        }
    }

    /** 检查是否已完成过引导 */
    private hasCompletedTutorial(): boolean {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        } catch {
            return true; // 无 localStorage 环境跳过引导
        }
    }

    /** 标记引导已完成 */
    private markTutorialDone() {
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // 静默失败
        }
    }
}
