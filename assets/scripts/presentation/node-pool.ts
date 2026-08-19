/**
 * NodePool —— 通用节点对象池
 *
 * 职责：
 *  - 缓存已销毁的节点，避免频繁创建/销毁带来的 GC 压力
 *  - 回收时重置位置/缩放/透明度，保证复用时状态干净
 *  - 按类型（key）分池，不同类型的节点不混用
 *
 * 使用方式：
 *  1. 需要节点时调用 acquire(key, factory)
 *  2. 不需要时调用 release(node, key)
 *  3. 场景切换时调用 clearAll()
 */

import { Node, UIOpacity, Sprite, Color } from 'cc';
import { setUniformScale } from './scale-helper';

export class NodePool {

    /** 按类型分池：key → 空闲节点数组 */
    private pools: Map<string, Node[]> = new Map();

    /** 获取一个节点（优先复用池中的，否则调用 factory 创建） */
    acquire(key: string, factory: () => Node): Node {
        const pool = this.pools.get(key);
        if (pool && pool.length > 0) {
            const node = pool.pop()!;
            // 重置状态
            node.active = true;
            setUniformScale(node, 1);
            const opacity = node.getComponent(UIOpacity);
            if (opacity) opacity.opacity = 255;
            return node;
        }
        return factory();
    }

    /** 回收节点到池中 */
    release(node: Node, key: string) {
        if (!node.isValid) return;
        node.active = false;
        node.removeFromParent();

        // 重置视觉状态
        setUniformScale(node, 1);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;

        let pool = this.pools.get(key);
        if (!pool) {
            pool = [];
            this.pools.set(key, pool);
        }
        pool.push(node);
    }

    /** 清空所有池（场景切换时调用） */
    clearAll() {
        for (const [, pool] of this.pools) {
            for (const node of pool) {
                if (node.isValid) node.destroy();
            }
        }
        this.pools.clear();
    }

    /** 获取所有池中的空闲节点数（调试用） */
    getPoolStats(): Map<string, number> {
        const stats = new Map<string, number>();
        for (const [key, pool] of this.pools) {
            stats.set(key, pool.length);
        }
        return stats;
    }
}
