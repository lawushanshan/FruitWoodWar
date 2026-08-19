/**
 * 可注入随机源（M1）
 *
 * 模拟核心所有随机行为必须通过 RandomSource 获取，
 * 以支持固定种子测试与未来回放。禁止在 core 内直接使用 Math.random。
 */

export interface RandomSource {
    /** 返回 [0, 1) 区间随机数 */
    next(): number;
    /** 返回 [min, max) 区间随机浮点数 */
    range(min: number, max: number): number;
    /** 返回 [0, maxExclusive) 区间随机整数 */
    int(maxExclusive: number): number;
}

/** 默认随机源：直接包装 Math.random */
export class MathRandomSource implements RandomSource {
    next(): number {
        return Math.random();
    }
    range(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
    int(maxExclusive: number): number {
        return Math.floor(Math.random() * maxExclusive);
    }
}

/**
 * 固定种子随机源（mulberry32 算法）
 * 相同种子产生相同随机序列，用于测试和回放。
 */
export class SeededRandomSource implements RandomSource {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed >>> 0;
    }

    next(): number {
        this.seed = (this.seed + 0x6d2b79f5) >>> 0;
        let t = this.seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    int(maxExclusive: number): number {
        return Math.floor(this.next() * maxExclusive);
    }
}
