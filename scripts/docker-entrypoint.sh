#!/bin/sh

# 프로덕션 Docker 엔트리포인트 스크립트

set -e

# 환경 변수 검증
required_vars="DATABASE_URL JWT_SECRET ENCRYPTION_KEY"
for var in $required_vars; do
  if [ -z "$(eval echo \$$var)" ]; then
    echo "Error: Required environment variable $var is not set"
    exit 1
  fi
done

# 데이터베이스 연결 대기
echo "Waiting for database connection..."
until npx prisma db push --accept-data-loss 2>/dev/null; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready!"

# Prisma 마이그레이션 실행
echo "Running database migrations..."
npx prisma migrate deploy

# 데이터베이스 시드 (프로덕션에서는 선택적)
if [ "$SEED_DATABASE" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

# 업로드 디렉토리 권한 설정
if [ -d "/app/uploads" ]; then
  chmod -R 755 /app/uploads
fi

# 로그 디렉토리 권한 설정
if [ -d "/app/logs" ]; then
  chmod -R 755 /app/logs
fi

# 애플리케이션 시작
echo "Starting application..."
exec "$@"