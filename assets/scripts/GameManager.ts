/**
 * GameManager —— 表现层适配器（架构回归版，v1.1.0）
 *
 * 职责：Cocos 生命周期编排 + 模块装配 + 事件路由 + 网格放置模式 + 表现效果。
 * 所有游戏规则由 core/GameEngine 执行，本文件不直接修改游戏数据。
 * 视觉由 GameView / HudView / PanelController 负责，本类只做装配与转发。
 *
 * v1.1.0 合并远程单体演进：
 * - 建造升级为网格 + 预览交互（v0.5.0）：格点吸附、红绿反馈、网格底图、ESC 取消
 * - 帧异常隔离：gameStep 内异常跳帧，不冻结胜负判定与渲染
 * - 卡牌选择倒计时：超时自动选第一张，防止选卡暂停导致假死
 * - 点击己方工厂打开升级面板（星标 / 学院提示提前 / 满级隐藏）
 */

import {
    _decorator, Component, Node, Color, UITransform, Size, Vec2, Vec3,
    Camera, EventTouch, EventMouse, Input, input, Layers, director, Sprite, sys,
} from 'cc';
import { GameEngine } from './core/game-engine';
import { ColorSpriteFactory } from './presentation/color-sprite-factory';
import { ArtLibrary } from './presentation/art-library';
import { GameView } from './presentation/game-view';
import { HudView } from './presentation/hud-view';
import { PanelController } from './presentation/panel-controller';
import { FloatingText } from './presentation/floating-text';
import { DeathEffect } from './presentation/death-effect';
import { AudioManager } from './presentation/audio-manager';
import { TutorialController } from './presentation/tutorial-controller';
import { BattleEffects } from './presentation/battle-effects';
import { EntityInfoPanel } from './presentation/entity-info-panel';
import { makeBuildCommand, makeUpgradeCommand, makeResearchCommand, makeShieldCommand, makeCardCommand } from './input/game-commands';
import { BUILDING_CONFIG } from './config/building-config';
import { BUILD_GRID } from './config/build-grid';
import { MAP_LAYOUT } from './config/map-layout';
import { saveFromState } from './core/save-system';
import { AdManager } from './platform/ad-manager';
import { NetworkClient } from './network/network-client';
import { SeededRandomSource } from './core/random';
import { stateHash } from './core/state-hash';
import type { ServerMessage } from './network/protocol';
import { HASH_EVERY_FRAMES } from './network/protocol';
import type { BuildingItemId, Phase } from './core/types';

const { ccclass } = _decorator;

/** 固定逻辑步长（秒）：模拟帧率与渲染帧率解耦（联机确定性前提） */
const FIXED_LOGIC_DT = 1 / 30;

/** 静音偏好 localStorage 键（'1' = 静音） */
const MUTED_PREF_KEY = 'fww_muted';

@ccclass('GameManager')
export class GameManager extends Component {

    /** 模拟核心 */
    private engine: GameEngine = new GameEngine();
    private prevPhase: Phase = 'idle';
    /** 固定逻辑步长累加器（联机 P0-S1） */
    private logicAccumulator = 0;

    // ---- 联机对战（P1） ----
    private net: NetworkClient | null = null;
    private online = false;
    /** 联机对局已收到服务器终局（本地模拟冻结，防结算面板背后继续打架） */
    private onlineEnded = false;
    private mySide: 'red' | 'blue' = 'red';
    /** 服务器帧号（联机模式由 frame 消息驱动） */
    private onlineFrame = 0;
    private lastHashReportFrame = 0;
    private roomCode: string | null = null;

    /** 表现层模块 */
    private gameView!: GameView;
    private hudView!: HudView;
    private panels!: PanelController;
    private spriteFactory!: ColorSpriteFactory;
    /** 美术资源库（M3：Q 版立绘/地图底图，预载完成后生效） */
    private artLibrary: ArtLibrary = new ArtLibrary();
    private floatingText!: FloatingText;
    private deathEffect!: DeathEffect;
    private audio!: AudioManager;
    private tutorial!: TutorialController;
    private battleEffects!: BattleEffects;
    private entityInfo!: EntityInfoPanel;

    /** 游戏容器 */
    private gameContainer!: Node;

    // ---- 放置模式（网格 + 预览，v0.5.0） ----
    private pendingBuild: BuildingItemId | null = null;
    private previewNode: Node | null = null;
    private previewBg: Sprite | null = null;
    /** 预览当前吸附的格点与合法性 */
    private previewCell: { x: number; y: number } | null = null;
    private previewValid = false;
    /** 网格底图节点（建造模式显示） */
    private gridOverlayNode: Node | null = null;

    // ---- 移动端长按拖拽建造（v1.5.0） ----
    /** 触摸是否已按住（TOUCH_START 后为真） */
    private touchHeld = false;
    /** 按住累计时长（秒）：达到长按阈值后才允许放置，防误触 */
    private touchHoldTime = 0;
    /** 长按判定阈值（秒） */
    private static readonly TOUCH_HOLD_THRESHOLD = 0.25;
    /**
     * 是否要求长按放置：移动端/小游戏（真实触摸设备）为 true，PC 为 false。
     * 用平台判定而非事件时序猜测——PC 浏览器把鼠标点击合成为触摸事件，
     * 事件派发顺序与时间窗口在不同版本上不可靠（v1.5.1 的教训）。
     */
    private static readonly REQUIRE_HOLD = sys.isMobile
        || sys.platform === sys.Platform.WECHAT_GAME
        || sys.platform === sys.Platform.BYTEDANCE_MINI_GAME;

    // ---- 状态追踪（用于检测事件触发表现效果） ----
    /** 上一帧单位快照（id → 位置/阵营/兵种），用于死亡弹飞与出兵脉冲的准确定位 */
    private prevUnits: Map<string, { x: number; y: number; side: string; type: string }> = new Map();
    /** 上一帧建筑快照（id → 位置/阵营），用于被毁爆炸的准确定位 */
    private prevBuildingIds: Map<string, { x: number; y: number }> = new Map();
    /** 上一帧单位攻击冷却（id → atkCd），冷却重置检测攻击瞬间 */
    private prevAtkCd: Map<string, number> = new Map();
    private prevGold: Record<string, number> = { red: 0, blue: 0 };
    private prevCrystalHp: Record<string, number> = { red: 0, blue: 0 };
    private prevKills: Record<string, number> = { red: 0, blue: 0 };
    /** 上一帧建筑/塔血量（id → hp），受击伤害跳字用（对齐水晶反馈） */
    private prevBuildingHp: Map<string, number> = new Map();
    private prevTowerHp: Map<string, number> = new Map();
    private prevBuildings: number = 0;

    // ==================== 生命周期 ====================

    onLoad() {
        // 层修正：本节点由编辑器创建（DEFAULT 层），但 UI 相机只渲染 UI_2D 层。
        // 统一在初始化最前面修正，所有动态创建的子节点都从本节点继承正确层级。
        this.node.layer = Layers.Enum.UI_2D;

        if (!this.node.getComponent(UITransform)) {
            const ut = this.node.addComponent(UITransform);
            ut.contentSize = new Size(1280, 720);
            ut.anchorPoint = new Vec2(0.5, 0.5);
        }

        // 查找 UI 相机：本节点 → 子树 → 整个场景，都没有才兜底创建
        const existingCam = this.node.getComponent(Camera)
            ?? this.node.getComponentInChildren(Camera)
            ?? director.getScene()?.getComponentInChildren(Camera)
            ?? null;
        if (existingCam) {
            // 兜底修正编辑器场景中可能错配的参数（M6 预览黑屏修复）
            if ((existingCam as any).targetTexture !== null && (existingCam as any).targetTexture !== undefined) {
                console.log('[GameManager] 清理 UI 相机上残留的 TargetTexture');
                (existingCam as any).targetTexture = null;
            }
            if (!(existingCam.visibility & Layers.Enum.UI_2D)) {
                existingCam.visibility |= Layers.Enum.UI_2D;
            }
            // 2D UI 游戏：UI 相机负责把画面刷成游戏背景色（否则会透出编辑器模板
            // 自带的 Main Camera 灰 #333 清屏，导致整个游戏画布黑屏/灰屏）
            const COLOR_DEPTH = 6; // COLOR | DEPTH，清色
            if (existingCam.clearFlags !== COLOR_DEPTH) {
                console.log(`[GameManager] 修正 UI 相机 ClearFlags ${existingCam.clearFlags} -> ${COLOR_DEPTH}`);
                existingCam.clearFlags = COLOR_DEPTH;
            }
            if (existingCam.projection !== 0) {
                existingCam.projection = 0;
            }
            // 禁用场景里其它占位相机（如编辑器模板的 3D 'Main Camera'）。
            // 2D UI 项目只需要 UI 相机，多出来的相机会以 priority=0 用灰白清屏抢占背景。
            const scene = director.getScene();
            if (scene) {
                const disableOthers = (node: Node) => {
                    for (const n of node.children) {
                        const cam = n.getComponent(Camera);
                        if (cam && cam !== existingCam) {
                            console.log(`[GameManager] 禁用多余相机节点: ${n.name}`);
                            n.active = false;
                        }
                        disableOthers(n);
                    }
                    const selfCam = node.getComponent(Camera);
                    if (selfCam && selfCam !== existingCam) {
                        node.active = false;
                    }
                };
                disableOthers(scene);
            }
        } else {
            console.log('[GameManager] 未找到相机，创建兜底 UICamera');
            const camNode = new Node('UICamera');
            camNode.layer = Layers.Enum.UI_2D;
            camNode.parent = this.node;
            const cam = camNode.addComponent(Camera);
            cam.projection = 0;
            cam.orthoHeight = 360;
            cam.priority = 0;
            cam.visibility = Layers.Enum.UI_2D;
            cam.clearColor = new Color(13, 20, 24, 255);
            cam.clearFlags = 6; // COLOR | DEPTH（唯一相机需刷背景）
        }

        // 创建容器（挂在 Canvas 下，绝不能挂 Camera 子树，否则整体落在近裁剪面前被裁掉）
        const uiRoot: Node = this.node.parent ?? this.node;
        if (uiRoot !== this.node) {
            uiRoot.layer = this.node.layer;
        }
        this.gameContainer = this.createContainer('GameContainer');
        uiRoot.addChild(this.gameContainer);
        const uiContainer = this.createContainer('UIContainer');
        uiRoot.addChild(uiContainer);

        // 战场背景
        const sf = new ColorSpriteFactory();
        sf.setLayer(this.node.layer);
        this.spriteFactory = sf;
        this.artLibrary.setLayer(this.node.layer);
        const bg = sf.createColorNode(new Color(13, 20, 24), 1280, 720);
        bg.parent = this.gameContainer;
        // M3.2 地图底图：预载完成后用草地底图替换纯色背景（置于容器最底层，
        // 河/道路/桥仍由程序绘制在上层——位置必须与逻辑常量精确对齐，AI 画不准）
        this.artLibrary.preload().then(() => {
            const mapNode = this.artLibrary.createSpriteNode('map/map_bg', 1280, 720);
            if (mapNode) {
                mapNode.name = 'MapBg';
                mapNode.parent = this.gameContainer;
                mapNode.setSiblingIndex(0); // 压到纯色背景之下
                bg.destroy(); // 底图就位后纯色背景不再需要
            }
            // 预载完成后把 HUD 里已按 emoji 兜底创建的图标升级为贴图
            this.hudView?.refreshIcons();
            // 预载完成后把面板里已按纯色兜底创建的底板升级为九宫格贴图
            this.panels?.refreshPanels();
        });

        // 河（楚河汉界）：沿 y 轴贯穿全场，唯一通道是中央道路（桥）
        const river = sf.createColorNode(
            new Color(28, 56, 96),
            MAP_LAYOUT.riverHalfWidth * 2,
            MAP_LAYOUT.riverHalfLength * 2,
        );
        river.name = 'River';
        river.parent = this.gameContainer;
        river.setPosition(MAP_LAYOUT.riverCenterX, 0, 0);
        // 河岸描边
        const bankColor = new Color(70, 96, 120);
        for (const bankX of [MAP_LAYOUT.riverHalfWidth, -MAP_LAYOUT.riverHalfWidth]) {
            const bank = sf.createColorNode(bankColor, 4, MAP_LAYOUT.riverHalfLength * 2);
            bank.name = 'RiverBank';
            bank.parent = this.gameContainer;
            bank.setPosition(bankX, 0, 0);
        }

        // 战斗道路：沿 x 轴居中（y=0，高 140），与 ±100 起的网格行互不重叠；
        // 盖在河上方形成"桥"
        const lane = sf.createColorNode(
            new Color(52, 62, 46),
            1280,
            MAP_LAYOUT.roadHalfHeight * 2,
        );
        lane.name = 'BattleRoad';
        lane.parent = this.gameContainer;
        lane.setPosition(0, MAP_LAYOUT.roadCenterY, 0);

        // 地图装饰：双方建造区域高亮（对齐网格：x ±90~570，行 y ±100~±250）
        // 建造区高亮：上/下两区各一块（行 ±100~±250，与网格对称，v1.4.3 修复下半场缺高亮）
        for (const zoneY of [175, -175]) {
            const redZone = sf.createColorNode(new Color(120, 40, 40, 45), 500, 180);
            redZone.name = 'RedBuildZone';
            redZone.parent = this.gameContainer;
            redZone.setPosition(-330, zoneY, 0);
            const blueZone = sf.createColorNode(new Color(40, 70, 140, 45), 500, 180);
            blueZone.name = 'BlueBuildZone';
            blueZone.parent = this.gameContainer;
            blueZone.setPosition(330, zoneY, 0);
        }

        // 初始化表现层模块（GameView 注入美术资源库：立绘可用时替换灰盒色块）
        this.gameView = new GameView(this.gameContainer, sf, this.artLibrary);
        this.hudView = new HudView(uiContainer, sf, this.node, this.artLibrary);
        this.panels = new PanelController(uiContainer, sf, this.node, this.artLibrary);
        this.floatingText = new FloatingText(this.gameContainer, this.node.layer);
        this.deathEffect = new DeathEffect(this.gameContainer, sf);
        this.audio = new AudioManager();
        this.tutorial = new TutorialController(uiContainer, sf, this.node.layer, this.artLibrary);
        this.battleEffects = new BattleEffects(this.gameContainer, sf, this.artLibrary);
        this.entityInfo = new EntityInfoPanel(uiContainer, this.gameContainer, sf, this.artLibrary, this.node);
        this.hudView.create();
        this.panels.create();

        // 战场触摸事件（网格放置 + 点建筑升级）
        this.gameContainer.on(Node.EventType.TOUCH_START, this.onGameTouchStart, this);
        this.gameContainer.on(Node.EventType.TOUCH_END, this.onGameTouch, this);
        this.gameContainer.on(Node.EventType.TOUCH_MOVE, this.onGameTouchMove, this);
        this.gameContainer.on(Node.EventType.TOUCH_CANCEL, this.onGameTouchCancel, this);
        // PC 右键取消建造：Node 上无稳定右键事件名，用全局 MOUSE_DOWN + getButton 判定
        input.on(Input.EventType.MOUSE_DOWN, this.onGlobalMouseDown, this);
        // ESC 取消建造模式
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    start() {
        this.panels.showStart();
        // 页面刷新恢复：若 sessionStorage 里有重连凭证，尝试找回对局
        this.tryRejoinFromStorage();
    }

    /** 刷新/崩溃后恢复：有凭证则连服务器 rejoin，成功后直接回到对局 */
    private tryRejoinFromStorage() {
        let token = '';
        try { token = sessionStorage.getItem('fww_rejoin') ?? ''; } catch { return; }
        if (!token) return;
        this.rejoinToken = token;
        this.rejoining = true;
        this.panels.showToast('检测到未完成的对局，正在恢复…', 8000);
        this.ensureNet();
        // onOpen 回调里会自动发 rejoin（见 ensureNet 的 rejoining 分支）
        // 兜底：超时仍未恢复（对局已结束/服务器不可达）则清凭证、断开连接回开始面板。
        // 必须真正 close：否则 NetworkClient 无限退避重连、消息队列持续堆积
        //（实测缺陷：retries 可涨到 13+ 且 ws 永远 null，建房命令全部卡死）
        setTimeout(() => {
            if (this.rejoining) {
                this.rejoining = false;
                this.rejoinToken = null;
                try { sessionStorage.removeItem('fww_rejoin'); } catch { /* */ }
                this.net?.close();
                this.net = null;
                this.panels.showToast('对局已结束或无法恢复');
            }
        }, 12_000);
    }

    onDestroy() {
        input.off(Input.EventType.MOUSE_DOWN, this.onGlobalMouseDown, this);
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        this.stopPingLoop();
    }

    /** 命令入口统一守卫：模拟未开始/已结束，或联机对局已被服务器判定结束 */
    private canAct(): boolean {
        return this.engine.state.phase === 'playing' && !this.onlineEnded;
    }

    update(dt: number) {
        // 长按计时：触摸按住期间累计，达到阈值后松手才允许放置（移动端防误触）
        if (this.touchHeld) this.touchHoldTime += dt;

        // 卡牌倒计时在所有阶段推进（选卡暂停期间也要倒计时，防止假死）
        this.panels.updateCardCountdown(dt, () => {
            const s = this.engine.state;
            if (s.phase === 'card-pause' && s.cards.offers.length > 0) {
                // 联机：自动选卡同样经服务器定序（保证双端一致）
                if (this.online) { this.submitOnline(makeCardCommand(s.cards.offers[0].id)); return; }
                this.engine.execute(makeCardCommand(s.cards.offers[0].id));
            }
        });

        if (this.engine.state.phase === 'playing' && !this.online && !this.onlineEnded) {
            // 固定逻辑步长（联机 P0-S1）：渲染 dt 经累加器切成固定 1/30s 逻辑帧，
            // 帧率波动不再影响模拟结果（确定性前提），残余不足一步的量留到下一帧。
            // 单帧上限 0.25s：切后台回来不做长追帧，防止一次性结算大量逻辑。
            // 联机模式不走此路径：由服务器 frame 消息驱动（见 onNetMessage）。
            // 单帧上限 0.25s：切后台回来不做长追帧，防止一次性结算大量逻辑。
            this.logicAccumulator += Math.min(dt, 0.25);
            let steps = 0;
            while (this.logicAccumulator >= FIXED_LOGIC_DT && steps < 12) {
                try {
                    this.engine.step(FIXED_LOGIC_DT);
                } catch (e) {
                    console.error('[GameEngine.step] 帧内异常（已跳过该帧）:', e);
                }
                this.logicAccumulator -= FIXED_LOGIC_DT;
                steps++;
                // 模拟中进入暂停/结束（如选卡）时立刻停止追帧
                if (this.engine.state.phase !== 'playing') break;
            }
        } else {
            this.logicAccumulator = 0;
        }
        // 联机模式的视觉同步照常每帧执行（模拟步进由帧消息驱动）

        const phase = this.engine.state.phase;
        if (phase !== this.prevPhase) {
            if (phase === 'card-pause') this.panels.showCards(this.engine.state);
            else if (phase === 'playing' && this.prevPhase === 'card-pause') this.panels.hideCards();
            else if (phase === 'ended') {
                const canRevive = AdManager.getInstance().canWatch('revive');
                this.panels.showEnd(this.engine.state, canRevive);
                this.onGameEnd();
                // 联机模式：本地模拟出胜负后上报服务器，由服务器广播权威 result
                // （否则服务器永远不知道水晶被拆，房间只能靠 10 分钟空转超时才结束）
                if (this.online && this.net) {
                    const winner = this.engine.state.stats.result?.winner;
                    if (winner) this.net.send({ t: 'game_end', winner });
                }
            }
            this.prevPhase = phase;
        }

        if (phase === 'playing') {
            this.detectEffects();
            this.consumeFx();
            this.detectTutorial();
            this.entityInfo.update(this.engine.state, dt);
            this.gameView.sync(this.engine.state, dt, this.online);
            this.hudView.update(this.engine.state);
            this.floatingText.update(dt);
            this.deathEffect.update(dt);
            this.battleEffects.update(dt);
            this.tutorial.update(dt);
            this.panels.refreshUpgrade(this.engine.state);
        }
    }

    /** 消费引擎结算出的战斗表现事件，路由到对应特效（07 方案 §6.1 五定位攻击签名） */
    private consumeFx() {
        const fx = this.engine.drainFx();
        if (fx.length === 0) return;
        for (const e of fx) {
            if (e.type === 'hit') {
                // 按攻击者定位差异化（缺 sx 的旧事件回退通用命中表现）
                const sx = e.sx ?? e.x, sy = e.sy ?? e.y;
                switch (e.atkType) {
                    case 'tank':
                        // 重击感：攻击者冲锋突进 + 命中爆闪 + 碎石迸溅
                        if (e.uid) this.gameView.playMeleeLunge(e.uid, sx, sy, e.x, e.y);
                        this.battleEffects.playImpact(e.x, e.y, e.side);
                        this.battleEffects.playDebrisBurst(e.x, e.y, 3);
                        break;
                    case 'rush':
                        // 突进感：攻击者冲锋突进 + 斩击弧光 + 轻命中
                        if (e.uid) this.gameView.playMeleeLunge(e.uid, sx, sy, e.x, e.y);
                        this.battleEffects.playSlash(e.x, e.y, e.side);
                        this.battleEffects.playImpact(e.x, e.y, e.side);
                        break;
                    case 'ranged':
                        // 轻快感：细箭（18px，贴合肥身比例）+ 小命中
                        this.battleEffects.playProjectile(sx, sy, e.x, e.y, e.side, 'fx/fx_arrow', 0.09, 18);
                        this.battleEffects.playImpact(e.x, e.y, e.side);
                        break;
                    case 'aoe':
                        // 法球（30px 辉光球）飞抵，落点爆光由 aoe 事件在弹道落地后补
                        this.battleEffects.playProjectile(sx, sy, e.x, e.y, e.side, 'fx/fx_bolt', 0.22, 30);
                        break;
                    case 'siege':
                        // 笨重感：慢速巨石（40px，与 30px 单位成比例）+ 命中闪光 + 落地碎石
                        this.battleEffects.playProjectile(sx, sy, e.x, e.y, e.side, 'fx/fx_boulder', 0.3, 40);
                        this.battleEffects.playImpact(e.x, e.y, e.side);
                        this.battleEffects.playDebrisBurst(e.x, e.y, 4);
                        break;
                    default:
                        this.battleEffects.playImpact(e.x, e.y, e.side);
                }
            } else if (e.type === 'aoe') {
                // AOE 落点：等法球(0.22s)飞抵后再爆闪+范围环，保持"弹道落地才炸"的同步感。
                // 最佳实践：亮核（爆闪 = 伤害半径×0.7）+ 细环（范围提示）两层分工，不再各自放大
                this.battleEffects.schedule(0.22, () => {
                    this.battleEffects.playRangeEffect(e.x, e.y, e.radius, e.side);
                    this.battleEffects.playBoom(e.x, e.y, e.radius * 0.7);
                });
            } else if (e.type === 'tower') {
                // 塔攻击：弹道飞抵(0.12s)后目标处溅射环，保持同步
                this.battleEffects.playProjectile(e.sx, e.sy, e.x, e.y, e.side);
                this.battleEffects.schedule(0.12, () => {
                    this.battleEffects.playRangeEffect(e.x, e.y, e.radius, e.side);
                });
            }
        }
    }

    /** 检测引导进度（首局玩家建造工厂/出兵） */
    private detectTutorial() {
        const s = this.engine.state;
        if (!this.tutorial.isActive()) return;

        const currentBuildings = s.buildings.filter(b => b.side === s.playerSide).length;
        if (currentBuildings > 0 && this.prevBuildings === 0) {
            this.tutorial.onFactoryBuilt();
        }
        this.prevBuildings = currentBuildings;

        // 出兵完成判定：己方工厂已建且场上存在己方存活单位（兼容建厂晚于第 1 波的情况）
        if (currentBuildings > 0 && s.units.some(u => u.side === s.playerSide && u.hp > 0)) {
            this.tutorial.onFirstWaveSpawned();
        }
    }

    // ==================== 表现效果检测 ====================

    /** 每帧检测状态变化，触发对应的视觉/音效表现（基于上一帧实体快照精确定位） */
    private detectEffects() {
        const s = this.engine.state;

        // 单位 id 索引（O(n) 构建，替代死亡检测里逐个 find 的 O(n²) 扫描）
        const unitsById = new Map(s.units.map(u => [u.id, u]));

        // ---- 单位事件（遍历快照，位置精确） ----
        for (const [id, snap] of this.prevUnits) {
            if (!unitsById.has(id)) {
                const color = snap.side === 'red'
                    ? new Color(255, 150, 150, 180)
                    : new Color(150, 200, 255, 180);
                this.deathEffect.play(snap.x, snap.y, color, 'circle', 12);
            }
        }

        for (const u of s.units) {
            const snap = this.prevUnits.get(u.id);

            const prevCd = this.prevAtkCd.get(u.id) ?? 0;
            if (snap && u.atkCd > prevCd + 0.1 && u.atkCd > 0.15) {
                this.battleEffects.playAttackFlash(u.x, u.y);
            }
            this.prevAtkCd.set(u.id, u.atkCd);
        }

        // ---- 建筑被毁：在原位置播放爆炸 ----
        const buildingIds = new Set(s.buildings.map(b => b.id));
        for (const [id, snap] of this.prevBuildingIds) {
            if (!buildingIds.has(id)) {
                this.battleEffects.playBuildingDestroy(snap.x, snap.y);
            }
        }

        // ---- 建筑/塔受击：伤害跳字（结构数量少，无性能顾虑；对齐水晶反馈）----
        for (const b of s.buildings) {
            const prevHp = this.prevBuildingHp.get(b.id) ?? b.hp;
            if (b.hp < prevHp - 0.01) {
                const dmg = prevHp - b.hp;
                if (dmg > 3) this.floatingText.showDamage(dmg, b.x, b.y + 40);
            }
            this.prevBuildingHp.set(b.id, b.hp);
        }
        const towerIds = new Set(s.towers.map(t => t.id));
        for (const t of s.towers) {
            const prevHp = this.prevTowerHp.get(t.id) ?? t.hp;
            if (t.hp < prevHp - 0.01) {
                const dmg = prevHp - t.hp;
                if (dmg > 3) this.floatingText.showDamage(dmg, t.x, t.y + 40);
            }
            this.prevTowerHp.set(t.id, t.hp);
        }
        for (const id of this.prevBuildingHp.keys()) if (!buildingIds.has(id)) this.prevBuildingHp.delete(id);
        for (const id of this.prevTowerHp.keys()) if (!towerIds.has(id)) this.prevTowerHp.delete(id);

        // ---- 金币变化 → 金币跳字 + 音效 ----
        for (const side of ['red', 'blue'] as const) {
            const diff = s.gold[side] - (this.prevGold[side] || 0);
            if (diff > 0 && side === s.playerSide) {
                this.floatingText.showGold(diff, -500, 300);
                this.audio.play('coin');
            }
        }

        // ---- 水晶受击 → 伤害数字 + 震动闪烁 ----
        for (const side of ['red', 'blue'] as const) {
            const crystal = s.crystals.find(c => c.side === side);
            if (crystal) {
                const prevHp = this.prevCrystalHp[side] || crystal.maxHp;
                if (crystal.hp < prevHp) {
                    const dmg = prevHp - crystal.hp;
                    if (dmg > 5) { // 忽略微小伤害（决战时刻过载）
                        this.floatingText.showDamage(dmg, crystal.x, crystal.y + 40);
                        this.battleEffects.playCrystalHit(crystal.x, crystal.y, side);
                    }
                }
                this.prevCrystalHp[side] = crystal.hp;
            }
        }

        // ---- 击杀数变化 → 击杀音效 ----
        for (const side of ['red', 'blue'] as const) {
            if (s.stats.kills[side] > (this.prevKills[side] || 0) && side === s.playerSide) {
                this.audio.play('kill');
            }
        }

        // ---- 更新快照 ----
        this.prevUnits = new Map(s.units.map(u => [u.id, { x: u.x, y: u.y, side: u.side, type: u.type }]));
        this.prevBuildingIds = new Map(s.buildings.map(b => [b.id, { x: b.x, y: b.y }]));
        this.prevGold = { ...s.gold };
        this.prevKills = { ...s.stats.kills };
    }

    /** 游戏结束时的表现 */
    private onGameEnd() {
        const s = this.engine.state;
        // 胜负按玩家所在边判定（联机时玩家可能是蓝方）
        const won = s.stats.result?.winner === s.playerSide;
        this.audio.play(won ? 'victory' : 'defeat');

        if (s.stats.result) {
            const isNewBest = saveFromState(
                s.stats.result, s.stats.kills,
                s.factions[s.playerSide], s.difficulty,
            );
            if (isNewBest) this.panels.showToast('🏆 新纪录！');
        }
    }

    // ==================== 网格放置模式（v0.5.0） ====================

    onBuildClick(_event: Event, id: string) {
        if (!this.canAct()) return;
        const itemId = id as BuildingItemId;

        if (this.pendingBuild === itemId) {
            this.cancelPlacement();
            this.panels.showToast('取消建造');
            return;
        }

        this.pendingBuild = itemId;
        this.entityInfo.hide();
        this.showPreview();
        this.showGridOverlay();
        const conf = BUILDING_CONFIG[itemId];
        this.panels.showToast(`选择格子放置${conf.name}（放错可右键/ESC 取消）`);
    }

    /** 触摸按下：开始长按计时（移动端长按拖拽建造） */
    private onGameTouchStart(_event: EventTouch) {
        this.touchHeld = true;
        this.touchHoldTime = 0;
    }

    /** PC 全局鼠标按下：右键取消建造模式 */
    private onGlobalMouseDown(event: EventMouse) {
        if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            if (this.pendingBuild) {
                this.cancelPlacement();
                this.panels.showToast('取消建造');
            }
        }
    }

    private onGameTouch(event: EventTouch) {
        // 触摸序列结束：复位长按状态；是否达到阈值决定移动端能否放置
        const heldLongEnough = this.touchHoldTime >= GameManager.TOUCH_HOLD_THRESHOLD;
        this.touchHeld = false;
        this.touchHoldTime = 0;

        if (!this.canAct()) return;
        // 必须用 getUILocation()：设计分辨率 UI 坐标（0~1280/0~720）。
        // getLocation() 返回设备像素坐标，高 DPI 屏上会整体偏移导致网格错位
        const loc = event.getUILocation();
        const localPos = this.toLocal(loc);

        // 建造模式：吸附格点放置
        if (this.pendingBuild) {
            // 移动端防误触：真实触摸设备必须长按（≥0.25s）后松手才放置；
            // PC 直接即点即放（平台判定，不依赖不可靠的事件时序）
            if (GameManager.REQUIRE_HOLD && !heldLongEnough) {
                return; // 快速点按不放置（误触保护）
            }
            const cell = this.snapToCell(localPos.x, localPos.y);
            if (!cell) {
                this.panels.showToast('请在己方建造区网格内放置');
                return;
            }
            if (!this.isCellFree(cell.x, cell.y)) {
                this.panels.showToast('该格已被占用');
                return;
            }
            const cmd = makeBuildCommand(this.pendingBuild, this.engine.state, cell);
            if (this.online) {
                this.submitOnline(cmd);
                this.cancelPlacement();
                this.panels.showToast('已发送建造命令');
                return;
            }
            const result = this.engine.execute(cmd);
            if (result.message) this.panels.showToast(result.message);
            this.hudView.updatePrices(this.engine.state);
            if (result.ok) {
                this.audio.play('build');
                this.floatingText.show('建造完成！', cell.x, cell.y + 30, new Color(100, 255, 100), 16, 0.6);
                // 放置成功即结束本次建造（一次点击 = 一座建筑）；
                // 右键/ESC 取消只用于放置前的反悔，避免连续模式下误点多造
                this.cancelPlacement();
            } else {
                // 放置失败（金币不足等）：保持建造模式，玩家可换格重试
                this.refreshGridOverlay();
                this.updatePreviewAt(cell.x, cell.y);
            }
            return;
        }

        // 非建造模式：实体信息查看（敌我均可）
        // 判定优先级：单位（视觉最上层）→ 己方工厂（升级面板）→ 任意建筑/塔/水晶 → 空地
        const st = this.engine.state;

        // 1) 单位：28px 内最近者
        let unitHit = null as typeof st.units[number] | null;
        let bestD = 28 * 28;
        for (const u of st.units) {
            const d = (u.x - localPos.x) ** 2 + (u.y - localPos.y) ** 2;
            if (d < bestD) { bestD = d; unitHit = u; }
        }
        if (unitHit) {
            this.entityInfo.show(st, { kind: 'unit', id: unitHit.id });
            this.panels.hideUpgrade();
            return;
        }

        // 2) 己方工厂：升级面板（原有交互）
        const ownFactory = st.buildings.find(b =>
            b.side === st.playerSide
            && b.unitType !== null
            && Math.abs(b.x - localPos.x) < BUILD_GRID.cellSize / 2
            && Math.abs(b.y - localPos.y) < BUILD_GRID.cellSize / 2);
        if (ownFactory) {
            this.panels.showUpgrade(st, ownFactory.id);
            this.entityInfo.hide();
            return;
        }

        // 3) 任意建筑 / 塔 / 水晶
        const bHit = st.buildings.find(b =>
            Math.abs(b.x - localPos.x) < BUILD_GRID.cellSize / 2
            && Math.abs(b.y - localPos.y) < BUILD_GRID.cellSize / 2);
        if (bHit) {
            this.entityInfo.show(st, { kind: 'building', id: bHit.id });
            this.panels.hideUpgrade();
            return;
        }
        const tHit = st.towers.find(t =>
            (t.x - localPos.x) ** 2 + (t.y - localPos.y) ** 2 < 26 * 26);
        if (tHit) {
            this.entityInfo.show(st, { kind: 'tower', id: tHit.id });
            this.panels.hideUpgrade();
            return;
        }
        const cHit = st.crystals.find(c =>
            (c.x - localPos.x) ** 2 + (c.y - localPos.y) ** 2 < 48 * 48);
        if (cHit) {
            this.entityInfo.show(st, { kind: 'crystal', side: cHit.side });
            this.panels.hideUpgrade();
            return;
        }

        // 4) 空地：全部收起
        this.panels.hideUpgrade();
        this.entityInfo.hide();
    }

    private onGameTouchMove(event: EventTouch) {
        if (!this.pendingBuild) return;
        const loc = event.getUILocation();
        const localPos = this.toLocal(loc);
        this.updatePreviewAt(localPos.x, localPos.y);
    }

    private onGameTouchCancel(_event: EventTouch) {
        // 触摸被系统打断：复位长按状态，保持预览不放置
        this.touchHeld = false;
        this.touchHoldTime = 0;
    }

    private onKeyDown(event: any) {
        if (this.pendingBuild && (event?.keyCode === 27 /* ESC */ || event?.keyCode === 256)) {
            this.cancelPlacement();
            this.panels.showToast('取消建造');
        }
    }

    /** 世界坐标 → 游戏容器本地坐标 */
    private toLocal(loc: { x: number; y: number }): Vec3 {
        const ut = this.gameContainer.getComponent(UITransform)!;
        return ut.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0));
    }

    /** 本方建造格点集（蓝方用镜像网格） */
    private myGridCells(): Array<{ x: number; y: number }> {
        return this.online && this.mySide === 'blue' ? BUILD_GRID.mirrorCells() : BUILD_GRID.cells();
    }

    /** 最近格点吸附（超出 1.2 格距返回 null） */
    private snapToCell(x: number, y: number): { x: number; y: number } | null {
        let best: { x: number; y: number } | null = null;
        let bestDist = Infinity;
        for (const c of this.myGridCells()) {
            const d = (c.x - x) ** 2 + (c.y - y) ** 2;
            if (d < bestDist) { bestDist = d; best = c; }
        }
        if (best && bestDist <= (BUILD_GRID.cellSize * 1.2) ** 2) return best;
        return null;
    }

    /** 格点是否空闲（无建筑/塔/水晶占位） */
    private isCellFree(x: number, y: number): boolean {
        const s = this.engine.state;
        const half = BUILD_GRID.cellSize / 2;
        for (const b of s.buildings) {
            if (Math.abs(b.x - x) < half && Math.abs(b.y - y) < half) return false;
        }
        for (const t of s.towers) {
            if (Math.abs(t.x - x) < half && Math.abs(t.y - y) < half) return false;
        }
        for (const c of s.crystals) {
            if (Math.abs(c.x - x) < half && Math.abs(c.y - y) < half) return false;
        }
        return true;
    }

    /** 预览：半透明建筑跟随指针，红绿反馈可放/占用 */
    private updatePreviewAt(x: number, y: number) {
        if (!this.previewNode) return;
        const cell = this.snapToCell(x, y);
        if (!cell) {
            this.previewNode.active = false;
            this.previewCell = null;
            return;
        }
        this.previewNode.active = true;
        this.previewNode.setPosition(cell.x, cell.y, 0);
        this.previewCell = cell;
        this.previewValid = this.isCellFree(cell.x, cell.y);
        if (this.previewBg) {
            this.previewBg.color = this.previewValid
                ? new Color(80, 220, 120, 130)
                : new Color(220, 80, 80, 130);
        }
    }

    private showPreview() {
        this.clearPreview();
        const conf = this.pendingBuild ? BUILDING_CONFIG[this.pendingBuild] : null;
        const size = conf ? (conf.kind === 'academy' ? 46 : 40) : 40;
        this.previewNode = this.spriteFactory.createColorNode(new Color(80, 220, 120, 130), size, size);
        this.previewNode.name = 'BuildPreview';
        this.previewBg = this.previewNode.getComponent(Sprite);
        this.previewNode.parent = this.gameContainer;
        this.previewNode.active = false;
    }

    /** 网格底图：建造模式显示空格/占用格 */
    private showGridOverlay() {
        this.clearGridOverlay();
        const overlay = new Node('GridOverlay');
        overlay.layer = this.node.layer;
        overlay.parent = this.gameContainer;
        this.gridOverlayNode = overlay;
        const cells = this.myGridCells().map(c => ({ ...c }));
        const nodeCells = new Map<string, Node>();
        for (const c of cells) {
            const cellNode = this.spriteFactory.createColorNode(new Color(255, 255, 255, 16), BUILD_GRID.cellSize - 6, BUILD_GRID.cellSize - 6);
            cellNode.parent = overlay;
            cellNode.setPosition(c.x, c.y, 0);
            nodeCells.set(`${c.x},${c.y}`, cellNode);
        }
        (overlay as any).__cells = nodeCells;
        this.refreshGridOverlay();
    }

    private refreshGridOverlay() {
        const overlay = this.gridOverlayNode;
        if (!overlay) return;
        const nodeCells: Map<string, Node> = (overlay as any).__cells ?? new Map();
        for (const [key, cellNode] of nodeCells) {
            const [cx, cy] = key.split(',').map(Number);
            const sp = cellNode.getComponent(Sprite);
            if (sp) {
                sp.color = this.isCellFree(cx, cy)
                    ? new Color(255, 255, 255, 16)
                    : new Color(220, 80, 80, 60);
            }
        }
    }

    private cancelPlacement() {
        this.pendingBuild = null;
        this.clearPreview();
        this.clearGridOverlay();
    }

    private clearPreview() {
        if (this.previewNode?.isValid) this.previewNode.destroy();
        this.previewNode = null;
        this.previewBg = null;
        this.previewCell = null;
    }

    private clearGridOverlay() {
        if (this.gridOverlayNode?.isValid) this.gridOverlayNode.destroy();
        this.gridOverlayNode = null;
    }

    // ==================== 事件路由 ====================

    /** 升级面板按钮：升级当前指向的工厂 */
    onBuildingUpgradeClick(_event: Event) {
        if (!this.canAct()) return;
        const buildingId = this.panels.getUpgradeBuildingId();
        if (!buildingId) return;
        if (this.online) {
            this.submitOnline({ type: 'upgrade', buildingId });
            this.panels.hideUpgrade();
            return;
        }
        const result = this.engine.execute({ type: 'upgrade', buildingId });
        if (result.ok) this.audio.play('upgrade');
        if (result.message) this.panels.showToast(result.message);
        this.panels.refreshUpgrade(this.engine.state);
    }

    /** HUD 快捷按钮：自动升级最低等级工厂 */
    onUpgradeClick(_event: Event) {
        if (!this.canAct()) return;
        const cmd = makeUpgradeCommand(this.engine.state);
        if (!cmd) { this.panels.showToast('没有可升级的兵工厂！'); return; }
        if (this.online) { this.submitOnline(cmd); return; }
        const result = this.engine.execute(cmd);
        if (result.ok) this.audio.play('upgrade');
        if (result.message) this.panels.showToast(result.message);
    }

    onResearchClick(_event: Event) {
        if (!this.canAct()) return;
        if (this.online) { this.submitOnline(makeResearchCommand()); this.hudView.updatePrices(this.engine.state); return; }
        const result = this.engine.execute(makeResearchCommand());
        if (result.ok) this.audio.play('upgrade');
        if (result.message) this.panels.showToast(result.message);
        this.hudView.updatePrices(this.engine.state);
    }

    /** 水晶护盾按钮点击：花金币给己方水晶加临时护盾（联机走锁步命令） */
    onShieldClick(_event: Event) {
        if (!this.canAct()) return;
        if (this.online) { this.submitOnline(makeShieldCommand()); this.hudView.updatePrices(this.engine.state); return; }
        const result = this.engine.execute(makeShieldCommand());
        if (result.ok) this.audio.play('build');
        if (result.message) this.panels.showToast(result.message);
        this.hudView.updatePrices(this.engine.state);
    }

    /** 音效开关点击：切换静音并持久化偏好 */
    onMuteClick(_event: Event) {
        const muted = !this.audio.isMuted();
        this.audio.setMuted(muted);
        try {
            localStorage.setItem(MUTED_PREF_KEY, muted ? '1' : '0');
        } catch { /* 无 localStorage 环境静默失败 */ }
        this.hudView.setMuteIcon(muted);
        // 解除静音时给一声反馈，确认音效已恢复
        if (!muted) this.audio.play('coin');
    }

    /** 读取静音偏好（无记录/异常时默认开启音效） */
    private readMutedPref(): boolean {
        try {
            return localStorage.getItem(MUTED_PREF_KEY) === '1';
        } catch {
            return false;
        }
    }

    onCardClick(_event: Event, cardId: string) {
        // 联机：选卡经服务器定序，随 frame 以选卡方的边执行（双方引擎一致）
        if (this.online) {
            this.submitOnline(makeCardCommand(cardId));
            return;
        }
        const result = this.engine.execute(makeCardCommand(cardId));
        if (result.ok) {
            this.panels.showToast('卡牌生效！');
            this.audio.play('build');
        }
    }

    /** 顶部卡牌图标行点击：打开本局卡牌详情面板 */
    onCardHistoryClick(_event: Event) {
        this.panels.showCardHistory(this.engine.state);
    }

    /** 卡牌详情面板关闭按钮 */
    onCloseCardHistoryClick(_event: Event) {
        this.panels.hideCardHistory();
    }

    onFactionClick(_event: Event, faction: string) { this.panels.onFactionClick(_event, faction); }
    onDiffClick(_event: Event) { this.panels.onDiffClick(_event); }

    /** 双倍工资按钮点击（观看广告后本局工资翻倍，标志由 AdManager 记录，开局时传入引擎） */
    async onDoubleSalaryClick(_event: Event) {
        const adManager = AdManager.getInstance();
        if (!adManager.canWatch('double_salary')) {
            this.panels.showToast('已启用双倍工资！');
            return;
        }

        const success = await adManager.watchAd('double_salary');
        if (success) {
            this.panels.showToast('🎉 已启用双倍工资！本局工资翻倍');
            this.audio.play('coin');
        } else {
            this.panels.showToast('广告观看失败');
        }
    }

    onStartClick(_event: Event) {
        // 初始化音频（需用户交互后才能播放）
        this.audio.init();
        // 恢复玩家音效偏好（静音开关持久化）
        this.audio.setMuted(this.readMutedPref());
        this.hudView.setMuteIcon(this.audio.isMuted());
        this.online = false;
        this.onlineEnded = false;

        const adManager = AdManager.getInstance();
        const doubleSalary = adManager.isDoubleSalaryEnabled();

        this.panels.hideStart();
        this.panels.hideUpgrade();
        this.cancelPlacement();
        this.gameView.clear();
        this.entityInfo.hide();
        this.floatingText.clear();
        this.deathEffect.clear();
        this.battleEffects.clear();
        this.tutorial.dispose();
        this.engine.reset({
            playerFaction: this.panels.getSelectedFaction(),
            difficulty: this.panels.getSelectedDifficulty(),
            doubleSalary,
        });

        // 开局后重置广告计数（本局的观看记录已随引擎状态生效）
        adManager.reset();

        // 重置状态追踪
        this.prevUnits.clear();
        this.prevBuildingIds.clear();
        this.prevAtkCd.clear();
        this.prevGold = { ...this.engine.state.gold };
        this.prevCrystalHp = { red: 0, blue: 0 };
        this.prevKills = { red: 0, blue: 0 };
        this.prevBuildings = 0;
        this.prevPhase = 'playing';

        this.hudView.updatePrices(this.engine.state);
        this.panels.showToast('游戏开始！阵营：' + this.panels.getSelectedFaction());

        // 启动新手引导（首局玩家）
        this.tutorial.checkAndStart();
    }

    // ==================== 联机对战（P1：好友房创建/加入） ====================
    // 注：原"联机对战"快速匹配入口已移除——单人多次点击会排队多条连接，
    // 自己和自己配对成局；好友房（创建/加入）语义清楚且必须两人，保留。

    /** 断线重连凭证（matched 下发；对局中掉线自动凭它恢复） */
    private rejoinToken: string | null = null;
    /** 正在重连（抑制期间的帧消息处理） */
    private rejoining = false;
    /** ping 测量：发送时间戳；收到 pong 计 RTT */
    private pingSentAt = 0;
    private pingTimer: ReturnType<typeof setInterval> | null = null;

    /** 联机建局共用：同 seed 建引擎 + 重置表现层（matched 与 resume 复用） */
    private setupOnlineEngine(seed: number, side: 'red' | 'blue', myFaction: string, oppFaction: string) {
        this.engine = new GameEngine(new SeededRandomSource(seed));
        this.engine.reset({
            playerFaction: (side === 'red' ? myFaction : oppFaction) as never,
            aiFaction: (side === 'red' ? oppFaction : myFaction) as never,
            playerSide: side,
            aiEnabled: false,
            disableCards: false, // S4：联机卡牌已双端化——效果按选卡方的真实边结算，锁步一致
        });
        // 重置表现层
        this.panels.hideStart();
        this.gameView.clear();
        this.battleEffects.clear();
        this.floatingText.clear();
        this.deathEffect.clear();
        this.prevPhase = 'playing';
        this.hudView.updatePrices(this.engine.state);
        this.hudView.showOnlineBadge(side);
        this.panels.updateOnlineStatus('');
        this.panels.hideRoomCode();
    }

    /** 每 5 秒 ping 一次测 RTT（联机期间持续；重复调用安全） */
    private startPingLoop() {
        if (this.pingTimer) return;
        this.pingTimer = setInterval(() => {
            if (!this.net || !this.online) { this.stopPingLoop(); return; }
            this.pingSentAt = Date.now();
            this.net.send({ t: 'ping' });
        }, 5000);
    }

    private stopPingLoop() {
        if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
        this.hudView.updatePing(-1);
    }

    /** 对手操作提示：对手建造/升级/科研时在对手半场弹出浮动文字 */
    private showOppAction(cmd: import('./network/protocol').GameCommandPayload) {
        const oppSide: 'red' | 'blue' = this.mySide === 'red' ? 'blue' : 'red';
        let text = '';
        let x = oppSide === 'red' ? -330 : 330;
        let y = 300;
        if (cmd.type === 'build') {
            const conf = BUILDING_CONFIG[cmd.itemId as BuildingItemId];
            text = `对手建造了${conf ? conf.name : '建筑'}！`;
            x = cmd.position.x; y = cmd.position.y + 30;
        } else if (cmd.type === 'upgrade') {
            const b = this.engine.state.buildings.find(bb => bb.id === cmd.buildingId);
            const name = b && b.unitType && BUILDING_CONFIG[b.unitType] ? BUILDING_CONFIG[b.unitType].name : '工厂';
            text = `对手升级了${name}！`;
            if (b) { x = b.x; y = b.y + 30; }
        } else if (cmd.type === 'research') {
            text = '对手进行了全军强化！';
        } else {
            return; // choose-card 联机未启用
        }
        this.floatingText.show(text, x, y, new Color(255, 140, 120), 16, 1.2);
    }

    /** 服务器消息处理：matched → 建局；resume → 重连恢复；frame → 应用命令并推进；result → 结算 */
    private onNetMessage(msg: ServerMessage) {
        switch (msg.t) {
            case 'matched': {
                // 双端用同一 seed 建局；联机禁卡牌（S4 卡牌双端化在 P3 实装）
                this.mySide = msg.yourSide;
                this.online = true;
                this.onlineEnded = false;
                this.rejoinToken = msg.rejoinToken ?? null;
                this.roomCode = null; // 已配对，房号使命完成
                this.setupOnlineEngine(msg.seed, msg.yourSide, msg.yourFaction, msg.oppFaction);
                this.panels.showToast(`已匹配！你是${this.mySide === 'red' ? '红方' : '蓝方'}（${msg.yourFaction}）`);
                this.startPingLoop();
                // 持久化重连凭证（页面刷新/崩溃后可凭它恢复对局）
                try { sessionStorage.setItem('fww_rejoin', msg.rejoinToken ?? ''); } catch { /* 隐私模式等 */ }
                break;
            }
            case 'resume': {
                // 断线重连：同 seed 重建引擎 → 按服务器命令历史回放 → 快追到当前帧
                this.mySide = msg.yourSide;
                this.online = true;
                this.onlineEnded = false;
                this.rejoining = false;
                this.panels.hideStart();
                this.setupOnlineEngine(msg.seed, msg.yourSide, msg.yourFaction, msg.oppFaction);
                // 回放命令历史（按 frame 升序：帧推进中在正确帧应用命令）
                let histIdx = 0;
                const history = msg.history;
                for (let f = 1; f <= msg.frame; f++) {
                    while (histIdx < history.length && history[histIdx].frame === f) {
                        const h = history[histIdx++];
                        this.engine.execute(h.cmd as never, h.side);
                    }
                    for (let i = 0; i < 3; i++) {
                        if (this.engine.state.phase === 'playing') this.engine.step(FIXED_LOGIC_DT);
                    }
                }
                this.onlineFrame = msg.frame;
                this.lastHashReportFrame = msg.frame;
                this.panels.showToast('已重新连接，对局恢复！');
                this.startPingLoop();
                console.log(`[GameManager] rejoin 完成：追帧到 ${msg.frame}，回放 ${history.length} 条命令`);
                break;
            }
            case 'frame': {
                if (!this.online) break;
                // 重连追帧期间到达的帧（序号落后于 resume 快照）直接丢弃，
                // 追帧完成后由服务器帧号接管
                if (this.rejoining) break;
                if (msg.frame <= this.onlineFrame) break; // 迟到/重复帧
                this.onlineFrame = msg.frame;
                for (const { side, cmd } of msg.cmds) {
                    // 联机命令按提交方的真实边执行
                    this.engine.execute(cmd as never, side);
                    // 对手操作提示：增强"真人对战感"（自己命令的反馈走建造/升级本地路径）
                    if (side !== this.mySide) this.showOppAction(cmd);
                }
                // 命令执行后刷新建造栏价格（联机建造/升级/科研经服务器回包生效，
                // 本地提交路径不执行引擎所以价格不会动——这里统一兜底刷新，
                // 让"同类递增 +25%"立刻反映到按钮价格上）
                if (msg.cmds.length > 0) this.hudView.updatePrices(this.engine.state);
                // 选卡暂停期间不推进模拟（等双方选完恢复 playing 再继续步进）；
                // 命令（含 choose-card）照常应用——否则选卡命令永远到不了引擎
                if (this.engine.state.phase !== 'playing') break;
                for (let i = 0; i < 3; i++) {
                    if (this.engine.state.phase === 'playing') this.engine.step(FIXED_LOGIC_DT);
                }
                // 每 HASH_EVERY_FRAMES 帧上报哈希
                if (this.onlineFrame - this.lastHashReportFrame >= HASH_EVERY_FRAMES) {
                    this.lastHashReportFrame = this.onlineFrame;
                    this.net?.send({ t: 'hash', frame: this.onlineFrame, hash: stateHash(this.engine.state as never) });
                }
                break;
            }
            case 'room_created': {
                this.roomCode = msg.roomCode;
                // 房号是加入房间的唯一凭证：大卡片常驻展示 + toast 双保险
                this.panels.showRoomCode(msg.roomCode);
                this.panels.showToast('房号：' + msg.roomCode, 10_000);
                this.panels.updateOnlineStatus('等待对手加入…');
                break;
            }
            case 'waiting':
                // 好友房房主：不要用"匹配中…"盖掉房号提示（服务器在建房后会立刻补发 waiting）
                if (this.roomCode) break;
                this.panels.showToast('匹配中…');
                break;
            case 'pong':
                if (this.pingSentAt > 0) {
                    this.hudView.updatePing(Date.now() - this.pingSentAt);
                    this.pingSentAt = 0;
                }
                break;
            case 'opp_left':
                this.panels.showToast('对手连接中断，15 秒内可重连…', 8000);
                break;
            case 'opp_back':
                this.panels.showToast('对手已回来');
                break;
            case 'result': {
                const won = msg.winner === this.mySide;
                this.panels.showToast(`对局结束：${won ? '胜利！' : '失败'}（${msg.reason}）`);
                this.online = false;
                this.onlineEnded = true;
                this.rejoining = false;
                this.rejoinToken = null;
                this.stopPingLoop();
                this.hudView.hideOnlineBadge();
                try { sessionStorage.removeItem('fww_rejoin'); } catch { /* */ }
                this.net?.close();
                this.net = null;
                this.panels.hideRoomCode();
                this.panels.updateOnlineStatus('');
                // 复用结算面板（联机结果以服务器为准；本地模拟可能尚未结束，
                // 传入服务器结果兜底，且按玩家所在边判定胜负）
                this.panels.showEnd(this.engine.state, false, { winner: msg.winner, reason: msg.reason });
                break;
            }
            case 'error':
                this.panels.showToast('联机错误：' + msg.msg);
                this.panels.updateOnlineStatus('');
                break;
        }
    }

    /** 房号卡片「取消等待」：退出排队并断开连接 */
    onCancelRoomClick(_event: Event) {
        if (this.net) {
            this.net.send({ t: 'cancel_match' });
            this.net.close();
            this.net = null;
        }
        this.roomCode = null;
        this.panels.hideRoomCode();
        this.panels.updateOnlineStatus('');
        this.panels.showToast('已取消联机');
    }

    /** 联机模式命令提交：本地不执行，经服务器定序后随 frame 应用（双端一致） */
    private submitOnline(cmd: import('./core/types').GameCommand): void {
        this.net?.send({ t: 'cmd', frame: this.onlineFrame + 2, cmd: cmd as never });
        this.panels.showToast('命令已发送');
    }

    /** 创建好友房：生成房间码并等待对手 */
    onCreateRoomClick(_event: Event) {
        this.ensureNet();
        if (!this.net) return;
        this.net.send({ t: 'create_room' });
        this.panels.showToast('正在创建房间…');
    }

    /** 加入好友房：输入房间码后匹配 */
    /** 加入好友房：浏览器 prompt 输入房码（H5 预览；小游戏输入 UI 属 P2） */
    onJoinRoomClick(_event: Event, _code?: string) {
        const c = this.promptRoomCode();
        if (c === null) return; // 取消
        if (!c) { this.panels.showToast('请输入房间码'); return; }
        this.ensureNet();
        if (!this.net) return;
        this.net.send({ t: 'join', token: 'dev-' + Math.floor(Math.random() * 1e6), mode: 'friend', roomCode: c });
        this.panels.showToast('加入房间 ' + c + '…');
        this.panels.updateOnlineStatus('房间 ' + c + ' · 等待对手…');
    }

    /** 房码输入：H5 用 window.prompt；小游戏环境降级提示（P2 补原生输入） */
    private promptRoomCode(): string | null {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
            const v = (window.prompt('输入房间号（房主创建后可见）') || '').trim().toUpperCase();
            return v === '' ? null : v;
        }
        this.panels.showToast('此平台暂不支持输入房号（P2 接入）');
        return null;
    }

    private ensureNet() {
        // 复用前先检查可用性：ws 已断且重连放弃（超过上限）的"僵尸 net"必须废弃重建，
        // 否则后续建房/加入命令全部堆进死队列（实测缺陷：retries 到上限后 ws 恒 null）
        if (this.net && this.net.isDead()) {
            this.net.close();
            this.net = null;
        }
        if (this.net) return;
        // onOpen 提示已连接；onClose 提示连接失败（连接建立前即关闭）
        let opened = false;
        this.net = new NetworkClient('ws://127.0.0.1:8100', {
            onMessage: (m) => this.onNetMessage(m),
            onOpen: () => {
                opened = true;
                this.panels.showToast('已连接联机服务器');
                // 对局中掉线重连成功：立刻凭 token 找回房间（不用等服务器消息）
                if (this.rejoining && this.rejoinToken) {
                    this.net?.send({ t: 'rejoin', token: this.rejoinToken });
                }
            },
            onClose: () => {
                if (!opened) {
                    this.panels.showToast('无法连接服务器（127.0.0.1:8100）');
                    return;
                }
                // 对局中断线：进入重连模式（NetworkClient 自动指数退避重连）
                if (this.online && !this.onlineEnded) {
                    this.rejoining = true;
                    this.panels.showToast('⚠ 连接断开，正在尝试重连…', 10_000);
                    this.panels.updateOnlineStatus('连接断开，重连中…');
                }
            },
        });
        this.net.connect();
    }

    onAgainClick(_event: Event) {
        this.cancelPlacement();
        this.panels.hideEnd();
        this.panels.showStart();
    }

    /** 复活按钮点击（观看广告后恢复水晶血量，复活逻辑走引擎 API） */
    async onReviveClick(_event: Event) {
        const adManager = AdManager.getInstance();
        const success = await adManager.watchAd('revive');

        if (success && this.engine.revivePlayer(0.3)) {
            // 同步表现层阶段追踪，避免 update 重复触发结算
            this.prevPhase = 'playing';
            this.panels.hideEnd();
            this.panels.showToast('复活成功！水晶恢复 30% 血量');
            this.audio.play('build');
        } else if (!success) {
            this.panels.showToast('广告观看失败，无法复活');
        }
    }

    // ==================== 辅助 ====================

    private createContainer(name: string): Node {
        const node = new Node(name);
        node.layer = this.node.layer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(1280, 720);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        return node;
    }
}
