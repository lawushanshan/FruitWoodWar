/** 启动/横屏遮罩。只暂停本地时间；联机仍由服务器时钟推进。 */
import { BlockInputEvents, Color, Label, Node, Size, UITransform, view } from 'cc';
import { ColorSpriteFactory } from './color-sprite-factory';

export class PlayReadiness {
    ready = false;
    private overlay: Node;
    private label: Label;

    constructor(private container: Node, factory: ColorSpriteFactory) {
        this.overlay = factory.createColorNode(new Color(13, 24, 30, 250), 1280, 720);
        this.overlay.name = 'PlayReadiness';
        this.overlay.parent = container;
        this.overlay.addComponent(BlockInputEvents);
        const text = new Node('ReadinessMessage');
        text.layer = container.layer;
        text.parent = this.overlay;
        text.addComponent(UITransform).contentSize = new Size(1100, 200);
        this.label = text.addComponent(Label);
        this.label.fontSize = 42;
        this.label.lineHeight = 62;
        this.update(false);
    }

    isBlocked(): boolean {
        const frame = view.getFrameSize();
        return !this.ready || frame.height > frame.width;
    }

    update(online: boolean): boolean {
        const blocked = this.isBlocked();
        this.overlay.active = blocked;
        if (blocked) {
            this.overlay.setSiblingIndex(this.container.children.length - 1);
            const size = view.getVisibleSize();
            this.overlay.getComponent(UITransform)!.contentSize = new Size(size.width, size.height);
            this.label.string = !this.ready ? '正在准备战场…' :
                '请横屏游玩\n' + (online ? '联机对局仍在进行，请尽快旋转设备' : '横屏后继续，当前进度已暂停');
        }
        return blocked;
    }

    dispose() { this.overlay.destroy(); }
}
