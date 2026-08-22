# 联机服务 Dockerfile（DOCS/06 §6）
# 注：P1 服务端为纯中继（gateway/match/room），不依赖客户端 core。
# P2/P3 需要复用 core 时再引入 shared（assets/scripts/{core,config} 软链）。
FROM node:lts-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev

FROM node:lts-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
EXPOSE 8100
CMD ["node", "--experimental-strip-types", "--no-warnings", "src/index.ts"]
