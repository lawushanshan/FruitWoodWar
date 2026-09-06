/**
 * 架构守卫测试（04-架构设计 §11 技术债务 D4）
 *
 * 守卫两条架构红线：
 * 1. core/** 零 cc 导入 —— 核心模拟层必须可在纯 Node 环境运行
 *    （批量平衡模拟 / 单元测试 / 联机服务器复用均依赖此约束）；
 * 2. GameManager.ts 行数不超过上限 —— 表现层适配器防再度膨胀
 *    （拆分方案见债务 D1，上限逐次收紧）。
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// 项目根目录（vitest 固定从项目根运行）
const ROOT = process.cwd();
const CORE_DIR = join(ROOT, 'assets', 'scripts', 'core');
const GAME_MANAGER = join(ROOT, 'assets', 'scripts', 'GameManager.ts');

/** GameManager 行数上限（随 D1 拆分进度逐次收紧） */
const GAME_MANAGER_MAX_LINES = 1500;

/** 递归收集目录下全部 .ts 文件路径 */
function collectTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...collectTsFiles(full));
        } else if (entry.name.endsWith('.ts')) {
            out.push(full);
        }
    }
    return out;
}

describe('架构守卫（04-架构设计 §11 D4）', () => {
    it('core/** 零 cc 导入：核心层不得依赖 Cocos 引擎', () => {
        const offenders: string[] = [];
        for (const file of collectTsFiles(CORE_DIR)) {
            const src = readFileSync(file, 'utf-8');
            if (/from\s+['"]cc['"]/.test(src)) {
                offenders.push(file);
            }
        }
        expect(offenders).toEqual([]);
    });

    it(`GameManager.ts 行数 ≤ ${GAME_MANAGER_MAX_LINES}（防表现层适配器膨胀）`, () => {
        const src = readFileSync(GAME_MANAGER, 'utf-8');
        // 与 wc -l 口径一致：末尾换行不计作第 N+1 行
        const lineCount = src.split('\n').length - (src.endsWith('\n') ? 1 : 0);
        expect(lineCount).toBeLessThanOrEqual(GAME_MANAGER_MAX_LINES);
    });
});
