/**
 * game-commands —— UI 输入到类型化命令的转换层
 *
 * 职责：
 *  - 将 UI 事件（按钮点击、触控）转换为 GameCommand
 *  - 建造命令支持两种模式：
 *    1. 指定位置（玩家放置模式）
 *    2. 随机位置（AI 建造 / 灰盒兼容）
 *  - 不包含游戏逻辑判断，只做输入适配
 */

import type { BuildingItemId, GameCommand, GameState, Position } from '../core/types';

/**
 * 将建造操作转换为 build 命令。
 * @param itemId  建筑类型
 * @param state   当前游戏状态
 * @param pos     用户指定的位置（放置模式），不传则随机生成
 */
export function makeBuildCommand(
    itemId: BuildingItemId,
    state: GameState,
    pos?: Position,
): GameCommand {
    const position = pos ?? {
        // 灰盒兜底：己方区域随机摆放
        x: -350 + Math.random() * 100,
        y: -50 + Math.random() * 60 - 30,
    };
    return { type: 'build', itemId, position };
}

/** 将升级按钮点击转换为 upgrade 命令（自动选最低等级工厂） */
export function makeUpgradeCommand(state: GameState): GameCommand | null {
    const candidates = state.buildings
        .filter(b => b.side === state.playerSide && b.unitType !== null && b.level < 3)
        .sort((a, b) => a.level - b.level);
    if (candidates.length === 0) return null;
    return { type: 'upgrade', buildingId: candidates[0].id };
}

/** 将科研按钮点击转换为 research 命令 */
export function makeResearchCommand(): GameCommand {
    return { type: 'research' };
}

/** 将卡牌选择点击转换为 choose-card 命令 */
export function makeCardCommand(cardId: string): GameCommand {
    return { type: 'choose-card', cardId };
}
