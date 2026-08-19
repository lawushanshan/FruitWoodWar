/**
 * AdManager —— 广告管理器
 *
 * 职责：
 *  - 封装激励视频广告的调用逻辑
 *  - 提供失败复活、双倍工资等广告场景
 *  - 记录广告观看状态（每局限制次数）
 *  - 与平台适配层集成
 */

import { PlatformManager } from './platform-adapter';

/** 广告场景 */
export type AdScene = 'revive' | 'double_salary' | 'extra_card';

/** 广告配置（各平台的广告位 ID） */
export const AD_CONFIG = {
    wechat: {
        revive: 'adunit-revive-001',
        double_salary: 'adunit-double-001',
        extra_card: 'adunit-card-001',
    },
    douyin: {
        revive: 'douyin-revive-001',
        double_salary: 'douyin-double-001',
        extra_card: 'douyin-card-001',
    },
    web: {
        revive: 'web-revive',
        double_salary: 'web-double',
        extra_card: 'web-card',
    },
};

/** 广告管理器 */
export class AdManager {
    private static instance: AdManager;

    /** 本局已观看的广告次数（按场景） */
    private watchCount: Record<AdScene, number> = {
        revive: 0,
        double_salary: 0,
        extra_card: 0,
    };

    /** 每局各场景的最大观看次数 */
    private maxCount: Record<AdScene, number> = {
        revive: 1,        // 失败复活最多 1 次
        double_salary: 1, // 双倍工资最多 1 次
        extra_card: 3,    // 额外抽卡最多 3 次
    };

    /** 是否已启用双倍工资（本局） */
    private doubleSalaryEnabled: boolean = false;

    private constructor() {}

    static getInstance(): AdManager {
        if (!AdManager.instance) {
            AdManager.instance = new AdManager();
        }
        return AdManager.instance;
    }

    /** 重置状态（新开局时调用） */
    reset() {
        this.watchCount = { revive: 0, double_salary: 0, extra_card: 0 };
        this.doubleSalaryEnabled = false;
    }

    /** 检查是否可以观看指定场景的广告 */
    canWatch(scene: AdScene): boolean {
        return this.watchCount[scene] < this.maxCount[scene];
    }

    /** 获取剩余可观看次数 */
    getRemainingCount(scene: AdScene): number {
        return Math.max(0, this.maxCount[scene] - this.watchCount[scene]);
    }

    /** 观看激励视频广告 */
    async watchAd(scene: AdScene): Promise<boolean> {
        if (!this.canWatch(scene)) {
            console.log(`[AdManager] ${scene} 已达到最大观看次数`);
            return false;
        }

        const platform = PlatformManager.getInstance();
        const adapter = platform.getAdapter();
        const platformType = platform.getPlatformType();

        // 获取对应平台的广告位 ID
        let adId = '';
        if (platformType === 'wechat') {
            adId = AD_CONFIG.wechat[scene];
        } else if (platformType === 'douyin') {
            adId = AD_CONFIG.douyin[scene];
        } else {
            adId = AD_CONFIG.web[scene];
        }

        // 显示广告
        const success = await adapter.showRewardedAd(adId);

        if (success) {
            this.watchCount[scene]++;
            console.log(`[AdManager] ${scene} 广告观看成功，第 ${this.watchCount[scene]} 次`);

            // 如果是双倍工资广告，标记启用
            if (scene === 'double_salary') {
                this.doubleSalaryEnabled = true;
            }

            // 振动反馈
            adapter.vibrateShort();
        } else {
            console.log(`[AdManager] ${scene} 广告观看失败或未完成`);
        }

        return success;
    }

    /** 是否已启用双倍工资 */
    isDoubleSalaryEnabled(): boolean {
        return this.doubleSalaryEnabled;
    }

    /** 获取各场景的观看次数 */
    getWatchCount(scene: AdScene): number {
        return this.watchCount[scene];
    }

    /** 获取各场景的最大次数 */
    getMaxCount(scene: AdScene): number {
        return this.maxCount[scene];
    }
}
