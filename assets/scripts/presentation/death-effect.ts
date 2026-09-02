/**
 * DeathEffect —— 死亡弹飞表现系统
 *
 * 职责：
 *  - 单位死亡时播放"重力弧线弹飞 + 自旋 + 星星消散"动画（无血腥，符合全龄化设计）
 *  - 弹飞带初速度与重力加速度，形成抛物线弧线；随机自旋增强动感
 *  - 死亡同时喷出 3~5 颗小星星向四周散开消散（01 总纲："变星星/果粒消散"）
 *  - 使用对象池复用节点
 *
 * 设计规范（来自 01-玩法设计总纲 §全龄化）：
 *  - "兵被打败 = 弹飞 + 变星星/果粒消散，禁止血腥"
 */

import { Node, Color, UITransform, Size, Vec2, UIOpacity, Sprite } from 'cc';
import { ColorSpriteFactory, Shape } from './color-sprite-factory';
import { NodePool } from './node-pool';
import { setUniformScale } from './scale-helper';
import { ArtLibrary } from './art-library';

/** 弹飞重力加速度（px/s²，向下）：数值决定抛物线的"坠感" */
const GRAVITY = -700;

/** 单个死亡弹飞动画实例 */
interface DeathAnim {
    node: Node;
    elapsed: number;
    duration: number;
    startX: number;
    startY: number;
    /** 初速度：vx 恒定，vy 受重力衰减形成弧线 */
    vx: number;
    vy: number;
    /** 自旋角速度（°/s，随机正负） */
    spin: number;
}

/** 星星消散粒子实例 */
interface StarAnim {
    node: Node;
    elapsed: number;
    duration: number;
    startX: number;
    startY: number;
    vx: number;
    vy: number;
    spin: number;
}

/** 星星颜色（金币金；贴图 tint 与灰盒兜底共用） */
const STAR_COLOR = new Color(255, 215, 94);

export class DeathEffect {

    /** 活跃的死亡弹飞列表 */
    private active: DeathAnim[] = [];
    /** 活跃的星星消散列表 */
    private stars: StarAnim[] = [];
    /** 弹飞主体对象池 */
    private pool: NodePool = new NodePool();
    /** 星星粒子对象池（贴图节点与灰盒节点同为 Sprite 节点，可混池复用） */
    private starPool: NodePool = new NodePool();

    private container: Node;
    private spriteFactory: ColorSpriteFactory;
    /** 美术资源库（可选：fx_star 贴图可用时替换灰盒星星） */
    private art: ArtLibrary | null = null;

    constructor(container: Node, spriteFactory: ColorSpriteFactory, art?: ArtLibrary | null) {
        this.container = container;
        this.spriteFactory = spriteFactory;
        this.art = art ?? null;
    }

    /**
     * 在指定位置播放死亡弹飞效果（并喷出星星）
     * @param x 死亡位置 x
     * @param y 死亡位置 y
     * @param color 实体颜色（跟随阵营边）
     * @param shape 实体形状（跟随兵种类型）
     * @param size 实体尺寸
     */
    play(x: number, y: number, color: Color, shape: Shape = 'circle', size: number = 16) {
        const node = this.pool.acquire('death', () =>
            this.spriteFactory.createColorNode(color, size, size, shape),
        );
        node.parent = this.container;
        node.setPosition(x, y, 0);
        node.active = true;
        node.angle = 0;
        setUniformScale(node, 1);
        const opacity = node.getComponent(UIOpacity);
        if (!opacity) node.addComponent(UIOpacity);
        else opacity.opacity = 255;

        // 随机方向的水平初速 + 向上初速：先蹿升再被重力拉落，形成抛物线弧线
        const angle = Math.random() * Math.PI * 2;
        this.active.push({
            node,
            elapsed: 0,
            duration: 0.55, // 比旧版 0.4s 稍长，让弧线完整呈现
            startX: x,
            startY: y,
            vx: Math.cos(angle) * (50 + Math.random() * 60),
            vy: 110 + Math.random() * 70,
            spin: (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 200),
        });

        // 星星消散（01 总纲：变星星消散）
        this.spawnStars(x, y);
    }

    /** 每帧更新：驱动弹飞与星星动画 */
    update(dt: number) {
        // 弹飞主体：抛物线 + 自旋
        for (let i = this.active.length - 1; i >= 0; i--) {
            const anim = this.active[i];
            anim.elapsed += dt;
            const progress = anim.elapsed / anim.duration;

            if (progress >= 1) {
                this.pool.release(anim.node, 'death');
                this.active.splice(i, 1);
                continue;
            }

            // 抛物线位移：x 匀速，y = v0·t + ½g·t²
            const t = anim.elapsed;
            anim.node.setPosition(
                anim.startX + anim.vx * t,
                anim.startY + anim.vy * t + 0.5 * GRAVITY * t * t,
                0,
            );
            anim.node.angle = anim.spin * t;

            // 缩小 + 后半段淡出（前半段保持实体感，避免"瞬隐"）
            setUniformScale(anim.node, 1 - progress * 0.75);
            const opacity = anim.node.getComponent(UIOpacity);
            if (opacity) {
                opacity.opacity = progress < 0.5
                    ? 255
                    : Math.floor(255 * (1 - (progress - 0.5) / 0.5));
            }
        }

        // 星星消散：小抛物线 + 自旋 + 缩小淡出
        for (let i = this.stars.length - 1; i >= 0; i--) {
            const s = this.stars[i];
            s.elapsed += dt;
            const progress = s.elapsed / s.duration;

            if (progress >= 1) {
                this.starPool.release(s.node, 'death_star');
                this.stars.splice(i, 1);
                continue;
            }

            const t = s.elapsed;
            s.node.setPosition(
                s.startX + s.vx * t,
                s.startY + s.vy * t + 0.5 * GRAVITY * t * t,
                0,
            );
            s.node.angle = s.spin * t;
            setUniformScale(s.node, 1 - progress * 0.8);
            const opacity = s.node.getComponent(UIOpacity);
            if (opacity) opacity.opacity = Math.floor(255 * (1 - progress));
        }
    }

    /** 清理所有死亡动画与星星 */
    clear() {
        for (const anim of this.active) {
            this.pool.release(anim.node, 'death');
        }
        this.active.length = 0;
        for (const s of this.stars) {
            this.starPool.release(s.node, 'death_star');
        }
        this.stars.length = 0;
        this.pool.clearAll();
        this.starPool.clearAll();
    }

    // ==================== 内部 ====================

    /** 死亡点喷出 3~5 颗小星星向四周散开消散 */
    private spawnStars(x: number, y: number) {
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const node = this.starPool.acquire('death_star', () => this.makeStarNode());
            node.parent = this.container;
            node.setPosition(x, y, 0);
            node.active = true;
            node.angle = 0;
            setUniformScale(node, 1);
            const opacity = node.getComponent(UIOpacity);
            if (!opacity) node.addComponent(UIOpacity);
            else opacity.opacity = 255;

            // 均匀铺开方向 + 随机扰动，避免每次喷星星都聚成一束
            const ang = (Math.PI * 2 * i) / count + Math.random() * 0.8;
            const speed = 60 + Math.random() * 90;
            this.stars.push({
                node,
                elapsed: 0,
                duration: 0.45 + Math.random() * 0.25,
                startX: x,
                startY: y,
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed + 60, // 整体略微向上喷
                spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 240),
            });
        }
    }

    /** 创建单颗星星节点：优先 fx_star 贴图（tint 金色），缺失回退灰盒五角星 */
    private makeStarNode(): Node {
        if (this.art?.isLoaded()) {
            const n = this.art.createSpriteNode('fx/star', 12, 12);
            if (n) {
                const sp = n.getComponent(Sprite);
                if (sp) sp.color = STAR_COLOR.clone();
                return n;
            }
        }
        return this.spriteFactory.createColorNode(STAR_COLOR.clone(), 12, 12, 'star');
    }
}
