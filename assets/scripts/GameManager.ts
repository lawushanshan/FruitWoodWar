import { _decorator, Component, Node, Label, Color, UITransform, Size, Vec2, Sprite, SpriteFrame, Texture2D, ImageAsset, Layers, Button, EventHandler, tween, Vec3, UIOpacity, BlockInputEvents, Canvas, Camera, gfx, Widget } from 'cc';
import {
    ACADEMY_LEVELS,
    ARMY_RESEARCH,
    AURA_TOWER,
    BASE_TOWER,
    BUILD_GRID,
    BUILDING_TYPES,
    CARD_RARITY_WEIGHTS,
    COMEBACK,
    DIFFICULTIES,
    ELITE_BOUNTY_MULTIPLIERS,
    FACTIONS,
    FACTORY_OUTPUT,
    FACTORY_UPGRADES,
    GAME_CONFIG,
    UNIT_TYPES,
    BuildingId,
    FactionId,
    UnitRoleId,
    getBuildingCost,
    getFactoryOutput,
    getFactoryPrice,
    isFactoryId,
} from './config/GameConfig';
import {
    calculateDamage,
    distance,
    getCounterMultiplier,
    getFirstStrikeMultiplier,
    getTargetDamageMultiplier,
    isInRange,
} from './core/CombatRules';
const { ccclass, property } = _decorator;

// 卡牌暂时保留在表现层；数值与兵种已抽到 config/GameConfig.ts。

const CARDS: Record<FactionId, any[]> = {
    fruit: [
        { id:'heal', name:'鲜榨回复', icon:'🍹', desc:'全体治疗30%血量', rarity:'rare' },
        { id:'atkUp', name:'果香四溢', icon:'🌺', desc:'全体攻击+25%永久', rarity:'epic' },
        { id:'splash', name:'果弹飞溅', icon:'💥', desc:'攻击附带60%溅射', rarity:'rare' },
        { id:'sunburst', name:'阳光爆发', icon:'☀️', desc:'10秒内攻速翻倍', rarity:'epic' },
        { id:'tropical', name:'热带风暴', icon:'🌀', desc:'对全场敌人造成200伤害', rarity:'legendary' },
        { id:'fruitRage', name:'果族狂怒', icon:'🔥', desc:'攻击+35%攻速+20%永久', rarity:'legendary' },
        { id:'shield', name:'果皮护盾', icon:'🛡️', desc:'全体获得150护盾', rarity:'rare' },
        { id:'regen', name:'光合再生', icon:'🌱', desc:'10秒内持续回血', rarity:'epic' },
        { id:'rain', name:'果雨纷飞', icon:'🌧️', desc:'每5秒对随机敌人造成100伤害', rarity:'legendary' },
    ],
    wood: [
        { id:'rootNet', name:'根系网络', icon:'🌿', desc:'敌人减速40%持续8秒', rarity:'rare' },
        { id:'hpUp', name:'生命之树', icon:'🌳', desc:'全体血量+30%永久', rarity:'epic' },
        { id:'spore', name:'孢子爆发', icon:'💨', desc:'对周围敌人造成150伤害', rarity:'rare' },
        { id:'vine', name:'万木缠缚', icon:'🌾', desc:'敌人定身3秒', rarity:'epic' },
        { id:'bark', name:'树皮铠甲', icon:'🪵', desc:'全体减伤20%永久', rarity:'legendary' },
        { id:'bloom', name:'百花绽放', icon:'🌸', desc:'召唤3个树人', rarity:'epic' },
        { id:'thorn', name:'荆棘之甲', icon:'🌵', desc:'受击反弹20%伤害', rarity:'rare' },
        { id:'growth', name:'自然生长', icon:'🌱', desc:'出兵速度+30%永久', rarity:'legendary' },
        { id:'forest', name:'森林守护', icon:'🌲', desc:'水晶回血500', rarity:'rare' },
    ],
    animal: [
        { id:'crit', name:'致命一击', icon:'🎯', desc:'全体暴击率+30%', rarity:'rare' },
        { id:'bloodlust', name:'嗜血狂潮', icon:'🩸', desc:'击杀回血20%', rarity:'epic' },
        { id:'frenzy', name:'狂暴本能', icon:'💢', desc:'攻击+40%攻速+30%永久', rarity:'legendary' },
        { id:'howl', name:'战嚎', icon:'📣', desc:'10秒内攻击+50%', rarity:'epic' },
        { id:'pack', name:'狼群战术', icon:'🐺', desc:'每有一个友军攻击+5%', rarity:'rare' },
        { id:'predator', name:'捕食者', icon:'🐆', desc:'对低血量敌人伤害+100%', rarity:'epic' },
        { id:'stampede', name:'兽群奔腾', icon:'🦬', desc:'全体加速50%持续10秒', rarity:'rare' },
        { id:'claw', name:'利爪撕裂', icon:'🦁', desc:'攻击附带流血效果', rarity:'legendary' },
        { id:'survival', name:'适者生存', icon:'🧬', desc:'死亡时对周围造成伤害', rarity:'epic' },
    ],
};

const RARITY_COLORS: Record<string, Color> = {
    rare: new Color(123, 79, 184),
    epic: new Color(212, 116, 26),
    legendary: new Color(255, 215, 94),
};

// 兵种定位 emoji（灰盒阶段用 emoji 区分 15 个兵种）
const UNIT_EMOJI: Record<UnitRoleId, string> = {
    tank: '🛡️',
    ranged: '🏹',
    aoe: '✨',
    rush: '⚡',
    siege: '🏰',
};

// 阵营大本营 emoji（水果=黄金菠萝王座 / 绿木=世界树苗 / 动物=百兽图腾）
const FACTION_EMOJI: Record<FactionId, string> = {
    fruit: '🍍',
    wood: '🌳',
    animal: '🦁',
};


@ccclass('GameManager')
export class GameManager extends Component {

    private gameContainer: Node | null = null;
    private uiContainer: Node | null = null;
    private gameRunning: boolean = false;
    private G: any = {};
    private colorTextures: Map<string, SpriteFrame> = new Map();
    private uiLayer: number = 0;

    // UI节点引用
    private goldLabel: Label | null = null;
    private waveLabel: Label | null = null;
    private popLabel: Label | null = null;
    private killsLabel: Label | null = null;
    private hpRedLabel: Label | null = null;
    private hpBlueLabel: Label | null = null;
    private startPanel: Node | null = null;
    private endPanel: Node | null = null;
    private cardPanel: Node | null = null;
    private buildBar: Node | null = null;
    private toastLabel: Label | null = null;
    private selectedFaction: FactionId = 'fruit';
    private selectedDifficulty: keyof typeof DIFFICULTIES = 'normal';
    private buildCostLabels: Map<BuildingId | 'research', Label> = new Map();
    private buildMode: string | null = null;
    private buildZoneNode: Node | null = null;
    private lastDt: number = 0;
    private riverWaves: Node[] = [];
    private mapAnimT: number = 0;
    // 卡牌选择超时：倒计时剩余秒数；<=0 表示无进行中的选卡
    private cardTimeoutSeconds: number = 0;
    // 当前待选卡牌（超时自动选第一张）
    private pendingCards: any[] = [];
    private researchBtn: Node | null = null;
    private upgradePanel: Node | null = null;
    private upgradeInfoLabel: Label | null = null;
    private upgradeCostLabel: Label | null = null;
    private upgradeBtnNode: Node | null = null;
    // 建造拖拽预览（v0.5.0）：半透明建筑跟随指针，红绿反馈
    private buildPreviewNode: Node | null = null;
    private buildPreviewIcon: Label | null = null;
    private buildPreviewBg: Sprite | null = null;
    private buildPreviewValid: boolean = false;
    private buildPreviewCell: { x: number; y: number } | null = null;
    // 网格底图节点（建造模式显示）
    private gridOverlayNode: Node | null = null;
    private tutorialPanel: Node | null = null;
    private recordLabel: Label | null = null;
    private selectedFactory: any = null;

    onLoad() {
        // 确保 Canvas 节点有 UITransform + Canvas 组件
        if (!this.node.getComponent(UITransform)) {
            const ut = this.node.addComponent(UITransform);
            ut.contentSize = new Size(1280, 720);
            ut.anchorPoint = new Vec2(0.5, 0.5);
        }
        if (!this.node.getComponent(Canvas)) {
            this.node.addComponent(Canvas);
        }

        // 确保有 Camera
        let cam = this.node.getComponentInChildren(Camera);
        if (!cam) {
            const camNode = new Node('UICamera');
            camNode.layer = this.node.layer;
            camNode.parent = this.node;
            cam = camNode.addComponent(Camera);
            cam.projection = 0; // ORTHO
            cam.orthoHeight = 360;
            cam.priority = 1073741824;
            cam.clearFlags = gfx.ClearFlagBit.COLOR;
            cam.clearColor = new Color(13, 20, 24, 255);
        }

        this.uiLayer = this.node.layer;
        this.createGameContainer();
        this.createUI();
    }

    start() {
        this.showStartPanel();
    }

    update(dt: number) {
        this.mapAnimT += dt;
        this.animateMap();
        this.updateCardTimeout(dt); // 选卡暂停期间也要倒计时（在 gameRunning 判断之前）
        if (!this.gameRunning) return;
        // 逻辑帧异常隔离：任何运行时错误不允许冻结胜负判定与渲染
        try {
            this.gameStep(dt);
        } catch (e) {
            console.error('[gameStep] 帧内异常（已跳过该帧）:', e);
        }
        this.syncVisuals();
        this.updateUI();
    }

    /** 地图细节动画：河道波纹左右流动 */
    private animateMap() {
        if (this.riverWaves.length === 0) return;
        const t = this.mapAnimT;
        this.riverWaves.forEach((w, i) => {
            const y = w.position.y;
            w.setPosition(Math.sin(t * 1.6 + i * 0.9) * 26, y, 0);
        });
    }

    // ==================== 创建游戏容器 ====================
    private createGameContainer() {
        this.gameContainer = new Node('GameContainer');
        this.gameContainer.layer = this.uiLayer;
        this.gameContainer.parent = this.node;
        const ct = this.gameContainer.addComponent(UITransform);
        ct.contentSize = new Size(1280, 720);
        ct.anchorPoint = new Vec2(0.5, 0.5);

        // 背景
        const bg = this.createColorNode(new Color(13, 20, 24), 1280, 720);
        bg.parent = this.gameContainer;
        bg.setPosition(0, 0, 0);

        // ==== 地图布局常量 ====
        // 河：垂直居中，x ∈ [-60, 60]；主道（桥）：水平，y ∈ [-45, 45]，横穿全图
        const RIVER_HALF_X = 60;
        const ROAD_HALF_Y = 45;

        // 己方建造区高亮底色（左侧半场，先画，主道/河会覆盖其上）
        const zone = this.createColorNode(new Color(80, 140, 255, 22), 530, 660);
        zone.name = 'BuildZone';
        zone.parent = this.gameContainer;
        zone.setPosition(-355, 0, 0);

        // 兵线主道（横贯全图的水平路）
        const road = this.createColorNode(new Color(52, 62, 46), 1280, ROAD_HALF_Y * 2);
        road.name = 'MainRoad';
        road.parent = this.gameContainer;
        road.setPosition(0, 0, 0);
        // 主道中央虚线（提示路径）
        for (let x = -600; x <= 600; x += 80) {
            const dash = this.createColorNode(new Color(140, 170, 130, 90), 40, 5);
            dash.parent = this.gameContainer;
            dash.setPosition(x, 0, 0);
        }

        // 河道（垂直，覆盖主道以外的部分）
        const river = this.createColorNode(new Color(28, 70, 120, 235), RIVER_HALF_X * 2, 720);
        river.name = 'River';
        river.parent = this.gameContainer;
        river.setPosition(0, 0, 0);
        // 河道波纹装饰（会流动）
        this.riverWaves = [];
        for (let i = 0; i < 5; i++) {
            const wave = this.createColorNode(new Color(70, 130, 190, 130), 80, 4);
            wave.parent = river;
            wave.setPosition(0, 240 - i * 120, 0);
            this.riverWaves.push(wave);
        }

        // 桥（主道跨河段）
        const bridge = this.createColorNode(new Color(110, 84, 56), RIVER_HALF_X * 2, ROAD_HALF_Y * 2);
        bridge.name = 'Bridge';
        bridge.parent = this.gameContainer;
        bridge.setPosition(0, 0, 0);
        // 桥栏
        const railCol = new Color(140, 108, 74);
        const railT = this.createColorNode(railCol, RIVER_HALF_X * 2 + 10, 4); railT.parent = bridge; railT.setPosition(0, ROAD_HALF_Y - 2, 0);
        const railB = this.createColorNode(railCol, RIVER_HALF_X * 2 + 10, 4); railB.parent = bridge; railB.setPosition(0, -ROAD_HALF_Y + 2, 0);
        // 桥面木板纹理（竖向木板）
        for (let x = -50; x <= 50; x += 20) {
            const plank = this.createColorNode(new Color(130, 100, 66, 140), 4, ROAD_HALF_Y * 2 - 10);
            plank.parent = bridge;
            plank.setPosition(x, 0, 0);
        }

        // 建造区边框（上下两条，主道隔开）
        const borderCol = new Color(120, 170, 255, 190);
        const bt = this.createColorNode(borderCol, 530, 3); bt.parent = this.gameContainer; bt.setPosition(-355, 330, 0);
        const bb = this.createColorNode(borderCol, 530, 3); bb.parent = this.gameContainer; bb.setPosition(-355, -330, 0);
        const bl = this.createColorNode(borderCol, 3, 660); bl.parent = this.gameContainer; bl.setPosition(-620, 0, 0);
        const br = this.createColorNode(borderCol, 3, 660); br.parent = this.gameContainer; br.setPosition(-90, 0, 0);
        // 建造区标题
        const zTitle = new Node();
        zTitle.layer = this.uiLayer;
        zTitle.parent = this.gameContainer;
        const ztUt = zTitle.addComponent(UITransform);
        ztUt.contentSize = new Size(200, 20);
        const ztLabel = zTitle.addComponent(Label);
        ztLabel.string = '己方建造区（主道/河道除外）';
        ztLabel.fontSize = 14;
        ztLabel.color = new Color(159, 208, 255, 230);
        ztLabel.lineHeight = 18;
        zTitle.setPosition(-355, 308, 0);
        this.buildZoneNode = zone;

        // 点击游戏区选择己方兵工厂（升级入口）
        this.gameContainer.on(Node.EventType.TOUCH_END, this.onGameTouch, this);
        // 建造模式预览：指针移动/拖动时实时显示吸附格点（v0.5.0）
        this.gameContainer.on(Node.EventType.TOUCH_MOVE, this.onBuildPointerMove, this);
        this.gameContainer.on(Node.EventType.MOUSE_MOVE, this.onBuildPointerMove, this);
        // ESC/右键取消建造模式
        this.node.on(Node.EventType.KEY_DOWN, (e: any) => {
            if (e.keyCode === 27 || e.keyCode === 46) this.cancelBuildMode(); // Esc / Delete
        });
        this.gameContainer.on(Node.EventType.MOUSE_DOWN, (e: any) => {
            if (e.getButton && e.getButton() === 2) this.cancelBuildMode(); // 右键
        });
    }

    // ==================== 创建UI ====================
    private createUI() {
        this.uiContainer = new Node('UIContainer');
        this.uiContainer.layer = this.uiLayer;
        this.uiContainer.parent = this.node;
        const ut = this.uiContainer.addComponent(UITransform);
        ut.contentSize = new Size(1280, 720);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        this.createTopBar();
        this.createBuildBar();
        this.createStartPanel();
        this.createEndPanel();
        this.createCardPanel();
        this.createUpgradePanel();
        this.createTutorialPanel();
        this.createToast();
    }

    private createTopBar() {
        const bar = new Node('TopBar');
        bar.layer = this.uiLayer;
        bar.parent = this.uiContainer;
        const ut = bar.addComponent(UITransform);
        ut.contentSize = new Size(1280, 44);
        ut.anchorPoint = new Vec2(0.5, 1);

        // 对齐到屏幕顶部（否则默认停在屏幕中心）
        const widget = bar.addComponent(Widget);
        widget.isAlignTop = true;
        widget.isAlignHorizontalCenter = true;
        widget.top = 0;

        const bg = this.createColorNode(new Color(34, 48, 58), 1280, 44);
        bg.parent = bar;
        bg.setPosition(0, -22, 0);

        const makeLabel = (text: string, x: number, y: number, color: Color, size: number = 18) => {
            const node = new Node();
            node.layer = this.uiLayer;
            node.parent = bar;
            const ut = node.addComponent(UITransform);
            ut.contentSize = new Size(200, 30);
            ut.anchorPoint = new Vec2(0.5, 0.5);
            const label = node.addComponent(Label);
            label.string = text;
            label.fontSize = size;
            label.color = color;
            label.lineHeight = size;
            node.setPosition(x, y, 0);
            return label;
        };

        this.goldLabel = makeLabel('💰 200', -550, -22, new Color(255, 215, 94));
        this.popLabel = makeLabel('👥 0/60', -380, -22, new Color(255, 255, 255));
        this.killsLabel = makeLabel(' 0', -220, -22, new Color(255, 255, 255));
        this.waveLabel = makeLabel('🌊 第 0 波', 200, -22, new Color(255, 255, 255));
        this.hpRedLabel = makeLabel('🔴 ' + GAME_CONFIG.crystalHealth, 400, -22, new Color(255, 138, 122));
        this.hpBlueLabel = makeLabel('🔵 ' + GAME_CONFIG.crystalHealth, 560, -22, new Color(122, 184, 255));
    }

    private createBuildBar() {
        this.buildBar = new Node('BuildBar');
        this.buildBar.layer = this.uiLayer;
        this.buildBar.parent = this.uiContainer;
        const ut = this.buildBar.addComponent(UITransform);
        ut.contentSize = new Size(1280, 76);
        ut.anchorPoint = new Vec2(0.5, 0);

        // 对齐到屏幕底部（否则默认停在屏幕中心）
        const widget = this.buildBar.addComponent(Widget);
        widget.isAlignBottom = true;
        widget.isAlignHorizontalCenter = true;
        widget.bottom = 0;

        const bg = this.createColorNode(new Color(34, 48, 58), 1280, 76);
        bg.parent = this.buildBar;
        bg.setPosition(0, 38, 0);

        const types = Object.keys(BUILDING_TYPES) as BuildingId[];
        const startX = -450;
        const gap = 92;

        types.forEach((type, i) => {
            const btn = this.createBuildButton(type);
            btn.parent = this.buildBar;
            btn.setPosition(startX + i * gap, 38, 0);
        });

        // 全军强化研究按钮（需战争学院 Lv2，动态显示）
        const researchBtn = this.createBuildButton('research');
        researchBtn.parent = this.buildBar;
        researchBtn.setPosition(startX + types.length * gap, 38, 0);
        researchBtn.active = false;
        this.researchBtn = researchBtn;
    }

    private createBuildButton(type: BuildingId | 'research'): Node {
        const building = type === 'research'
            ? { name: '全军强化', icon: '⚔️' }
            : BUILDING_TYPES[type];
        const btn = new Node('BuildBtn_' + type);
        btn.layer = this.uiLayer;
        const ut = btn.addComponent(UITransform);
        ut.contentSize = new Size(86, 64);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.createColorNode(new Color(46, 65, 82), 86, 64);
        bg.parent = btn;

        const iconLabel = new Node();
        iconLabel.layer = this.uiLayer;
        iconLabel.parent = btn;
        const icUt = iconLabel.addComponent(UITransform);
        icUt.contentSize = new Size(60, 24);
        const icLabel = iconLabel.addComponent(Label);
        icLabel.string = building.icon;
        icLabel.fontSize = 20;
        icLabel.color = Color.WHITE;
        iconLabel.setPosition(0, 10, 0);

        const nameLabel = new Node();
        nameLabel.layer = this.uiLayer;
        nameLabel.parent = btn;
        const nmUt = nameLabel.addComponent(UITransform);
        nmUt.contentSize = new Size(80, 16);
        const nmLabel = nameLabel.addComponent(Label);
        nmLabel.string = building.name;
        nmLabel.fontSize = 12;
        nmLabel.color = new Color(223, 233, 240);
        nameLabel.setPosition(0, -8, 0);

        const costLabel = new Node();
        costLabel.layer = this.uiLayer;
        costLabel.parent = btn;
        const csUt = costLabel.addComponent(UITransform);
        csUt.contentSize = new Size(60, 14);
        const csLabel = costLabel.addComponent(Label);
        csLabel.string = this.getBuildCostText(type) ?? '';
        csLabel.fontSize = 11;
        csLabel.color = new Color(255, 215, 94);
        costLabel.setPosition(0, -22, 0);
        this.buildCostLabels.set(type, csLabel);

        // 点击事件
        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.1;

        const clickHandler = new EventHandler();
        clickHandler.target = this.node;
        clickHandler.component = 'GameManager';
        clickHandler.handler = type === 'research' ? 'onResearchClick' : 'onBuildClick';
        clickHandler.customEventData = type;
        button.clickEvents = [clickHandler];

        return btn;
    }

    private refreshBuildBar() {
        if (!this.G || !this.G.gold) return;
        this.buildCostLabels.forEach((label, type) => {
            const text = this.getBuildCostText(type);
            if (text !== null) label.string = text;
        });
        if (this.researchBtn) {
            this.researchBtn.active = (this.G.academies?.red ?? 0) >= 2;
        }
    }

    private getBuildCostText(type: BuildingId | 'research'): string | null {
        if (type === 'research') {
            if (!this.G || !this.G.researchCosts) return null;
            return this.G.researchCosts.red + '金';
        }
        if (type === 'academy') {
            const lvl = this.G.academies ? this.G.academies.red : 0;
            if (lvl >= 2) return '已满级';
            return ACADEMY_LEVELS[(lvl + 1) as 1 | 2].cost + '金';
        }
        if (type === 'auraTower') {
            return this.G.auraBuilt && this.G.auraBuilt.red ? '已建造' : AURA_TOWER.cost + '金';
        }
        if (isFactoryId(type)) {
            const owned = this.G.buildings
                ? this.G.buildings.filter((b: any) => b.side === 'red' && b.unitType === type).length
                : 0;
            return getFactoryPrice(type, this.selectedFaction, owned) + '金';
        }
        return getBuildingCost(type, this.selectedFaction) + '金';
    }

    private createStartPanel() {
        this.startPanel = new Node('StartPanel');
        this.startPanel.layer = this.uiLayer;
        this.startPanel.parent = this.uiContainer;
        const ut = this.startPanel.addComponent(UITransform);
        ut.contentSize = new Size(1280, 720);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.createColorNode(new Color(5, 10, 14, 210), 1280, 720);
        bg.parent = this.startPanel;

        // 标题
        const title = new Node();
        title.layer = this.uiLayer;
        title.parent = this.startPanel;
        const tUt = title.addComponent(UITransform);
        tUt.contentSize = new Size(400, 50);
        const tLabel = title.addComponent(Label);
        tLabel.string = '果林大战';
        tLabel.fontSize = 42;
        tLabel.color = Color.WHITE;
        tLabel.lineHeight = 50;
        title.setPosition(0, 200, 0);

        // 副标题
        const sub = new Node();
        sub.layer = this.uiLayer;
        sub.parent = this.startPanel;
        const sUt = sub.addComponent(UITransform);
        sUt.contentSize = new Size(400, 30);
        const sLabel = sub.addComponent(Label);
        sLabel.string = '选择你的阵营';
        sLabel.fontSize = 20;
        sLabel.color = new Color(159, 208, 255);
        sLabel.lineHeight = 30;
        sub.setPosition(0, 150, 0);

        // 阵营按钮
        const factionKeys = Object.keys(FACTIONS);
        const colors = [new Color(255, 112, 67), new Color(102, 187, 106), new Color(255, 202, 40)];
        factionKeys.forEach((key, i) => {
            const f = FACTIONS[key];
            const btn = this.createFactionButton(f.name, f.passive, colors[i], key);
            btn.parent = this.startPanel;
            btn.setPosition(-240 + i * 240, 20, 0);
        });

        // 难度选择
        const diffLabel = new Node();
        diffLabel.layer = this.uiLayer;
        diffLabel.parent = this.startPanel;
        const dUt = diffLabel.addComponent(UITransform);
        dUt.contentSize = new Size(200, 24);
        const dLabel = diffLabel.addComponent(Label);
        dLabel.string = '难度：普通';
        dLabel.fontSize = 18;
        dLabel.color = Color.WHITE;
        diffLabel.setPosition(0, -80, 0);

        const diffBtn = new Node();
        diffBtn.layer = this.uiLayer;
        diffBtn.parent = this.startPanel;
        const dbUt = diffBtn.addComponent(UITransform);
        dbUt.contentSize = new Size(160, 40);
        const dbBg = this.createColorNode(new Color(46, 65, 82), 160, 40);
        dbBg.parent = diffBtn;
        // 文字必须是子节点（在背景之后创建），否则会被背景色块盖住
        const dbTextNode = new Node();
        dbTextNode.layer = this.uiLayer;
        dbTextNode.parent = diffBtn;
        const dbtUt = dbTextNode.addComponent(UITransform);
        dbtUt.contentSize = new Size(160, 40);
        const dbLabel = dbTextNode.addComponent(Label);
        dbLabel.string = '切换难度';
        dbLabel.fontSize = 16;
        dbLabel.color = Color.WHITE;
        dbLabel.lineHeight = 20;
        diffBtn.setPosition(0, -120, 0);

        const dbButton = diffBtn.addComponent(Button);
        dbButton.transition = Button.Transition.SCALE;
        const dbHandler = new EventHandler();
        dbHandler.target = this.node;
        dbHandler.component = 'GameManager';
        dbHandler.handler = 'onDiffClick';
        dbButton.clickEvents = [dbHandler];

        // 开始按钮
        const startBtn = new Node();
        startBtn.layer = this.uiLayer;
        startBtn.parent = this.startPanel;
        const sbUt = startBtn.addComponent(UITransform);
        sbUt.contentSize = new Size(200, 50);
        const sbBg = this.createColorNode(new Color(63, 109, 51), 200, 50);
        sbBg.parent = startBtn;
        // 文字必须是子节点（在背景之后创建），否则会被背景色块盖住
        const sbTextNode = new Node();
        sbTextNode.layer = this.uiLayer;
        sbTextNode.parent = startBtn;
        const sbtUt = sbTextNode.addComponent(UITransform);
        sbtUt.contentSize = new Size(200, 50);
        const sbLabel = sbTextNode.addComponent(Label);
        sbLabel.string = '开始游戏';
        sbLabel.fontSize = 24;
        sbLabel.color = Color.WHITE;
        sbLabel.lineHeight = 30;
        startBtn.setPosition(0, -200, 0);

        const sButton = startBtn.addComponent(Button);
        sButton.transition = Button.Transition.SCALE;
        const sHandler = new EventHandler();
        sHandler.target = this.node;
        sHandler.component = 'GameManager';
        sHandler.handler = 'onStartClick';
        sButton.clickEvents = [sHandler];

        // 本地战绩（存档）
        const recNode = new Node();
        recNode.layer = this.uiLayer;
        recNode.parent = this.startPanel;
        const rcUt = recNode.addComponent(UITransform);
        rcUt.contentSize = new Size(500, 30);
        this.recordLabel = recNode.addComponent(Label);
        this.recordLabel.string = '';
        this.recordLabel.fontSize = 16;
        this.recordLabel.color = new Color(159, 208, 255);
        this.recordLabel.lineHeight = 22;
        recNode.setPosition(0, -262, 0);
    }

    private createUpgradePanel() {
        const panel = new Node('UpgradePanel');
        panel.layer = this.uiLayer;
        panel.parent = this.uiContainer;
        const ut = panel.addComponent(UITransform);
        ut.contentSize = new Size(440, 150);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const bg = this.createColorNode(new Color(20, 30, 40, 235), 440, 150);
        bg.parent = panel;

        const infoNode = new Node();
        infoNode.layer = this.uiLayer;
        infoNode.parent = panel;
        const iUt = infoNode.addComponent(UITransform);
        iUt.contentSize = new Size(400, 30);
        this.upgradeInfoLabel = infoNode.addComponent(Label);
        this.upgradeInfoLabel.string = '';
        this.upgradeInfoLabel.fontSize = 20;
        this.upgradeInfoLabel.color = Color.WHITE;
        this.upgradeInfoLabel.lineHeight = 26;
        infoNode.setPosition(0, 45, 0);

        const costNode = new Node();
        costNode.layer = this.uiLayer;
        costNode.parent = panel;
        const cUt = costNode.addComponent(UITransform);
        cUt.contentSize = new Size(400, 24);
        this.upgradeCostLabel = costNode.addComponent(Label);
        this.upgradeCostLabel.string = '';
        this.upgradeCostLabel.fontSize = 16;
        this.upgradeCostLabel.color = new Color(255, 215, 94);
        this.upgradeCostLabel.lineHeight = 22;
        costNode.setPosition(0, 12, 0);

        const upBtn = new Node();
        upBtn.layer = this.uiLayer;
        upBtn.parent = panel;
        const ubUt = upBtn.addComponent(UITransform);
        ubUt.contentSize = new Size(170, 44);
        const ubBg = this.createColorNode(new Color(63, 109, 51), 170, 44);
        ubBg.parent = upBtn;
        // 文字必须是子节点，否则会被背景色块盖住
        const ubTextNode = new Node();
        ubTextNode.layer = this.uiLayer;
        ubTextNode.parent = upBtn;
        const ubtUt = ubTextNode.addComponent(UITransform);
        ubtUt.contentSize = new Size(170, 44);
        const ubLabel = ubTextNode.addComponent(Label);
        ubLabel.string = '升级';
        ubLabel.fontSize = 20;
        ubLabel.color = Color.WHITE;
        ubLabel.lineHeight = 26;
        upBtn.setPosition(-90, -42, 0);
        this.upgradeBtnNode = upBtn; // 顶级时隐藏（v0.4.4）
        const ubButton = upBtn.addComponent(Button);
        ubButton.transition = Button.Transition.SCALE;
        const ubHandler = new EventHandler();
        ubHandler.target = this.node;
        ubHandler.component = 'GameManager';
        ubHandler.handler = 'onUpgradeConfirm';
        ubButton.clickEvents = [ubHandler];

        const closeBtn = new Node();
        closeBtn.layer = this.uiLayer;
        closeBtn.parent = panel;
        const cbUt = closeBtn.addComponent(UITransform);
        cbUt.contentSize = new Size(120, 44);
        const cbBg = this.createColorNode(new Color(70, 80, 92), 120, 44);
        cbBg.parent = closeBtn;
        // 文字必须是子节点，否则会被背景色块盖住
        const cbTextNode = new Node();
        cbTextNode.layer = this.uiLayer;
        cbTextNode.parent = closeBtn;
        const cbtUt = cbTextNode.addComponent(UITransform);
        cbtUt.contentSize = new Size(120, 44);
        const cbLabel = cbTextNode.addComponent(Label);
        cbLabel.string = '关闭';
        cbLabel.fontSize = 18;
        cbLabel.color = Color.WHITE;
        cbLabel.lineHeight = 24;
        closeBtn.setPosition(110, -42, 0);
        const cbButton = closeBtn.addComponent(Button);
        cbButton.transition = Button.Transition.SCALE;
        const cbHandler = new EventHandler();
        cbHandler.target = this.node;
        cbHandler.component = 'GameManager';
        cbHandler.handler = 'onUpgradeClose';
        cbButton.clickEvents = [cbHandler];

        panel.active = false;
        this.upgradePanel = panel;
    }

    private createTutorialPanel() {
        const panel = new Node('TutorialPanel');
        panel.layer = this.uiLayer;
        panel.parent = this.uiContainer;
        const ut = panel.addComponent(UITransform);
        ut.contentSize = new Size(700, 80);
        ut.anchorPoint = new Vec2(0.5, 0.5);
        const bg = this.createColorNode(new Color(0, 0, 0, 180), 700, 80);
        bg.parent = panel;
        const tNode = new Node();
        tNode.layer = this.uiLayer;
        tNode.parent = panel;
        const tUt = tNode.addComponent(UITransform);
        tUt.contentSize = new Size(680, 60);
        const tLabel = tNode.addComponent(Label);
        tLabel.string = '👆 点击下方「坦克厂」，建造你的第一个兵工厂！';
        tLabel.fontSize = 22;
        tLabel.color = new Color(255, 230, 140);
        tLabel.lineHeight = 30;
        tNode.setPosition(0, 0, 0);
        panel.setPosition(0, -230, 0);
        panel.active = false;
        this.tutorialPanel = panel;
    }

    private createFactionButton(name: string, passive: string, color: Color, key: string): Node {
        const btn = new Node('FactionBtn_' + key);
        btn.layer = this.uiLayer;
        const ut = btn.addComponent(UITransform);
        ut.contentSize = new Size(200, 120);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.createColorNode(new Color(46, 65, 82), 200, 120);
        bg.parent = btn;

        const nameLabel = new Node();
        nameLabel.layer = this.uiLayer;
        nameLabel.parent = btn;
        const nUt = nameLabel.addComponent(UITransform);
        nUt.contentSize = new Size(180, 30);
        const nLabel = nameLabel.addComponent(Label);
        nLabel.string = name;
        nLabel.fontSize = 22;
        nLabel.color = color;
        nLabel.lineHeight = 28;
        nameLabel.setPosition(0, 25, 0);

        const passiveLabel = new Node();
        passiveLabel.layer = this.uiLayer;
        passiveLabel.parent = btn;
        const pUt = passiveLabel.addComponent(UITransform);
        pUt.contentSize = new Size(180, 50);
        const pLabel = passiveLabel.addComponent(Label);
        pLabel.string = passive;
        pLabel.fontSize = 13;
        pLabel.color = new Color(159, 180, 196);
        pLabel.lineHeight = 18;
        passiveLabel.setPosition(0, -15, 0);

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.05;
        const handler = new EventHandler();
        handler.target = this.node;
        handler.component = 'GameManager';
        handler.handler = 'onFactionClick';
        handler.customEventData = key;
        button.clickEvents = [handler];

        return btn;
    }

    private createEndPanel() {
        this.endPanel = new Node('EndPanel');
        this.endPanel.layer = this.uiLayer;
        this.endPanel.parent = this.uiContainer;
        this.endPanel.active = false;
        const ut = this.endPanel.addComponent(UITransform);
        ut.contentSize = new Size(1280, 720);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.createColorNode(new Color(5, 10, 14, 210), 1280, 720);
        bg.parent = this.endPanel;

        const title = new Node();
        title.layer = this.uiLayer;
        title.parent = this.endPanel;
        const tUt = title.addComponent(UITransform);
        tUt.contentSize = new Size(400, 50);
        const tLabel = title.addComponent(Label);
        tLabel.string = '游戏结束';
        tLabel.fontSize = 36;
        tLabel.color = Color.WHITE;
        tLabel.lineHeight = 40;
        title.setPosition(0, 150, 0);

        const stats = new Node();
        stats.layer = this.uiLayer;
        stats.parent = this.endPanel;
        const stUt = stats.addComponent(UITransform);
        stUt.contentSize = new Size(400, 120);
        const stLabel = stats.addComponent(Label);
        stLabel.string = '';
        stLabel.fontSize = 20;
        stLabel.color = new Color(207, 227, 240);
        stLabel.lineHeight = 32;
        stats.setPosition(0, 30, 0);

        const againBtn = new Node();
        againBtn.layer = this.uiLayer;
        againBtn.parent = this.endPanel;
        const abUt = againBtn.addComponent(UITransform);
        abUt.contentSize = new Size(180, 50);
        const abBg = this.createColorNode(new Color(63, 109, 51), 180, 50);
        abBg.parent = againBtn;
        // 文字必须是子节点，否则会被背景色块盖住
        const abTextNode = new Node();
        abTextNode.layer = this.uiLayer;
        abTextNode.parent = againBtn;
        const abtUt = abTextNode.addComponent(UITransform);
        abtUt.contentSize = new Size(180, 50);
        const abLabel = abTextNode.addComponent(Label);
        abLabel.string = '再来一局';
        abLabel.fontSize = 22;
        abLabel.color = Color.WHITE;
        abLabel.lineHeight = 28;
        againBtn.setPosition(0, -100, 0);

        const abButton = againBtn.addComponent(Button);
        abButton.transition = Button.Transition.SCALE;
        const abHandler = new EventHandler();
        abHandler.target = this.node;
        abHandler.component = 'GameManager';
        abHandler.handler = 'onAgainClick';
        abButton.clickEvents = [abHandler];
    }

    private createCardPanel() {
        this.cardPanel = new Node('CardPanel');
        this.cardPanel.layer = this.uiLayer;
        this.cardPanel.parent = this.uiContainer;
        this.cardPanel.active = false;
        const ut = this.cardPanel.addComponent(UITransform);
        ut.contentSize = new Size(1280, 720);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        const bg = this.createColorNode(new Color(5, 10, 14, 235), 1280, 720);
        bg.parent = this.cardPanel;
        // 挡住点击穿透：防止选卡时误触战场（建造/选中工厂）
        bg.addComponent(BlockInputEvents);

        const title = new Node();
        title.layer = this.uiLayer;
        title.parent = this.cardPanel;
        const tUt = title.addComponent(UITransform);
        tUt.contentSize = new Size(500, 40);
        const tLabel = title.addComponent(Label);
        tLabel.string = '⏸ 游戏暂停 · 选择一张卡牌';
        tLabel.fontSize = 30;
        tLabel.color = new Color(255, 215, 94);
        tLabel.lineHeight = 36;
        title.setPosition(0, 220, 0);

        const sub = new Node('CardSub');
        sub.layer = this.uiLayer;
        sub.parent = this.cardPanel;
        const sUt = sub.addComponent(UITransform);
        sUt.contentSize = new Size(400, 24);
        const sLabel = sub.addComponent(Label);
        sLabel.string = '点击一张卡牌后战斗继续';
        sLabel.fontSize = 16;
        sLabel.color = new Color(159, 180, 196);
        sLabel.lineHeight = 22;
        sub.setPosition(0, 180, 0);
    }

    private createToast() {
        const toast = new Node('Toast');
        toast.layer = this.uiLayer;
        toast.parent = this.uiContainer;
        const tUt = toast.addComponent(UITransform);
        tUt.contentSize = new Size(400, 40);
        tUt.anchorPoint = new Vec2(0.5, 1);
        const tBg = this.createColorNode(new Color(0, 0, 0, 180), 400, 40);
        tBg.parent = toast;
        // 文字必须是子节点，否则会被背景色块盖住
        const tTextNode = new Node();
        tTextNode.layer = this.uiLayer;
        tTextNode.parent = toast;
        const ttUt = tTextNode.addComponent(UITransform);
        ttUt.contentSize = new Size(400, 40);
        this.toastLabel = tTextNode.addComponent(Label);
        this.toastLabel.string = '';
        this.toastLabel.fontSize = 18;
        this.toastLabel.color = Color.WHITE;
        this.toastLabel.lineHeight = 24;
        toast.setPosition(0, 340, 0);
        toast.active = false;
    }

    // ==================== 创建纯色节点 ====================
    private createColorNode(color: Color, w: number, h: number): Node {
        const node = new Node();
        node.layer = this.uiLayer;
        const uiTransform = node.addComponent(UITransform);
        uiTransform.contentSize = new Size(w, h);
        uiTransform.anchorPoint = new Vec2(0.5, 0.5);
        const sprite = node.addComponent(Sprite);
        const sf = this.getColorSpriteFrame(color, w, h);
        if (sf) sprite.spriteFrame = sf;
        return node;
    }

    private getColorSpriteFrame(color: Color, w: number, h: number): SpriteFrame | null {
        const key = `${color.r},${color.g},${color.b},${color.a},${w}x${h}`;
        if (this.colorTextures.has(key)) return this.colorTextures.get(key)!;

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(w));
        canvas.height = Math.max(1, Math.floor(h));
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const image = new ImageAsset();
        image._nativeAsset = canvas;
        const texture = new Texture2D();
        texture.image = image;

        const sf = new SpriteFrame();
        sf.texture = texture;
        this.colorTextures.set(key, sf);
        return sf;
    }

    // ==================== UI事件 ====================
    onFactionClick(event: Event, faction: string) {
        if (!FACTIONS[faction as FactionId]) return;
        this.selectedFaction = faction as FactionId;
        this.refreshBuildBar();
        this.showToast('选择了：' + FACTIONS[faction].name);
    }

    onDiffClick(event: Event) {
        const diffs = ['easy', 'normal', 'hard'] as const;
        const idx = diffs.indexOf(this.selectedDifficulty);
        this.selectedDifficulty = diffs[(idx + 1) % 3];
        // 更新难度显示
        const diffNode = this.startPanel?.children.find(c => c.getComponent(Label));
        // 简化：直接toast
        this.showToast('难度：' + DIFFICULTIES[this.selectedDifficulty].name);
    }

    onStartClick(event: Event) {
        if (this.startPanel) this.startPanel.active = false;
        this.initGame();
        this.G.playerFaction = this.selectedFaction;
        this.G.difficulty = this.selectedDifficulty;
        this.G.phase = 'playing';
        this.gameRunning = true;
        this.G.gameStartTime = Date.now(); // 记录游戏开始时间
        this.refreshBuildBar();
        this.showToast('游戏开始！阵营：' + FACTIONS[this.selectedFaction].name);
        // 首次游玩：新手教学（手指引导造第一个兵工厂）
        const save = this.loadSave();
        if (!save.tutorialDone) this.showTutorial();
    }

    onBuildClick(event: Event, type: string) {
        if (!this.gameRunning) return;
        const id = type as BuildingId;
        const side = this.G.playerSide;

        // 学院：已有学院 → 直接升级 Lv2（不需要选位置）；无学院 → 进入建造模式自选位置
        if (id === 'academy') {
            const lvl = this.G.academies[side] ?? 0;
            if (lvl >= 2) {
                this.showToast('战争学院已满级');
                return;
            }
            if (lvl >= 1) {
                this.buildAcademyUpgrade(side);
                return;
            }
            this.enterBuildMode(id);
            return;
        }
        // 光环塔：限 1 座；未建 → 进入建造模式自选位置
        if (id === 'auraTower') {
            if (this.G.auraBuilt[side]) {
                this.showToast('光环塔每方限建 1 座');
                return;
            }
            this.enterBuildMode(id);
            return;
        }
        if (!isFactoryId(id) || !(id in BUILDING_TYPES)) return;

        this.enterBuildMode(id);
    }

    /** 进入建造模式：点击左侧建造区放置 */
    private enterBuildMode(id: BuildingId) {
        const side = this.G.playerSide;
        if (this.buildMode === id) {
            // 再点一次取消建造模式
            this.cancelBuildMode();
            this.showToast('已取消建造');
            return;
        }
        // 预算预检：金币不够直接提示，不进入放置
        const cost = this.getBuildCost(id);
        if (this.G.gold[side] < cost) {
            this.showToast('金币不足！需要 ' + cost + ' 金');
            return;
        }
        this.buildMode = id;
        this.setBuildZoneHighlight(true);
        this.showToast('点击绿色格子放置「' + BUILDING_TYPES[id].name + '」（ESC 取消）');
    }

    /** 当前建造项的成本（工厂带同类型递增价） */
    private getBuildCost(id: BuildingId): number {
        if (isFactoryId(id)) {
            const owned = this.G.buildings.filter((b: any) => b.side === 'red' && b.unitType === id).length;
            return getFactoryPrice(id, this.G.playerFaction, owned);
        }
        if (id === 'academy') {
            const lvl = this.G.academies?.red ?? 0;
            return ACADEMY_LEVELS[(lvl + 1) as 1 | 2].cost;
        }
        return AURA_TOWER.cost;
    }

    // ==================== 建造网格（v0.5.0） ====================
    /** 所有格点（懒加载缓存） */
    private gridCells: Array<{ x: number; y: number }> | null = null;

    private getGridCells(): Array<{ x: number; y: number }> {
        if (!this.gridCells) this.gridCells = BUILD_GRID.cells();
        return this.gridCells;
    }

    /** 坐标吸附到最近格点；无可行格返回 null */
    private snapToGrid(px: number, py: number): { x: number; y: number } | null {
        let best: { x: number; y: number } | null = null;
        let bestDist = Infinity;
        for (const c of this.getGridCells()) {
            const d = (c.x - px) ** 2 + (c.y - py) ** 2;
            if (d < bestDist) { bestDist = d; best = c; }
        }
        // 吸附距离上限：1.2 格，太远视为建造区外
        if (best && bestDist <= (BUILD_GRID.cellSize * 1.2) ** 2) return best;
        return null;
    }

    /** 格点是否被占用（同格中心距 < 半格即视为占用） */
    private isCellOccupied(x: number, y: number, forSide?: string): boolean {
        for (const b of this.G.buildings) {
            if (forSide && b.side !== forSide) continue;
            if (Math.abs(b.x - x) < BUILD_GRID.cellSize / 2 && Math.abs(b.y - y) < BUILD_GRID.cellSize / 2) {
                return true;
            }
        }
        // 防御塔/水晶也不可压（塔在 ±450,±70，本就不在格点上，保险起见也检查）
        for (const t of [...this.G.towers, ...this.G.crystals]) {
            if (Math.abs(t.x - x) < BUILD_GRID.cellSize / 2 && Math.abs(t.y - y) < BUILD_GRID.cellSize / 2) {
                return true;
            }
        }
        return false;
    }

    /** 建造模式中：点击 → 吸附最近空格放置（v0.5.0 网格版） */
    private tryPlaceBuilding(px: number, py: number) {
        const id = this.buildMode as BuildingId;
        if (!id) return;
        // 吸附格点：太远（>1.2格）提示建造区，吸附失败同样提示
        const cell = this.snapToGrid(px, py);
        if (!cell) {
            this.showToast('只能在左侧己方建造区内建造！');
            return;
        }
        if (this.isCellOccupied(cell.x, cell.y)) {
            this.showToast('这个格子已被占用');
            return;
        }
        const side = this.G.playerSide;

        if (id === 'academy') {
            this.placeAcademy(cell.x, cell.y, side);
            return;
        }
        if (id === 'auraTower') {
            if (this.G.auraBuilt[side]) {
                this.showToast('光环塔每方限建 1 座');
                this.cancelBuildMode();
                return;
            }
            this.placeAuraTower(cell.x, cell.y, side);
            return;
        }

        const owned = this.G.buildings.filter((b: any) => b.side === 'red' && b.unitType === id).length;
        const cost = getFactoryPrice(id, this.G.playerFaction, owned);
        if (this.G.gold[side] < cost) {
            this.showToast('金币不足！需要 ' + cost + ' 金');
            this.cancelBuildMode();
            return;
        }
        this.G.gold[side] -= cost;
        this.G.buildings.push({
            kind: 'building', type: 'factory', unitType: id, side: 'red',
            x: cell.x, y: cell.y,
            hp: BUILDING_TYPES[id].health, maxHp: BUILDING_TYPES[id].health,
            baseHp: BUILDING_TYPES[id].health,
            waveTimer: FACTIONS[this.G.playerFaction].waveIntervalSeconds,
            level: 1,
        });
        this.showToast('建造了 ' + BUILDING_TYPES[id].name + '！');
        this.cancelBuildMode();
        this.refreshBuildBar();
        this.dismissTutorial();
    }

    /** 建造区高亮/取消高亮 */
    private setBuildZoneHighlight(on: boolean) {
        if (!this.buildZoneNode) return;
        const sprite = this.buildZoneNode.getComponent(Sprite);
        if (sprite) {
            const color = on ? new Color(120, 200, 255, 60) : new Color(80, 140, 255, 22);
            const sf = this.getColorSpriteFrame(color, 530, 660);
            if (sf) sprite.spriteFrame = sf;
        }
        this.setGridOverlay(on);
    }

    // ==================== 建造预览与网格底图（v0.5.0） ====================

    /** 网格底图：建造模式下显示空格/占用格 */
    private setGridOverlay(on: boolean) {
        if (on) {
            if (this.gridOverlayNode) { this.gridOverlayNode.active = true; return; }
            const overlay = new Node('GridOverlay');
            overlay.layer = this.uiLayer;
            overlay.parent = this.gameContainer;
            for (const c of this.getGridCells()) {
                const occupied = this.isCellOccupied(c.x, c.y);
                const cellNode = this.createColorNode(
                    occupied ? new Color(255, 90, 90, 70) : new Color(120, 200, 255, 40),
                    BUILD_GRID.cellSize - 6, BUILD_GRID.cellSize - 6);
                cellNode.parent = overlay;
                cellNode.setPosition(c.x, c.y, 0);
            }
            this.gridOverlayNode = overlay;
        } else if (this.gridOverlayNode) {
            this.gridOverlayNode.active = false;
        }
    }

    /** 刷新网格底图（放置/拆除建筑后调用） */
    private refreshGridOverlay() {
        if (!this.gridOverlayNode || !this.gridOverlayNode.active) return;
        const children = this.gridOverlayNode.children;
        const cells = this.getGridCells();
        for (let i = 0; i < children.length && i < cells.length; i++) {
            const c = cells[i];
            const sp = children[i].getComponent(Sprite);
            if (!sp) continue;
            const occupied = this.isCellOccupied(c.x, c.y);
            const sf = this.getColorSpriteFrame(
                occupied ? new Color(255, 90, 90, 70) : new Color(120, 200, 255, 40),
                BUILD_GRID.cellSize - 6, BUILD_GRID.cellSize - 6);
            if (sf) sp.spriteFrame = sf;
        }
    }

    /** 创建建造预览节点（半透明建筑 + 格点高亮底） */
    private createBuildPreview(id: BuildingId) {
        this.destroyBuildPreview();
        const node = new Node('BuildPreview');
        node.layer = this.uiLayer;
        node.parent = this.gameContainer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(BUILD_GRID.cellSize - 6, BUILD_GRID.cellSize - 6);
        const bg = this.createColorNode(new Color(80, 220, 120, 130), BUILD_GRID.cellSize - 6, BUILD_GRID.cellSize - 6);
        bg.name = 'Bg';
        bg.parent = node;
        this.buildPreviewBg = bg.getComponent(Sprite);
        const icon = new Node('Icon');
        icon.layer = this.uiLayer;
        icon.parent = node;
        const iUt = icon.addComponent(UITransform);
        iUt.contentSize = new Size(40, 40);
        this.buildPreviewIcon = icon.addComponent(Label);
        this.buildPreviewIcon.string = this.getBuildEmoji(id);
        this.buildPreviewIcon.fontSize = 30;
        this.buildPreviewIcon.lineHeight = 36;
        this.buildPreviewIcon.color = Color.WHITE;
        node.active = false;
        this.buildPreviewNode = node;
    }

    private getBuildEmoji(id: BuildingId): string {
        if (id === 'academy') return '🎓';
        if (id === 'auraTower') return '🌀';
        return UNIT_EMOJI[id as UnitRoleId] || '🏭';
    }

    private destroyBuildPreview() {
        if (this.buildPreviewNode && this.buildPreviewNode.isValid) this.buildPreviewNode.destroy();
        this.buildPreviewNode = null;
        this.buildPreviewIcon = null;
        this.buildPreviewBg = null;
        this.buildPreviewValid = false;
        this.buildPreviewCell = null;
    }

    /** 指针移动（鼠标 hover / 触摸拖动）：预览吸附格点 + 红绿反馈 */
    private onBuildPointerMove(event: any) {
        if (!this.buildMode || !this.gameRunning || !this.gameContainer) return;
        const ut = this.gameContainer.getComponent(UITransform);
        if (!ut) return;
        const loc = event.getUILocation();
        // 触摸时预览上移，避免手指遮挡（手机优先）
        const isTouch = event.touch !== undefined;
        const offsetY = isTouch ? 40 : 0;
        const p = ut.convertToNodeSpaceAR(new Vec3(loc.x, loc.y - offsetY, 0));
        if (!this.buildPreviewNode) this.createBuildPreview(this.buildMode);
        this.updateBuildPreview(p.x, p.y);
    }

    private updateBuildPreview(px: number, py: number) {
        if (!this.buildPreviewNode || !this.buildPreviewBg) return;
        const cell = this.snapToGrid(px, py);
        if (!cell) {
            this.buildPreviewNode.active = false;
            this.buildPreviewValid = false;
            this.buildPreviewCell = null;
            return;
        }
        const occupied = this.isCellOccupied(cell.x, cell.y);
        const id = this.buildMode as BuildingId;
        const auraBlocked = id === 'auraTower' && this.G.auraBuilt[this.G.playerSide];
        const gold = this.G.gold[this.G.playerSide];
        const cost = this.getBuildCost(id);
        const valid = !occupied && !auraBlocked && gold >= cost;
        this.buildPreviewNode.active = true;
        this.buildPreviewNode.setPosition(cell.x, cell.y, 0);
        this.buildPreviewValid = valid;
        this.buildPreviewCell = valid ? cell : null;
        const sf = this.getColorSpriteFrame(
            valid ? new Color(80, 220, 120, 150) : new Color(255, 90, 90, 150),
            BUILD_GRID.cellSize - 6, BUILD_GRID.cellSize - 6);
        if (sf) this.buildPreviewBg.spriteFrame = sf;
    }

    /** 取消建造模式（ESC/右键/再点按钮/放置完成） */
    private cancelBuildMode() {
        if (!this.buildMode) {
            // 即使模式已空，预览节点可能残留，兜底清理
            this.destroyBuildPreview();
            return;
        }
        this.buildMode = null;
        this.setBuildZoneHighlight(false);
        this.destroyBuildPreview();
        this.refreshGridOverlay();
    }

    onResearchClick(event: Event) {
        if (!this.gameRunning) return;
        if ((this.G.academies?.red ?? 0) < 2) {
            this.showToast('全军强化需要战争学院 Lv2！');
            return;
        }
        const cost = this.G.researchCosts.red;
        if (this.G.gold.red < cost) {
            this.showToast('金币不足！需要 ' + cost + ' 金');
            return;
        }
        this.G.gold.red -= cost;
        this.G.researchLayers.red++;
        this.G.researchCosts.red = Math.round(
            ARMY_RESEARCH.baseCost * Math.pow(ARMY_RESEARCH.costGrowth, this.G.researchLayers.red));
        const oldAtk = this.G.permBuff.atk || 1;
        this.G.permBuff.atk = oldAtk * (1 + ARMY_RESEARCH.attackBonusPerLayer);
        const ratio = this.G.permBuff.atk / oldAtk;
        // 已在场的己方单位立即同比例加攻（全局生效）
        this.G.units.filter((u: any) => u.side === 'red').forEach((u: any) => {
            u.atk = u.atk * ratio;
        });
        this.showToast('全军强化 Lv' + this.G.researchLayers.red + '！全队攻击 +8%（可无限叠加）');
        this.refreshBuildBar();
    }

    /** 战争学院：Lv1 解锁 Lv3 兵工厂；Lv2 全队攻击 +10% 并解锁全军强化 */
    /** 玩家：在自选位置放置战争学院 Lv1 */
    private placeAcademy(px: number, py: number, side: string) {
        const lvl = this.G.academies[side] ?? 0;
        if (lvl >= 1) {
            this.showToast('战争学院已建造，点击按钮可升级');
            this.cancelBuildMode();
            return;
        }
        const next = ACADEMY_LEVELS[1];
        if (this.G.gold[side] < next.cost) {
            this.showToast('金币不足！需要 ' + next.cost + ' 金');
            this.cancelBuildMode();
            return;
        }
        this.G.gold[side] -= next.cost;
        this.G.buildings.push({
            kind: 'building', type: 'academy', side,
            x: px, y: py,
            hp: next.health, maxHp: next.health, baseHp: next.health,
            level: 1,
        });
        this.G.academies[side] = 1;
        this.showToast('战争学院 Lv1！解锁 Lv3 兵工厂升级');
        this.cancelBuildMode();
        this.refreshBuildBar();
        this.dismissTutorial();
    }

    /** 玩家：升级战争学院到 Lv2（已有学院时点按钮直接升级，无需选位置） */
    private buildAcademyUpgrade(side: string) {
        const lvl = this.G.academies[side] ?? 0;
        if (lvl >= 2) {
            if (side === 'red') this.showToast('战争学院已满级');
            return;
        }
        const next = ACADEMY_LEVELS[(lvl + 1) as 1 | 2];
        if (this.G.gold[side] < next.cost) {
            if (side === 'red') this.showToast('金币不足！需要 ' + next.cost + ' 金');
            return;
        }
        this.G.gold[side] -= next.cost;
        const acad = this.G.buildings.find((b: any) => b.side === side && b.type === 'academy');
        if (acad) {
            acad.level = 2;
            acad.maxHp = next.health;
            acad.hp = Math.min(acad.maxHp, acad.hp + (next.health - ACADEMY_LEVELS[1].health));
        }
        this.G.academies[side] = lvl + 1;
        if (side === 'red') {
            const oldAtk = this.G.permBuff.atk || 1;
            this.G.permBuff.atk = oldAtk * (1 + ACADEMY_LEVELS[2].attackBonus);
            const ratio = this.G.permBuff.atk / oldAtk;
            // 已在场的己方单位立即同比例加攻（全局生效）
            this.G.units.filter((u: any) => u.side === 'red').forEach((u: any) => {
                u.atk = u.atk * ratio;
            });
            this.showToast('战争学院 Lv2！全队攻击+10%，解锁全军强化');
        } else {
            this.G.aiAtkMult *= (1 + ACADEMY_LEVELS[2].attackBonus);
        }
        this.refreshBuildBar();
    }

    /** AI：自动在固定位置建造战争学院（AI 不需要玩家式放置） */
    private buildAcademy(side: string) {
        const lvl = this.G.academies[side] ?? 0;
        if (lvl >= 2) {
            if (side === 'red') this.showToast('战争学院已满级');
            return;
        }
        const next = ACADEMY_LEVELS[(lvl + 1) as 1 | 2];
        if (this.G.gold[side] < next.cost) {
            if (side === 'red') this.showToast('金币不足！需要 ' + next.cost + ' 金');
            return;
        }
        this.G.gold[side] -= next.cost;
        if (lvl === 0) {
            // 网格空位放置（v0.5.0：AI 也走格点，保持整齐）
            const cell = side === 'blue' ? this.pickAIBuildCell() : null;
            this.G.buildings.push({
                kind: 'building', type: 'academy', side,
                x: side === 'red' ? -430 : (cell ? cell.x : 430), y: side === 'red' ? 130 : (cell ? cell.y : 130),
                hp: next.health, maxHp: next.health, baseHp: next.health,
                level: 1,
            });
            if (side === 'red') this.showToast('战争学院 Lv1！解锁 Lv3 兵工厂升级');
        } else {
            const acad = this.G.buildings.find((b: any) => b.side === side && b.type === 'academy');
            if (acad) {
                acad.level = 2;
                acad.maxHp = next.health;
                acad.hp = Math.min(acad.maxHp, acad.hp + (next.health - ACADEMY_LEVELS[1].health));
            }
            if (side === 'red') {
                const oldAtk = this.G.permBuff.atk || 1;
                this.G.permBuff.atk = oldAtk * (1 + ACADEMY_LEVELS[2].attackBonus);
                const ratio = this.G.permBuff.atk / oldAtk;
                // 已在场的己方单位立即同比例加攻（全局生效）
                this.G.units.filter((u: any) => u.side === 'red').forEach((u: any) => {
                    u.atk = u.atk * ratio;
                });
                this.showToast('战争学院 Lv2！全队攻击+10%，解锁全军强化');
            } else {
                this.G.aiAtkMult *= (1 + ACADEMY_LEVELS[2].attackBonus);
            }
        }
        this.G.academies[side] = lvl + 1;
        this.refreshBuildBar();
    }

    /** 玩家：在自选位置放置光环塔（每方限 1 座） */
    private placeAuraTower(px: number, py: number, side: string) {
        if (this.G.gold[side] < AURA_TOWER.cost) {
            this.showToast('金币不足！需要 ' + AURA_TOWER.cost + ' 金');
            this.cancelBuildMode();
            return;
        }
        this.G.gold[side] -= AURA_TOWER.cost;
        this.G.buildings.push({
            kind: 'building', type: 'auraTower', side,
            x: px, y: py,
            hp: AURA_TOWER.health, maxHp: AURA_TOWER.health, baseHp: AURA_TOWER.health,
            // 范围攻击参数（v0.4.3：光环塔也能防御）
            range: AURA_TOWER.rangePixels, atk: AURA_TOWER.attack,
            atkSpd: AURA_TOWER.attacksPerSecond, atkCd: 0,
        });
        this.G.auraBuilt[side] = true;
        this.showToast('光环塔！全体己方单位攻速 +15%，可范围攻击');
        this.cancelBuildMode();
        this.refreshBuildBar();
        this.dismissTutorial();
    }

    /** 光环塔：每方限 1 座，全体己方单位攻速 +15%（实体建筑，可被拆）AI 用 */
    private buildAuraTower(side: string) {
        if (this.G.auraBuilt[side]) {
            if (side === 'red') this.showToast('光环塔每方限建 1 座');
            return;
        }
        if (this.G.gold[side] < AURA_TOWER.cost) {
            if (side === 'red') this.showToast('金币不足！需要 ' + AURA_TOWER.cost + ' 金');
            return;
        }
        this.G.gold[side] -= AURA_TOWER.cost;
        const auraCell = side === 'blue' ? this.pickAIBuildCell() : null;
        this.G.buildings.push({
            kind: 'building', type: 'auraTower', side,
            x: auraCell ? auraCell.x : (side === 'red' ? -420 : 420),
            y: auraCell ? auraCell.y : -140,
            hp: AURA_TOWER.health, maxHp: AURA_TOWER.health, baseHp: AURA_TOWER.health,
            // 范围攻击参数（v0.4.3：光环塔也能防御）
            range: AURA_TOWER.rangePixels, atk: AURA_TOWER.attack,
            atkSpd: AURA_TOWER.attacksPerSecond, atkCd: 0,
        });
        this.G.auraBuilt[side] = true;
        if (side === 'red') {
            this.showToast('光环塔！全体己方单位攻速 +15%');
            this.refreshBuildBar();
        }
    }

    // ==================== 兵工厂升级 ====================
    private upgradeFactory(factory: any, side: string): boolean {
        const level = factory.level || 1;
        if (level >= 3) {
            if (side === 'red') this.showToast('该兵工厂已满级 Lv3');
            return false;
        }
        const upgrade = FACTORY_UPGRADES[(level + 1) as 2 | 3];
        if (upgrade.requiresAcademyLevel > (this.G.academies[side] ?? 0)) {
            if (side === 'red') this.showToast('需要战争学院 Lv1 才能升到 Lv3！');
            return false;
        }
        if (this.G.gold[side] < upgrade.cost) {
            if (side === 'red') this.showToast('金币不足！需要 ' + upgrade.cost + ' 金');
            return false;
        }
        this.G.gold[side] -= upgrade.cost;
        factory.level = level + 1;
        const oldMax = factory.maxHp;
        factory.maxHp = Math.round((factory.baseHp || oldMax) * upgrade.healthMultiplier);
        factory.hp = Math.min(factory.maxHp, factory.hp + (factory.maxHp - oldMax));
        if (side === 'red') {
            this.showToast('兵工厂升级 Lv' + factory.level + '！出兵属性 ×' + upgrade.statMultiplier);
        }
        return true;
    }

    private onGameTouch(event: any) {
        if (!this.gameRunning || !this.gameContainer) return;
        const ut = this.gameContainer.getComponent(UITransform);
        if (!ut) return;
        const loc = event.getUILocation();
        const p = ut.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0));
        // 建造模式优先：点击放置建筑
        if (this.buildMode) {
            this.tryPlaceBuilding(p.x, p.y);
            return;
        }
        let best: any = null, bestDist = 60;
        for (const b of this.G.buildings) {
            if (b.side !== 'red' || b.type !== 'factory') continue;
            const d = Math.sqrt((b.x - p.x) ** 2 + (b.y - p.y) ** 2);
            if (d < bestDist) { bestDist = d; best = b; }
        }
        if (best) {
            this.selectedFactory = best;
            this.showUpgradePanel();
        } else {
            this.selectedFactory = null;
            this.hideUpgradePanel();
        }
    }

    private showUpgradePanel() {
        if (!this.upgradePanel || !this.selectedFactory) return;
        const f = this.selectedFactory;
        const level = f.level || 1;
        const stars = level >= 3 ? '★★' : level >= 2 ? '★' : '';
        // 学院限制：Lv2→Lv3 需要战争学院 Lv1（面板提前显示，避免点了才提示）
        const next = level < 3 ? FACTORY_UPGRADES[(level + 1) as 2 | 3] : null;
        const academyRequired = next && next.requiresAcademyLevel > (this.G.academies?.red ?? 0);
        if (this.upgradeInfoLabel) {
            this.upgradeInfoLabel.string = BUILDING_TYPES[f.unitType as BuildingId].name
                + ' Lv' + level + stars
                + (level >= 3 ? '（已满级）' : academyRequired ? '（需战争学院 Lv1）' : ' 点击工厂再点「升级」');
        }
        if (this.upgradeCostLabel) {
            this.upgradeCostLabel.string = level >= 3
                ? '已升至最高级，不再升级'
                : academyRequired
                    ? '⚠ 需先建造「战争学院」才能升到 Lv' + (level + 1)
                    : 'Lv' + (level + 1) + '：出兵 ×' + next!.statMultiplier
                        + '，血量 ×' + next!.healthMultiplier
                        + '，花费 ' + next!.cost + ' 金';
        }
        // 升级按钮：顶级隐藏；学院未达要求时禁用并置灰，达标恢复绿色
        if (this.upgradeBtnNode) {
            const btn = this.upgradeBtnNode;
            btn.active = level < 3;
            if (level < 3) {
                // 每次面板刷新都同步按钮颜色：绿=可升，灰=需学院
                const targetColor = academyRequired ? new Color(70, 80, 92) : new Color(63, 109, 51);
                btn.getComponentsInChildren(Sprite).forEach((sp: any) => {
                    if (sp.node !== btn && sp.node.getComponent(Label) === null) {
                        sp.color = targetColor;
                    }
                });
            }
        }
        this.upgradePanel.active = true;
    }

    private hideUpgradePanel() {
        if (this.upgradePanel) this.upgradePanel.active = false;
    }

    onUpgradeConfirm(event: Event) {
        if (this.selectedFactory) this.upgradeFactory(this.selectedFactory, 'red');
        this.showUpgradePanel();
    }

    onUpgradeClose(event: Event) {
        this.selectedFactory = null;
        this.hideUpgradePanel();
    }

    // ==================== 本地存档与教学 ====================
    private loadSave(): any {
        try {
            const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('fww_save') : null;
            if (raw) return JSON.parse(raw);
        } catch (e) { /* 存档不可用（如隐私模式）则使用默认值 */ }
        return { wins: 0, losses: 0, bestStars: 0, tutorialDone: false };
    }

    private saveSave(save: any) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('fww_save', JSON.stringify(save));
            }
        } catch (e) { /* 忽略写入失败 */ }
    }

    private showTutorial() {
        if (this.tutorialPanel) this.tutorialPanel.active = true;
    }

    private dismissTutorial() {
        if (this.tutorialPanel && this.tutorialPanel.active) {
            this.tutorialPanel.active = false;
            const save = this.loadSave();
            if (!save.tutorialDone) {
                save.tutorialDone = true;
                this.saveSave(save);
            }
        }
    }

    onAgainClick(event: Event) {
        if (this.endPanel) this.endPanel.active = false;
        this.showStartPanel();
    }

    private showStartPanel() {
        if (this.startPanel) this.startPanel.active = true;
        if (this.recordLabel) {
            const save = this.loadSave();
            const stars = save.bestStars ? '⭐'.repeat(save.bestStars) : '暂无';
            this.recordLabel.string = '战绩：' + (save.wins || 0) + ' 胜 ' + (save.losses || 0) + ' 负 · 最佳：' + stars;
        }
    }

    private showToast(msg: string) {
        if (!this.toastLabel) return;
        this.toastLabel.string = msg;
        const toast = this.toastLabel.node;
        toast.active = true;
        // 3秒后隐藏
        setTimeout(() => {
            if (toast) toast.active = false;
        }, 3000);
    }

    // ==================== 游戏逻辑 ====================
    initGame() {
        // 清理旧的视觉节点（防止重复销毁）
        if (this.G && this.G.crystalNodes) {
            this.G.crystalNodes.forEach(n => { if (n && n.isValid) n.destroy(); });
            this.G.buildingNodes.forEach(n => { if (n && n.isValid) n.destroy(); });
            this.G.towerNodes.forEach(n => { if (n && n.isValid) n.destroy(); });
            this.G.unitNodes.forEach(n => { if (n && n.isValid) n.destroy(); });
            this.G.projectiles?.forEach((p: any) => { if (p.node?.isValid) p.node.destroy(); });
            this.G.effects?.forEach((e: any) => { if (e.node?.isValid) e.node.destroy(); });
            this.G.floatTexts?.forEach((f: any) => { if (f.node?.isValid) f.node.destroy(); });
        }

        this.G = {
            phase: 'idle', playerSide: 'red',
            playerFaction: this.selectedFaction,
            aiFaction: this.getAIFaction(),
            difficulty: this.selectedDifficulty,
            elapsed: 0,
            gameStartTime: Date.now(),
            gold: { red: GAME_CONFIG.startingGold, blue: GAME_CONFIG.startingGold },
            salaryTimer: { red: GAME_CONFIG.salaryIntervalSeconds, blue: GAME_CONFIG.salaryIntervalSeconds },
            wave: 0, waveTimer: GAME_CONFIG.waveIntervalSeconds,
            units: [] as any[], buildings: [] as any[],
            towers: [] as any[], crystals: [] as any[],
            kills: { red: 0, blue: 0 },
            permBuff: { atk: 1, hp: 1, as: 1, dr: 1, crit: 0, splashMult: 1, waveInt: 1 },
            aiBuildTimer: DIFFICULTIES[this.selectedDifficulty].buildIntervalSeconds,
            tempBuffs: [] as any[],
            cardTriggered: { 5: false, 15: false, 20: false },
            crystalNodes: [] as Node[],
            buildingNodes: [] as Node[],
            towerNodes: [] as Node[],
            unitNodes: [] as Node[],
            projectiles: [] as any[],
            effects: [] as any[],
            floatTexts: [] as any[],
            // M2 系统状态
            academies: { red: 0, blue: 0 },
            researchLayers: { red: 0, blue: 0 },
            researchCosts: { red: ARMY_RESEARCH.baseCost, blue: ARMY_RESEARCH.baseCost },
            auraBuilt: { red: false, blue: false },
            aiAtkMult: 1,
            comeback: {
                red: { streak: 0, active: false },
                blue: { streak: 0, active: false },
            },
            playerComp: {} as Record<string, number>,
            aiCompDelayed: {} as Record<string, number>,
        };
        this.selectedFactory = null;
        this.hideUpgradePanel();

        this.G.crystals.push({
            kind: 'crystal', side: 'red', x: -500, y: 0,
            hp: GAME_CONFIG.crystalHealth, maxHp: GAME_CONFIG.crystalHealth,
        });
        this.G.crystals.push({
            kind: 'crystal', side: 'blue', x: 500, y: 0,
            hp: GAME_CONFIG.crystalHealth, maxHp: GAME_CONFIG.crystalHealth,
        });

        // 基地防御塔：双方各 2 座，固定不可建造；塔不倒不能打水晶
        for (const side of ['red', 'blue']) {
            const dir = side === 'red' ? -1 : 1;
            for (const dy of [70, -70]) {
                this.G.towers.push({
                    kind: 'tower', type: 'tower', side,
                    x: dir * 450, y: dy,
                    hp: BASE_TOWER.health, maxHp: BASE_TOWER.health,
                    range: BASE_TOWER.rangePixels, atk: BASE_TOWER.attack,
                    atkSpd: BASE_TOWER.attacksPerSecond, atkCd: 0,
                });
            }
        }
    }

    private getAIFaction(): string {
        const factions = Object.keys(FACTIONS);
        const idx = factions.indexOf(this.selectedFaction);
        return factions[(idx + 1) % factions.length];
    }

    createFactory(side: string, x: number, y: number, unitType: UnitRoleId = 'tank') {
        const faction = side === 'red' ? this.G.playerFaction : this.G.aiFaction;
        const building = BUILDING_TYPES[unitType];
        this.G.buildings.push({
            kind: 'building', type: 'factory', unitType, side, x, y,
            hp: building.health,
            maxHp: building.health,
            baseHp: building.health,
            waveTimer: FACTIONS[faction].waveIntervalSeconds,
            level: 1,
        });
    }

    gameStep(dt: number) {
        this.G.elapsed += dt;

        // 工资（绝地反击激活期间 +50%）
        for (const side of ['red', 'blue']) {
            this.G.salaryTimer[side] -= dt;
            if (this.G.salaryTimer[side] <= 0) {
                let salary: number = GAME_CONFIG.salaryGold;
                if (this.G.comeback[side].active) {
                    salary = Math.round(salary * COMEBACK.salaryMultiplier);
                }
                const incomeMultiplier = side === 'blue'
                    ? DIFFICULTIES[this.G.difficulty].incomeMultiplier
                    : 1;
                this.G.gold[side] += Math.round(salary * incomeMultiplier);
                this.G.salaryTimer[side] = GAME_CONFIG.salaryIntervalSeconds;
            }
        }

        // 波次
        this.G.waveTimer -= dt;
        if (this.G.waveTimer <= 0) {
            this.G.wave++;
            this.G.waveTimer = GAME_CONFIG.waveIntervalSeconds;
            this.onWave();
        }

        // 兵工厂出兵
        for (const b of this.G.buildings.filter((b: any) => b.type === 'factory')) {
            b.waveTimer -= dt;
            if (b.waveTimer <= 0) {
                this.waveSpawn(b);
                const faction = b.side === 'red' ? this.G.playerFaction : this.G.aiFaction;
                const fConf = FACTIONS[faction];
                b.waveTimer = fConf.waveIntervalSeconds * (this.G.permBuff.waveInt || 1);
            }
        }

        // 更新单位
        this.lastDt = dt;
        for (const u of this.G.units) this.updateUnit(u, dt);
        // 单位间分离，避免重叠
        this.separateUnits();
        for (const u of this.G.units) this.constrainToBridge(u);
        // 弹道与特效
        this.updateProjectilesAndEffects(dt);
        // 更新塔
        for (const t of this.G.towers) this.updateTower(t, dt);
        // 光环塔（玩家可建造）：范围攻击（v0.4.3）
        for (const b of this.G.buildings) {
            if (b.type === 'auraTower') this.updateAuraTower(b, dt);
        }

        // 清理死亡（先发射全龄化消亡特效：兵变星星/果粒，建筑碎裂，无血腥）
        this.emitDeathEffects();
        this.G.units = this.G.units.filter((u: any) => u.hp > 0);
        this.G.buildings = this.G.buildings.filter((b: any) => b.hp > 0);
        this.G.towers = this.G.towers.filter((t: any) => t.hp > 0);

        // 学院等级 / 光环塔状态由场上实体推导（被拆即失效）
        const redAuraBefore = this.G.auraBuilt.red;
        const structBefore = this.G.academies.red + '/' + this.G.academies.blue
            + '/' + this.G.auraBuilt.red + '/' + this.G.auraBuilt.blue;
        for (const side of ['red', 'blue'] as const) {
            this.G.academies[side] = this.G.buildings
                .filter((b: any) => b.side === side && b.type === 'academy')
                .reduce((m: number, b: any) => Math.max(m, b.level || 1), 0);
            this.G.auraBuilt[side] = this.G.buildings.some(
                (b: any) => b.side === side && b.type === 'auraTower');
        }
        const structAfter = this.G.academies.red + '/' + this.G.academies.blue
            + '/' + this.G.auraBuilt.red + '/' + this.G.auraBuilt.blue;
        if (structAfter !== structBefore) {
            if (redAuraBefore && !this.G.auraBuilt.red) this.showToast('光环塔被拆除了！');
            this.refreshBuildBar();
        }

        // 临时buff
        for (let i = this.G.tempBuffs.length - 1; i >= 0; i--) {
            this.G.tempBuffs[i].dur -= dt;
            if (this.G.tempBuffs[i].dur <= 0) this.G.tempBuffs.splice(i, 1);
        }

        // AI造兵
        this.aiThink(dt);

        // 决战时刻：防止优势方只守不攻导致僵局
        if (this.G.elapsed >= GAME_CONFIG.suddenDeathStartTimeSeconds) {
            const fraction = GAME_CONFIG.suddenDeathHealthFractionPerSecond * dt;
            for (const crystal of this.G.crystals) {
                crystal.hp = Math.max(0, crystal.hp - crystal.maxHp * fraction);
            }
        }

        // 胜负
        this.checkWinCondition();
    }

    private aiThink(dt: number) {
        this.G.aiBuildTimer -= dt;
        if (this.G.aiBuildTimer > 0) return;
        this.G.aiBuildTimer = DIFFICULTIES[this.G.difficulty].buildIntervalSeconds;

        const faction = this.G.aiFaction as FactionId;
        const myFactories = () => this.G.buildings.filter((b: any) => b.side === 'blue' && b.type === 'factory');

        // 困难：光环塔 / 学院时机最优（有余钱先补功能建筑）
        if (this.G.difficulty === 'hard') {
            if (!this.G.auraBuilt.blue && this.G.gold.blue >= AURA_TOWER.cost + 100) {
                this.buildAuraTower('blue');
                return;
            }
            if (this.G.academies.blue < 1 && this.G.gold.blue >= ACADEMY_LEVELS[1].cost + 200) {
                this.buildAcademy('blue');
                return;
            }
            if (this.G.academies.blue < 2 && this.G.gold.blue >= ACADEMY_LEVELS[2].cost + 200) {
                this.buildAcademy('blue');
                return;
            }
            // 困难：厂子铺起来后把低级厂升到 Lv2
            if (myFactories().length >= 3 && this.G.gold.blue >= FACTORY_UPGRADES[2].cost + 150) {
                const target = myFactories().find((b: any) => (b.level || 1) < 2);
                if (target) { this.upgradeFactory(target, 'blue'); return; }
            }
        }

        // 兵种选择：简单=固定建造顺序；普通=延迟1波的克制；困难=即时克制
        let role: UnitRoleId;
        if (this.G.difficulty === 'easy') {
            const order: UnitRoleId[] = ['tank', 'ranged', 'rush', 'aoe', 'siege'];
            role = order.find(r => !myFactories().some((b: any) => b.unitType === r)) ?? 'tank';
        } else {
            const comp = this.G.difficulty === 'hard' ? this.G.playerComp : this.G.aiCompDelayed;
            const dominant = this.getDominantRole(comp);
            role = dominant ? this.counterOf(dominant) : 'tank';
        }

        const owned = myFactories().filter((b: any) => b.unitType === role).length;
        // 阵容多样性：同类型厂最多 2 座，避免 AI 单一兵种海滚雪球
        if (owned >= 2) {
            const others = (['tank', 'ranged', 'aoe', 'rush', 'siege'] as UnitRoleId[])
                .filter(r => myFactories().filter((b: any) => b.unitType === r).length < 2);
            role = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : role;
        }
        const cost = getFactoryPrice(role, faction, owned);
        if (this.G.gold.blue < cost) return;
        if (myFactories().length >= 7) return;
        const cell = this.pickAIBuildCell();
        if (!cell) return; // 无空位
        this.G.gold.blue -= cost;
        this.G.buildings.push({
            kind: 'building', type: 'factory', unitType: role, side: 'blue',
            // 蓝方：镜像红方网格的空位（整齐 + 避开主道）
            x: cell.x, y: cell.y,
            hp: BUILDING_TYPES[role].health,
            maxHp: BUILDING_TYPES[role].health,
            baseHp: BUILDING_TYPES[role].health,
            waveTimer: FACTIONS[faction].waveIntervalSeconds,
            level: 1,
        });
    }

    /** AI 建造格点：红方网格镜像到蓝方，返回一个随机空格 */
    private pickAIBuildCell(): { x: number; y: number } | null {
        // AI 倾向前排（靠河道），格点按 |x| 升序（靠前优先）
        const cells = this.getGridCells()
            .map(c => ({ x: -c.x, y: c.y })) // 镜像到蓝方
            .map(c => ({ ...c, occupied: this.isCellOccupied(c.x, c.y) }))
            .filter(c => !c.occupied)
            .sort((a, b) => a.x - b.x); // 蓝方前排 = x 小
        if (cells.length === 0) return null;
        // 前排优先带随机：从前 40% 空位随机选
        const pool = cells.slice(0, Math.max(1, Math.ceil(cells.length * 0.4)));
        return pool[Math.floor(Math.random() * pool.length)];
    }

    /** 玩家兵种构成中最多的定位（达到 3 个才视为明显倾向） */
    private getDominantRole(comp: Record<string, number>): UnitRoleId | null {
        let best: UnitRoleId | null = null, max = 0;
        for (const k of Object.keys(comp)) {
            if (comp[k] > max) { max = comp[k]; best = k as UnitRoleId; }
        }
        return max >= 3 ? best : null;
    }

    /** 克制关系反查：造什么厂克玩家最多的兵种 */
    private counterOf(role: UnitRoleId): UnitRoleId {
        switch (role) {
            case 'rush': return 'tank';      // 坦克堵路克冲锋
            case 'tank': return 'ranged';    // 远程磨血克坦克
            case 'ranged': return 'rush';    // 冲锋切后排克远程
            case 'aoe': return 'rush';       // 冲锋切后排克 AOE
            default: return 'tank';
        }
    }

    // 地图：河道 x ∈ [-60,60]；主道/桥 y ∈ [-45,45]
    private static readonly RIVER_HALF_X = 60;
    private static readonly ROAD_HALF_Y = 45;

    /** 过河寻路：目标在河对岸时，先走到己方桥口，过桥期间沿桥中线前进 */
    private getMovePoint(u: any, tx: number, ty: number): { x: number, y: number } {
        const RIVER = GameManager.RIVER_HALF_X;
        const targetSign = tx >= 0 ? 1 : -1;
        if (Math.abs(u.x) > RIVER) {
            // 在陆地上
            if (Math.sign(u.x) === targetSign) {
                return { x: tx, y: ty }; // 与目标同岸，直走
            }
            // 去对岸桥口（过桥期间 constrainToBridge 会把单位夹在桥面上）
            return { x: -Math.sign(u.x) * (RIVER + 10), y: 0 };
        }
        // 在桥上（河道范围内）：朝目标一侧的桥口前进，保持桥内
        return { x: targetSign * (RIVER + 10), y: 0 };
    }

    updateUnit(u: any, dt: number) {
        if (u.hp <= 0) return;
        let spdMult = 1;
        // 临时加速卡（兽群奔腾）叠加在减速之上：取两者乘积
        const tempSpd = this.G.tempBuffs.some((b: any) => b.type === 'spdMult');
        if (tempSpd) spdMult *= 2;
        if (u.slowDur && u.slowDur > 0) { spdMult *= u.slowMult || 0.6; u.slowDur -= dt; }
        if (u.stunDur && u.stunDur > 0) { u.stunDur -= dt; return; }
        if (u.atkCd > 0) u.atkCd -= dt;

        const target = this.findTarget(u);
        if (target) {
            // 过河寻路：不能越河，必须走桥
            const mp = this.getMovePoint(u, target.x, target.y);
            const dx = mp.x - u.x, dy = mp.y - u.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (isInRange(u, target, u.range)) {
                if (u.atkCd <= 0) {
                    this.attack(u, target);
                    // 光环塔：射程 400px 内己方单位攻速 +15%（v0.4.4 全场→光环范围）
                    const auraTower = this.G.buildings.find((b: any) => b.type === 'auraTower' && b.side === u.side);
                    const auraMult = auraTower && isInRange(u, auraTower, AURA_TOWER.buffRadiusPixels)
                        ? 1 + AURA_TOWER.attackSpeedBonus
                        : 1;
                    const asBuff = u.side === 'red' ? (this.G.permBuff.as || 1) : 1;
                    const tempAs = u.side === 'red'
                        ? this.G.tempBuffs.reduce((m: number, b: any) => b.type === 'asMult' ? m * b.mult : m, 1)
                        : 1;
                    u.atkCd = 1 / (u.atkSpd * asBuff * tempAs * auraMult);
                }
            } else if (dist > 1) {
                u.x += (dx / dist) * u.spd * spdMult * dt;
                u.y += (dy / dist) * u.spd * spdMult * dt;
                this.constrainToBridge(u);
            }
        } else {
            const crystal = this.G.crystals.find((c: any) => c.side !== u.side);
            if (crystal) {
                const mp = this.getMovePoint(u, crystal.x, crystal.y);
                const dx = mp.x - u.x, dy = mp.y - u.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 1) {
                    u.x += (dx / dist) * u.spd * spdMult * dt;
                    u.y += (dy / dist) * u.spd * spdMult * dt;
                    this.constrainToBridge(u);
                }
            }
        }
    }

    /** 在河道范围内时，把单位约束在桥面（主道）上 */
    private constrainToBridge(u: any) {
        const RIVER = GameManager.RIVER_HALF_X;
        const ROAD = GameManager.ROAD_HALF_Y;
        if (Math.abs(u.x) <= RIVER + 2) {
            const limit = ROAD - 8;
            if (u.y > limit) u.y = limit;
            if (u.y < -limit) u.y = -limit;
        }
    }

    // ==================== 弹道与特效 ====================

    // 特效数量上限：防止大规模混战时节点无限堆积导致卡顿
    private static readonly FX_MAX_PROJECTILES = 120;
    private static readonly FX_MAX_EFFECTS = 150;
    private static readonly FX_MAX_FLOAT_TEXTS = 80;

    /** 发射一枚视觉弹丸（伤害已在逻辑层结算） */
    private spawnProjectile(attacker: any, target: any) {
        if (!this.gameContainer) return;
        if (this.G.projectiles.length >= GameManager.FX_MAX_PROJECTILES) return; // 超限不再生成
        const side = attacker.side;
        let color = side === 'red' ? new Color(255, 170, 90) : new Color(130, 180, 255);
        let size = 6;
        if (attacker.kind === 'unit' && attacker.type === 'siege') { color = side === 'red' ? new Color(255, 120, 60) : new Color(110, 160, 255); size = 9; }
        if (attacker.kind === 'unit' && attacker.type === 'aoe') { color = side === 'red' ? new Color(255, 220, 120) : new Color(160, 220, 255); size = 7; }
        if (attacker.kind === 'tower') { size = 5; }

        const node = this.createColorNode(color, size, size);
        node.parent = this.gameContainer;
        node.setPosition(attacker.x, attacker.y, 0);
        this.G.projectiles.push({
            node,
            x: attacker.x, y: attacker.y,
            tx: target.x, ty: target.y,
            speed: 420,
            isAoe: attacker.kind === 'unit' && attacker.type === 'aoe',
        });
    }

    /** 近战命中闪白 */
    private spawnHitFlash(target: any) {
        this.spawnEffect(target.x, target.y, new Color(255, 255, 255, 200), 14, 0.12);
    }

    /** AOE 溅射扩散圈 */
    private spawnSplashEffect(x: number, y: number, radius: number) {
        this.spawnEffect(x, y, new Color(255, 200, 90, 180), radius, 0.3);
    }

    /** 通用短命特效（扩散+淡出） */
    private spawnEffect(x: number, y: number, color: Color, size: number, dur: number) {
        if (!this.gameContainer) return;
        if (this.G.effects.length >= GameManager.FX_MAX_EFFECTS) return; // 超限不再生成
        const node = this.createColorNode(new Color(color.r, color.g, color.b, color.a), size, size);
        node.parent = this.gameContainer;
        node.setPosition(x, y, 0);
        this.G.effects.push({ node, t: 0, dur, size });
    }

    /** 浮字：伤害跳字 / 死亡星星，上飘 + 淡出 */
    private spawnFloatText(x: number, y: number, text: string, color: Color, size: number = 16) {
        if (!this.gameContainer) return;
        if (this.G.floatTexts.length >= GameManager.FX_MAX_FLOAT_TEXTS) return; // 超限不再生成
        const node = new Node('FloatText');
        node.layer = this.uiLayer;
        node.parent = this.gameContainer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(80, 24);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 4;
        label.color = color;
        node.setPosition(x, y, 0);
        this.G.floatTexts.push({ node, x, y, t: 0, dur: 0.6, size });
    }

    /** 每帧更新弹道与特效 */
    private updateProjectilesAndEffects(dt: number) {
        if (!this.G.projectiles) return;
        for (let i = this.G.projectiles.length - 1; i >= 0; i--) {
            const p = this.G.projectiles[i];
            const dx = p.tx - p.x, dy = p.ty - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const step = p.speed * dt;
            if (dist <= step) {
                // 命中：AOE 显示溅射圈
                if (p.isAoe) this.spawnSplashEffect(p.tx, p.ty, UNIT_TYPES.aoe.splashRadiusPixels);
                else this.spawnEffect(p.tx, p.ty, new Color(255, 230, 150, 200), 10, 0.12);
                if (p.node.isValid) { p.node.removeFromParent(); p.node.destroy(); }
                this.G.projectiles.splice(i, 1);
                continue;
            }
            p.x += (dx / dist) * step;
            p.y += (dy / dist) * step;
            p.node.setPosition(p.x, p.y, 0);
        }
        for (let i = this.G.effects.length - 1; i >= 0; i--) {
            const e = this.G.effects[i];
            e.t += dt;
            const k = e.t / e.dur;
            if (k >= 1) {
                if (e.node.isValid) { e.node.removeFromParent(); e.node.destroy(); }
                this.G.effects.splice(i, 1);
                continue;
            }
            // 扩散用节点缩放、淡出用 UIOpacity——绝不每帧换贴图（换贴图会导致纹理缓存爆炸）
            const scale = 1 + k * 1.2;
            e.node.setScale(scale, scale, 1);
            const op = e.node.getComponent(UIOpacity) || e.node.addComponent(UIOpacity);
            op.opacity = Math.round(200 * (1 - k));
        }
        // 浮字：上飘 + 淡出
        for (let i = this.G.floatTexts.length - 1; i >= 0; i--) {
            const f = this.G.floatTexts[i];
            f.t += dt;
            const k = f.t / f.dur;
            if (k >= 1) {
                if (f.node.isValid) { f.node.removeFromParent(); f.node.destroy(); }
                this.G.floatTexts.splice(i, 1);
                continue;
            }
            f.node.setPosition(f.x, f.y + k * 40, 0);
            const op = f.node.getComponent(UIOpacity) || f.node.addComponent(UIOpacity);
            op.opacity = Math.round(255 * (1 - k));
        }
    }

    /** 单位间分离：附近单位互相排斥，避免完全重叠看不清数量 */
    private separateUnits() {
        const units = this.G.units;
        const MIN_DIST = 14;   // 单位最小间距（略小于体型 16px）
        const PUSH = 24;       // 每秒排斥速度
        for (let i = 0; i < units.length; i++) {
            const a = units[i];
            if (a.hp <= 0) continue;
            for (let j = i + 1; j < units.length; j++) {
                const b = units[j];
                if (b.hp <= 0) continue;
                let dx = b.x - a.x, dy = b.y - a.y;
                let d2 = dx * dx + dy * dy;
                if (d2 >= MIN_DIST * MIN_DIST || d2 === 0) continue;
                let d = Math.sqrt(d2) || 0.01;
                // 重叠越深推得越猛；完全重合时给个随机方向分开
                if (d < 1) {
                    dx = Math.random() - 0.5;
                    dy = Math.random() - 0.5;
                    d = Math.sqrt(dx * dx + dy * dy) || 1;
                }
                const overlap = (MIN_DIST - d) / MIN_DIST; // 0~1
                const push = PUSH * overlap;
                const nx = dx / d, ny = dy / d;
                a.x -= nx * push * this.lastDt; a.y -= ny * push * this.lastDt;
                b.x += nx * push * this.lastDt; b.y += ny * push * this.lastDt;
            }
        }
    }

    findTarget(u: any): any {
        let nearest: any = null, minDist = Infinity;
        for (const e of this.G.units.filter((e: any) => e.side !== u.side)) {
            const d = distance(u, e);
            if (d < minDist && d <= GAME_CONFIG.unitAggroRangePixels) { minDist = d; nearest = e; }
        }
        for (const b of this.G.buildings.filter((b: any) => b.side !== u.side)) {
            const d = distance(u, b);
            if (d < minDist && d <= GAME_CONFIG.unitAggroRangePixels) { minDist = d; nearest = b; }
        }
        for (const t of this.G.towers.filter((t: any) => t.side !== u.side)) {
            const d = distance(u, t);
            if (d < minDist && d <= GAME_CONFIG.unitAggroRangePixels) { minDist = d; nearest = t; }
        }
        const crystal = this.G.crystals.find((c: any) => c.side !== u.side && c.hp > 0);
        if (crystal) {
            // 基地防御塔必须先拆掉，才能攻击水晶（防一波偷家）
            const towersAlive = this.G.towers.some((t: any) => t.side !== u.side);
            if (!towersAlive) {
                const d = distance(u, crystal);
                if (d < minDist) nearest = crystal;
            }
        }
        return nearest;
    }

    attack(attacker: any, target: any) {
        // 弹道表现：远程单位 / 塔发射飞行弹丸（伤害仍即时结算，弹丸纯视觉）
        const isRangedAttacker = attacker.kind === 'tower'
            || (attacker.kind === 'unit' && ['ranged', 'aoe', 'siege'].includes(attacker.type));
        if (isRangedAttacker) {
            this.spawnProjectile(attacker, target);
        } else {
            this.spawnHitFlash(target); // 近战命中闪白
        }

        const attackerRole = attacker.type as UnitRoleId;
        const attackerFaction = attacker.side === 'red'
            ? this.G.playerFaction
            : this.G.aiFaction;
        const firstStrikeMultiplier = getFirstStrikeMultiplier(
            attackerRole,
            attackerFaction,
            attacker.hasStruck === true,
        );
        if (attacker.kind === 'unit') attacker.hasStruck = true;

        const counterMultiplier = target.kind === 'unit'
            ? getCounterMultiplier(attackerRole, target.type)
            : 1;
        const executeMultiplier = this.G.permBuff.execute && target.hp < target.maxHp * 0.3 ? 2 : 1;
        // 临时攻击卡（战嚎 +50%）：玩家单位实时生效
        const tempAtkMult = attacker.kind === 'unit' && attacker.side === 'red'
            ? this.G.tempBuffs.reduce((m: number, b: any) => b.type === 'atkMult' ? m * b.mult : m, 1)
            : 1;
        const result = calculateDamage({
            // atk 已在生成时乘过 permBuff.atk/阵营修正/等级，这里不再重复乘
            attack: attacker.atk * executeMultiplier * tempAtkMult,
            counterMultiplier,
            firstStrikeMultiplier,
            targetMultiplier: getTargetDamageMultiplier(attackerRole, target.kind),
            criticalChance: this.G.permBuff.crit || 0,
            damageReduction: (target.dr || 1) * (this.G.permBuff.dr || 1),
            shield: target.shield || 0,
        });

        if (target.shield) target.shield -= result.shieldConsumed;
        target.hp -= result.damage;
        if (target.hp < 0) target.hp = 0;

        // 伤害跳字（暴击放大加感叹号）
        if (result.damage > 0) {
            const isCrit = result.critical;
            const color = isCrit
                ? new Color(255, 210, 60)
                : (attacker.side === 'red' ? new Color(255, 220, 220) : new Color(200, 230, 255));
            this.spawnFloatText(
                target.x, target.y + 10,
                (isCrit ? '暴击 ' : '') + Math.round(result.damage),
                color,
                isCrit ? 20 : 15,
            );
        }

        // 溅射：AOE 兵 35% 溅射（v0.4 平衡：60%→35%，保留克人海但不再秒杀）；卡牌溅射按叠加
        const splashMultiplier = attacker.type === 'aoe' ? 0.35 : (this.G.permBuff.splashMult - 1) * 0.5;
        if (splashMultiplier > 0) {
            const splashDamage = result.damage * splashMultiplier;
            const splashRadius = attacker.type === 'aoe'
                ? UNIT_TYPES.aoe.splashRadiusPixels
                : 80;
            for (const e of this.G.units.filter((e: any) => e.side !== attacker.side && e !== target)) {
                if (!isInRange(target, e, splashRadius)) continue;
                e.hp = Math.max(0, e.hp - splashDamage);
                this.awardKill(attacker.side, e, attacker);
            }
        }

        this.awardKill(attacker.side, target, attacker);
    }

    /** 塔射击也走弹道表现 */
    updateTower(t: any, dt: number) {
        if (t.atkCd > 0) { t.atkCd -= dt; return; }
        let target: any = null, minDist = Infinity;
        for (const u of this.G.units.filter((u: any) => u.side !== t.side)) {
            const d = distance(t, u);
            if (d < t.range && d < minDist) { minDist = d; target = u; }
        }
        if (target) {
            this.spawnProjectile(t, target);
            target.hp -= t.atk;
            if (target.hp < 0) target.hp = 0;
            this.spawnFloatText(target.x, target.y + 8, String(t.atk), new Color(255, 230, 200), 13);
            // 范围攻击：对主目标周围敌人造成 40% 溅射（防人海偷家）
            const splashFraction = BASE_TOWER.splashDamageFraction;
            const splashRadius = BASE_TOWER.splashRadiusPixels;
            if (splashFraction > 0 && splashRadius > 0) {
                const splashDamage = t.atk * splashFraction;
                for (const e of this.G.units.filter((u: any) => u.side !== t.side && u !== target)) {
                    if (!isInRange(target, e, splashRadius)) continue;
                    e.hp = Math.max(0, e.hp - splashDamage);
                    this.spawnFloatText(e.x, e.y + 8, String(Math.round(splashDamage)), new Color(255, 200, 150), 12);
                    if (e.hp <= 0) {
                        this.awardKill(t.side, e);
                    }
                }
            }
            t.atkCd = 1 / t.atkSpd;
            if (target.hp <= 0) {
                this.awardKill(t.side, target);
            }
        }
    }

    /** 光环塔：弱化版范围攻击（v0.4.3）——攻 40 + 30% 溅射，玩家可建造的塔也能防御 */
    updateAuraTower(t: any, dt: number) {
        if (t.atkCd > 0) { t.atkCd -= dt; return; }
        let target: any = null, minDist = Infinity;
        for (const u of this.G.units.filter((u: any) => u.side !== t.side)) {
            const d = distance(t, u);
            if (d < t.range && d < minDist) { minDist = d; target = u; }
        }
        if (target) {
            this.spawnProjectile(t, target);
            target.hp -= t.atk;
            if (target.hp < 0) target.hp = 0;
            this.spawnFloatText(target.x, target.y + 8, String(t.atk), new Color(255, 230, 200), 13);
            // 范围攻击
            const splashFraction = AURA_TOWER.splashDamageFraction;
            const splashRadius = AURA_TOWER.splashRadiusPixels;
            if (splashFraction > 0 && splashRadius > 0) {
                const splashDamage = t.atk * splashFraction;
                for (const e of this.G.units.filter((u: any) => u.side !== t.side && u !== target)) {
                    if (!isInRange(target, e, splashRadius)) continue;
                    e.hp = Math.max(0, e.hp - splashDamage);
                    this.spawnFloatText(e.x, e.y + 8, String(Math.round(splashDamage)), new Color(255, 200, 150), 12);
                    if (e.hp <= 0) {
                        this.awardKill(t.side, e);
                    }
                }
            }
            t.atkCd = 1 / t.atkSpd;
            if (target.hp <= 0) {
                this.awardKill(t.side, target);
            }
        }
    }

    private awardKill(side: string, target: any, attacker?: any) {
        if (target.hp > 0) return;

        this.G.kills[side]++;
        if (target.kind === 'unit') {
            // 精英兵（Lv2/Lv3 工厂产出）击杀赏金 ×1.5 / ×2
            const eliteMult = ELITE_BOUNTY_MULTIPLIERS[(attacker?.level || 1) as 1 | 2 | 3] || 1;
            this.G.gold[side] += Math.round(UNIT_TYPES[target.type as UnitRoleId].bounty * eliteMult);
        } else if (target.kind === 'building') {
            this.G.gold[side] += GAME_CONFIG.razeBounty;
        }

        if (attacker?.kind === 'unit' && this.G.permBuff.lifeOnKill) {
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + attacker.maxHp * this.G.permBuff.lifeOnKill);
        }
    }

    onWave() {
        // 绝地反击：按全体单位平均 x 评估兵线位置
        const units = this.G.units;
        if (units.length > 0) {
            const frontline = units.reduce((s: number, u: any) => s + u.x, 0) / units.length;
            const th = COMEBACK.frontlineThresholdPixels;
            this.updateComeback('red', frontline < -th, frontline > -th / 2);
            this.updateComeback('blue', frontline > th, frontline < th / 2);
        }

        // 普通 AI：延迟 1 波快照玩家兵种构成
        this.G.aiCompDelayed = { ...this.G.playerComp };

        // 卡牌触发
        if ([5, 15, 20].includes(this.G.wave) && !this.G.cardTriggered[this.G.wave]) {
            this.G.cardTriggered[this.G.wave] = true;
            this.showCardSelection();
        }
    }

    /** 绝地反击状态机：连续 N 波被推回己方高地 → 工资加成，兵线重回中路后解除 */
    private updateComeback(side: string, pushedBack: boolean, recovered: boolean) {
        const c = this.G.comeback[side];
        if (c.active) {
            if (recovered) {
                c.active = false;
                c.streak = 0;
                if (side === 'red') this.showToast('兵线重回中路，绝地反击结束');
            }
            return;
        }
        if (pushedBack) {
            c.streak++;
            if (c.streak >= COMEBACK.triggerWaves) {
                c.active = true;
                if (side === 'red') this.showToast('绝地反击！工资 +50%');
            }
        } else {
            c.streak = 0;
        }
    }

    waveSpawn(factory: any) {
        const side = factory.side;
        const faction = side === 'red' ? this.G.playerFaction : this.G.aiFaction;
        const fConf = FACTIONS[faction];

        const unitType = (factory.unitType || 'tank') as UnitRoleId;
        const uConf = UNIT_TYPES[unitType] || UNIT_TYPES.tank;
        // 精英兵：升级提升出兵属性（数量不变），带等级用于赏金/体型
        const level = (factory.level || 1) as 1 | 2 | 3;
        const statMult = level === 1 ? 1 : FACTORY_UPGRADES[level].statMultiplier;
        // 玩家用卡牌/研究 permBuff；AI 用 aiAtkMult（学院加成）
        const sideAtk = side === 'red' ? (this.G.permBuff.atk || 1) : this.G.aiAtkMult;
        const sideHp = side === 'red' ? (this.G.permBuff.hp || 1) : 1;

        let count = getFactoryOutput(unitType, faction);
        if (Math.random() < fConf.factoryBonusChance) count += fConf.factoryBonusCount;
        const pop = this.G.units.filter((u: any) => u.side === side).length;
        if (pop + count > GAME_CONFIG.unitCapPerSide) {
            count = Math.max(0, GAME_CONFIG.unitCapPerSide - pop);
        }

        // 统计玩家出兵构成（供 AI 克制决策）
        if (side === 'red') {
            this.G.playerComp[unitType] = (this.G.playerComp[unitType] || 0) + count;
        }

        for (let i = 0; i < count; i++) {
            this.G.units.push({
                kind: 'unit', side, type: unitType, level,
                x: factory.x + (side === 'red' ? 40 : -40) + Math.random() * 30,
                y: factory.y + Math.random() * 60 - 30,
                hp: uConf.health * fConf.healthMultiplier * sideHp * statMult,
                maxHp: uConf.health * fConf.healthMultiplier * sideHp * statMult,
                atk: uConf.attack * fConf.attackMultiplier * sideAtk * statMult,
                spd: uConf.speedPixelsPerSecond * fConf.speedMultiplier,
                range: uConf.rangePixels,
                atkSpd: uConf.attacksPerSecond,
                atkCd: 0,
                hasStruck: false,
            });
        }
    }

    showCardSelection() {
        if (!this.cardPanel) return;
        this.cardPanel.active = true;
        this.gameRunning = false;

        // 清除旧卡牌
        const oldCards = this.cardPanel.children.filter(c => c.name.startsWith('Card_'));
        oldCards.forEach(c => { if (c.isValid) c.destroy(); });

        // 按稀有度加权随机抽 3 张（不重复）：稀有权重高、传说权重低
        const faction = this.G.playerFaction;
        const pool = [...CARDS[faction]];
        const selected: any[] = [];
        for (let i = 0; i < 3 && pool.length > 0; i++) {
            const weightOf = (c: any) => CARD_RARITY_WEIGHTS[c.rarity as keyof typeof CARD_RARITY_WEIGHTS] || 1;
            const total = pool.reduce((s, c) => s + weightOf(c), 0);
            let roll = Math.random() * total;
            let idx = 0;
            for (; idx < pool.length - 1; idx++) {
                roll -= weightOf(pool[idx]);
                if (roll < 0) break;
            }
            selected.push(pool.splice(idx, 1)[0]);
        }

        this.pendingCards = selected;
        this.cardTimeoutSeconds = 10; // 10 秒不选自动拿第一张

        const subNode = this.cardPanel.getChildByName('CardSub');
        if (subNode) {
            const l = subNode.getComponent(Label);
            if (l) l.string = '第 ' + this.G.wave + ' 波 · ' + FACTIONS[faction].name + ' · ⏱ ' + this.cardTimeoutSeconds + ' 秒后自动选择第一张';
        }

        selected.forEach((card, i) => {
            const cardNode = this.createCardNode(card, i);
            cardNode.parent = this.cardPanel;
            cardNode.setPosition(-220 + i * 220, 0, 0);
        });
    }

    /** 卡牌倒计时：update 中调用（选卡暂停期间 gameStep 不跑，所以独立计时） */
    private updateCardTimeout(dt: number) {
        if (this.cardTimeoutSeconds <= 0) return;
        this.cardTimeoutSeconds -= dt;
        if (this.cardTimeoutSeconds <= 0) {
            // 超时：自动选第一张
            const first = this.pendingCards[0];
            this.cardTimeoutSeconds = 0;
            if (first) {
                this.onCardClick({ target: null, type: 'click' } as any, first.id);
                this.showToast('⏱ 超时自动选择：' + first.name);
            }
            return;
        }
        // 刷新倒计时显示（秒数变化时才更新文本，避免每帧写字符串）
        const remain = Math.ceil(this.cardTimeoutSeconds);
        const subNode = this.cardPanel ? this.cardPanel.getChildByName('CardSub') : null;
        if (subNode && this.cardPanel && this.cardPanel.active) {
            const l = subNode.getComponent(Label);
            if (l && l.string.indexOf('⏱ ' + remain + ' ') < 0) {
                const faction = this.G.playerFaction;
                l.string = '第 ' + this.G.wave + ' 波 · ' + FACTIONS[faction].name + ' · ⏱ ' + remain + ' 秒后自动选择第一张';
            }
        }
    }

    private createCardNode(card: any, index: number): Node {
        const node = new Node('Card_' + index);
        node.layer = this.uiLayer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(200, 260);
        ut.anchorPoint = new Vec2(0.5, 0.5);

        // 背景
        const rarityColor = RARITY_COLORS[card.rarity] || new Color(100, 100, 100);
        const bg = this.createColorNode(new Color(30, 42, 54), 200, 260);
        bg.parent = node;

        // 边框
        const border = this.createColorNode(rarityColor, 204, 264);
        border.parent = node;
        border.setPosition(0, 0, -1);

        // 图标
        const iconNode = new Node();
        iconNode.layer = this.uiLayer;
        iconNode.parent = node;
        const iUt = iconNode.addComponent(UITransform);
        iUt.contentSize = new Size(60, 60);
        const iLabel = iconNode.addComponent(Label);
        iLabel.string = card.icon;
        iLabel.fontSize = 42;
        iLabel.color = Color.WHITE;
        iconNode.setPosition(0, 70, 0);

        // 名称
        const nameNode = new Node();
        nameNode.layer = this.uiLayer;
        nameNode.parent = node;
        const nUt = nameNode.addComponent(UITransform);
        nUt.contentSize = new Size(180, 30);
        const nLabel = nameNode.addComponent(Label);
        nLabel.string = card.name;
        nLabel.fontSize = 20;
        nLabel.color = Color.WHITE;
        nLabel.lineHeight = 26;
        nameNode.setPosition(0, 20, 0);

        // 描述
        const descNode = new Node();
        descNode.layer = this.uiLayer;
        descNode.parent = node;
        const dUt = descNode.addComponent(UITransform);
        dUt.contentSize = new Size(180, 60);
        const dLabel = descNode.addComponent(Label);
        dLabel.string = card.desc;
        dLabel.fontSize = 14;
        dLabel.color = new Color(159, 180, 196);
        dLabel.lineHeight = 20;
        descNode.setPosition(0, -40, 0);

        // 稀有度
        const rarNode = new Node();
        rarNode.layer = this.uiLayer;
        rarNode.parent = node;
        const rUt = rarNode.addComponent(UITransform);
        rUt.contentSize = new Size(80, 20);
        const rLabel = rarNode.addComponent(Label);
        const rarNames: Record<string, string> = { rare: '稀有', epic: '史诗', legendary: '传说' };
        rLabel.string = rarNames[card.rarity] || '普通';
        rLabel.fontSize = 12;
        rLabel.color = rarityColor;
        rarNode.setPosition(60, 110, 0);

        // 点击
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.08;
        const handler = new EventHandler();
        handler.target = this.node;
        handler.component = 'GameManager';
        handler.handler = 'onCardClick';
        handler.customEventData = card.id;
        button.clickEvents = [handler];

        return node;
    }

    onCardClick(event: Event, cardId: string) {
        this.cardTimeoutSeconds = 0; // 手动选择即取消倒计时
        this.pendingCards = [];
        this.gameRunning = true;
        if (this.cardPanel) this.cardPanel.active = false;
        this.applyCardEffect(cardId);
        this.showToast('卡牌生效！');
    }

    private applyCardEffect(cardId: string) {
        const faction = this.G.playerFaction;
        const card = CARDS[faction].find((c: any) => c.id === cardId);
        if (!card) return;

        // 简化版效果
        switch (cardId) {
            case 'heal':
                this.G.units.filter((u: any) => u.side === 'red').forEach((u: any) => {
                    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3);
                });
                break;
            case 'atkUp':
            case 'fruitRage': {
                const oldAtk = this.G.permBuff.atk || 1;
                this.G.permBuff.atk = oldAtk * (cardId === 'fruitRage' ? 1.35 : 1.25);
                const ratio = this.G.permBuff.atk / oldAtk;
                // 已在场的己方单位立即按同比例提升攻击（永久加成全局生效，含老兵）
                this.G.units.filter((u: any) => u.side === 'red').forEach((u: any) => {
                    u.atk = u.atk * ratio;
                });
                if (cardId === 'fruitRage') this.G.permBuff.as = (this.G.permBuff.as || 1) * 1.2;
                break;
            }
            case 'splash':
                this.G.permBuff.splashMult = (this.G.permBuff.splashMult || 1) * 1.6;
                break;
            case 'sunburst':
            case 'stampede':
                this.G.tempBuffs.push({ type: cardId === 'sunburst' ? 'asMult' : 'spdMult', mult: 2, dur: 10 });
                break;
            case 'howl':
                this.G.tempBuffs.push({ type: 'atkMult', mult: 1.5, dur: 10 });
                break;
            case 'tropical':
            case 'spore':
                this.G.units.filter((u: any) => u.side === 'blue').forEach((u: any) => {
                    u.hp -= cardId === 'tropical' ? 200 : 150;
                });
                break;
            case 'shield':
                this.G.units.filter((u: any) => u.side === 'red').forEach((u: any) => {
                    u.shield = (u.shield || 0) + 150;
                });
                break;
            case 'hpUp':
            case 'bark':
                this.G.permBuff.hp = (this.G.permBuff.hp || 1) * (cardId === 'hpUp' ? 1.3 : 1);
                this.G.permBuff.dr = (this.G.permBuff.dr || 1) * (cardId === 'bark' ? 0.8 : 1);
                // 已在场的己方单位立即按比例提升血量（永久加成全局生效，含老兵）
                this.G.units.filter((u: any) => u.side === 'red').forEach((u: any) => {
                    const oldMax = u.maxHp;
                    u.maxHp = Math.round(u.maxHp * (cardId === 'hpUp' ? 1.3 : 1));
                    u.hp = Math.min(u.maxHp, u.hp + (u.maxHp - oldMax));
                });
                break;
            case 'crit':
                this.G.permBuff.crit = (this.G.permBuff.crit || 0) + 0.3;
                break;
            case 'bloodlust':
                this.G.permBuff.lifeOnKill = 0.2;
                break;
            case 'frenzy': {
                const oldAtk = this.G.permBuff.atk || 1;
                this.G.permBuff.atk = oldAtk * 1.4;
                const ratio = this.G.permBuff.atk / oldAtk;
                this.G.units.filter((u: any) => u.side === 'red').forEach((u: any) => {
                    u.atk = u.atk * ratio;
                });
                this.G.permBuff.as = (this.G.permBuff.as || 1) * 1.3;
                break;
            }
            case 'bloom':
                for (let i = 0; i < 3; i++) {
                    this.G.units.push({
                        kind: 'unit', side: 'red', type: 'tank',
                        x: -300 + Math.random() * 100, y: -50 + Math.random() * 60 - 30,
                        hp: 200, maxHp: 200, atk: 15, spd: 0.6, range: 50, atkSpd: 0.8, atkCd: 0,
                    });
                }
                break;
            case 'growth':
                this.G.permBuff.waveInt = (this.G.permBuff.waveInt || 1) * 0.7;
                break;
            case 'forest':
                const rc = this.G.crystals.find((c: any) => c.side === 'red');
                if (rc) rc.hp = Math.min(rc.maxHp, rc.hp + 500);
                break;
            case 'predator':
                this.G.permBuff.execute = true;
                break;
            case 'vine':
                this.G.units.filter((u: any) => u.side === 'blue').forEach((u: any) => { u.stunDur = 3; });
                break;
            case 'rootNet':
                this.G.units.filter((u: any) => u.side === 'blue').forEach((u: any) => { u.slowMult = 0.6; u.slowDur = 8; });
                break;
            default:
                this.G.permBuff.atk = (this.G.permBuff.atk || 1) * 1.1;
                break;
        }
    }

    checkWinCondition() {
        const rc = this.G.crystals.find((c: any) => c.side === 'red');
        const bc = this.G.crystals.find((c: any) => c.side === 'blue');
        if (rc && rc.hp <= 0 && bc && bc.hp <= 0) {
            this.endGame(this.G.kills.red >= this.G.kills.blue ? 'red' : 'blue');
        } else if (rc && rc.hp <= 0) {
            this.endGame('blue');
        } else if (bc && bc.hp <= 0) {
            this.endGame('red');
        }
    }

    endGame(winner: string) {
        this.G.phase = 'ended';
        this.gameRunning = false;

        const won = winner === 'red';
        const crystal = this.G.crystals.find((c: any) => c.side === 'red');
        const hpRatio = crystal ? crystal.hp / crystal.maxHp : 0;
        const stars = won ? (hpRatio >= 0.5 ? 3 : 2) : 1;

        // 计算用时
        const durationSec = Math.floor((Date.now() - this.G.gameStartTime) / 1000);
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;
        const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // 本地存档：胜负与最佳星级
        const save = this.loadSave();
        if (won) {
            save.wins = (save.wins || 0) + 1;
            save.bestStars = Math.max(save.bestStars || 0, stars);
        } else {
            save.losses = (save.losses || 0) + 1;
        }
        this.saveSave(save);

        if (this.endPanel) {
            this.endPanel.active = true;
            const statsNode = this.endPanel.children.find(c => {
                const l = c.getComponent(Label);
                return l && l.fontSize === 20;
            });
            if (statsNode) {
                const l = statsNode.getComponent(Label);
                if (l) {
                    l.string = (won ? '🎉 胜利！' : '😢 失败\n') +
                        '⭐'.repeat(stars) + '☆'.repeat(3 - stars) + '\n' +
                        '用时：' + durationText + '\n' +
                        '击杀：' + this.G.kills.red + '\n' +
                        '波次：第 ' + this.G.wave + ' 波';
                }
            }
        }
    }

    /** 全龄化死亡特效：单位 → 弹飞星星/果粒消散；建筑/塔 → 彩色碎裂；水晶 → 大爆闪（由结算处理） */
    private emitDeathEffects() {
        if (!this.gameContainer) return;
        const star = new Color(255, 240, 150);
        // 单位：在死亡点撒一圈"果粒/星星"扩散，并飘一个 ⭐
        for (const u of this.G.units) {
            if (u.hp > 0) continue;
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI * 2 * i) / 4 + Math.random() * 0.6;
                const r = 14 + Math.random() * 10;
                this.spawnEffect(u.x + Math.cos(a) * r, u.y + Math.sin(a) * r, star, 8, 0.35);
            }
            this.spawnFloatText(u.x, u.y + 6, '⭐', star, 16);
        }
        // 建筑/塔：碎裂（橙红颗粒）
        const debris = new Color(255, 180, 100);
        for (const b of this.G.buildings) {
            if (b.hp > 0) continue;
            for (let i = 0; i < 5; i++) {
                const a = (Math.PI * 2 * i) / 5 + Math.random() * 0.5;
                const r = 18 + Math.random() * 14;
                this.spawnEffect(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, debris, 10, 0.4);
            }
        }
        for (const t of this.G.towers) {
            if (t.hp > 0) continue;
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI * 2 * i) / 4;
                this.spawnEffect(t.x + Math.cos(a) * 14, t.y + Math.sin(a) * 14, debris, 9, 0.35);
            }
        }
    }

    // ==================== 视觉同步 ====================
    private syncVisuals() {
        if (!this.gameContainer) return;
        this.syncCrystals();
        this.syncBuildings();
        this.syncTowers();
        this.syncUnits();
    }

    /** 生成一个"底色块 + emoji 图标"的实体视觉节点 */
    private makeEmojiVisual(emoji: string, color: Color, size: number): Node {
        const node = new Node('Entity');
        node.layer = this.uiLayer;
        const ut = node.addComponent(UITransform);
        ut.contentSize = new Size(size, size);
        const bg = this.createColorNode(color, size, size);
        bg.name = 'Bg';
        bg.parent = node;
        const icon = new Node('Icon');
        icon.layer = this.uiLayer;
        icon.parent = node;
        const iUt = icon.addComponent(UITransform);
        iUt.contentSize = new Size(size, size);
        const label = icon.addComponent(Label);
        label.string = emoji;
        label.fontSize = Math.max(12, size - 6);
        label.lineHeight = size;
        label.color = Color.WHITE;
        icon.setPosition(0, 0, 0);
        return node;
    }

    /** 更新实体视觉：底色颜色/尺寸 + emoji + 字号 */
    private updateEmojiVisual(node: Node, emoji: string, color: Color, size: number) {
        const bg = node.getChildByName('Bg');
        if (bg) {
            const sp = bg.getComponent(Sprite);
            if (sp) { const sf = this.getColorSpriteFrame(color, size, size); if (sf) sp.spriteFrame = sf; }
        }
        const icon = node.getChildByName('Icon');
        if (icon) {
            const label = icon.getComponent(Label);
            if (label) { label.string = emoji; label.fontSize = Math.max(12, size - 6); label.lineHeight = size; }
            const iUt = icon.getComponent(UITransform);
            if (iUt) iUt.contentSize = new Size(size, size);
        }
        const ut = node.getComponent(UITransform);
        if (ut) ut.contentSize = new Size(size, size);
    }

    /** 给实体节点挂一个血条（bg + fg），fg 用 scale.x 表示血量比例 */
    private attachHpBar(node: Node, width: number): Node {
        const bar = new Node('HpBar');
        bar.layer = this.uiLayer;
        bar.parent = node;
        const but = bar.addComponent(UITransform);
        but.contentSize = new Size(width, 4);
        const bg = this.createColorNode(new Color(0, 0, 0, 180), width, 4);
        bg.parent = bar;
        const fgNode = this.createColorNode(new Color(80, 220, 90), width - 2, 2);
        fgNode.name = 'HpFg';
        fgNode.parent = bar;
        // fg 左对齐：锚点设为左中，位置贴左，缩放时从左往右减
        const fut = fgNode.getComponent(UITransform)!;
        fut.anchorPoint = new Vec2(0, 0.5);
        fgNode.setPosition(-(width - 2) / 2, 0, 0);
        bar.setPosition(0, 0, 0); // 由调用方摆位置
        return bar;
    }

    /** 更新血条显示（比例 + 红/黄/绿变色） */
    private updateHpBar(node: Node, hp: number, maxHp: number) {
        const bar = node.getChildByName('HpBar');
        if (!bar) return;
        const fgNode = bar.getChildByName('HpFg');
        if (!fgNode) return;
        const ratio = Math.max(0, Math.min(1, hp / maxHp));
        fgNode.setScale(ratio, 1, 1);
        const sprite = fgNode.getComponent(Sprite);
        if (sprite) {
            let c: Color;
            if (ratio > 0.6) c = new Color(80, 220, 90);
            else if (ratio > 0.3) c = new Color(250, 200, 60);
            else c = new Color(235, 80, 70);
            const ut = fgNode.getComponent(UITransform);
            const sf = this.getColorSpriteFrame(c, Math.round(ut.contentSize.width), Math.round(ut.contentSize.height));
            if (sf) sprite.spriteFrame = sf;
        }
    }

    private syncCrystals() {
        while (this.G.crystalNodes.length < this.G.crystals.length) {
            const node = this.makeEmojiVisual('🏛️', new Color(100, 100, 100), 60);
            node.parent = this.gameContainer;
            const bar = this.attachHpBar(node, 56);
            bar.setPosition(0, 38, 0);
            this.G.crystalNodes.push(node);
        }
        while (this.G.crystalNodes.length > this.G.crystals.length) { const n = this.G.crystalNodes.pop()!; if (n.isValid) n.destroy(); }
        for (let i = 0; i < this.G.crystals.length; i++) {
            const c = this.G.crystals[i];
            const node = this.G.crystalNodes[i];
            const color = c.side === 'red' ? new Color(255, 130, 80) : new Color(90, 150, 255);
            const faction = c.side === 'red' ? this.G.playerFaction : this.G.aiFaction;
            const emoji = FACTION_EMOJI[faction as FactionId] || '🏛️';
            node.setPosition(c.x, c.y, 0);
            this.updateEmojiVisual(node, emoji, color, 60);
            this.updateHpBar(node, c.hp, c.maxHp);
        }
    }

    private syncBuildings() {
        while (this.G.buildingNodes.length < this.G.buildings.length) {
            const node = this.makeEmojiVisual('🏭', new Color(100, 100, 100), 40);
            node.parent = this.gameContainer;
            const bar = this.attachHpBar(node, 36);
            bar.setPosition(0, 30, 0);
            // 升级星标（Lv2 ★ / Lv3 ★★，v0.4.4）
            const badge = new Node('StarBadge');
            badge.layer = this.uiLayer;
            badge.parent = node;
            const bUt = badge.addComponent(UITransform);
            bUt.contentSize = new Size(22, 16);
            const bLabel = badge.addComponent(Label);
            bLabel.fontSize = 13;
            bLabel.lineHeight = 16;
            bLabel.color = new Color(255, 215, 60);
            badge.active = false;
            this.G.buildingNodes.push(node);
        }
        while (this.G.buildingNodes.length > this.G.buildings.length) { const n = this.G.buildingNodes.pop()!; if (n.isValid) n.destroy(); }
        for (let i = 0; i < this.G.buildings.length; i++) {
            const b = this.G.buildings[i];
            const node = this.G.buildingNodes[i];
            let color = b.side === 'red' ? new Color(200, 100, 100) : new Color(100, 150, 200);
            let size = 40;
            let emoji = '🏭';
            if (b.type === 'factory') {
                size = 40; // 统一尺寸，等级由星标区分（v0.4.5 去掉升级变大避免挤压）
                emoji = UNIT_EMOJI[b.unitType as UnitRoleId] || '🏭';
            }
            if (b.type === 'academy') { color = new Color(170, 120, 220); size = 46; emoji = '🎓'; }
            if (b.type === 'auraTower') { color = new Color(80, 200, 220); size = 42; emoji = '🌀'; }
            if (this.selectedFactory && b === this.selectedFactory) color = new Color(255, 220, 90);
            node.setPosition(b.x, b.y, 0);
            this.updateEmojiVisual(node, emoji, color, size);
            this.updateHpBar(node, b.hp, b.maxHp);
            // 升级星标
            const badge = node.getChildByName('StarBadge');
            if (badge) {
                const lvl = b.type === 'factory' ? (b.level || 1) : 1;
                if (lvl > 1) {
                    badge.active = true;
                    const bLabel = badge.getComponent(Label);
                    if (bLabel) bLabel.string = lvl >= 3 ? '★★' : '★';
                    badge.setPosition(size * 0.42, size * 0.42, 0);
                } else {
                    badge.active = false;
                }
            }
        }
    }

    private syncTowers() {
        while (this.G.towerNodes.length < this.G.towers.length) {
            const node = this.makeEmojiVisual('🗼', new Color(100, 100, 100), 30);
            node.parent = this.gameContainer;
            const bar = this.attachHpBar(node, 28);
            bar.setPosition(0, 22, 0);
            this.G.towerNodes.push(node);
        }
        while (this.G.towerNodes.length > this.G.towers.length) { const n = this.G.towerNodes.pop()!; if (n.isValid) n.destroy(); }
        for (let i = 0; i < this.G.towers.length; i++) {
            const t = this.G.towers[i];
            const node = this.G.towerNodes[i];
            const color = t.side === 'red' ? new Color(220, 120, 120) : new Color(120, 170, 220);
            node.setPosition(t.x, t.y, 0);
            this.updateEmojiVisual(node, '🗼', color, 30);
            this.updateHpBar(node, t.hp, t.maxHp);
        }
    }

    private syncUnits() {
        while (this.G.unitNodes.length < this.G.units.length) {
            const node = this.makeEmojiVisual('🛡️', new Color(100, 100, 100), 16);
            node.parent = this.gameContainer;
            const bar = this.attachHpBar(node, 18);
            bar.setPosition(0, 14, 0);
            // 精英★角标（Lv2/Lv3 显示）
            const badge = new Node('StarBadge');
            badge.layer = this.uiLayer;
            badge.parent = node;
            const bUt = badge.addComponent(UITransform);
            bUt.contentSize = new Size(18, 14);
            const bLabel = badge.addComponent(Label);
            bLabel.fontSize = 12;
            bLabel.lineHeight = 14;
            bLabel.color = new Color(255, 215, 60);
            badge.active = false;
            this.G.unitNodes.push(node);
        }
        while (this.G.unitNodes.length > this.G.units.length) { const n = this.G.unitNodes.pop()!; if (n.isValid) n.destroy(); }
        for (let i = 0; i < this.G.units.length; i++) {
            const u = this.G.units[i];
            const node = this.G.unitNodes[i];
            const color = u.side === 'red' ? new Color(255, 150, 150) : new Color(150, 200, 255);
            const size = 18 + ((u.level || 1) - 1) * 6; // 精英兵（★/★★）体型更大
            const emoji = UNIT_EMOJI[u.type as UnitRoleId] || '🛡️';
            node.setPosition(u.x, u.y, 0);
            this.updateEmojiVisual(node, emoji, color, size);
            this.updateHpBar(node, u.hp, u.maxHp);
            // 精英角标
            const badge = node.getChildByName('StarBadge');
            if (badge) {
                const lvl = u.level || 1;
                if (lvl > 1) {
                    badge.active = true;
                    const bLabel = badge.getComponent(Label);
                    if (bLabel) bLabel.string = lvl >= 3 ? '★★' : '★';
                    badge.setPosition(size * 0.42, size * 0.42, 0);
                } else {
                    badge.active = false;
                }
            }
        }
    }

    // ==================== UI更新 ====================
    updateUI() {
        if (this.goldLabel) this.goldLabel.string = '💰 ' + this.G.gold[this.G.playerSide];
        if (this.waveLabel) this.waveLabel.string = ' 第 ' + this.G.wave + ' 波';
        if (this.popLabel) {
            const pop = this.G.units.filter((u: any) => u.side === this.G.playerSide).length;
            this.popLabel.string = ' ' + pop + '/' + GAME_CONFIG.unitCapPerSide;
        }
        if (this.killsLabel) this.killsLabel.string = '⚔ ' + this.G.kills[this.G.playerSide];
        const rc = this.G.crystals.find((c: any) => c.side === 'red');
        const bc = this.G.crystals.find((c: any) => c.side === 'blue');
        if (this.hpRedLabel && rc) this.hpRedLabel.string = '🔴 ' + Math.max(0, Math.floor(rc.hp));
        if (this.hpBlueLabel && bc) this.hpBlueLabel.string = ' ' + Math.max(0, Math.floor(bc.hp));
    }
}
