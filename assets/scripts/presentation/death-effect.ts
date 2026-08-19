/**
 * DeathEffect —— 死亡弹飞表现系统
 *
 * 职责：
 *  - 单位死亡时播放"弹飞 + 消散"动画（无血腥，符合全龄化设计）
 *  - 弹飞方向随机偏移，缩放渐小，透明度渐零
 *  - 使用对象池复用节点
 *
 * 设计规范（来自 01-玩法设计总纲 §全龄化）：
 *  - "兵被打败 = 弹飞 + 变星星/果粒消散，禁止血腥"
 */

import { Node, Color, UITransform, Size, Vec2, UIOpacity, Sprite } from 'cc';
import { ColorSpriteFactory, Shape } from './color-sprite-factory';
import { NodePool } from './node-pool';
import { setUniformScale } from './scale-helper';

/** 单个死亡动画实例 */
interface DeathAnim {
    node: Node;
    elapsed: number;
    duration: number;
    startX: number;
    startY: number;
    /** 弹飞方向偏移 */
    dx: number;
    dy: number;
}

export class DeathEffect {

    /** 活跃的死亡动画列表 */
    private active: DeathAnim[] = [];
    private pool: NodePool = new NodePool();

    private container: Node;
    private spriteFactory: ColorSpriteFactory;

    constructor(container: Node, spriteFactory: ColorSpriteFactory) {
        this.container = container;
        this.spriteFactory = spriteFactory;
    }

    /**
     * 在指定位置播放死亡弹飞效果
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
        setUniformScale(node, 1);
        const opacity = node.getComponent(UIOpacity);
        if (!opacity) node.addComponent(UIOpacity);
        else opacity.opacity = 255;

        // 随机弹飞方向
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 40; // 60~100px 弹飞距离

        this.active.push({
            node,
            elapsed: 0,
            duration: 0.4, // 0.4 秒完成弹飞
            startX: x,
            startY: y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed + 30, // 偏上弹飞
        });
    }

    /** 每帧更新：驱动弹飞动画 */
    update(dt: number) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const anim = this.active[i];
            anim.elapsed += dt;
            const progress = anim.elapsed / anim.duration;

            if (progress >= 1) {
                this.pool.release(anim.node, 'death');
                this.active.splice(i, 1);
                continue;
            }

            // 弹飞位移（缓出）
            const easeOut = 1 - (1 - progress) * (1 - progress);
            const nx = anim.startX + anim.dx * easeOut;
            const ny = anim.startY + anim.dy * easeOut;
            anim.node.setPosition(nx, ny, 0);

            // 缩小 + 淡出
            setUniformScale(anim.node, 1 - progress * 0.7);
            const opacity = anim.node.getComponent(UIOpacity);
            if (opacity) {
                opacity.opacity = Math.floor(255 * (1 - progress));
            }
        }
    }

    /** 清理所有死亡动画 */
    clear() {
        for (const anim of this.active) {
            this.pool.release(anim.node, 'death');
        }
        this.active.length = 0;
        this.pool.clearAll();
    }
}
