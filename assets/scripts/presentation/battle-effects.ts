/**
 * BattleEffects —— 战斗视觉表现效果集
 *
 * 职责：
 *  - 出兵表现：工厂闪烁/脉冲
 *  - 攻击表现：攻击者闪光 + 命中爆发 + 范围溅射环 + 粒子
 *  - 水晶受击：震动 + 闪烁
 *  - 建筑被毁：爆炸扩散效果 + 碎片
 *  - 所有效果使用对象池，不频繁创建/销毁节点
 *  - 全局上限判定：活跃效果数量超限时丢弃新效果，防止性能雪崩
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
    type: 'attack_flash' | 'crystal_shake' | 'building_explode' | 'impact_ring' | 'range_ring' | 'particle' | 'projectile';
    /** 起始位置 */
    startX: number;
    startY: number;
    /** 原始缩放（用于恢复/基准） */
    origScale: number;
    /** 弹射方向偏移（碎片/粒子专用） */
    dx: number;
    dy: number;
}

/** 活跃效果总数上限：超过则丢弃新效果（上限判定，保护低端设备帧率） */
const MAX_ACTIVE_EFFECTS = 220;
/** 单次爆发的粒子数量上限 */
const MAX_PARTICLES_PER_BURST = 6;

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

    // 注：出兵脉冲效果已按用户反馈移除——单位出生时不应有类似爆炸的视觉。

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

        this.push({
            node, elapsed: 0, duration: 0.15,
            type: 'attack_flash', startX: x, startY: y, origScale: 1,
            dx: 0, dy: 0,
        });
    }

    /** 命中表现：目标位置小爆发（冲击环 + 少量粒子） */
    playImpact(x: number, y: number, side: 'red' | 'blue') {
        const color = side === 'red' ? new Color(255, 90, 90, 200) : new Color(90, 140, 255, 200);
        const ring = this.pool.acquire('impact', () =>
            this.spriteFactory.createColorNode(color, 30, 30, 'circle'),
        );
        ring.parent = this.container;
        ring.setPosition(x, y, 0);
        ring.active = true;
        setUniformScale(ring, 0.3);
        const opacity = ring.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 200;

        this.push({
            node: ring, elapsed: 0, duration: 0.25,
            type: 'impact_ring', startX: x, startY: y, origScale: 0.3,
            dx: 0, dy: 0,
        });

        // 少量粒子飞散（上限判定：受 MAX_ACTIVE_EFFECTS 约束）
        this.spawnParticles(x, y, color, 3);
    }

    /** 塔弹道表现：从塔指向目标的快速飞弹（直线移动 + 淡出） */
    playProjectile(sx: number, sy: number, tx: number, ty: number, side: 'red' | 'blue') {
        const color = side === 'red' ? new Color(255, 210, 140, 230) : new Color(150, 200, 255, 230);
        const node = this.pool.acquire('projectile', () =>
            this.spriteFactory.createColorNode(color, 8, 8, 'circle'),
        );
        node.parent = this.container;
        node.setPosition(sx, sy, 0);
        node.active = true;
        setUniformScale(node, 1);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;

        this.push({
            node, elapsed: 0, duration: 0.12,
            type: 'projectile', startX: sx, startY: sy, origScale: 1,
            dx: tx - sx, dy: ty - sy,
        });
    }

    /** 范围溅射表现：以目标为圆心的扩散环（AOE / 防御塔溅射） */
    playRangeEffect(x: number, y: number, radius: number, side: 'red' | 'blue') {
        const color = side === 'red' ? new Color(255, 160, 90, 170) : new Color(90, 180, 255, 170);
        const node = this.pool.acquire('range', () =>
            this.spriteFactory.createColorNode(color, 40, 40, 'circle'),
        );
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        setUniformScale(node, 0.4);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 180;

        // 目标缩放 = radius / 基准 40px
        this.push({
            node, elapsed: 0, duration: 0.35,
            type: 'range_ring', startX: x, startY: y,
            origScale: radius / 40,
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

        this.push({
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

        this.push({
            node, elapsed: 0, duration: 0.5,
            type: 'building_explode', startX: x, startY: y, origScale: 0.3,
            dx: 0, dy: 0,
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

            this.push({
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

    // ==================== 内部 ====================

    /** 推入活跃效果（带全局上限判定：超限直接丢弃，不创建新节点） */
    private push(fx: EffectInstance) {
        if (this.active.length >= MAX_ACTIVE_EFFECTS) {
            this.pool.release(fx.node, this.getPoolKey(fx.type));
            return;
        }
        this.active.push(fx);
    }

    /** 生成一簇粒子（每个粒子受全局上限约束） */
    private spawnParticles(x: number, y: number, color: Color, count: number) {
        const n = Math.min(count, MAX_PARTICLES_PER_BURST);
        for (let i = 0; i < n; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 60;
            const particle = this.pool.acquire('particle', () =>
                this.spriteFactory.createColorNode(color, 6, 6, 'rect'),
            );
            particle.parent = this.container;
            particle.setPosition(x, y, 0);
            particle.active = true;
            setUniformScale(particle, 1);
            const opacity = particle.getComponent(UIOpacity);
            if (opacity) opacity.opacity = 255;

            this.push({
                node: particle, elapsed: 0, duration: 0.4,
                type: 'particle', startX: x, startY: y, origScale: 1,
                dx: Math.cos(angle) * speed,
                dy: Math.sin(angle) * speed,
            });
        }
    }

    private animateEffect(fx: EffectInstance, progress: number) {
        const node = fx.node;
        const opacity = node.getComponent(UIOpacity);

        switch (fx.type) {

            case 'attack_flash':
                // 快速闪烁消失
                setUniformScale(node, 1 + progress * 0.5);
                if (opacity) opacity.opacity = Math.floor(255 * (1 - progress));
                break;

            case 'impact_ring':
                // 命中：快速放大 + 淡出
                setUniformScale(node, fx.origScale + progress * 1.4);
                if (opacity) opacity.opacity = Math.floor(200 * (1 - progress));
                break;

            case 'range_ring':
                // 范围溅射：从 0.4 放大到 radius/40，淡出
                setUniformScale(node, 0.4 + (fx.origScale - 0.4) * progress);
                if (opacity) opacity.opacity = Math.floor(180 * (1 - progress));
                break;

            case 'particle':
                // 粒子：飞散 + 缩小 + 淡出
                node.setPosition(
                    fx.startX + fx.dx * progress,
                    fx.startY + fx.dy * progress,
                    0,
                );
                setUniformScale(node, 1 - progress * 0.8);
                if (opacity) opacity.opacity = Math.floor(255 * (1 - progress));
                break;
            case 'projectile':
                // 弹道：从塔直线飞向目标，末端快速淡出
                node.setPosition(
                    fx.startX + fx.dx * progress,
                    fx.startY + fx.dy * progress,
                    0,
                );
                setUniformScale(node, 1 - progress * 0.4);
                if (opacity) opacity.opacity = Math.floor(255 * (1 - progress));
                break;

            case 'crystal_shake': {
                // 左右震动 + 淡出
                const shakeX = Math.sin(progress * Math.PI * 6) * 8 * (1 - progress);
                node.setPosition(fx.startX + shakeX, fx.startY, 0);
                setUniformScale(node, 1 + Math.sin(progress * Math.PI) * 0.15);
                if (opacity) opacity.opacity = Math.floor(200 * (1 - progress));
                break;
            }

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
            case 'attack_flash': return 'attack';
            case 'crystal_shake': return 'crystal_hit';
            case 'building_explode': return 'explode';
            case 'impact_ring': return 'impact';
            case 'range_ring': return 'range';
            case 'particle': return 'particle';
            case 'projectile': return 'projectile';
        }
    }
}
