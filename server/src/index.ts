/**
 * 联机服务入口（P1 最小骨架）。
 * P1：gateway 直起（内存 match），Redis/PG 接入在 P2（compose 已备好依赖）。
 */

import { Gateway } from './gateway.ts';

const port = Number(process.env.PORT ?? 8100);
new Gateway(port);
console.log('[server] fruitwoodwar online service (P1 skeleton) started');
