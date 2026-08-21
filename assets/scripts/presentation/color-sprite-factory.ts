/**
 * ColorSpriteFactory —— 灰盒形状 Sprite 生成器
 *
 * 职责：通过 Texture2D.reset 直接上传像素（平台无关、无 DOM 依赖），
 *       缓存 SpriteFrame，并提供快捷方法创建带颜色和形状的 UI 节点。
 * 后续替换为真实 SpriteFrame 资源时，只需修改本文件。
 *
 * 性能策略：
 *   - rect（矩形）：复用一张 1×1 白像素 SpriteFrame，通过 Sprite.color 染色 +
 *     Sprite.SizeMode.CUSTOM 呈现任意尺寸，避免生成大纹理，性能最优。
 *   - 其它形状（circle/diamond/triangle/hexagon/star）：
 *     Web 环境用 HTML Canvas 绘制后 getImageData 读像素；
 *     无 DOM 的小游戏环境退化为纯色矩形填充。
 *
 * 支持的形状：rect（矩形）、circle（圆形）、diamond（菱形）、
 *              triangle（三角形）、hexagon（六角形）、star（星形）
 */

import {
    Node, Color, UITransform, Size, Vec2, Sprite, SpriteFrame, Texture2D,
} from 'cc';

/** 支持的形状类型 */
export type Shape = 'rect' | 'circle' | 'diamond' | 'triangle' | 'hexagon' | 'star';

export class ColorSpriteFactory {

    /** 非矩形 SpriteFrame 缓存（key = shape:r,g,b,a,WxH） */
    private cache: Map<string, SpriteFrame> = new Map();

    /** 矩形共享：一张 1×1 白色像素 SpriteFrame，配合 Sprite.color + CUSTOM sizeMode 使用 */
    private sharedRectFrame: SpriteFrame | null = null;

    /** 节点默认 layer */
    private layer: number = 0;

    setLayer(layer: number) {
        this.layer = layer;
    }

    /**
     * 生成一张 1×1 白色像素的共享 SpriteFrame（矩形专用）。
     * 不依赖任何 DOM / 原生 API，所有平台均可运行。
     */
    private getSharedRectFrame(): SpriteFrame {
        if (this.sharedRectFrame) return this.sharedRectFrame;
        const tex = new Texture2D();
        // 一个白像素（RGBA8888）。注意：reset 后必须显式 uploadData 上传像素，
        // 否则纹理为空 → 所有 Sprite 不可见（全屏黑）
        tex.reset({
            width: 1,
            height: 1,
            format: Texture2D.PixelFormat.RGBA8888,
        });
        tex.uploadData(new Uint8Array([255, 255, 255, 255]));
        const sf = new SpriteFrame();
        sf.texture = tex;
        this.sharedRectFrame = sf;
        return sf;
    }

    /**
     * 获取指定形状、颜色与尺寸的 SpriteFrame（带缓存）。
     * - rect：返回共享 1×1 白像素帧，尺寸与颜色在 Sprite 组件上体现；
     * - 其它：按形状与颜色生成唯一整张纹理。
     */
    getSpriteFrame(color: Color, w: number, h: number, shape: Shape = 'rect'): SpriteFrame | null {
        if (shape === 'rect') {
            return this.getSharedRectFrame();
        }

        const key = `${shape}:${color.r},${color.g},${color.b},${color.a},${w}x${h}`;
        const cached = this.cache.get(key);
        if (cached) return cached;

        const fw = Math.max(1, Math.floor(w));
        const fh = Math.max(1, Math.floor(h));
        const pixels = new Uint8Array(fw * fh * 4);

        try {
            // Web 环境用 HTML Canvas 画复杂形状，再读取回像素
            if (typeof document !== 'undefined') {
                const canvas = document.createElement('canvas');
                canvas.width = fw;
                canvas.height = fh;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const cx = fw / 2;
                    const cy = fh / 2;
                    ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
                    ctx.strokeStyle = `rgba(${Math.min(255, color.r + 40)},${Math.min(255, color.g + 40)},${Math.min(255, color.b + 40)},${color.a / 255})`;
                    ctx.lineWidth = 1.5;

                    switch (shape) {
                        case 'circle':
                            ctx.beginPath();
                            ctx.arc(cx, cy, Math.min(cx, cy) - 1, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.stroke();
                            break;
                        case 'diamond':
                            ctx.beginPath();
                            ctx.moveTo(cx, 1);
                            ctx.lineTo(fw - 1, cy);
                            ctx.lineTo(cx, fh - 1);
                            ctx.lineTo(1, cy);
                            ctx.closePath();
                            ctx.fill();
                            ctx.stroke();
                            break;
                        case 'triangle':
                            ctx.beginPath();
                            ctx.moveTo(cx, 1);
                            ctx.lineTo(fw - 1, fh - 1);
                            ctx.lineTo(1, fh - 1);
                            ctx.closePath();
                            ctx.fill();
                            ctx.stroke();
                            break;
                        case 'hexagon':
                            this.drawPolygon(ctx, cx, cy, Math.min(cx, cy) - 1, 6);
                            ctx.fill();
                            ctx.stroke();
                            break;
                        case 'star':
                            this.drawStar(ctx, cx, cy, Math.min(cx, cy) - 1, 5);
                            ctx.fill();
                            ctx.stroke();
                            break;
                    }
                    const imgData = ctx.getImageData(0, 0, fw, fh);
                    pixels.set(new Uint8Array(imgData.data.buffer,
                        imgData.data.byteOffset, imgData.data.byteLength));
                } else {
                    this.fillSolidRect(pixels, fw, fh, color);
                }
            } else {
                // 微信 / 抖音等小游戏无 document，退化为纯色矩形
                this.fillSolidRect(pixels, fw, fh, color);
            }
        } catch (e) {
            // 任意异常兜底，避免纹理为全透明导致屏幕空白
            this.fillSolidRect(pixels, fw, fh, color);
        }

        const tex = new Texture2D();
        // reset 后显式上传像素（data 不在 ITexture2DCreateInfo 中，静默忽略会导致空纹理）
        tex.reset({
            width: fw,
            height: fh,
            format: Texture2D.PixelFormat.RGBA8888,
        });
        tex.uploadData(pixels);
        const sf = new SpriteFrame();
        sf.texture = tex;
        this.cache.set(key, sf);
        return sf;
    }

    /**
     * 创建一个带形状和颜色的 UI 节点。
     * - 矩形：共享 1×1 白像素 + Sprite.color 染色 + CUSTOM sizeMode（最省显存）
     * - 其它形状：整张纹理渲染，Sprite.color 保持白色
     */
    createColorNode(color: Color, w: number, h: number, shape: Shape = 'rect'): Node {
        const node = new Node();
        node.layer = this.layer;
        const uiTransform = node.addComponent(UITransform);
        uiTransform.contentSize = new Size(w, h);
        uiTransform.anchorPoint = new Vec2(0.5, 0.5);
        const sprite = node.addComponent(Sprite);
        // 必须在挂 SpriteFrame 之前固定 sizeMode/type：
        // 默认 RAW 模式下赋值 spriteFrame 会立刻把节点重置为纹理尺寸
        // （共享矩形帧是 1×1 像素，会把所有节点缩成 1×1 → 全屏不可见）
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        const sf = this.getSpriteFrame(color, w, h, shape);
        if (sf) sprite.spriteFrame = sf;
        // 挂帧后再断言一次尺寸（防御引擎版本在赋值路径上改写 contentSize）
        uiTransform.contentSize = new Size(w, h);
        if (shape === 'rect') {
            // 矩形：通过 Sprite.color 染色实现颜色
            sprite.color = color.clone();
        } else {
            // 非矩形：纹理已自带颜色，保持白色乘子
            sprite.color = new Color(255, 255, 255, 255);
        }
        return node;
    }

    /** 清理缓存 */
    dispose() {
        this.cache.forEach(sf => sf.destroy?.());
        this.cache.clear();
        this.sharedRectFrame?.destroy?.();
        this.sharedRectFrame = null;
    }

    // ==================== 无 DOM 兜底：纯色矩形填充 ====================

    private fillSolidRect(pixels: Uint8Array, w: number, h: number, color: Color) {
        const r = color.r, g = color.g, b = color.b, a = color.a;
        for (let i = 0, p = 0; i < w * h; i++, p += 4) {
            pixels[p] = r;
            pixels[p + 1] = g;
            pixels[p + 2] = b;
            pixels[p + 3] = a;
        }
    }

    // ==================== 内部绘制辅助 ====================

    /** 绘制正多边形 */
    private drawPolygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number) {
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    /** 绘制五角星 */
    private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (Math.PI * i) / points - Math.PI / 2;
            const radius = i % 2 === 0 ? r : r * 0.45;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    }
}
