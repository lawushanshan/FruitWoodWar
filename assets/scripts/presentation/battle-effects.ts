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
import { ArtLibrary } from './art-library';

/** 特效贴图显示尺寸（07 方案 §4：接入 96~128，战场显示 24~40px） */
const FX_SIZE = { projectile: 24, ring: 40 } as const;

/** 活跃效果实例 */
interface EffectInstance {
    node: Node;
    elapsed: number;
    duration: number;
    /** 效果类型 */
    type: 'attack_flash' | 'crystal_shake' | 'building_explode' | 'impact_ring' | 'range_ring' | 'particle' | 'projectile' | 'slash_fx' | 'boom';
    /** 起始位置 */
    startX: number;
    startY: number;
    /** 原始缩放（用于恢复/基准） */
    origScale: number;
    /** 弹射方向偏移（碎片/粒子专用） */
    dx: number;
    dy: number;
    /** 节点所属池 key（fx_* 为贴图节点，回收时销毁而非入池；缺省按 type 推导） */
    poolKey?: string;
    /** 初始透明度（boom 亮核/柔光分层淡出用；缺省按 type 内置值） */
    baseOpacity?: number;
}

/** 活跃效果总数上限：超过则丢弃新效果（上限判定，保护低端设备帧率） */
const MAX_ACTIVE_EFFECTS = 220;
/** 单次爆发的粒子数量上限 */
const MAX_PARTICLES_PER_BURST = 6;

export class BattleEffects {

    private active: EffectInstance[] = [];
    /** 延时动作队列：用于“弹道飞行结束后再落点爆炸”，使 AOE 命中与弹道同步 */
    private scheduled: Array<{ delay: number; fn: () => void }> = [];
    private pool: NodePool = new NodePool();
    private spriteFactory: ColorSpriteFactory;
    private container: Node;
    /** 美术资源库（可选：fx 贴图可用时弹道/溅射环替换程序色块） */
    private art: ArtLibrary | null = null;

    constructor(container: Node, spriteFactory: ColorSpriteFactory, art?: ArtLibrary | null) {
        this.container = container;
        this.spriteFactory = spriteFactory;
        this.art = art ?? null;
    }

    /** 用特效贴图创建节点并按敌我染色；贴图缺失返回 null */
    private makeFxNode(path: string, size: number, tint: Color): Node | null {
        if (!this.art?.isLoaded() || !this.art.has(path)) return null;
        const node = this.art.createSpriteNode(path, size, size);
        if (!node) return null;
        const sprite = node.getComponent('cc.Sprite') as import('cc').Sprite | null;
        if (sprite) sprite.color = tint; // 阵营 tint 染色：一张贴图红蓝通用（07 方案 §6.1）
        return node;
    }

    // ==================== 公开方法 ====================

    // 注：出兵脉冲效果已按用户反馈移除——单位出生时不应有类似爆炸的视觉。

    /** 攻击表现：攻击者短暂闪光（fx_star 贴图，程序星形兜底） */
    playAttackFlash(x: number, y: number) {
        let node: Node;
        let poolKey = 'attack';
        const fxNode = this.makeFxNode('fx/fx_star', 16, new Color(255, 250, 210, 235));
        if (fxNode) {
            node = fxNode;
            poolKey = 'fx_attack';
        } else {
            node = this.pool.acquire('attack', () =>
                this.spriteFactory.createColorNode(new Color(255, 255, 200, 200), 12, 12, 'star'),
            );
        }
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        node.angle = Math.random() * 90; // 随机初始角，闪光不呆板
        setUniformScale(node, 1);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;

        this.push({
            node, elapsed: 0, duration: 0.15,
            type: 'attack_flash', startX: x, startY: y, origScale: 1,
            dx: 0, dy: 0,
        }, poolKey);
    }

    /** 命中表现：目标位置小爆发（冲击环 + 少量粒子）。
     * 实测调优（2026-09-03）：30px/透明度200 的环在草地与深色路带上辨识度过低，
     * 提升到 42px/不透明，并加 1 颗粒子，保证近战命中打击感可读 */
    playImpact(x: number, y: number, side: 'red' | 'blue') {
        const color = side === 'red' ? new Color(255, 90, 90, 230) : new Color(90, 140, 255, 230);
        const ring = this.pool.acquire('impact', () =>
            this.spriteFactory.createColorNode(color, 42, 42, 'circle'),
        );
        ring.parent = this.container;
        ring.setPosition(x, y, 0);
        ring.active = true;
        setUniformScale(ring, 0.3);
        const opacity = ring.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;

        this.push({
            node: ring, elapsed: 0, duration: 0.25,
            type: 'impact_ring', startX: x, startY: y, origScale: 0.3,
            dx: 0, dy: 0,
        });

        // 少量粒子飞散（上限判定：受 MAX_ACTIVE_EFFECTS 约束）
        this.spawnParticles(x, y, color, 4);
    }

    /**
     * 弹道表现：起点 → 目标的飞行投射物（直线 + 淡出）。
     * @param tex  贴图路径（fx/fx_arrow 快箭 / fx/fx_bolt 法球 / fx/fx_boulder 巨石）
     * @param duration 飞行时长（秒）：远程 0.12 / AOE 0.2 / 攻城 0.32
     * @param size 显示尺寸
     */
    playProjectile(sx: number, sy: number, tx: number, ty: number, side: 'red' | 'blue',
        tex: string = 'fx/fx_arrow', duration = 0.12, size: number = FX_SIZE.projectile) {
        // 弹道贴图多为有色素材（teal 法球/灰石），用近白 tint 保留原色不糊，仅留轻微敌我冷暖；
        // 实测调优（2026-09-03）：alpha 235 在深色路带上偏灰淡，提满到 255
        const color = side === 'red' ? new Color(255, 232, 214, 255) : new Color(214, 232, 255, 255);
        let node: Node;
        let poolKey = 'projectile';
        const fxNode = this.makeFxNode(tex, size, color.clone());
        if (fxNode) {
            node = fxNode;
            poolKey = 'fx_projectile';
        } else {
            node = this.pool.acquire('projectile', () =>
                this.spriteFactory.createColorNode(color, 8, 8, 'circle'),
            );
        }
        node.parent = this.container;
        node.setPosition(sx, sy, 0);
        node.active = true;
        setUniformScale(node, 1);
        // 投射物朝向飞行方向（贴图默认朝右）
        const angle = Math.atan2(ty - sy, tx - sx) * 180 / Math.PI;
        if (poolKey === 'fx_projectile') node.angle = angle;
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;

        this.push({
            node, elapsed: 0, duration,
            type: 'projectile', startX: sx, startY: sy, origScale: 1,
            dx: tx - sx, dy: ty - sy,
        }, poolKey);
    }

    /** 冲锋斩击：目标处月牙弧光快速掠过（fx_slash；程序白弧兜底）。
     * 实测调优（2026-09-03）：48px 在深色路带上偏小，放大到 56px 并提满透明度 */
    playSlash(x: number, y: number, side: 'red' | 'blue') {
        const color = side === 'red' ? new Color(255, 240, 200, 255) : new Color(200, 230, 255, 255);
        let node: Node;
        let poolKey = 'slash';
        const fxNode = this.makeFxNode('fx/fx_slash', 56, color.clone());
        if (fxNode) {
            node = fxNode;
            poolKey = 'fx_slash';
        } else {
            node = this.pool.acquire('slash', () =>
                this.spriteFactory.createColorNode(color, 42, 12, 'rect'),
            );
        }
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        node.angle = -30 + Math.random() * 60; // 随机倾角，避免整齐划一
        setUniformScale(node, 0.7);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;

        this.push({
            node, elapsed: 0, duration: 0.18,
            type: 'slash_fx', startX: x, startY: y, origScale: 1.1,
            dx: 0, dy: 0,
        }, poolKey);
    }

    /** 碎石迸溅：命中点小碎石飞散（fx_debris 程序碎片兜底，tank/siege 命中用） */
    playDebrisBurst(x: number, y: number, count = 4) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const node = this.makeFxNode('fx/fx_debris', 18, new Color(255, 255, 255))
                ?? this.pool.acquire('debris_fx', () =>
                    this.spriteFactory.createColorNode(new Color(190, 150, 95), 7, 7, 'rect'));
            node.parent = this.container;
            node.setPosition(x, y, 0);
            node.active = true;
            node.angle = Math.random() * 360;
            setUniformScale(node, 1);
            const opacity = node.getComponent(UIOpacity);
            if (opacity) opacity.opacity = 255;
            this.push({
                node, elapsed: 0, duration: 0.3,
                type: 'particle', startX: x, startY: y, origScale: 1,
                dx: Math.cos(angle) * (40 + Math.random() * 40),
                dy: Math.sin(angle) * (40 + Math.random() * 40),
            }, node.name.startsWith('fx_') ? 'fx_particle' : 'particle');
        }
    }

    /**
     * 爆闪火光：AOE 落点爆光（fx_boom 程序圆兜底）。
     * 最佳实践：爆闪直径应诚实反映伤害范围——封顶为伤害半径 ×0.7（约 52px @radius75），
     * 且只作"亮核"，范围提示交给 playRangeEffect 的细环，两层不再各自放大糊屏。
     * @param finalDiameter 爆闪最终显示直径（px）
     */
    playBoom(x: number, y: number, finalDiameter: number = 56) {
        let node: Node;
        let poolKey = 'boom';
        const fxNode = this.makeFxNode('fx/fx_boom', 72, new Color(255, 255, 255));
        let baseSize: number;
        if (fxNode) {
            node = fxNode;
            poolKey = 'fx_boom';
            baseSize = 72;
        } else {
            node = this.pool.acquire('boom', () =>
                this.spriteFactory.createColorNode(new Color(255, 180, 70, 220), 50, 50, 'circle'),
            );
            baseSize = 50;
        }
        const endScale = Math.max(0.4, finalDiameter / baseSize);
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        setUniformScale(node, 0.45);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 190;

        this.push({
            node, elapsed: 0, duration: 0.24,
            type: 'boom', startX: x, startY: y, origScale: endScale,
            dx: 0, dy: 0, baseOpacity: 190,
        }, poolKey);

        // 柔光底层（fx_glow）：比亮核大一圈但很淡，给爆炸"能量释放"质感，不增加尺寸压迫感
        const glow = this.makeFxNode('fx/fx_glow', 64, new Color(255, 210, 130, 80));
        if (glow) {
            glow.parent = this.container;
            glow.setPosition(x, y, 0);
            glow.active = true;
            setUniformScale(glow, 0.5);
            const gOpacity = glow.getComponent(UIOpacity);
            if (gOpacity) gOpacity.opacity = 70;
            this.push({
                node: glow, elapsed: 0, duration: 0.3,
                type: 'boom', startX: x, startY: y, origScale: (finalDiameter * 1.3) / 64,
                dx: 0, dy: 0, baseOpacity: 70,
            }, 'fx_boom');
        }
    }

    /** 范围溅射表现：以目标为圆心的扩散环（AOE / 防御塔溅射）；优先 fx_ring 贴图 */
    playRangeEffect(x: number, y: number, radius: number, side: 'red' | 'blue') {
        // 环是"伤害范围"的唯一提示层：缩至 0.6× 保持克制，低透明度避免与爆闪叠加糊屏
        const color = side === 'red' ? new Color(255, 170, 100, 140) : new Color(100, 180, 255, 140);
        let node: Node;
        let poolKey = 'range';
        const fxNode = this.makeFxNode('fx/fx_ring', FX_SIZE.ring, color.clone());
        if (fxNode) {
            node = fxNode;
            poolKey = 'fx_range';
        } else {
            node = this.pool.acquire('range', () =>
                this.spriteFactory.createColorNode(color, 40, 40, 'circle'),
            );
        }
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        setUniformScale(node, 0.4);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 90;

        // 目标缩放 = 基准 40px × (radius/40) × 0.6
        this.push({
            node, elapsed: 0, duration: 0.35,
            type: 'range_ring', startX: x, startY: y,
            origScale: (radius / 40) * 0.6,
            dx: 0, dy: 0,
        }, poolKey);
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
        // 延时动作：到点触发（如 AOE 弹道落地再爆炸）
        for (let i = this.scheduled.length - 1; i >= 0; i--) {
            this.scheduled[i].delay -= dt;
            if (this.scheduled[i].delay <= 0) {
                const fn = this.scheduled[i].fn;
                this.scheduled.splice(i, 1);
                fn();
            }
        }

        for (let i = this.active.length - 1; i >= 0; i--) {
            const fx = this.active[i];
            fx.elapsed += dt;
            const progress = Math.min(1, fx.elapsed / fx.duration);

            if (progress >= 1) {
                this.retire(fx.node, fx.poolKey, fx.type);
                this.active.splice(i, 1);
                continue;
            }

            this.animateEffect(fx, progress);
        }
    }

    /** 清理所有效果 */
    clear() {
        for (const fx of this.active) {
            this.retire(fx.node, fx.poolKey, fx.type);
        }
        this.active.length = 0;
        this.scheduled.length = 0;
        this.pool.clearAll();
    }

    /** 延时执行一个表现动作（秒）；用于弹道飞行结束后再落点爆炸，保持“弹道落地才炸”的同步感 */
    schedule(delay: number, fn: () => void) {
        if (delay <= 0) { fn(); return; }
        this.scheduled.push({ delay, fn });
    }

    // ==================== 内部 ====================

    /** 效果结束回收：贴图节点（fx_* 池）直接销毁，程序色块节点回对象池 */
    private retire(node: Node, poolKey: string | undefined, type: EffectInstance['type']) {
        if (poolKey && poolKey.startsWith('fx_')) {
            node.destroy();
        } else {
            this.pool.release(node, poolKey || this.getPoolKey(type));
        }
    }

    /** 推入活跃效果（带全局上限判定：超限直接丢弃，不创建新节点） */
    private push(fx: EffectInstance, poolKey?: string) {
        if (poolKey) fx.poolKey = poolKey;
        if (this.active.length >= MAX_ACTIVE_EFFECTS) {
            this.retire(fx.node, fx.poolKey, fx.type);
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

            case 'slash_fx':
                // 斩击：快速放大 + 轻微上移 + 淡出
                setUniformScale(node, 0.6 + progress * 0.7);
                node.setPosition(fx.startX, fx.startY + progress * 6, 0);
                if (opacity) opacity.opacity = Math.floor(235 * (1 - progress));
                break;

            case 'impact_ring':
                // 命中：小幅放大 + 淡出（收敛到 +0.9，近战命中不再糊成一团）
                setUniformScale(node, fx.origScale + progress * 0.9);
                if (opacity) opacity.opacity = Math.floor(180 * (1 - progress));
                break;

            case 'boom':
                // 爆闪/柔光：0.45 → 目标直径封顶，按各自初始透明度分层淡出
                setUniformScale(node, 0.45 + (fx.origScale - 0.45) * progress);
                if (opacity) opacity.opacity = Math.floor((fx.baseOpacity ?? 190) * (1 - progress));
                break;

            case 'range_ring':
                // 范围溅射：从 0.4 放大到半径×0.6，淡出
                setUniformScale(node, 0.4 + (fx.origScale - 0.4) * progress);
                if (opacity) opacity.opacity = Math.floor(120 * (1 - progress));
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
            case 'slash_fx': return 'slash';
            case 'range_ring': return 'range';
            case 'particle': return 'particle';
            case 'projectile': return 'projectile';
            case 'boom': return 'boom';
        }
    }
}
