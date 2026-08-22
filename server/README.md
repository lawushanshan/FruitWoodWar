# 果林大战联机服务（P1 骨架）

见 `DOCS/06-联机对战设计.md`。

## 本地启动

```bash
cd server
docker compose up --build        # 起全套：game-server(8100) + redis + postgres(55433)
# 或仅调试服务本体（依赖后置到 P2）：
npm install
npm run dev                      # ws://localhost:8100
```

## 阶段状态

- P1：gateway/match/room 内存版，帧中继 + 哈希比对 + 离场宽限
- P2：Redis 匹配跨进程 + PG 对局入库 + 断线重连重放 + 平台鉴权
