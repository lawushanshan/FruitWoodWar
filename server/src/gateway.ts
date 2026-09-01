/**
 * gateway：ws 连接管理、鉴权（P1 阶段 token 直通，平台 openid 接入在 P2）、
 * 心跳、消息路由到 match/room。
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage } from './protocol.ts';
import { MatchMaker } from './match.ts';
import { RoomManager } from './room.ts';

interface ClientConn {
    ws: WebSocket;
    id: string;
    alive: boolean;
    /** 当前所在房间 */
    roomId: string | null;
}

let nextConnId = 1;

export class Gateway {
    private conns = new Map<string, ClientConn>();
    private matcher: MatchMaker;
    private rooms: RoomManager;

    constructor(port: number) {
        const wss = new WebSocketServer({ port });
        this.matcher = new MatchMaker(
            (a, b, seed, sides, factions, roomCode) => this.rooms.createRoom(a, b, seed, sides, factions, roomCode),
        );
        this.rooms = new RoomManager({
            send: (connId, msg) => this.send(connId, msg),
            getConn: (connId) => this.conns.get(connId) ?? null,
            onRoomEmpty: (roomId, redConnId, blueConnId) => {
                this.matcher.onRoomClosed(roomId);
                // 释放双方匹配索引，允许重新排队（防 inRoom 泄漏）
                if (redConnId) this.matcher.release(redConnId);
                if (blueConnId) this.matcher.release(blueConnId);
            },
        });

        wss.on('connection', (ws) => {
            const conn: ClientConn = { ws, id: `c${nextConnId++}`, alive: true, roomId: null };
            this.conns.set(conn.id, conn);

            ws.on('pong', () => { conn.alive = true; });

            ws.on('message', (raw) => {
                let msg: ClientMessage;
                try {
                    msg = JSON.parse(String(raw));
                } catch {
                    this.send(conn.id, { t: 'error', msg: 'bad json' });
                    return;
                }
                try {
                    this.route(conn, msg);
                } catch (err) {
                    // 单条消息处理异常不应拖垮整个服务进程
                    console.error(`[gateway] route error (conn=${conn.id}):`, err);
                }
            });

            // 客户端异常断开（TCP RST 等）会触发 error 事件；
            // 无监听器会抛未捕获异常导致进程崩溃，必须就地消化并按掉线清理
            ws.on('error', (err) => {
                console.warn(`[gateway] conn ${conn.id} error: ${err.message}`);
            });

            ws.on('close', () => this.dropConn(conn));
        });

        // ws 服务器级错误（端口占用等）：只记日志，避免崩溃
        wss.on('error', (err) => {
            console.error('[gateway] server error:', err);
        });

        // 进程级兜底：任何遗漏的异常/拒绝只记日志，服务保持存活（防长时间运行后僵死）
        process.on('uncaughtException', (err) => {
            console.error('[gateway] uncaughtException:', err);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('[gateway] unhandledRejection:', reason);
        });

        // 心跳：30s 探测，失联连接清理
        setInterval(() => {
            for (const conn of this.conns.values()) {
                if (!conn.alive) {
                    conn.ws.terminate();
                    this.dropConn(conn);
                    continue;
                }
                conn.alive = false;
                conn.ws.ping();
            }
        }, 30_000);

        console.log(`[gateway] ws listening on :${port}`);
    }

    /** 统一掉线清理：移除连接、退出队列、离开房间 */
    private dropConn(conn: ClientConn) {
        this.conns.delete(conn.id);
        this.matcher.leaveQueue(conn.id);
        this.matcher.release(conn.id);
        if (conn.roomId) this.rooms.onLeave(conn.roomId, conn.id);
    }

    private route(conn: ClientConn, msg: ClientMessage) {
        switch (msg.t) {
            case 'join': {
                const err = this.matcher.join(conn.id, msg.mode, msg.roomCode ?? null);
                if (err) this.send(conn.id, { t: 'error', msg: err });
                break;
            }
            case 'rejoin':
                if (!this.rooms.onRejoin(conn.id, msg.token)) {
                    this.send(conn.id, { t: 'error', msg: '重连失败：对局不存在或已结束' });
                }
                break;
            case 'ping':
                this.send(conn.id, { t: 'pong' });
                break;
            case 'create_room': {
                const code = this.matcher.create(conn.id);
                this.send(conn.id, { t: 'room_created', roomCode: code });
                this.send(conn.id, { t: 'waiting' });
                break;
            }
            case 'cancel_match':
                this.matcher.leaveQueue(conn.id);
                break;
            case 'cmd':
                if (conn.roomId) this.rooms.onCmd(conn.roomId, conn.id, msg.frame, msg.cmd);
                break;
            case 'hash':
                if (conn.roomId) this.rooms.onHash(conn.roomId, conn.id, msg.frame, msg.hash);
                break;
            case 'game_end':
                if (conn.roomId) this.rooms.onGameEnd(conn.roomId, conn.id, msg.winner);
                break;
            case 'leave':
                if (conn.roomId) this.rooms.onLeave(conn.roomId, conn.id);
                break;
        }
    }

    send(connId: string, msg: unknown) {
        const conn = this.conns.get(connId);
        if (conn && conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(JSON.stringify(msg));
        }
    }
}
