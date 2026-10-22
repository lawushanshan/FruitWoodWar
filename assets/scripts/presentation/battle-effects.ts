/**
 * 卡通战斗表现：清晰弹道、短促命中、尘土与抛物线碎片。
 * Kenney Particle Pack (CC0) 贴图；仅改变表现，不改伤害结算。
 * 按素材/形状/尺寸分池，alpha 统一由 UIOpacity 控制。
 */
import { Node, Color, UIOpacity, Sprite } from 'cc';
import { ColorSpriteFactory, type Shape } from './color-sprite-factory';
import { NodePool } from './node-pool';
import { ArtLibrary } from './art-library';
import { projectilePose } from './projectile-motion';

type Side = 'red' | 'blue';
type Kind = 'flash' | 'dust' | 'ring' | 'debris' | 'slash' | 'projectile';
interface Effect {
    node: Node;
    key: string;
    kind: Kind;
    elapsed: number;
    duration: number;
    x: number; y: number;
    dx: number; dy: number;
    alpha: number;
    angle: number;
    spin: number;
    arc: number;
    shadow?: { node: Node; key: string };
    trail?: { node: Node; key: string };
}
const MAX_ACTIVE_EFFECTS = 160;
const MAX_SCHEDULED = 128;
const WARM = new Color(255, 222, 148);
const COOL = new Color(190, 222, 246);
const DUST = new Color(218, 196, 158);
const STONE = new Color(155, 132, 99);

export class BattleEffects {
    private active: Effect[] = [];
    private scheduled: Array<{ delay: number; fn: () => void }> = [];
    private pool = new NodePool();

    constructor(private container: Node, private spriteFactory: ColorSpriteFactory,
        private art: ArtLibrary | null = null) {}

    private acquire(path: string, size: number, color: Color, shape: Shape = 'circle') {
        const hasArt = !!this.art?.has(path);
        const key = (hasArt ? path : 'fallback:' + shape) + ':' + size;
        const node = this.pool.acquire(key, () => hasArt
            ? this.art!.createSpriteNode(path, size, size)!
            : this.spriteFactory.createColorNode(Color.WHITE, size, size, shape));
        node.name = 'BattleFX_' + key;
        node.layer = this.container.layer;
        node.parent = this.container;
        node.angle = 0;
        node.setScale(1, 1, 1);
        const sprite = node.getComponent(Sprite);
        if (sprite) sprite.color = new Color(color.r, color.g, color.b, 255);
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        opacity.opacity = 255;
        return { node, key };
    }

    private emit(kind: Kind, path: string, size: number, color: Color, x: number, y: number,
        duration: number, alpha = 255, shape: Shape = 'circle'): Effect | null {
        if (this.active.length >= MAX_ACTIVE_EFFECTS) return null;
        const { node, key } = this.acquire(path, size, color, shape);
        const fx: Effect = { node, key, kind, x, y, duration, alpha, elapsed: 0,
            dx: 0, dy: 0, angle: 0, spin: 0, arc: 0 };
        node.setPosition(x, y);
        this.active.push(fx);
        return fx;
    }

    playAttackFlash(x: number, y: number) {
        const fx = this.emit('flash', 'fx/kenney/star_04', 15, WARM, x, y + 7, 0.11, 185, 'star');
        if (fx) this.animate(fx, 0);
    }

    /** 普通命中只用一闪、两颗碎屑，避免每支箭都引发爆炸。 */
    playImpact(x: number, y: number, side: Side) {
        const fx = this.emit('flash', 'fx/kenney/star_04', 28, side === 'red' ? WARM : COOL,
            x, y + 5, 0.16, 245, 'star');
        if (fx) { fx.angle = Math.random() * 80 - 40; this.animate(fx, 0); }
        this.fragments(x, y, 2, 5, side === 'red' ? WARM : COOL);
    }

    /** 保留调用参数，按兵种选择干净贴图与运动方式；巨石有抛物线和独立地面影子。 */
    playProjectile(sx: number, sy: number, tx: number, ty: number, side: Side,
        tex = 'fx/fx_arrow', duration = 0.12, size = 32) {
        const rock = tex === 'fx/fx_boulder';
        const orb = tex === 'fx/fx_bolt';
        const color = rock ? Color.WHITE : side === 'red' ? new Color(244, 193, 95) : new Color(178, 210, 232);
        const diameter = rock ? Math.min(32, size * 0.7) : orb ? 16 : 9;
        const fx = this.emit('projectile', rock ? 'fx/boulder_clean' : '',
            diameter, color, sx, sy + 8, Math.max(0.04, duration));
        if (!fx) return;
        fx.dx = tx - sx;
        fx.dy = ty - sy;
        fx.arc = rock ? Math.min(75, Math.max(18, Math.hypot(fx.dx, fx.dy) * 0.22)) : orb ? 12 : 0;
        fx.spin = rock ? (fx.dx >= 0 ? -160 : 160) : 0;
        if (rock) {
            fx.shadow = this.acquire('fx/kenney/circle_01', 22, new Color(32, 30, 24));
            fx.shadow.node.setSiblingIndex(fx.node.getSiblingIndex());
        } else {
            fx.trail = this.acquire('fx/kenney/trace_01', orb ? 35 : 27, color);
            fx.trail.node.setSiblingIndex(fx.node.getSiblingIndex());
        }
        this.animate(fx, 0);
    }

    playSlash(x: number, y: number, side: Side) {
        const fx = this.emit('slash', 'fx/kenney/slash_03', 42, side === 'red' ? WARM : COOL,
            x, y + 4, 0.16, 220);
        if (fx) { fx.angle = side === 'red' ? -35 : 145; this.animate(fx, 0); }
    }

    playDebrisBurst(x: number, y: number, count = 4) {
        this.fragments(x, y, count, 8, STONE);
    }

    private fragments(x: number, y: number, count: number, size: number, color: Color) {
        for (let i = 0; i < Math.min(6, count); i++) {
            const fx = this.emit('debris', '', size, color, x, y + 4, 0.32 + Math.random() * 0.1, 230, 'diamond');
            if (!fx) return;
            fx.dx = (i % 2 === 0 ? -1 : 1) * (35 + Math.random() * 70);
            fx.dy = 65 + Math.random() * 80;
            fx.spin = (Math.random() - 0.5) * 520;
            this.animate(fx, 0);
        }
    }

    /** 重击落点：短星芒之后散开三团尘土，不叠彩色霓虹光圈。 */
    playBoom(x: number, y: number, finalDiameter = 56) {
        const fx = this.emit('flash', 'fx/kenney/star_04', Math.min(52, finalDiameter), WARM,
            x, y + 6, 0.13, 240, 'star');
        if (fx) this.animate(fx, 0);
        this.dust(x, y, Math.max(24, Math.min(58, finalDiameter)));
    }

    private dust(x: number, y: number, size: number) {
        for (let i = 0; i < 3; i++) {
            const fx = this.emit('dust', i === 1 ? 'fx/kenney/smoke_06' : 'fx/kenney/smoke_03',
                size, DUST, x + (i - 1) * 5, y, 0.38 + i * 0.04, 190);
            if (!fx) return;
            fx.dx = (i - 1) * size * 0.42;
            fx.dy = 8 + i * 3;
            fx.angle = (i - 1) * 30;
            this.animate(fx, 0);
        }
    }

    /** 椭圆地面冲击只作冲击反馈，非精确伤害范围指示。 */
    playRangeEffect(x: number, y: number, radius: number, _side: Side) {
        const fx = this.emit('ring', 'fx/kenney/circle_03', Math.min(108, radius * 1.3), DUST,
            x, y - 3, 0.25, 150);
        if (fx) this.animate(fx, 0);
    }

    playCrystalHit(x: number, y: number, _side: Side) {
        const fx = this.emit('flash', 'fx/kenney/star_04', 42, WARM, x, y + 18, 0.16, 210, 'star');
        if (fx) this.animate(fx, 0);
        this.fragments(x, y, 3, 6, STONE);
    }

    playBuildingDestroy(x: number, y: number) {
        this.playBoom(x, y, 64);
        this.playDebrisBurst(x, y, 6);
        this.playRangeEffect(x, y, 80, 'red');
    }

    schedule(delay: number, fn: () => void) {
        if (delay <= 0) { fn(); return; }
        if (this.scheduled.length < MAX_SCHEDULED) this.scheduled.push({ delay, fn });
    }

    update(dt: number) {
        // 先推进已有投射物，再触发落点；新增命中不会被同帧的大 dt 直接跳过。
        for (let i = this.active.length - 1; i >= 0; i--) {
            const fx = this.active[i];
            fx.elapsed += dt;
            if (fx.elapsed >= fx.duration) {
                this.animate(fx, 1);
                this.retire(fx);
                this.active.splice(i, 1);
            } else this.animate(fx, fx.elapsed / fx.duration);
        }
        for (let i = this.scheduled.length - 1; i >= 0; i--) {
            this.scheduled[i].delay -= dt;
            if (this.scheduled[i].delay <= 0) {
                const { fn } = this.scheduled.splice(i, 1)[0];
                fn();
            }
        }
    }

    clear() {
        for (const fx of this.active) this.retire(fx);
        this.active.length = 0;
        this.scheduled.length = 0;
        this.pool.clearAll();
    }

    private retire(fx: Effect) {
        this.pool.release(fx.node, fx.key);
        if (fx.shadow) this.pool.release(fx.shadow.node, fx.shadow.key);
        if (fx.trail) this.pool.release(fx.trail.node, fx.trail.key);
    }

    private animate(fx: Effect, p: number) {
        const n = fx.node;
        let alpha = fx.alpha * (1 - p);
        switch (fx.kind) {
            case 'projectile': {
                const pose = projectilePose(fx.x, fx.y, fx.dx, fx.dy, p, fx.arc);
                n.setPosition(pose.x, pose.y);
                n.angle = fx.spin ? fx.spin * p : pose.angle;
                n.setScale(1, fx.spin ? 1 : 0.82, 1);
                alpha = 255; // 旧版全程淡出导致未命中就消失。
                if (fx.shadow) {
                    const k = 1 - 0.25 * Math.sin(Math.PI * p);
                    fx.shadow.node.setPosition(fx.x + fx.dx * p, fx.y - 8 + fx.dy * p);
                    fx.shadow.node.setScale(k, k * 0.35, 1);
                    fx.shadow.node.getComponent(UIOpacity)!.opacity = 85;
                }
                if (fx.trail) {
                    const angle = pose.angle * Math.PI / 180;
                    fx.trail.node.setPosition(pose.x - Math.cos(angle) * 12, pose.y - Math.sin(angle) * 12);
                    fx.trail.node.angle = pose.angle - 90;
                    fx.trail.node.getComponent(UIOpacity)!.opacity = 145;
                }
                break;
            }
            case 'flash': {
                const s = p < 0.2 ? 0.65 + p * 2.5 : 1.15 - (p - 0.2) * 0.7;
                n.setScale(s, s, 1); n.angle = fx.angle;
                alpha = fx.alpha * Math.pow(1 - p, 0.7);
                break;
            }
            case 'dust':
                n.setPosition(fx.x + fx.dx * p, fx.y + fx.dy * p);
                n.setScale(0.55 + p * 0.9, 0.4 + p * 0.7, 1); n.angle = fx.angle;
                alpha = fx.alpha * (1 - p) * Math.min(1, p * 10);
                break;
            case 'ring':
                n.setScale(0.3 + p * 0.7, (0.3 + p * 0.7) * 0.48, 1);
                break;
            case 'debris':
                n.setPosition(fx.x + fx.dx * fx.elapsed, fx.y + fx.dy * fx.elapsed - 350 * fx.elapsed ** 2);
                n.angle = fx.spin * fx.elapsed;
                n.setScale(1 - p * 0.65, 1 - p * 0.65, 1);
                break;
            case 'slash':
                n.angle = fx.angle + p * 60;
                n.setScale(0.8 + p * 0.3, 0.65 + p * 0.2, 1);
                break;
        }
        n.getComponent(UIOpacity)!.opacity = Math.round(alpha);
    }
}
