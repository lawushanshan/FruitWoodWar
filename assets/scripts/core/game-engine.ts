/**
 * 游戏引擎：固定顺序推进一帧，命令入口（M3）
 *
 * 帧顺序：
 * 工资 → 全局波次（兵种快照 + 绝地反击评估 + 卡牌触发）→ 工厂出兵
 * → 单位/塔战斗 → 死亡清理（含死亡爆炸）→ 临时 buff（回血/果雨/衰减）
 * → AI 决策（产出命令走 execute）→ 决战时刻与胜负判定
 *
 * core 不导入 cc；所有随机经 RandomSource 注入。
 */

import { createInitialState } from './game-state';
import { MathRandomSource } from './random';
import type { RandomSource } from './random';
import { stepEconomy } from './systems/economy-system';
import { stepWaveTimer } from './systems/wave-system';
import { stepSpawners } from './systems/spawn-system';
import { stepCombat, cleanupDead } from './systems/combat-system';
import { triggerCardChoiceIfDue, chooseCard, stepTempBuffs } from './systems/card-system';
import { aiDecide, evaluateComeback, snapshotPlayerComposition } from './systems/ai-system';
import { tryBuild, tryResearch, tryUpgrade } from './systems/building-system';
import { stepVictory } from './systems/victory-system';
import type { CommandResult, FxEvent, GameCommand, GameState, Side, StartOptions } from './types';

/** 表现事件队列上限：超过则丢弃最旧的，防止极端情况下队列无限增长 */
const MAX_FX_QUEUE = 1000;

export class GameEngine {
    private _state: GameState;
    readonly random: RandomSource;
    /** 待表现层消费的战斗事件队列（不进 GameState，避免污染确定性序列化） */
    private _fxQueue: FxEvent[] = [];

    constructor(random: RandomSource = new MathRandomSource()) {
        this.random = random;
        // 占位初始状态，正式开局请调用 reset()
        this._state = createInitialState({ playerFaction: 'fruit' });
    }

    /** 只读状态快照（表现层唯一数据来源，禁止直接改写） */
    get state(): Readonly<GameState> {
        return this._state;
    }

    /** 开始/重开一局 */
    reset(options: StartOptions): void {
        this._state = createInitialState(options);
        this._state.phase = 'playing';
        this._fxQueue.length = 0;
    }

    /** 读取并清空本帧累计的战斗表现事件（表现层每帧调用） */
    drainFx(): FxEvent[] {
        if (this._fxQueue.length === 0) return [];
        const out = this._fxQueue;
        this._fxQueue = [];
        return out;
    }

    /** 推进一帧（仅在 playing 阶段生效） */
    step(dt: number): void {
        const s = this._state;
        if (s.phase !== 'playing') return;

        s.time += dt;

        // 1. 工资（含难度收入倍率与绝地反击加成）
        stepEconomy(s, dt);

        // 2. 全局波次：跨波时做兵种快照、反击评估与卡牌触发
        const newWave = stepWaveTimer(s, dt);
        if (newWave !== null) {
            snapshotPlayerComposition(s);
            evaluateComeback(s);
            triggerCardChoiceIfDue(s, this.random);
        }

        // 3. 工厂出兵
        stepSpawners(s, dt, this.random);

        // 4. 战斗（单位 + 防御塔）
        const fx: FxEvent[] = [];
        stepCombat(s, dt, this.random, fx);
        if (fx.length > 0) {
            for (const e of fx) this._fxQueue.push(e);
            while (this._fxQueue.length > MAX_FX_QUEUE) this._fxQueue.shift();
        }

        // 5. 死亡清理（含死亡爆炸结算）
        cleanupDead(s);

        // 6. 临时 buff（回血/果雨生效 + 计时衰减）
        stepTempBuffs(s, dt, this.random);

        // 7. AI 决策：命令统一走 execute 通道（以蓝方身份执行）；联机对战跳过（蓝方为远端玩家）
        if (s.aiEnabled) {
            const cmd = aiDecide(s, this.random);
            if (cmd) this.execute(cmd, 'blue');
        }

        // 8. 决战时刻与胜负判定
        stepVictory(s, dt);
    }

    /** 执行 UI / AI 提交的类型化命令（AI 通过 side 参数复用，见各系统实现） */
    execute(cmd: GameCommand, side: Side = this._state.playerSide): CommandResult {
        switch (cmd.type) {
            case 'build':
                return tryBuild(this._state, cmd.itemId, cmd.position, side);
            case 'upgrade':
                return tryUpgrade(this._state, cmd.buildingId, side);
            case 'research':
                return tryResearch(this._state, side);
            case 'choose-card':
                // side = 选卡方所在边（联机锁步：双方引擎以同一 side 执行同一条命令）
                return chooseCard(this._state, cmd.cardId, this.random, side);
            default:
                return { ok: false };
        }
    }

    /**
     * 复活玩家方水晶（广告激励入口）。
     * 恢复比例的血量并回到 playing 阶段；每局调用次数由表现层的 AdManager 控制。
     */
    revivePlayer(ratio: number = 0.3): boolean {
        const s = this._state;
        if (s.phase !== 'ended') return false;
        const crystal = s.crystals.find(c => c.side === s.playerSide);
        if (!crystal) return false;

        crystal.hp = Math.min(crystal.maxHp, Math.ceil(crystal.maxHp * ratio));
        s.phase = 'playing';
        s.stats.result = null;
        return true;
    }
}
