/**
 * save-system —— 本地最佳战绩存档
 *
 * 职责：
 *  - 保存/读取最佳战绩到 localStorage（仅序列化数据，不保存运行时引用）
 *  - 按阵营 + 难度维度记录最佳（星级最高 → 用时最短 → 击杀最多）
 *  - 存档键：`fww_best_{faction}_{difficulty}`
 *
 * 注意：本模块不导入 cc，可在 Node 环境运行。
 */

import type { FactionId, Difficulty, MatchResult, Side } from './types';

/** 可序列化的战绩摘要 */
export interface SaveRecord {
    winner: Side;
    stars: number;
    duration: number;
    playerGold: number;
    kills: number;
    faction: FactionId;
    difficulty: Difficulty;
    /** 存档时间戳 */
    savedAt: number;
}

const STORAGE_PREFIX = 'fww_best_';

/** 判断新战绩是否优于旧记录 */
export function isBetter(newResult: SaveRecord, old: SaveRecord | null): boolean {
    if (!old) return true;
    // 星级高 → 更好
    if (newResult.stars !== old.stars) return newResult.stars > old.stars;
    // 星级相同：胜利方比失败方好
    if (newResult.winner !== old.winner) return newResult.winner === 'red';
    // 都胜利：用时短更好
    if (newResult.winner === 'red' && old.winner === 'red') {
        if (newResult.duration !== old.duration) return newResult.duration < old.duration;
    }
    // 都失败：击杀多更好
    return newResult.kills > old.kills;
}

/** 保存战绩（仅当优于已有记录时覆盖） */
export function saveBestResult(record: SaveRecord): boolean {
    const key = STORAGE_PREFIX + record.faction + '_' + record.difficulty;
    const old = loadBestResult(record.faction, record.difficulty);
    if (!isBetter(record, old)) return false;

    try {
        localStorage.setItem(key, JSON.stringify(record));
    } catch {
        // localStorage 不可用时静默失败（测试环境等）
    }
    return true;
}

/** 读取某阵营 + 难度的最佳战绩 */
export function loadBestResult(faction: FactionId, difficulty: Difficulty): SaveRecord | null {
    const key = STORAGE_PREFIX + faction + '_' + difficulty;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as SaveRecord;
    } catch {
        return null;
    }
}

/** 从 GameState 构造战绩摘要并保存 */
export function saveFromState(
    result: MatchResult,
    kills: Record<Side, number>,
    faction: FactionId,
    difficulty: Difficulty,
): boolean {
    const record: SaveRecord = {
        winner: result.winner,
        stars: result.stars,
        duration: result.duration,
        playerGold: result.playerGold,
        kills: kills.red,
        faction,
        difficulty,
        savedAt: Date.now(),
    };
    return saveBestResult(record);
}

/** 清除所有存档（调试用） */
export function clearAllSaves() {
    try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
    } catch {
        // 静默失败
    }
}
