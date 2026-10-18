/** 建造位置校验：纯数据，预览与点击确认使用同一个结果。 */
import { BUILD_GRID } from '../config/build-grid';
import type { GameState, Position, Side } from '../core/types';

export function placementCells(side: Side): Position[] {
    return side === 'red' ? BUILD_GRID.cells() : BUILD_GRID.mirrorCells();
}

export function cellIsFree(state: Readonly<GameState>, cell: Position): boolean {
    const half = BUILD_GRID.cellSize / 2;
    return ![...state.buildings, ...state.towers, ...state.crystals].some(entity =>
        Math.abs(entity.x - cell.x) < half && Math.abs(entity.y - cell.y) < half);
}

export function snapBuildCell(side: Side, point: Position): Position | null {
    // 不把道路、河流和建造区外的点击吸到远处的格子上。
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    let nearest: Position | null = null;
    let distance = Infinity;
    for (const cell of placementCells(side)) {
        if (Math.abs(cell.x - point.x) > 30 || Math.abs(cell.y - point.y) > 25) continue;
        const d = (cell.x - point.x) ** 2 + (cell.y - point.y) ** 2;
        if (d < distance) { nearest = cell; distance = d; }
    }
    return nearest;
}
