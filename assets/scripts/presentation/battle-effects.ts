/**
 * BattleEffects —— 战斗视觉表现效果集
 *
 * 职责：
 *  - 出兵表现：工厂闪烁/脉冲
 *  - 攻击表现：攻击者闪光
 *  - 水晶受击：震动 + 闪烁
 *  - 建筑被毁：爆炸扩散效果
 *  - 所有效果使用对象池，不频繁创建/销毁节点
 *
 * 设计规范（来自 01-玩法设计总纲 §全龄化）：
 *  - "出兵、攻击、死亡弹飞、伤害跳字和水晶受击表现"
 *  - 无血腥，Q 版卡通风格
 */

import { Node, Color, UIOpacity } from 'cc';
import { ColorSpriteFactory } from './color-sprite-factory';
import { NodePool } from './node-pool';
import { setUniformScale } from './scale-helper';

/** 活跃效果实例 */
interface EffectInstance {
    node: Node;
    elapsed: number;
    duration: number;
    /** 效果类型 */
    type: 'spawn_pulse' | 'attack_flash' | 'crystal_shake' | 'building_explode';
    /** 起始位置 */
    startX: number;
    startY: number;
    /** 原始缩放（用于恢复） */
    origScale: number;
    /** 弹射方向偏移（爆炸碎片专用） */
    dx: number;
    dy: number;
}

export class BattleEffects {

    private active: EffectInstance[] = [];
    private pool: NodePool = new NodePool();
    private spriteFactory: ColorSpriteFactory;
    private container: Node;

    constructor(container: Node, spriteFactory: ColorSpriteFactory) {
        this.container = container;
        this.spriteFactory = spriteFactory;
    }

    // ==================== 公开方法 ====================

    /** 出兵表现：工厂脉冲闪烁 */
    playSpawnEffect(x: number, y: number) {
        const node = this.pool.acquire('spawn', () =>
            this.spriteFactory.createColorNode(new Color(255, 255, 100, 180), 50, 50, 'circle'),
        );
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        setUniformScale(node, 0.5);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 200;

        this.active.push({
            node, elapsed: 0, duration: 0.3,
            type: 'spawn_pulse', startX: x, startY: y, origScale: 0.5,
            dx: 0, dy: 0,
        });
    }

    /** 攻击表现：攻击者短暂闪光 */
    playAttackFlash(x: number, y: number) {
        const node = this.pool.acquire('attack', () =>
            this.spriteFactory.createColorNode(new Color(255, 255, 200, 200), 12, 12, 'star'),
        );
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        setUniformScale(node, 1);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;

        this.active.push({
            node, elapsed: 0, duration: 0.15,
            type: 'attack_flash', startX: x, startY: y, origScale: 1,
            dx: 0, dy: 0,
        });
    }

    /** 水晶受击：震动 + 闪烁 */
    playCrystalHit(x: number, y: number, side: 'red' | 'blue') {
        const color = side === 'red' ? new Color(255, 50, 50, 200) : new Color(50, 100, 255, 200);
        const node = this.pool.acquire('crystal_hit', () =>
            this.spriteFactory.createColorNode(color, 70, 70, 'hexagon'),
        );
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        setUniformScale(node, 1);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 200;

        this.active.push({
            node, elapsed: 0, duration: 0.4,
            type: 'crystal_shake', startX: x, startY: y, origScale: 1,
            dx: 0, dy: 0,
        });
    }

    /** 建筑被毁：爆炸扩散 */
    playBuildingDestroy(x: number, y: number) {
        // 主爆炸圈
        const node = this.pool.acquire('explode', () =>
            this.spriteFactory.createColorNode(new Color(255, 180, 50, 200), 60, 60, 'circle'),
        );
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        setUniformScale(node, 0.3);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 220;

        this.active.push({
            node, elapsed: 0, duration: 0.5,
            type: 'building_explode', startX: x, startY: y, origScale: 0.3,
            dx: 0, dy: 0, // 主爆炸圈不弹射
        });

        // 碎片粒子（4 个小方块向四周飞散）
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.5;
            const debris = this.pool.acquire('debris', () =>
                this.spriteFactory.createColorNode(new Color(180, 140, 80), 8, 8, 'rect'),
            );
            debris.parent = this.container;
            debris.setPosition(x, y, 0);
            debris.active = true;
            setUniformScale(debris, 1);
            const dOpacity = debris.getComponent(UIOpacity);
            if (dOpacity) dOpacity.opacity = 255;

            this.active.push({
                node: debris, elapsed: 0, duration: 0.4,
                type: 'building_explode',
                startX: x + Math.cos(angle) * 5,
                startY: y + Math.sin(angle) * 5,
                origScale: 1,
                dx: Math.cos(angle) * 80,
                dy: Math.sin(angle) * 80 + 30,
            });
        }
    }

    /** 每帧更新所有效果 */
    update(dt: number) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const fx = this.active[i];
            fx.elapsed += dt;
            const progress = Math.min(1, fx.elapsed / fx.duration);

            if (progress >= 1) {
                this.pool.release(fx.node, this.getPoolKey(fx.type));
                this.active.splice(i, 1);
                continue;
            }

            this.animateEffect(fx, progress);
        }
    }

    /** 清理所有效果 */
    clear() {
        for (const fx of this.active) {
            this.pool.release(fx.node, this.getPoolKey(fx.type));
        }
        this.active.length = 0;
        this.pool.clearAll();
    }

    // ==================== 内部动画 ====================

    private animateEffect(fx: EffectInstance, progress: number) {
        const node = fx.node;
        const opacity = node.getComponent(UIOpacity);

        switch (fx.type) {
            case 'spawn_pulse':
                // 从小到大扩散 + 淡出
                setUniformScale(node, fx.origScale + progress * 1.0);
                if (opacity) opacity.opacity = Math.floor(200 * (1 - progress));
                break;

            case 'attack_flash':
                // 快速闪烁消失
                setUniformScale(node, 1 + progress * 0.5);
                if (opacity) opacity.opacity = Math.floor(255 * (1 - progress));
                break;

            case 'crystal_shake':
                // 左右震动 + 淡出
                const shakeX = Math.sin(progress * Math.PI * 6) * 8 * (1 - progress);
                node.setPosition(fx.startX + shakeX, fx.startY, 0);
                setUniformScale(node, 1 + Math.sin(progress * Math.PI) * 0.15);
                if (opacity) opacity.opacity = Math.floor(200 * (1 - progress));
                break;

            case 'building_explode':
                // 主圈：放大 + 淡出；碎片：飞散 + 缩小 + 淡出（按 dx/dy 区分）
                if (fx.dx !== 0 || fx.dy !== 0) {
                    // 碎片
                    const easeOut = 1 - (1 - progress) * (1 - progress);
                    node.setPosition(
                        fx.startX + fx.dx * easeOut,
                        fx.startY + fx.dy * easeOut,
                        0,
                    );
                    setUniformScale(node, 1 - progress * 0.7);
                    if (opacity) opacity.opacity = Math.floor(255 * (1 - progress));
                } else {
                    // 主爆炸圈
                    setUniformScale(node, fx.origScale + progress * 2.0);
                    if (opacity) opacity.opacity = Math.floor(220 * (1 - progress));
                }
                break;
        }
    }

    private getPoolKey(type: EffectInstance['type']): string {
        switch (type) {
            case 'spawn_pulse': return 'spawn';
            case 'attack_flash': return 'attack';
            case 'crystal_shake': return 'crystal_hit';
            case 'building_explode': return 'explode';
        }
    }
}
