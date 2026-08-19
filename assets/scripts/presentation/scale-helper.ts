/**
 * scale-helper —— 统一缩放工具
 *
 * Cocos 3.x 的 Node.scale setter 需要 Vec3，直接赋 number 会类型报错且运行时异常。
 * 本工具复用模块级临时向量，避免每帧分配新对象。
 */

import { Node, Vec3 } from 'cc';

/** 模块级临时向量（调用后立即消费，无跨帧持有） */
const tmpVec = new Vec3();

/** 设置节点统一缩放（x/y/z 相同） */
export function setUniformScale(node: Node, s: number): void {
    tmpVec.set(s, s, s);
    node.setScale(tmpVec);
}
