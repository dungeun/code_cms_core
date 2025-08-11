#!/bin/bash

# Coolify 배포 스크립트
# 블리CMS Enterprise Edition

set -e

echo "🚀 블리CMS Coolify 배포 시작..."

# 환경 변수 확인
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL이 설정되지 않았습니다."
    exit 1
fi

if [ -z "$REDIS_CLUSTER_NODES" ]; then
    echo "❌ REDIS_CLUSTER_NODES가 설정되지 않았습니다."
    exit 1
fi

# 의존성 설치
echo "📦 의존성 설치 중..."
npm ci --only=production

# Prisma 클라이언트 생성
echo "🔨 Prisma 클라이언트 생성 중..."
npx prisma generate

# 데이터베이스 마이그레이션
echo "🗄️ 데이터베이스 마이그레이션 실행 중..."
npx prisma migrate deploy

# 애플리케이션 빌드
echo "🏗️ 애플리케이션 빌드 중..."
npm run build

# 정적 파일 최적화
echo "🎨 정적 파일 최적화 중..."
if [ -d "public/build" ]; then
    find public/build -type f -name "*.js" -exec gzip -9 -k {} \;
    find public/build -type f -name "*.css" -exec gzip -9 -k {} \;
fi

# 업로드 디렉토리 생성
echo "📁 디렉토리 생성 중..."
mkdir -p public/uploads
mkdir -p plugins
mkdir -p logs

# 권한 설정
echo "🔐 권한 설정 중..."
chmod 755 public/uploads
chmod 755 plugins
chmod 755 logs

# 헬스체크
echo "❤️ 헬스체크 확인 중..."
sleep 5
curl -f http://localhost:3000/api/health?quick=true || {
    echo "❌ 헬스체크 실패"
    exit 1
}

echo "✅ 블리CMS 배포 완료!"
echo "🌐 애플리케이션이 포트 3000에서 실행 중입니다."