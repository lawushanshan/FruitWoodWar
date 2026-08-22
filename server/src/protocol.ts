/**
 * 联机协议（DOCS/06 §2.2）：客户端 ↔ 服务器消息类型。
 * 本文件同时被服务端与客户端引用（客户端经软链/复制同步），是协议唯一基线。
 */

/** 客户端 → 服务器 */
export type ClientMessage =
    | { t: 'join'; token: string; mode: 'quick' | 'friend'; roomCode?: string }
    | { t: 'create_room' }
    | { t: 'cmd'; frame: number; cmd: GameCommandPayload }
    | { t: 'hash'; frame: number; hash: string }
    | { t: 'cancel_match' }
    | { t: 'leave' };

/** 服务器 → 客户端 */
export type ServerMessage =
    | { t: 'waiting' } // 匹配中
    | { t: 'room_created'; roomCode: string } // 已创建好友房，等待对手加入
    | { t: 'matched'; roomId: string; seed: number; yourSide: 'red' | 'blue'; yourFaction: FactionId; oppFaction: FactionId; roomCode?: string }
    | { t: 'start'; startInMs: number } // 双端同时倒计时后进入
    | { t: 'frame'; frame: number; cmds: Array<{ side: 'red' | 'blue'; cmd: GameCommandPayload }> }
    | { t: 'opp_left' } // 对手离开（15s 宽限倒计时开始）
    | { t: 'opp_back' }
    | { t: 'result'; winner: 'red' | 'blue'; reason: 'crystal' | 'surrender' | 'timeout' | 'desync' }
    | { t: 'error'; msg: string };

/**
 * GameCommand 的可序列化子集（与 core/types GameCommand 对齐；
 * select-faction/select-difficulty 属单机 UI 命令，联机不传输）。
 */
export type GameCommandPayload =
    | { type: 'build'; itemId: string; position: { x: number; y: number } }
    | { type: 'upgrade'; buildingId: string }
    | { type: 'research' }
    | { type: 'choose-card'; cardId: string };

export type FactionId = 'fruit' | 'wood' | 'animal';

/** 逻辑帧间隔（ms）：客户端锁步对齐用 */
export const LOGIC_FRAME_MS = 100;

/** 哈希上报间隔（逻辑帧数） */
export const HASH_EVERY_FRAMES = 30;
