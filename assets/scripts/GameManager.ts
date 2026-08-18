import { _decorator, Component, Node, Label, Color, UITransform, Size, Vec2, Sprite, SpriteFrame, Texture2D, ImageAsset, Layers, Button, EventHandler, tween, Vec3, UIOpacity, BlockInputEvents, Canvas, Camera, ClearFlags } from 'cc';
const { ccclass, property } = _decorator;

// ==================== 配置 ====================
const CFG = {
    WAVE_INT: 20, SALARY_INT: 15, SALARY: 50, START_GOLD: 200,
    CRYSTAL_HP: 5000, UNIT_CAP: 60, RAZE_BOUNTY: 50,
};

const FACTIONS: Record<string, any> = {
    fruit:  { name:'水果王国', passive:'阳光生长·出兵快11%', price:0.95, hp:0.78, atk:0.9,  speed:1.0,  waveInt:18, countBonus:0, first:2,   color:'#ff7043' },
    wood:   { name:'绿木林',   passive:'生生不息·每厂每波+1兵', price:1.1,  hp:1.45, atk:1.0, speed:0.8,  waveInt:20, countBonus:1, first:2,   color:'#66bb6a' },
    animal: { name:'动物庄园', passive:'野性力量·攻击+45%', price:1.0,  hp:0.95, atk:1.45, speed:1.35, waveInt:20, countBonus:0, first:2.5, color:'#ffca28' },
};

const UNITS: Record<string, any> = {
    tank:   { name:'坦克',   hp:280, atk:22, spd:0.7, range:55,  atkSpd:1.0, cost:150, icon:'🛡️' },
    ranged: { name:'远程',   hp:120, atk:30, spd:0.9, range:180, atkSpd:1.2, cost:130, icon:'🏹' },
    aoe:    { name:'AOE',    hp:160, atk:18, spd:0.8, range:130, atkSpd:0.9, cost:180, icon:'✨' },
    rush:   { name:'冲锋',   hp:90,  atk:26, spd:1.5, range:50,  atkSpd:1.5, cost:160, icon:'' },
    siege:  { name:'攻城',   hp:400, atk:45, spd:0.5, range:220, atkSpd:0.6, cost:200, icon:'🪨' },
};

const BUILDINGS: Record<string, any> = {
    tank:    { name:'坦克厂',   hp:800,  cost:150, icon:'🛡️' },
    ranged:  { name:'远程厂',   hp:800,  cost:130, icon:'🏹' },
    aoe:     { name:'AOE厂',    hp:800,  cost:180, icon:'✨' },
    rush:    { name:'冲锋厂',   hp:800,  cost:160, icon:'⚡' },
    siege:   { name:'攻城厂',   hp:800,  cost:200, icon:'🪨' },
    tower:   { name:'防御塔',   hp:600,  cost:120, range:200, atk:25, atkSpd:1.0, icon:'🗼' },
    academy: { name:'战争学院', hp:500,  cost:200, icon:'️' },
};

const CARDS: Record<string, any[]> = {
    fruit: [
        { id:'heal', name:'鲜榨回复', icon:'🍹', desc:'全体治疗30%血量', rarity:'rare' },
        { id:'atkUp', name:'果香四溢', icon:'🌺', desc:'全体攻击+25%永久', rarity:'epic' },
        { id:'splash', name:'果弹飞溅', icon:'💥', desc:'攻击附带60%溅射', rarity:'rare' },
        { id:'sunburst', name:'阳光爆发', icon:'️', desc:'10秒内攻速翻倍', rarity:'epic' },
        { id:'tropical', name:'热带风暴', icon:'️', desc:'对全场敌人造成200伤害', rarity:'legendary' },
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
        { id:'thorn', name:'荆棘之甲', icon:'', desc:'受击反弹20%伤害', rarity:'rare' },
        { id:'growth', name:'自然生长', icon:'🌱', desc:'出兵速度+30%永久', rarity:'legendary' },
        { id:'forest', name:'森林守护', icon:'🌲', desc:'水晶回血500', rarity:'rare' },
    ],
    animal: [
        { id:'crit', name:'致命一击', icon:'', desc:'全体暴击率+30%', rarity:'rare' },
        { id:'bloodlust', name:'嗜血狂潮', icon:'', desc:'击杀回血20%', rarity:'epic' },
        { id:'frenzy', name:'狂暴本能', icon:'💢', desc:'攻击+40%攻速+30%永久', rarity:'legendary' },
        { id:'howl', name:'战嚎', icon:'', desc:'10秒内攻击+50%', rarity:'epic' },
        { id:'pack', name:'狼群战术', icon:'', desc:'每有一个友军攻击+5%', rarity:'rare' },
        { id:'predator', name:'捕食者', icon:'', desc:'对低血量敌人伤害+100%', rarity:'epic' },
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
    private selectedFaction: string = 'fruit';
    private selectedDifficulty: string = 'normal';
    private buildMode: string | null = null;

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
            cam.clearFlags = ClearFlags.SOLID_COLOR;
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
        if (!this.gameRunning) return;
        this.gameStep(dt);
        this.syncVisuals();
        this.updateUI();
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

        // 兵线区域
        const lane = this.createColorNode(new Color(34, 48, 58), 1280, 200);
        lane.parent = this.gameContainer;
        lane.setPosition(0, -50, 0);
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
        this.createToast();
    }

    private createTopBar() {
        const bar = new Node('TopBar');
        bar.layer = this.uiLayer;
        bar.parent = this.uiContainer;
        const ut = bar.addComponent(UITransform);
        ut.contentSize = new Size(1280, 44);
        ut.anchorPoint = new Vec2(0.5, 1);

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
        this.hpRedLabel = makeLabel('🔴 5000', 400, -22, new Color(255, 138, 122));
        this.hpBlueLabel = makeLabel('🔵 5000', 560, -22, new Color(122, 184, 255));
    }

    private createBuildBar() {
        this.buildBar = new Node('BuildBar');
        this.buildBar.layer = this.uiLayer;
        this.buildBar.parent = this.uiContainer;
        const ut = this.buildBar.addComponent(UITransform);
        ut.contentSize = new Size(1280, 76);
        ut.anchorPoint = new Vec2(0.5, 0);

        const bg = this.createColorNode(new Color(34, 48, 58), 1280, 76);
        bg.parent = this.buildBar;
        bg.setPosition(0, 38, 0);

        const types = Object.keys(BUILDINGS);
        const startX = -420;
        const gap = 96;

        types.forEach((type, i) => {
            const b = BUILDINGS[type];
            const btn = this.createBuildButton(b.icon, b.name, b.cost, type);
            btn.parent = this.buildBar;
            btn.setPosition(startX + i * gap, 38, 0);
        });
    }

    private createBuildButton(icon: string, name: string, cost: number, type: string): Node {
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
        icLabel.string = icon;
        icLabel.fontSize = 20;
        icLabel.color = Color.WHITE;
        iconLabel.setPosition(0, 10, 0);

        const nameLabel = new Node();
        nameLabel.layer = this.uiLayer;
        nameLabel.parent = btn;
        const nmUt = nameLabel.addComponent(UITransform);
        nmUt.contentSize = new Size(80, 16);
        const nmLabel = nameLabel.addComponent(Label);
        nmLabel.string = name;
        nmLabel.fontSize = 12;
        nmLabel.color = new Color(223, 233, 240);
        nameLabel.setPosition(0, -8, 0);

        const costLabel = new Node();
        costLabel.layer = this.uiLayer;
        costLabel.parent = btn;
        const csUt = costLabel.addComponent(UITransform);
        csUt.contentSize = new Size(60, 14);
        const csLabel = costLabel.addComponent(Label);
        csLabel.string = cost + '金';
        csLabel.fontSize = 11;
        csLabel.color = new Color(255, 215, 94);
        costLabel.setPosition(0, -22, 0);

        // 点击事件
        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.1;

        const clickHandler = new EventHandler();
        clickHandler.target = this.node;
        clickHandler.component = 'GameManager';
        clickHandler.handler = 'onBuildClick';
        clickHandler.customEventData = type;
        button.clickEvents = [clickHandler];

        return btn;
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
        const dbLabel = diffBtn.addComponent(Label);
        dbLabel.string = '切换难度';
        dbLabel.fontSize = 16;
        dbLabel.color = Color.WHITE;
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
        const sbLabel = startBtn.addComponent(Label);
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
        const abLabel = againBtn.addComponent(Label);
        abLabel.string = '再来一局';
        abLabel.fontSize = 22;
        abLabel.color = Color.WHITE;
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

        const title = new Node();
        title.layer = this.uiLayer;
        title.parent = this.cardPanel;
        const tUt = title.addComponent(UITransform);
        tUt.contentSize = new Size(400, 40);
        const tLabel = title.addComponent(Label);
        tLabel.string = '选择一张卡牌';
        tLabel.fontSize = 30;
        tLabel.color = new Color(255, 215, 94);
        tLabel.lineHeight = 36;
        title.setPosition(0, 220, 0);

        const sub = new Node();
        sub.layer = this.uiLayer;
        sub.parent = this.cardPanel;
        const sUt = sub.addComponent(UITransform);
        sUt.contentSize = new Size(400, 24);
        const sLabel = sub.addComponent(Label);
        sLabel.string = '';
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
        this.toastLabel = toast.addComponent(Label);
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
        this.selectedFaction = faction;
        this.showToast('选择了：' + FACTIONS[faction].name);
    }

    onDiffClick(event: Event) {
        const diffs = ['easy', 'normal', 'hard'];
        const names = ['简单', '普通', '困难'];
        const idx = diffs.indexOf(this.selectedDifficulty);
        this.selectedDifficulty = diffs[(idx + 1) % 3];
        // 更新难度显示
        const diffNode = this.startPanel?.children.find(c => c.getComponent(Label));
        // 简化：直接toast
        this.showToast('难度：' + names[(idx + 1) % 3]);
    }

    onStartClick(event: Event) {
        if (this.startPanel) this.startPanel.active = false;
        this.initGame();
        this.G.playerFaction = this.selectedFaction;
        this.G.difficulty = this.selectedDifficulty;
        this.G.phase = 'playing';
        this.gameRunning = true;
        this.createFactory('red', -400, -50);
        this.createFactory('blue', 400, -50);
        this.showToast('游戏开始！阵营：' + FACTIONS[this.selectedFaction].name);
    }

    onBuildClick(event: Event, type: string) {
        if (!this.gameRunning) return;
        const b = BUILDINGS[type];
        if (!b) return;
        const gold = this.G.gold[this.G.playerSide];
        if (gold < b.cost) {
            this.showToast('金币不足！需要 ' + b.cost + ' 金');
            return;
        }
        this.G.gold[this.G.playerSide] -= b.cost;

        if (type === 'tower') {
            // 造塔
            this.G.towers.push({
                kind: 'tower', type: 'tower', side: 'red',
                x: -300 + Math.random() * 100, y: -50 + Math.random() * 40 - 20,
                hp: b.hp, maxHp: b.hp,
                range: b.range, atk: b.atk, atkSpd: b.atkSpd, atkCd: 0,
            });
        } else if (type === 'academy') {
            // 学院 - 全军强化
            this.G.permBuff.atk = (this.G.permBuff.atk || 1) * 1.1;
            this.G.permBuff.hp = (this.G.permBuff.hp || 1) * 1.1;
            this.showToast('战争学院！全军攻击+10% 血量+10%');
        } else {
            // 兵工厂
            this.G.buildings.push({
                kind: 'building', type: 'factory', unitType: type, side: 'red',
                x: -350 + Math.random() * 100, y: -50 + Math.random() * 60 - 30,
                hp: b.hp, maxHp: b.hp,
                waveTimer: FACTIONS[this.G.playerFaction].waveInt,
                level: 1,
            });
        }
        this.showToast('建造了 ' + b.name + '！');
    }

    onAgainClick(event: Event) {
        if (this.endPanel) this.endPanel.active = false;
        this.showStartPanel();
    }

    private showStartPanel() {
        if (this.startPanel) this.startPanel.active = true;
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
        }

        this.G = {
            phase: 'idle', playerSide: 'red',
            playerFaction: this.selectedFaction,
            aiFaction: this.getAIFaction(),
            difficulty: this.selectedDifficulty,
            gold: { red: CFG.START_GOLD, blue: CFG.START_GOLD },
            salaryTimer: { red: CFG.SALARY_INT, blue: CFG.SALARY_INT },
            wave: 0, waveTimer: CFG.WAVE_INT,
            units: [] as any[], buildings: [] as any[],
            towers: [] as any[], crystals: [] as any[],
            kills: { red: 0, blue: 0 },
            permBuff: { atk: 1, hp: 1, as: 1, dr: 1, crit: 0, splashMult: 1, waveInt: 1 },
            tempBuffs: [] as any[],
            cardTriggered: { 5: false, 15: false, 20: false },
            crystalNodes: [] as Node[],
            buildingNodes: [] as Node[],
            towerNodes: [] as Node[],
            unitNodes: [] as Node[],
        };

        this.G.crystals.push({
            kind: 'crystal', side: 'red', x: -500, y: 0,
            hp: CFG.CRYSTAL_HP, maxHp: CFG.CRYSTAL_HP,
        });
        this.G.crystals.push({
            kind: 'crystal', side: 'blue', x: 500, y: 0,
            hp: CFG.CRYSTAL_HP, maxHp: CFG.CRYSTAL_HP,
        });
    }

    private getAIFaction(): string {
        const factions = Object.keys(FACTIONS);
        const idx = factions.indexOf(this.selectedFaction);
        return factions[(idx + 1) % factions.length];
    }

    createFactory(side: string, x: number, y: number) {
        const faction = side === 'red' ? this.G.playerFaction : this.G.aiFaction;
        const fConf = FACTIONS[faction];
        this.G.buildings.push({
            kind: 'building', type: 'factory', side, x, y,
            hp: 800 * fConf.hp, maxHp: 800 * fConf.hp,
            waveTimer: fConf.waveInt, level: 1,
        });
    }

    gameStep(dt: number) {
        // 工资
        for (const side of ['red', 'blue']) {
            this.G.salaryTimer[side] -= dt;
            if (this.G.salaryTimer[side] <= 0) {
                this.G.gold[side] += CFG.SALARY;
                this.G.salaryTimer[side] = CFG.SALARY_INT;
            }
        }

        // 波次
        this.G.waveTimer -= dt;
        if (this.G.waveTimer <= 0) {
            this.G.wave++;
            this.G.waveTimer = CFG.WAVE_INT;
            this.onWave();
        }

        // 兵工厂出兵
        for (const b of this.G.buildings.filter((b: any) => b.type === 'factory')) {
            b.waveTimer -= dt;
            if (b.waveTimer <= 0) {
                this.waveSpawn(b);
                const faction = b.side === 'red' ? this.G.playerFaction : this.G.aiFaction;
                const fConf = FACTIONS[faction];
                b.waveTimer = fConf.waveInt * (this.G.permBuff.waveInt || 1);
            }
        }

        // 更新单位
        for (const u of this.G.units) this.updateUnit(u, dt);
        // 更新塔
        for (const t of this.G.towers) this.updateTower(t, dt);

        // 清理死亡
        this.G.units = this.G.units.filter((u: any) => u.hp > 0);
        this.G.buildings = this.G.buildings.filter((b: any) => b.hp > 0);
        this.G.towers = this.G.towers.filter((t: any) => t.hp > 0);

        // 临时buff
        for (let i = this.G.tempBuffs.length - 1; i >= 0; i--) {
            this.G.tempBuffs[i].dur -= dt;
            if (this.G.tempBuffs[i].dur <= 0) this.G.tempBuffs.splice(i, 1);
        }

        // AI造兵
        this.aiThink(dt);

        // 胜负
        this.checkWinCondition();
    }

    private aiThink(dt: number) {
        // 简单AI：攒钱造兵工厂
        const aiGold = this.G.gold.blue;
        const types = Object.keys(BUILDINGS);
        const cheapType = types.reduce((a, b) => BUILDINGS[a].cost < BUILDINGS[b].cost ? a : b);
        const cost = BUILDINGS[cheapType].cost;

        if (aiGold >= cost && this.G.buildings.filter((b: any) => b.side === 'blue').length < 5) {
            this.G.gold.blue -= cost;
            this.G.buildings.push({
                kind: 'building', type: 'factory', side: 'blue',
                x: 350 + Math.random() * 100, y: -50 + Math.random() * 60 - 30,
                hp: 800, maxHp: 800,
                waveTimer: FACTIONS[this.G.aiFaction].waveInt,
                level: 1,
            });
        }
    }

    updateUnit(u: any, dt: number) {
        if (u.hp <= 0) return;
        let spdMult = 1;
        if (u.slowDur && u.slowDur > 0) { spdMult = u.slowMult || 0.6; u.slowDur -= dt; }
        if (u.stunDur && u.stunDur > 0) { u.stunDur -= dt; return; }
        if (u.atkCd > 0) u.atkCd -= dt;

        const target = this.findTarget(u);
        if (target) {
            const dx = target.x - u.x, dy = target.y - u.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= u.range) {
                if (u.atkCd <= 0) {
                    this.attack(u, target);
                    u.atkCd = 1 / (u.atkSpd * (this.G.permBuff.as || 1));
                }
            } else {
                u.x += (dx / dist) * u.spd * spdMult * 60 * dt;
                u.y += (dy / dist) * u.spd * spdMult * 60 * dt;
            }
        } else {
            const crystal = this.G.crystals.find((c: any) => c.side !== u.side);
            if (crystal) {
                const dx = crystal.x - u.x, dy = crystal.y - u.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 1) {
                    u.x += (dx / dist) * u.spd * spdMult * 60 * dt;
                    u.y += (dy / dist) * u.spd * spdMult * 60 * dt;
                }
            }
        }
    }

    findTarget(u: any): any {
        let nearest: any = null, minDist = Infinity;
        for (const e of this.G.units.filter((e: any) => e.side !== u.side)) {
            const d = Math.abs(e.x - u.x) + Math.abs(e.y - u.y);
            if (d < minDist && d < 300) { minDist = d; nearest = e; }
        }
        for (const b of this.G.buildings.filter((b: any) => b.side !== u.side)) {
            const d = Math.abs(b.x - u.x) + Math.abs(b.y - u.y);
            if (d < minDist && d < 300) { minDist = d; nearest = b; }
        }
        for (const t of this.G.towers.filter((t: any) => t.side !== u.side)) {
            const d = Math.abs(t.x - u.x) + Math.abs(t.y - u.y);
            if (d < minDist && d < 300) { minDist = d; nearest = t; }
        }
        const crystal = this.G.crystals.find((c: any) => c.side !== u.side);
        if (crystal) {
            const d = Math.abs(crystal.x - u.x) + Math.abs(crystal.y - u.y);
            if (d < minDist) nearest = crystal;
        }
        return nearest;
    }

    attack(attacker: any, target: any) {
        let dmg = attacker.atk * (this.G.permBuff.atk || 1);
        if (Math.random() < (this.G.permBuff.crit || 0)) dmg *= 2;
        if (this.G.permBuff.execute && target.hp < target.maxHp * 0.3) dmg *= 2;
        if (target.shield && target.shield > 0) {
            const sd = Math.min(target.shield, dmg);
            target.shield -= sd; dmg -= sd;
        }
        dmg *= (target.dr || 1) * (this.G.permBuff.dr || 1);
        target.hp -= dmg;
        if (target.hp < 0) target.hp = 0;

        if (this.G.permBuff.splashMult > 1) {
            const sd = dmg * 0.5 * (this.G.permBuff.splashMult - 1);
            for (const e of this.G.units.filter((e: any) => e.side !== attacker.side && e !== target)) {
                if (Math.abs(e.x - target.x) + Math.abs(e.y - target.y) < 80) e.hp -= sd;
            }
        }

        if (target.hp <= 0) {
            this.G.kills[attacker.side]++;
            if (this.G.permBuff.lifeOnKill)
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + attacker.maxHp * this.G.permBuff.lifeOnKill);
        }
    }

    updateTower(t: any, dt: number) {
        if (t.atkCd > 0) { t.atkCd -= dt; return; }
        let target: any = null, minDist = Infinity;
        for (const u of this.G.units.filter((u: any) => u.side !== t.side)) {
            const d = Math.abs(u.x - t.x) + Math.abs(u.y - t.y);
            if (d < t.range && d < minDist) { minDist = d; target = u; }
        }
        if (target) {
            target.hp -= t.atk;
            if (target.hp < 0) target.hp = 0;
            t.atkCd = 1 / t.atkSpd;
            if (target.hp <= 0) this.G.kills[t.side]++;
        }
    }

    onWave() {
        if ([5, 15, 20].includes(this.G.wave) && !this.G.cardTriggered[this.G.wave]) {
            this.G.cardTriggered[this.G.wave] = true;
            this.showCardSelection();
        }
    }

    waveSpawn(factory: any) {
        const side = factory.side;
        const faction = side === 'red' ? this.G.playerFaction : this.G.aiFaction;
        const fConf = FACTIONS[faction];

        // 如果有指定兵种类型
        const unitType = factory.unitType || Object.keys(UNITS)[Math.floor(Math.random() * 5)];
        const uConf = UNITS[unitType] || UNITS.tank;

        let count = Math.floor(factory.level * fConf.first) + fConf.countBonus;
        const pop = this.G.units.filter((u: any) => u.side === side).length;
        if (pop + count > CFG.UNIT_CAP) count = Math.max(0, CFG.UNIT_CAP - pop);

        for (let i = 0; i < count; i++) {
            this.G.units.push({
                kind: 'unit', side, type: unitType,
                x: factory.x + (side === 'red' ? 40 : -40) + Math.random() * 30,
                y: factory.y + Math.random() * 60 - 30,
                hp: uConf.hp * fConf.hp * (this.G.permBuff.hp || 1),
                maxHp: uConf.hp * fConf.hp * (this.G.permBuff.hp || 1),
                atk: uConf.atk * fConf.atk * (this.G.permBuff.atk || 1),
                spd: uConf.spd * fConf.speed,
                range: uConf.range,
                atkSpd: uConf.atkSpd * (this.G.permBuff.as || 1),
                atkCd: 0,
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

        // 随机3张卡
        const faction = this.G.playerFaction;
        const pool = [...CARDS[faction]];
        const selected: any[] = [];
        for (let i = 0; i < 3 && pool.length > 0; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            selected.push(pool.splice(idx, 1)[0]);
        }

        const subNode = this.cardPanel.children.find(c => {
            const l = c.getComponent(Label);
            return l && l.string === '';
        });
        if (subNode) {
            const l = subNode.getComponent(Label);
            if (l) l.string = '第 ' + this.G.wave + ' 波 · ' + FACTIONS[faction].name;
        }

        selected.forEach((card, i) => {
            const cardNode = this.createCardNode(card, i);
            cardNode.parent = this.cardPanel;
            cardNode.setPosition(-220 + i * 220, 0, 0);
        });
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
            case 'fruitRage':
                this.G.permBuff.atk = (this.G.permBuff.atk || 1) * (cardId === 'fruitRage' ? 1.35 : 1.25);
                if (cardId === 'fruitRage') this.G.permBuff.as = (this.G.permBuff.as || 1) * 1.2;
                break;
            case 'splash':
                this.G.permBuff.splashMult = (this.G.permBuff.splashMult || 1) * 1.6;
                break;
            case 'sunburst':
            case 'howl':
            case 'stampede':
                this.G.tempBuffs.push({ type: 'asMult', mult: cardId === 'sunburst' ? 2 : 1.5, dur: 10 });
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
                break;
            case 'crit':
                this.G.permBuff.crit = (this.G.permBuff.crit || 0) + 0.3;
                break;
            case 'bloodlust':
                this.G.permBuff.lifeOnKill = 0.2;
                break;
            case 'frenzy':
                this.G.permBuff.atk = (this.G.permBuff.atk || 1) * 1.4;
                this.G.permBuff.as = (this.G.permBuff.as || 1) * 1.3;
                break;
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
        if (rc && rc.hp <= 0) this.endGame('blue');
        else if (bc && bc.hp <= 0) this.endGame('red');
    }

    endGame(winner: string) {
        this.G.phase = 'ended';
        this.gameRunning = false;

        const won = winner === 'red';
        const crystal = this.G.crystals.find((c: any) => c.side === 'red');
        const hpRatio = crystal ? crystal.hp / crystal.maxHp : 0;
        const stars = won ? (hpRatio >= 0.5 ? 3 : 2) : 1;

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
                        '击杀：' + this.G.kills.red + '\n' +
                        '波次：第 ' + this.G.wave + ' 波';
                }
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

    private syncCrystals() {
        while (this.G.crystalNodes.length < this.G.crystals.length) {
            const node = this.createColorNode(new Color(100, 100, 100), 60, 60);
            node.parent = this.gameContainer;
            this.G.crystalNodes.push(node);
        }
        while (this.G.crystalNodes.length > this.G.crystals.length) { const n = this.G.crystalNodes.pop()!; if (n.isValid) n.destroy(); }
        for (let i = 0; i < this.G.crystals.length; i++) {
            const c = this.G.crystals[i];
            const node = this.G.crystalNodes[i];
            const color = c.side === 'red' ? new Color(255, 100, 100) : new Color(100, 150, 255);
            node.setPosition(c.x, c.y, 0);
            const sprite = node.getComponent(Sprite);
            if (sprite) { const sf = this.getColorSpriteFrame(color, 60, 60); if (sf) sprite.spriteFrame = sf; }
        }
    }

    private syncBuildings() {
        while (this.G.buildingNodes.length < this.G.buildings.length) {
            const node = this.createColorNode(new Color(100, 100, 100), 40, 40);
            node.parent = this.gameContainer;
            this.G.buildingNodes.push(node);
        }
        while (this.G.buildingNodes.length > this.G.buildings.length) { const n = this.G.buildingNodes.pop()!; if (n.isValid) n.destroy(); }
        for (let i = 0; i < this.G.buildings.length; i++) {
            const b = this.G.buildings[i];
            const node = this.G.buildingNodes[i];
            const color = b.side === 'red' ? new Color(200, 100, 100) : new Color(100, 150, 200);
            node.setPosition(b.x, b.y, 0);
            const sprite = node.getComponent(Sprite);
            if (sprite) { const sf = this.getColorSpriteFrame(color, 40, 40); if (sf) sprite.spriteFrame = sf; }
        }
    }

    private syncTowers() {
        while (this.G.towerNodes.length < this.G.towers.length) {
            const node = this.createColorNode(new Color(100, 100, 100), 30, 30);
            node.parent = this.gameContainer;
            this.G.towerNodes.push(node);
        }
        while (this.G.towerNodes.length > this.G.towers.length) { const n = this.G.towerNodes.pop()!; if (n.isValid) n.destroy(); }
        for (let i = 0; i < this.G.towers.length; i++) {
            const t = this.G.towers[i];
            const node = this.G.towerNodes[i];
            const color = t.side === 'red' ? new Color(220, 120, 120) : new Color(120, 170, 220);
            node.setPosition(t.x, t.y, 0);
            const sprite = node.getComponent(Sprite);
            if (sprite) { const sf = this.getColorSpriteFrame(color, 30, 30); if (sf) sprite.spriteFrame = sf; }
        }
    }

    private syncUnits() {
        while (this.G.unitNodes.length < this.G.units.length) {
            const node = this.createColorNode(new Color(100, 100, 100), 16, 16);
            node.parent = this.gameContainer;
            this.G.unitNodes.push(node);
        }
        while (this.G.unitNodes.length > this.G.units.length) { const n = this.G.unitNodes.pop()!; if (n.isValid) n.destroy(); }
        for (let i = 0; i < this.G.units.length; i++) {
            const u = this.G.units[i];
            const node = this.G.unitNodes[i];
            const color = u.side === 'red' ? new Color(255, 150, 150) : new Color(150, 200, 255);
            node.setPosition(u.x, u.y, 0);
            const sprite = node.getComponent(Sprite);
            if (sprite) { const sf = this.getColorSpriteFrame(color, 16, 16); if (sf) sprite.spriteFrame = sf; }
        }
    }

    // ==================== UI更新 ====================
    updateUI() {
        if (this.goldLabel) this.goldLabel.string = '💰 ' + this.G.gold[this.G.playerSide];
        if (this.waveLabel) this.waveLabel.string = ' 第 ' + this.G.wave + ' 波';
        if (this.popLabel) {
            const pop = this.G.units.filter((u: any) => u.side === this.G.playerSide).length;
            this.popLabel.string = ' ' + pop + '/' + CFG.UNIT_CAP;
        }
        if (this.killsLabel) this.killsLabel.string = '⚔ ' + this.G.kills[this.G.playerSide];
        const rc = this.G.crystals.find((c: any) => c.side === 'red');
        const bc = this.G.crystals.find((c: any) => c.side === 'blue');
        if (this.hpRedLabel && rc) this.hpRedLabel.string = '🔴 ' + Math.max(0, Math.floor(rc.hp));
        if (this.hpBlueLabel && bc) this.hpBlueLabel.string = ' ' + Math.max(0, Math.floor(bc.hp));
    }
}
