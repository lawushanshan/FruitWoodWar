/** 放置模式的网格和建筑预览；不改写游戏状态，不执行命令。 */
import { Color, Label, Node, Size, Sprite, UIOpacity, UITransform } from 'cc';
import { BUILDING_CONFIG } from '../config/building-config';
import type { BuildingItemId, GameState, Position } from '../core/types';
import { ArtLibrary } from '../presentation/art-library';
import { ColorSpriteFactory } from '../presentation/color-sprite-factory';
import { cellIsFree, placementCells, snapBuildCell } from './build-placement';

export class BuildPlacer {
    item: BuildingItemId | null = null;
    private overlay: Node | null = null;
    private preview: Node | null = null;
    private tint: Sprite | null = null;
    private status: Label | null = null;

    constructor(private container: Node, private factory: ColorSpriteFactory, private art: ArtLibrary) {}

    begin(item: BuildingItemId, state: Readonly<GameState>) {
        this.cancel();
        this.item = item;
        const overlay = new Node('BuildGrid');
        overlay.layer = this.container.layer;
        overlay.parent = this.container;
        this.overlay = overlay;
        for (const cell of placementCells(state.playerSide)) {
            const free = cellIsFree(state, cell);
            const tile = this.factory.createColorNode(
                free ? new Color(130, 230, 170, 65) : new Color(240, 80, 80, 120), 54, 44);
            tile.parent = overlay;
            tile.setPosition(cell.x, cell.y);
        }
        this.preview = this.factory.createColorNode(new Color(80, 220, 120, 170), 56, 46);
        this.preview.name = 'BuildPreview';
        this.preview.parent = overlay;
        this.tint = this.preview.getComponent(Sprite);
        const path = item === 'academy' ? 'b_academy' : item === 'aura' ? 'b_aura' : `b_factory_${item}`;
        const art = this.art.createSpriteNode(`buildings/${path}`, 50, 50);
        if (art) { art.parent = this.preview; art.addComponent(UIOpacity).opacity = 180; }
        const labelNode = new Node('PlacementStatus');
        labelNode.layer = overlay.layer;
        labelNode.parent = this.preview;
        labelNode.addComponent(UITransform).contentSize = new Size(220, 30);
        labelNode.setPosition(0, 48);
        this.status = labelNode.addComponent(Label);
        this.status.fontSize = 20;
        this.status.lineHeight = 24;
        this.status.enableOutline = true;
        this.status.outlineColor = Color.BLACK;
        this.status.outlineWidth = 2;
        // 立即展示一处可建位置，玩家无需先拖动才能理解预览。
        const first = placementCells(state.playerSide).find(cell => cellIsFree(state, cell));
        if (first) this.move(first, state);
        else this.preview.active = false;
    }

    move(point: Position, state: Readonly<GameState>) {
        if (!this.preview || !this.item) return;
        const cell = snapBuildCell(state.playerSide, point);
        this.preview.active = cell !== null;
        if (!cell) return;
        const free = cellIsFree(state, cell);
        this.preview.setPosition(cell.x, cell.y);
        // 最外列也完整显示提示，不让文字越出画布。
        this.status?.node.setPosition(Math.max(-530, Math.min(530, cell.x)) - cell.x, 48);
        if (this.tint) this.tint.color = free ? new Color(80, 220, 120, 170) : new Color(240, 70, 70, 200);
        if (this.status) {
            this.status.string = free ? BUILDING_CONFIG[this.item].name + ' · 可建造' : '此格已被占用';
            this.status.color = free ? new Color(190, 255, 210) : new Color(255, 160, 160);
        }
    }

    cancel() {
        this.item = null;
        this.overlay?.destroy();
        this.overlay = null;
        this.preview = null;
        this.tint = null;
        this.status = null;
    }
}
