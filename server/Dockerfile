# 联机服务 Dockerfile（DOCS/06 §6）
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
# 共享客户端的模拟核心与配置（帧同步同代码基线）
COPY shared ./shared
EXPOSE 8100
CMD ["node", "--experimental-strip-types", "--no-warnings", "src/index.ts"]
