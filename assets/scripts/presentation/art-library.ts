/**
 * ArtLibrary —— 美术资源库（M3 美术接入）
 *
 * 职责（07-美术技术方案 §7.2）：
 *  - onLoad 阶段一次性预载 assets/resources/art/ 下全部图片，转成 SpriteFrame 存 Map 缓存
 *  - 提供按资源路径取帧与创建精灵节点的快捷方法
 *  - 资源缺失时优雅降级（返回 null），调用方回退到灰盒色块/emoji 表现
 *
 * 加载方式（Cocos 3.8 关键坑）：
 *  - 本版本的 resources 包只注册 ImageAsset + Texture2D 两种类型，
 *    SpriteFrame 不是可加载的独立路径：loadDir(dir, SpriteFrame) 恒返回 0，
 *    load('.../spriteFrame', SpriteFrame) 报 "Bundle resources doesn't contain ..."。
 *  - 正确做法：resources.load(path, ImageAsset) → SpriteFrame.createWithImage(img)。
 *  - loadDir 返回的 ImageAsset.name 为空字符串，无法按名映射，故改为显式路径清单。
 *
 * 资源路径约定（08-美术操作指南 §1 命名规范）：
 *  - units/u_{faction}_{role}.png、units/hq_{faction}.png
 *  - buildings/b_factory_{role}.png、b_academy.png、b_aura.png、b_tower.png
 *  - fx/fx_*.png、map/map_bg.jpg
 */

import {
    Node, UITransform, Size, Vec2, Sprite, SpriteFrame, ImageAsset, resources,
} from 'cc';

/** 阵营 id（与 08 指南命名规范一致） */
const FACTIONS = ['fruit', 'wood', 'animal'] as const;
/** 兵种定位 id */
const ROLES = ['tank', 'ranged', 'aoe', 'rush', 'siege'] as const;
/** 特效贴图名 */
const FX_NAMES = ['arrow', 'bolt', 'boulder', 'boom', 'debris', 'glow', 'heal', 'ring', 'slash', 'smoke', 'star'] as const;
/** UI 图标名（预留：后续 UI 替换用，缺失不影响玩法） */
const UI_NAMES = [
    'coin', 'hand', 'hp_blue', 'hp_red', 'kill', 'lock', 'pop',
    'rarity_epic', 'rarity_legendary', 'rarity_rare', 'research',
    'settings', 'star', 'time', 'up', 'wave',
] as const;
/** 建造栏图标（建筑图裁切附带，M3.3 建造栏用） */
const BUILD_ICONS = ['tank', 'ranged', 'aoe', 'rush', 'siege', 'academy', 'aura'] as const;
const UI_PANEL_BTN = ['panel_dark', 'panel_light', 'panel_card', 'btn_green', 'btn_blue'] as const;

/** 全部需要预载的图片路径（resources 根相对路径，不含扩展名） */
function buildArtPaths(): string[] {
    const paths: string[] = [];
    // 15 兵种 + 3 大本营
    for (const f of FACTIONS) {
        for (const r of ROLES) paths.push(`art/units/u_${f}_${r}`);
        paths.push(`art/units/hq_${f}`);
    }
    // 8 建筑
    for (const r of ROLES) paths.push(`art/buildings/b_factory_${r}`);
    paths.push('art/buildings/b_academy', 'art/buildings/b_aura', 'art/buildings/b_tower');
    // 11 特效
    for (const n of FX_NAMES) paths.push(`art/fx/fx_${n}`);
    // 地图底图
    paths.push('art/map/map_bg');
    // UI 图标（预留）
    for (const n of UI_NAMES) paths.push(`art/ui/ico_${n}`);
    for (const n of BUILD_ICONS) paths.push(`art/ui/ico_build_${n}`);
    for (const n of UI_PANEL_BTN) paths.push(`art/ui/ui_${n}`);
    return paths;
}

export class ArtLibrary {

    /** 路径（如 units/u_fruit_tank）→ SpriteFrame */
    private frames = new Map<string, SpriteFrame>();
    /** 节点默认 layer */
    private layer = 0;
    /** 预载完成标记 */
    private loaded = false;

    setLayer(layer: number) {
        this.layer = layer;
    }

    /** 是否已完成预载 */
    isLoaded(): boolean {
        return this.loaded;
    }

    /**
     * 预载全部美术图片（并行，逐条显式加载）。
     * 任一资源失败只打警告不抛出——对应类别自动走灰盒兜底。
     */
    preload(): Promise<void> {
        const paths = buildArtPaths();
        const tasks = paths.map(path =>
            new Promise<void>(resolve => {
                resources.load(path, ImageAsset, (err, img) => {
                    if (err || !img) {
                        console.warn(`[ArtLibrary] 预载 ${path} 失败（该资源回退灰盒表现）:`, (err as any)?.message ?? err);
                        resolve();
                        return;
                    }
                    try {
                        const sf = SpriteFrame.createWithImage(img);
                        // 缓存键 = 去掉 art/ 前缀（与 07 方案 §7.2 的资源路径映射一致）
                        const key = path.slice('art/'.length);
                        this.frames.set(key, sf);
                    } catch (e) {
                        console.warn(`[ArtLibrary] 转换 SpriteFrame 失败 ${path}:`, e);
                    }
                    resolve();
                });
            }),
        );
        return Promise.all(tasks).then(() => {
            this.loaded = true;
            console.log(`[ArtLibrary] 预载完成：${this.frames.size}/${paths.length} 张 SpriteFrame`);
        });
    }

    /** 按路径取帧（如 'units/u_fruit_tank'），缺失返回 null */
    get(path: string): SpriteFrame | null {
        return this.frames.get(path) ?? null;
    }

    has(path: string): boolean {
        return this.frames.has(path);
    }

    /**
     * 创建显示尺寸为 w×h 的精灵节点（CUSTOM sizeMode，纹理等比缩放到目标尺寸）。
     * 资源缺失返回 null，由调用方决定兜底表现。
     */
    createSpriteNode(path: string, w: number, h: number): Node | null {
        const sf = this.get(path);
        if (!sf) return null;
        const node = new Node(path.replace('/', '_'));
        node.layer = this.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(w, h);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const sprite = node.addComponent(Sprite);
        // 与 ColorSpriteFactory 相同的坑位防御：先固定 sizeMode 再挂帧，
        // 避免 RAW 模式赋值时节点被重置为纹理原始尺寸
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.spriteFrame = sf;
        ut.contentSize = new Size(w, h);
        return node;
    }

    /**
     * 创建九宫格（SLICED）面板底板节点：拉伸到 w×h，边框按 inset 固定不拉伸。
     * 用于 ui_panel_* 面板底板（08 指南 §8.1）。资源缺失返回 null。
     */
    createPanelNode(path: string, w: number, h: number, inset = 40): Node | null {
        const sf = this.get(path);
        if (!sf) return null;
        // 九宫格边框：四边 inset 固定，中间区域拉伸（一张 256×256 适配任意尺寸面板）
        sf.insetLeft = inset;
        sf.insetRight = inset;
        sf.insetTop = inset;
        sf.insetBottom = inset;

        const node = new Node(path.replace('/', '_') + '_panel');
        node.layer = this.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(w, h);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SLICED;
        sprite.spriteFrame = sf;
        ut.contentSize = new Size(w, h);
        return node;
    }
}
