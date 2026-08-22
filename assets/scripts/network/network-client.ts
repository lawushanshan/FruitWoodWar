/**
 * NetworkClient —— 联机客户端（DOCS/06 §7）
 *
 * 职责：
 *  - ws 连接/心跳（借协议层 ping）/指数退避重连
 *  - 命令上行（带逻辑帧号）、帧下行回调、哈希上报
 *  - 纯 IO 层，不含游戏逻辑；GameManager 消费回调
 *
 * 注：H5 环境用浏览器原生 WebSocket；小游戏环境 wx.connectSocket 由
 * platform-adapter 提供（P2 接入），此处统一封装。
 */

import type { ClientMessage, ServerMessage } from './protocol';

export interface NetCallbacks {
    onMessage: (msg: ServerMessage) => void;
    onOpen?: () => void;
    onClose?: () => void;
}

export class NetworkClient {
    private ws: WebSocket | null = null;
    private url: string;
    private cbs: NetCallbacks;
    /** 重连退避 */
    private retries = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private closedByUser = false;

    constructor(url: string, cbs: NetCallbacks) {
        this.url = url;
        this.cbs = cbs;
    }

    connect() {
        this.closedByUser = false;
        try {
            this.ws = new WebSocket(this.url);
        } catch (e) {
            this.scheduleReconnect();
            return;
        }
        this.ws.onopen = () => {
            this.retries = 0;
            // 补发连接期间排队的消息（修复"创建房间无反应"：send 在 OPEN 前直接丢弃）
            const pending = this.sendQueue;
            this.sendQueue = [];
            for (const m of pending) this.rawSend(m);
            this.cbs.onOpen?.();
        };
        this.ws.onmessage = (ev) => {
            try {
                this.cbs.onMessage(JSON.parse(String(ev.data)) as ServerMessage);
            } catch {
                // 忽略坏包
            }
        };
        this.ws.onclose = () => {
            this.cbs.onClose?.();
            this.ws = null;
            if (!this.closedByUser) this.scheduleReconnect();
            else this.flushQueue();
        };
        this.ws.onerror = () => {
            this.ws?.close();
        };
    }

    private scheduleReconnect() {
        if (this.closedByUser) return;
        const delay = Math.min(1000 * Math.pow(2, this.retries++), 10_000);
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }

    private sendQueue: ClientMessage[] = [];

    /** 发送消息；连接未就绪时入队，open 后自动补发（不丢失早期命令） */
    send(msg: ClientMessage): boolean {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return this.rawSend(msg);
        }
        this.sendQueue.push(msg);
        return true;
    }

    private flushQueue() {
        this.sendQueue = [];
    }

    private rawSend(msg: ClientMessage): boolean {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
            return true;
        }
        return false;
    }

    close() {
        this.closedByUser = true;
        this.sendQueue = [];
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.ws?.close();
        this.ws = null;
    }
}
