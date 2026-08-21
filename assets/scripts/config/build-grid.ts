/**
 * 建造网格（v0.5.0）：建筑吸附格点放置，整齐且防重叠。
 *
 * 格距 60px、建筑视觉 40px（占格 67%，四周留呼吸空间）。
 * 每方建造区 9 列 × 8 行 = 72 格点；红方在左侧（x < 0），蓝方镜像在右侧。
 * 行范围 ±100~±250（v0.5.1 收拢，避免最上/最下行越出 720 高的视野）。
 */

export interface BuildGridConfig {
    /** 格距（px） */
    cellSize: number;
    /** 网格列数（单侧建造区） */
    columns: number;
    /** 红方最左列中心 x */
    gridOriginX: number;
    /** 上区行 y 坐标 */
    topRows: readonly number[];
    /** 下区行 y 坐标（与上区对称） */
    bottomRows: readonly number[];
    /** 生成红方全部格点坐标 */
    cells(): Array<{ x: number; y: number }>;
    /** 生成蓝方（镜像）全部格点坐标 */
    mirrorCells(): Array<{ x: number; y: number }>;
}

export const BUILD_GRID: BuildGridConfig = {
    cellSize: 60,
    columns: 9,
    gridOriginX: -570,
    topRows: [100, 150, 200, 250],
    bottomRows: [-100, -150, -200, -250],
    cells(): Array<{ x: number; y: number }> {
        const pts: Array<{ x: number; y: number }> = [];
        for (const y of [...this.topRows, ...this.bottomRows]) {
            for (let c = 0; c < this.columns; c++) {
                pts.push({ x: this.gridOriginX + c * this.cellSize, y });
            }
        }
        return pts;
    },
    mirrorCells(): Array<{ x: number; y: number }> {
        return this.cells().map(p => ({ x: -p.x, y: p.y }));
    },
} as const;

/** 两侧建造区的 x 边界（含半格余量），用于判断某点是否落在己方建造区内 */
export const BUILD_ZONE_X: Record<'red' | 'blue', { min: number; max: number }> = {
    red: { min: BUILD_GRID.gridOriginX - BUILD_GRID.cellSize / 2, max: BUILD_GRID.gridOriginX + BUILD_GRID.columns * BUILD_GRID.cellSize },
    blue: { min: -BUILD_GRID.gridOriginX - BUILD_GRID.columns * BUILD_GRID.cellSize, max: -(BUILD_GRID.gridOriginX - BUILD_GRID.cellSize / 2) },
};

/** 建造区行 y 边界 */
export const BUILD_ZONE_Y: { min: number; max: number } = {
    min: Math.min(...BUILD_GRID.bottomRows) - BUILD_GRID.cellSize / 2,
    max: Math.max(...BUILD_GRID.topRows) + BUILD_GRID.cellSize / 2,
};
