/**
 * ResponsiveLayout —— 桌面宽屏/窄屏 UI 适配
 *
 * 职责：
 *  - 检测实际可视区域尺寸，防止顶部状态栏和底部建造栏重叠
 *  - 宽屏时：战场区域向两侧扩展（背景填充）
 *  - 窄屏时：缩小建造栏按钮尺寸，确保不超出可视区域
 *  - 每帧检测屏幕尺寸变化（支持窗口 resize）
 *
 * 设计分辨率：1280×720
 * 适配策略：fitWidth + fitHeight（SHOW_ALL 模式，保持比例，可能有黑边）
 */

import { view, screen } from 'cc';

/** 布局参数 */
export interface LayoutParams {
    /** 设计分辨率 */
    designWidth: number;
    designHeight: number;
    /** 实际可视区域（像素） */
    visibleWidth: number;
    visibleHeight: number;
    /** 实际宽高比 */
    aspectRatio: number;
    /** 是否为窄屏（宽高比 < 16:9） */
    isNarrow: boolean;
    /** 是否为超宽屏（宽高比 > 21:9） */
    isUltraWide: boolean;
    /** 缩放因子（窄屏时 < 1） */
    scaleFactor: number;
}

/** 标准宽高比常量 */
const ASPECT_16_9 = 16 / 9;   // 1.778
const ASPECT_21_9 = 21 / 9;   // 2.333
const ASPECT_4_3 = 4 / 3;     // 1.333

export class ResponsiveLayout {

    private params: LayoutParams;

    constructor() {
        this.params = this.computeLayout();
    }

    /** 获取当前布局参数 */
    getParams(): LayoutParams {
        return this.params;
    }

    /** 每帧更新：检测屏幕尺寸变化 */
    update(): boolean {
        const newParams = this.computeLayout();
        const changed = newParams.visibleWidth !== this.params.visibleWidth
            || newParams.visibleHeight !== this.params.visibleHeight;
        this.params = newParams;
        return changed;
    }

    /** 计算当前布局参数 */
    private computeLayout(): LayoutParams {
        const designSize = view.getDesignResolutionSize();
        const visSize = view.getVisibleSize();

        const visibleWidth = visSize.width;
        const visibleHeight = visSize.height;
        const aspectRatio = visibleWidth / visibleHeight;

        // 窄屏判定：宽高比 < 16:9
        const isNarrow = aspectRatio < ASPECT_16_9;
        // 超宽屏判定：宽高比 > 21:9
        const isUltraWide = aspectRatio > ASPECT_21_9;

        // 缩放因子：窄屏时按比例缩小 UI
        let scaleFactor = 1;
        if (isNarrow) {
            // 以 16:9 为基准，窄屏按比例缩小
            // 最窄支持到 4:3（scaleFactor ≈ 0.75）
            scaleFactor = Math.max(0.7, aspectRatio / ASPECT_16_9);
        }

        return {
            designWidth: designSize.width,
            designHeight: designSize.height,
            visibleWidth,
            visibleHeight,
            aspectRatio,
            isNarrow,
            isUltraWide,
            scaleFactor,
        };
    }

    /**
     * 根据布局参数计算顶部栏 Y 位置（锚点顶部对齐）
     * 确保不超出可视区域上边界
     */
    getTopBarY(): number {
        return this.params.visibleHeight / 2;
    }

    /**
     * 根据布局参数计算底部建造栏 Y 位置（锚点底部对齐）
     * 确保不超出可视区域下边界
     */
    getBottomBarY(): number {
        return -this.params.visibleHeight / 2;
    }

    /**
     * 获取建造栏按钮缩放因子
     * 窄屏时缩小按钮，防止超出可视区域
     */
    getBuildBarScale(): number {
        return this.params.scaleFactor;
    }

    /**
     * 获取建造栏按钮间距
     * 窄屏时缩小间距
     */
    getBuildBarGap(): number {
        const baseGap = 96;
        return baseGap * this.params.scaleFactor;
    }

    /**
     * 检查顶部栏和底部栏是否会重叠
     * 顶部栏高度 44px + 底部栏高度 76px = 120px
     * 如果可视高度 < 140px（极端情况），则判定为重叠
     */
    isOverlapping(): boolean {
        return this.params.visibleHeight < 140;
    }
}
