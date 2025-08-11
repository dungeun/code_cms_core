#!/bin/bash

# Coolify 백업 스크립트
# 블리CMS Enterprise Edition

set -e

# 백업 디렉토리 설정
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/blee-cms-$TIMESTAMP"

echo "💾 블리CMS 백업 시작..."
echo "📅 타임스탬프: $TIMESTAMP"

# 백업 디렉토리 생성
mkdir -p "$BACKUP_PATH"

# 1. 데이터베이스 백업
echo "🗄️ 데이터베이스 백업 중..."
pg_dump "$DATABASE_URL" > "$BACKUP_PATH/database.sql"
gzip -9 "$BACKUP_PATH/database.sql"

# 2. 업로드 파일 백업
echo "📁 업로드 파일 백업 중..."
if [ -d "/app/public/uploads" ]; then
    tar -czf "$BACKUP_PATH/uploads.tar.gz" -C /app/public uploads
fi

# 3. 플러그인 백업
echo "🧩 플러그인 백업 중..."
if [ -d "/app/plugins" ]; then
    tar -czf "$BACKUP_PATH/plugins.tar.gz" -C /app plugins
fi

# 4. 환경 설정 백업
echo "⚙️ 환경 설정 백업 중..."
if [ -f ".env.production" ]; then
    cp .env.production "$BACKUP_PATH/env.production.backup"
fi

# 5. Redis 데이터 백업 (선택사항)
if [ "$BACKUP_REDIS" = "true" ]; then
    echo "📊 Redis 데이터 백업 중..."
    redis-cli --rdb "$BACKUP_PATH/redis.rdb"
fi

# 백업 메타데이터 생성
cat > "$BACKUP_PATH/backup.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "version": "$APP_VERSION",
  "type": "full",
  "components": {
    "database": true,
    "uploads": true,
    "plugins": true,
    "config": true,
    "redis": ${BACKUP_REDIS:-false}
  },
  "size": "$(du -sh $BACKUP_PATH | cut -f1)"
}
EOF

# 오래된 백업 삭제 (7일 이상)
echo "🗑️ 오래된 백업 삭제 중..."
find "$BACKUP_DIR" -name "blee-cms-*" -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true

# 백업 완료 알림
BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
echo "✅ 백업 완료!"
echo "📍 백업 위치: $BACKUP_PATH"
echo "💿 백업 크기: $BACKUP_SIZE"

# S3 업로드 (선택사항)
if [ "$UPLOAD_TO_S3" = "true" ] && [ -n "$S3_BUCKET" ]; then
    echo "☁️ S3에 백업 업로드 중..."
    aws s3 cp "$BACKUP_PATH" "s3://$S3_BUCKET/backups/blee-cms-$TIMESTAMP" --recursive
    echo "✅ S3 업로드 완료!"
fi