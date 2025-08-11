#!/bin/bash

# Coolify 롤백 스크립트
# 블리CMS Enterprise Edition

set -e

echo "⏪ 블리CMS 롤백 시작..."

# 이전 버전 태그 확인
PREVIOUS_VERSION=${PREVIOUS_VERSION:-"latest"}
echo "📌 롤백 대상 버전: $PREVIOUS_VERSION"

# 현재 실행 중인 컨테이너 중지
echo "🛑 현재 컨테이너 중지 중..."
docker stop blee-cms-app || true

# 이전 버전 이미지로 전환
echo "🔄 이전 버전으로 전환 중..."
docker tag blee-cms:$PREVIOUS_VERSION blee-cms:rollback
docker tag blee-cms:rollback blee-cms:latest

# 데이터베이스 롤백 (필요한 경우)
if [ "$ROLLBACK_DATABASE" = "true" ]; then
    echo "🗄️ 데이터베이스 롤백 중..."
    npx prisma migrate resolve --rolled-back
fi

# 새 컨테이너 시작
echo "🚀 롤백된 버전 시작 중..."
docker run -d \
    --name blee-cms-app \
    --env-file .env.production \
    -p 3000:3000 \
    blee-cms:latest

# 헬스체크
echo "❤️ 헬스체크 확인 중..."
sleep 10
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:3000/api/health?quick=true; then
        echo "✅ 롤백 완료!"
        exit 0
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "⏳ 재시도 중... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
done

echo "❌ 롤백 후 헬스체크 실패"
exit 1