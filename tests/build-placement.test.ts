import { describe, expect, it } from 'vitest';
import { createInitialState } from '../assets/scripts/core/game-state';
import { cellIsFree, placementCells, snapBuildCell } from '../assets/scripts/input/build-placement';

describe('建造位置预检', () => {
    it('两侧所有格点都可准确吸附，蓝方镜像保持一致', () => {
        for (const side of ['red', 'blue'] as const) {
            for (const cell of placementCells(side)) expect(snapBuildCell(side, cell)).toEqual(cell);
        }
        expect(placementCells('blue')).toEqual(placementCells('red').map(c => ({ x: -c.x, y: c.y })));
    });
    it('拒绝河流、道路、敌方区域及非有限坐标，避免远距离误吸附', () => {
        for (const point of [{ x: 0, y: 100 }, { x: -90, y: 70 }, { x: 90, y: 100 },
            { x: -610, y: 100 }, { x: -90, y: NaN }, { x: Infinity, y: 100 }]) {
            expect(snapBuildCell('red', point)).toBeNull();
        }
    });
    it('允许格内偏移点击', () => {
        expect(snapBuildCell('red', { x: -560, y: 110 })).toEqual({ x: -570, y: 100 });
    });
    it('任何阵营的建筑、塔和水晶都阻挡放置，移除后恢复空闲', () => {
        const state = createInitialState({ playerFaction: 'fruit' });
        const cell = { x: -570, y: 100 };
        expect(cellIsFree(state, cell)).toBe(true);
        state.buildings.push({ id: 'factory', side: 'blue', unitType: 'tank', ...cell,
            hp: 100, maxHp: 100, waveTimer: 20, level: 1 });
        expect(cellIsFree(state, cell)).toBe(false);
        state.buildings = [];
        expect(cellIsFree(state, cell)).toBe(true);
        for (const entity of [...state.towers, ...state.crystals]) expect(cellIsFree(state, entity)).toBe(false);
    });
});
