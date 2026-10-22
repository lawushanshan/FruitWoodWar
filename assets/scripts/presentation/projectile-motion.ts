/** 纯表现轨迹：不会改变战斗结算、命中时间或核心随机源。 */
export function projectilePose(sx: number, sy: number, dx: number, dy: number, progress: number, height = 0) {
    const p = Math.max(0, Math.min(1, progress));
    return {
        x: sx + dx * p,
        y: sy + dy * p + 4 * height * p * (1 - p),
        angle: Math.atan2(dy + 4 * height * (1 - 2 * p), dx) * 180 / Math.PI,
    };
}
