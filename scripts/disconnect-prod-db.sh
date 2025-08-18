#!/bin/bash

# 프로덕션 데이터베이스 연결 종료 스크립트

echo "🛑 Disconnecting from production databases..."

# PID 파일에서 프로세스 ID 읽기
if [ -f .postgres_tunnel.pid ]; then
    POSTGRES_PID=$(cat .postgres_tunnel.pid)
    if kill -0 $POSTGRES_PID 2>/dev/null; then
        kill $POSTGRES_PID
        echo "✅ PostgreSQL tunnel stopped"
    fi
    rm -f .postgres_tunnel.pid
fi

if [ -f .redis_tunnel.pid ]; then
    REDIS_PID=$(cat .redis_tunnel.pid)
    if kill -0 $REDIS_PID 2>/dev/null; then
        kill $REDIS_PID
        echo "✅ Redis tunnel stopped"
    fi
    rm -f .redis_tunnel.pid
fi

# 추가 정리
pkill -f "ssh.*5432:f8g0kswkokkgogcs00sos40g"
pkill -f "ssh.*6379:agsck4skoos4ss08gwckcs08"

echo "🏁 All database tunnels disconnected"