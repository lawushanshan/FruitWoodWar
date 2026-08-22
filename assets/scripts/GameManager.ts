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
import { GameView } from './presentation/game-view';
import { HudView } from './presentation/hud-view';
import { PanelController } from './presentation/panel-controller';
import { FloatingText } from './presentation/floating-text';
import { DeathEffect } from './presentation/death-effect';
import { AudioManager } from './presentation/audio-manager';
import { TutorialController } from './presentation/tutorial-controller';
import { BattleEffects } from './presentation/battle-effects';
import { makeBuildCommand, makeUpgradeCommand, makeResearchCommand, makeCardCommand } from './input/game-commands';
import { BUILDING_CONFIG } from './config/building-config';
import { BUILD_GRID } from './config/build-grid';
import { MAP_LAYOUT } from './config/map-layout';
import { saveFromState } from './core/save-system';
import { AdManager } from './platform/ad-manager';
import type { BuildingItemId, Phase } from './core/types';

const { ccclass } = _decorator;

/** 固定逻辑步长（秒）：模拟帧率与渲染帧率解耦（联机确定性前提） */
const FIXED_LOGIC_DT = 1 / 30;

@ccclass('GameManager')
export class GameManager extends Component {

    /** 模拟核心 */
    private engine: GameEngine = new GameEngine();
    private prevPhase: Phase = 'idle';
    /** 固定逻辑步长累加器（联机 P0-S1） */
    private logicAccumulator = 0;

    /** 表现层模块 */
    private gameView!: GameView;
    private hudView!: HudView;
    private panels!: PanelController;
    private spriteFactory!: ColorSpriteFactory;
    private floatingText!: FloatingText;
    private deathEffect!: DeathEffect;
    private audio!: AudioManager;
    private tutorial!: TutorialController;
    private battleEffects!: BattleEffects;

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
    private prevBuildings: number = 0;
    private prevWave: number = 0;

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
        const bg = sf.createColorNode(new Color(13, 20, 24), 1280, 720);
        bg.parent = this.gameContainer;

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
        const redZone = sf.createColorNode(new Color(120, 40, 40, 45), 500, 180);
        redZone.name = 'RedBuildZone';
        redZone.parent = this.gameContainer;
        redZone.setPosition(-330, 175, 0);
        const blueZone = sf.createColorNode(new Color(40, 70, 140, 45), 500, 180);
        blueZone.name = 'BlueBuildZone';
        blueZone.parent = this.gameContainer;
        blueZone.setPosition(330, 175, 0);

        // 初始化表现层模块
        this.gameView = new GameView(this.gameContainer, sf);
        this.hudView = new HudView(uiContainer, sf, this.node);
        this.panels = new PanelController(uiContainer, sf, this.node);
        this.floatingText = new FloatingText(this.gameContainer, this.node.layer);
        this.deathEffect = new DeathEffect(this.gameContainer, sf);
        this.audio = new AudioManager();
        this.tutorial = new TutorialController(uiContainer, sf, this.node.layer);
        this.battleEffects = new BattleEffects(this.gameContainer, sf);
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

    start() { this.panels.showStart(); }

    onDestroy() {
        input.off(Input.EventType.MOUSE_DOWN, this.onGlobalMouseDown, this);
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    update(dt: number) {
        // 长按计时：触摸按住期间累计，达到阈值后松手才允许放置（移动端防误触）
        if (this.touchHeld) this.touchHoldTime += dt;

        // 卡牌倒计时在所有阶段推进（选卡暂停期间也要倒计时，防止假死）
        this.panels.updateCardCountdown(dt, () => {
            const s = this.engine.state;
            if (s.phase === 'card-pause' && s.cards.offers.length > 0) {
                this.engine.execute(makeCardCommand(s.cards.offers[0].id));
            }
        });

        if (this.engine.state.phase === 'playing') {
            // 固定逻辑步长（联机 P0-S1）：渲染 dt 经累加器切成固定 1/30s 逻辑帧，
            // 帧率波动不再影响模拟结果（确定性前提），残余不足一步的量留到下一帧。
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

        const phase = this.engine.state.phase;
        if (phase !== this.prevPhase) {
            if (phase === 'card-pause') this.panels.showCards(this.engine.state);
            else if (phase === 'playing' && this.prevPhase === 'card-pause') this.panels.hideCards();
            else if (phase === 'ended') {
                const canRevive = AdManager.getInstance().canWatch('revive');
                this.panels.showEnd(this.engine.state, canRevive);
                this.onGameEnd();
            }
            this.prevPhase = phase;
        }

        if (phase === 'playing') {
            this.detectEffects();
            this.consumeFx();
            this.detectTutorial();
            this.gameView.sync(this.engine.state, dt);
            this.hudView.update(this.engine.state);
            this.floatingText.update(dt);
            this.deathEffect.update(dt);
            this.battleEffects.update(dt);
            this.tutorial.update(dt);
            this.panels.refreshUpgrade(this.engine.state);
        }
    }

    /** 消费引擎结算出的战斗表现事件，路由到对应特效 */
    private consumeFx() {
        const fx = this.engine.drainFx();
        if (fx.length === 0) return;
        for (const e of fx) {
            if (e.type === 'hit') {
                this.battleEffects.playImpact(e.x, e.y, e.side);
            } else if (e.type === 'aoe') {
                this.battleEffects.playRangeEffect(e.x, e.y, e.radius, e.side);
            } else if (e.type === 'tower') {
                // 塔攻击：弹道 + 目标处溅射环
                this.battleEffects.playProjectile(e.sx, e.sy, e.x, e.y, e.side);
                this.battleEffects.playRangeEffect(e.x, e.y, e.radius, e.side);
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

        if (s.wave > 0 && this.prevWave === 0 && currentBuildings > 0) {
            this.tutorial.onFirstWaveSpawned();
        }
        this.prevWave = s.wave;
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
        const won = s.stats.result?.winner === 'red';
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
        if (this.engine.state.phase !== 'playing') return;
        const itemId = id as BuildingItemId;

        if (this.pendingBuild === itemId) {
            this.cancelPlacement();
            this.panels.showToast('取消建造');
            return;
        }

        this.pendingBuild = itemId;
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

        if (this.engine.state.phase !== 'playing') return;
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

        // 非建造模式：点击己方兵工厂打开升级面板
        const hit = this.engine.state.buildings.find(b =>
            b.side === this.engine.state.playerSide
            && b.unitType !== null
            && Math.abs(b.x - localPos.x) < BUILD_GRID.cellSize / 2
            && Math.abs(b.y - localPos.y) < BUILD_GRID.cellSize / 2);
        if (hit) {
            this.panels.showUpgrade(this.engine.state, hit.id);
        } else {
            this.panels.hideUpgrade();
        }
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

    /** 最近格点吸附（超出 1.2 格距返回 null） */
    private snapToCell(x: number, y: number): { x: number; y: number } | null {
        let best: { x: number; y: number } | null = null;
        let bestDist = Infinity;
        for (const c of BUILD_GRID.cells()) {
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
        const cells = BUILD_GRID.cells().map(c => ({ ...c }));
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
        if (this.engine.state.phase !== 'playing') return;
        const buildingId = this.panels.getUpgradeBuildingId();
        if (!buildingId) return;
        const result = this.engine.execute({ type: 'upgrade', buildingId });
        if (result.ok) this.audio.play('upgrade');
        if (result.message) this.panels.showToast(result.message);
        this.panels.refreshUpgrade(this.engine.state);
    }

    /** HUD 快捷按钮：自动升级最低等级工厂 */
    onUpgradeClick(_event: Event) {
        if (this.engine.state.phase !== 'playing') return;
        const cmd = makeUpgradeCommand(this.engine.state);
        if (!cmd) { this.panels.showToast('没有可升级的兵工厂！'); return; }
        const result = this.engine.execute(cmd);
        if (result.ok) this.audio.play('upgrade');
        if (result.message) this.panels.showToast(result.message);
    }

    onResearchClick(_event: Event) {
        if (this.engine.state.phase !== 'playing') return;
        const result = this.engine.execute(makeResearchCommand());
        if (result.ok) this.audio.play('upgrade');
        if (result.message) this.panels.showToast(result.message);
        this.hudView.updatePrices(this.engine.state);
    }

    onCardClick(_event: Event, cardId: string) {
        const result = this.engine.execute(makeCardCommand(cardId));
        if (result.ok) {
            this.panels.showToast('卡牌生效！');
            this.audio.play('build');
        }
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

        const adManager = AdManager.getInstance();
        const doubleSalary = adManager.isDoubleSalaryEnabled();

        this.panels.hideStart();
        this.panels.hideUpgrade();
        this.cancelPlacement();
        this.gameView.clear();
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
        this.prevWave = 0;
        this.prevPhase = 'playing';

        this.hudView.updatePrices(this.engine.state);
        this.panels.showToast('游戏开始！阵营：' + this.panels.getSelectedFaction());

        // 启动新手引导（首局玩家）
        this.tutorial.checkAndStart();
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
