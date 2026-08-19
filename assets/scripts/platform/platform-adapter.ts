/**
 * PlatformAdapter —— 平台适配层
 *
 * 职责：
 *  - 抽象微信/抖音小游戏 API 差异
 *  - 提供统一的平台接口（登录、广告、分享、支付等）
 *  - 运行时自动检测平台类型
 *  - 不导入 cc，可在 Node 环境运行（静默降级）
 */

/** 平台类型 */
export type PlatformType = 'wechat' | 'douyin' | 'web' | 'unknown';

/** 广告类型 */
export type AdType = 'rewarded' | 'banner' | 'interstitial';

/** 广告配置 */
export interface AdConfig {
    rewardedVideoId?: string;
    bannerId?: string;
    interstitialId?: string;
}

/** 分享配置 */
export interface ShareConfig {
    title: string;
    imageUrl?: string;
    query?: string;
}

/** 平台适配器接口 */
export interface IPlatformAdapter {
    /** 获取平台类型 */
    getPlatformType(): PlatformType;

    /** 登录 */
    login(): Promise<{ code: string } | null>;

    /** 获取用户信息 */
    getUserInfo(): Promise<{ nickName: string; avatarUrl: string } | null>;

    /** 显示激励视频广告 */
    showRewardedAd(adId: string): Promise<boolean>;

    /** 显示 Banner 广告 */
    showBanner(adId: string): void;

    /** 隐藏 Banner 广告 */
    hideBanner(): void;

    /** 显示插屏广告 */
    showInterstitial(adId: string): void;

    /** 分享 */
    share(config: ShareConfig): Promise<boolean>;

    /** 振动反馈 */
    vibrateShort(): void;

    /** 振动反馈（长） */
    vibrateLong(): void;

    /** 获取系统信息 */
    getSystemInfo(): { platform: string; screenWidth: number; screenHeight: number };
}

/** 微信小游戏适配器 */
class WechatAdapter implements IPlatformAdapter {
    private wx: any = (globalThis as any).wx;

    getPlatformType(): PlatformType {
        return 'wechat';
    }

    async login(): Promise<{ code: string } | null> {
        if (!this.wx) return null;
        return new Promise((resolve) => {
            this.wx.login({
                success: (res: any) => resolve({ code: res.code }),
                fail: () => resolve(null),
            });
        });
    }

    async getUserInfo(): Promise<{ nickName: string; avatarUrl: string } | null> {
        if (!this.wx) return null;
        return new Promise((resolve) => {
            this.wx.getUserInfo({
                success: (res: any) => resolve({
                    nickName: res.userInfo.nickName,
                    avatarUrl: res.userInfo.avatarUrl,
                }),
                fail: () => resolve(null),
            });
        });
    }

    async showRewardedAd(adId: string): Promise<boolean> {
        if (!this.wx) return false;
        return new Promise((resolve) => {
            const ad = this.wx.createRewardedVideoAd({ adUnitId: adId });
            ad.onClose((res: any) => {
                resolve(res && res.isEnded);
            });
            ad.show().catch(() => {
                ad.load().then(() => ad.show());
            });
        });
    }

    showBanner(adId: string): void {
        if (!this.wx) return;
        const banner = this.wx.createBannerAd({
            adUnitId: adId,
            style: { left: 0, top: 0, width: 320 },
        });
        banner.show();
    }

    hideBanner(): void {
        // Banner 需要保存引用才能隐藏，简化处理
    }

    showInterstitial(adId: string): void {
        if (!this.wx) return;
        const ad = this.wx.createInterstitialAd({ adUnitId: adId });
        ad.show();
    }

    async share(config: ShareConfig): Promise<boolean> {
        if (!this.wx) return false;
        return new Promise((resolve) => {
            this.wx.shareAppMessage({
                title: config.title,
                imageUrl: config.imageUrl,
                query: config.query,
                success: () => resolve(true),
                fail: () => resolve(false),
            });
        });
    }

    vibrateShort(): void {
        if (!this.wx) return;
        this.wx.vibrateShort();
    }

    vibrateLong(): void {
        if (!this.wx) return;
        this.wx.vibrateLong();
    }

    getSystemInfo(): { platform: string; screenWidth: number; screenHeight: number } {
        if (!this.wx) return { platform: 'unknown', screenWidth: 375, screenHeight: 667 };
        const info = this.wx.getSystemInfoSync();
        return {
            platform: info.platform,
            screenWidth: info.screenWidth,
            screenHeight: info.screenHeight,
        };
    }
}

/** 抖音小游戏适配器 */
class DouyinAdapter implements IPlatformAdapter {
    private tt: any = (globalThis as any).tt;

    getPlatformType(): PlatformType {
        return 'douyin';
    }

    async login(): Promise<{ code: string } | null> {
        if (!this.tt) return null;
        return new Promise((resolve) => {
            this.tt.login({
                success: (res: any) => resolve({ code: res.code }),
                fail: () => resolve(null),
            });
        });
    }

    async getUserInfo(): Promise<{ nickName: string; avatarUrl: string } | null> {
        if (!this.tt) return null;
        return new Promise((resolve) => {
            this.tt.getUserInfo({
                success: (res: any) => resolve({
                    nickName: res.userInfo.nickName,
                    avatarUrl: res.userInfo.avatarUrl,
                }),
                fail: () => resolve(null),
            });
        });
    }

    async showRewardedAd(adId: string): Promise<boolean> {
        if (!this.tt) return false;
        return new Promise((resolve) => {
            const ad = this.tt.createRewardedVideoAd({ adUnitId: adId });
            ad.onClose((res: any) => {
                resolve(res && res.isEnded);
            });
            ad.show().catch(() => {
                ad.load().then(() => ad.show());
            });
        });
    }

    showBanner(adId: string): void {
        if (!this.tt) return;
        const banner = this.tt.createBannerAd({
            adUnitId: adId,
            style: { left: 0, top: 0, width: 320 },
        });
        banner.show();
    }

    hideBanner(): void {
        // 简化处理
    }

    showInterstitial(adId: string): void {
        if (!this.tt) return;
        const ad = this.tt.createInterstitialAd({ adUnitId: adId });
        ad.show();
    }

    async share(config: ShareConfig): Promise<boolean> {
        if (!this.tt) return false;
        return new Promise((resolve) => {
            this.tt.shareAppMessage({
                title: config.title,
                imageUrl: config.imageUrl,
                query: config.query,
                success: () => resolve(true),
                fail: () => resolve(false),
            });
        });
    }

    vibrateShort(): void {
        if (!this.tt) return;
        this.tt.vibrateShort();
    }

    vibrateLong(): void {
        if (!this.tt) return;
        this.tt.vibrateLong();
    }

    getSystemInfo(): { platform: string; screenWidth: number; screenHeight: number } {
        if (!this.tt) return { platform: 'unknown', screenWidth: 375, screenHeight: 667 };
        const info = this.tt.getSystemInfoSync();
        return {
            platform: info.platform,
            screenWidth: info.screenWidth,
            screenHeight: info.screenHeight,
        };
    }
}

/** Web 浏览器适配器（开发/测试用） */
class WebAdapter implements IPlatformAdapter {
    getPlatformType(): PlatformType {
        return 'web';
    }

    async login(): Promise<{ code: string } | null> {
        console.log('[WebAdapter] login');
        return { code: 'web_test_code' };
    }

    async getUserInfo(): Promise<{ nickName: string; avatarUrl: string } | null> {
        return { nickName: 'Web用户', avatarUrl: '' };
    }

    async showRewardedAd(_adId: string): Promise<boolean> {
        console.log('[WebAdapter] showRewardedAd (模拟成功)');
        return true; // 开发环境模拟广告成功
    }

    showBanner(_adId: string): void {
        console.log('[WebAdapter] showBanner');
    }

    hideBanner(): void {
        console.log('[WebAdapter] hideBanner');
    }

    showInterstitial(_adId: string): void {
        console.log('[WebAdapter] showInterstitial');
    }

    async share(config: ShareConfig): Promise<boolean> {
        console.log('[WebAdapter] share:', config.title);
        return true;
    }

    vibrateShort(): void {
        // Web 不支持振动
    }

    vibrateLong(): void {
        // Web 不支持振动
    }

    getSystemInfo(): { platform: string; screenWidth: number; screenHeight: number } {
        return {
            platform: 'web',
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
        };
    }
}

/** 未知平台适配器 */
class UnknownAdapter implements IPlatformAdapter {
    getPlatformType(): PlatformType {
        return 'unknown';
    }

    async login(): Promise<{ code: string } | null> { return null; }
    async getUserInfo(): Promise<{ nickName: string; avatarUrl: string } | null> { return null; }
    async showRewardedAd(_adId: string): Promise<boolean> { return false; }
    showBanner(_adId: string): void {}
    hideBanner(): void {}
    showInterstitial(_adId: string): void {}
    async share(_config: ShareConfig): Promise<boolean> { return false; }
    vibrateShort(): void {}
    vibrateLong(): void {}
    getSystemInfo(): { platform: string; screenWidth: number; screenHeight: number } {
        return { platform: 'unknown', screenWidth: 375, screenHeight: 667 };
    }
}

/** 平台管理器（单例） */
export class PlatformManager {
    private static instance: PlatformManager;
    private adapter: IPlatformAdapter;

    private constructor() {
        this.adapter = this.createAdapter();
    }

    static getInstance(): PlatformManager {
        if (!PlatformManager.instance) {
            PlatformManager.instance = new PlatformManager();
        }
        return PlatformManager.instance;
    }

    private createAdapter(): IPlatformAdapter {
        const global = globalThis as any;

        // 检测微信小游戏
        if (global.wx && global.wx.getSystemInfoSync) {
            console.log('[Platform] 检测到微信小游戏环境');
            return new WechatAdapter();
        }

        // 检测抖音小游戏
        if (global.tt && global.tt.getSystemInfoSync) {
            console.log('[Platform] 检测到抖音小游戏环境');
            return new DouyinAdapter();
        }

        // 检测 Web 浏览器
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            console.log('[Platform] 检测到 Web 浏览器环境');
            return new WebAdapter();
        }

        console.log('[Platform] 未知环境');
        return new UnknownAdapter();
    }

    /** 获取平台适配器 */
    getAdapter(): IPlatformAdapter {
        return this.adapter;
    }

    /** 获取平台类型 */
    getPlatformType(): PlatformType {
        return this.adapter.getPlatformType();
    }

    /** 是否为小游戏环境 */
    isMiniGame(): boolean {
        const type = this.getPlatformType();
        return type === 'wechat' || type === 'douyin';
    }
}
