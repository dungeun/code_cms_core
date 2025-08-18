#!/bin/bash

# 프로덕션 데이터베이스 연결 스크립트
# 사용법: ./scripts/connect-prod-db.sh

echo "🔌 Connecting to production databases via SSH tunnel..."

# Coolify 서버 정보 (사용자가 설정해야 함)
COOLIFY_SERVER="YOUR_COOLIFY_SERVER_IP"
SSH_USER="root"
SSH_KEY="~/.ssh/coolify_key"

# 터널 포트
POSTGRES_LOCAL_PORT=5432
REDIS_LOCAL_PORT=6379

# 프로덕션 내부 호스트
POSTGRES_INTERNAL_HOST="f8g0kswkokkgogcs00sos40g"
REDIS_INTERNAL_HOST="agsck4skoos4ss08gwckcs08"

# 기존 터널 종료
echo "🛑 Stopping existing tunnels..."
pkill -f "ssh.*$POSTGRES_LOCAL_PORT:$POSTGRES_INTERNAL_HOST"
pkill -f "ssh.*$REDIS_LOCAL_PORT:$REDIS_INTERNAL_HOST"

# PostgreSQL 터널
echo "🐘 Setting up PostgreSQL tunnel..."
ssh -N -L $POSTGRES_LOCAL_PORT:$POSTGRES_INTERNAL_HOST:5432 \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=3 \
    -i $SSH_KEY \
    $SSH_USER@$COOLIFY_SERVER &

POSTGRES_PID=$!

# Redis 터널
echo "🔴 Setting up Redis tunnel..."
ssh -N -L $REDIS_LOCAL_PORT:$REDIS_INTERNAL_HOST:6379 \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=3 \
    -i $SSH_KEY \
    $SSH_USER@$COOLIFY_SERVER &

REDIS_PID=$!

# PID 저장
echo $POSTGRES_PID > .postgres_tunnel.pid
echo $REDIS_PID > .redis_tunnel.pid

# 연결 테스트
sleep 3

echo "🧪 Testing connections..."

# PostgreSQL 연결 테스트
if nc -z localhost $POSTGRES_LOCAL_PORT; then
    echo "✅ PostgreSQL tunnel established successfully"
else
    echo "❌ PostgreSQL tunnel failed"
    kill $POSTGRES_PID 2>/dev/null
fi

# Redis 연결 테스트
if nc -z localhost $REDIS_LOCAL_PORT; then
    echo "✅ Redis tunnel established successfully"
else
    echo "❌ Redis tunnel failed"  
    kill $REDIS_PID 2>/dev/null
fi

echo ""
echo "🎯 Production databases are now accessible at:"
echo "   PostgreSQL: localhost:5432"
echo "   Redis: localhost:6379"
echo ""
echo "💡 To stop tunnels, run: ./scripts/disconnect-prod-db.sh"
echo "📱 Keep this terminal open to maintain connection"

# 터널 유지
wait