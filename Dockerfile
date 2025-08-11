# Docker 멀티스테이지 빌드
# 블리CMS Enterprise 프로덕션 배포용

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# 패키지 파일 복사
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# 의존성 설치
RUN npm ci --only=production && \
    npm install -g prisma && \
    npx prisma generate

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 의존성 복사
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 환경 변수 설정
ENV NODE_ENV production
ENV REMIX_BUILD_MODE production

# Prisma 클라이언트 생성
RUN npx prisma generate

# 애플리케이션 빌드
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# 보안을 위한 비루트 사용자 생성
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 remix

# 필요한 파일만 복사
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.js ./server.js

# 업로드 디렉토리 생성 및 권한 설정
RUN mkdir -p /app/public/uploads && \
    chown -R remix:nodejs /app

# 비루트 사용자로 전환
USER remix

# 환경 변수
ENV NODE_ENV production
ENV PORT 3000
ENV HOST 0.0.0.0

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health?quick=true || exit 1

# 포트 노출
EXPOSE 3000

# 애플리케이션 실행
CMD ["node", "server.js"]