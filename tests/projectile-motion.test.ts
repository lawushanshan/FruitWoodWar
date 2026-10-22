import { describe, expect, it } from 'vitest';
import { projectilePose } from '../assets/scripts/presentation/projectile-motion';

describe('表现层抛物线', () => {
    it('左右投射都精确抵达原命中点，中段抬高且不改变地面坐标', () => {
        for (const dx of [-240, 240]) {
            expect(projectilePose(10, 20, dx, 40, 0, 60)).toMatchObject({ x: 10, y: 20 });
            expect(projectilePose(10, 20, dx, 40, 1, 60)).toMatchObject({ x: 10 + dx, y: 60 });
            expect(projectilePose(10, 20, dx, 40, 0.5, 60)).toMatchObject({ x: 10 + dx / 2, y: 100 });
        }
    });
    it('零高度保持直线，朝向与切线一致', () => {
        expect(projectilePose(0, 0, 100, 0, 0.5)).toEqual({ x: 50, y: 0, angle: 0 });
        expect(projectilePose(0, 0, -100, 0, 0.5).angle).toBe(180);
        expect(projectilePose(0, 0, 100, 0, 0, 50).angle).toBeGreaterThan(0);
        expect(projectilePose(0, 0, 100, 0, 1, 50).angle).toBeLessThan(0);
    });
    it('超出生命周期钳制到端点，重合发射点不产生 NaN', () => {
        expect(projectilePose(0, 0, 100, 0, 2, 50).x).toBe(100);
        expect(projectilePose(0, 0, 0, 0, 0.5).angle).toBe(0);
    });
});
