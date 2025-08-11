#!/bin/bash

# PostgreSQL 복제 설정 스크립트
# 마스터-슬레이브 스트리밍 복제 구성

set -e

echo "🚀 PostgreSQL 복제 환경 설정 시작..."

# 환경 변수 설정
export DB_NAME=${DB_NAME:-blee_cms}
export DB_USER=${DB_USER:-postgres}
export DB_PASSWORD=${DB_PASSWORD:-postgres}
export REPLICATION_PASSWORD=${REPLICATION_PASSWORD:-repl_password}

# 기존 볼륨 정리 (선택적)
if [ "$1" == "clean" ]; then
    echo "🧹 기존 볼륨 정리..."
    docker-compose down -v
    rm -rf ./data/*
fi

# 1. 마스터 시작
echo "📦 마스터 데이터베이스 시작..."
docker-compose up -d postgres-master

# 마스터가 준비될 때까지 대기
echo "⏳ 마스터 초기화 대기..."
sleep 10

# 마스터 상태 확인
until docker exec postgres-master pg_isready -U $DB_USER; do
    echo "대기 중..."
    sleep 2
done

echo "✅ 마스터 준비 완료"

# 2. 복제본 베이스 백업 생성
echo "📋 복제본 1 베이스 백업 생성..."
docker exec postgres-master pg_basebackup \
    -h localhost \
    -D /tmp/replica1_backup \
    -U replicator \
    -v -P -W \
    -X stream \
    -c fast

echo "📋 복제본 2 베이스 백업 생성..."
docker exec postgres-master pg_basebackup \
    -h localhost \
    -D /tmp/replica2_backup \
    -U replicator \
    -v -P -W \
    -X stream \
    -c fast

# 3. 복제본 시작
echo "🔄 복제본 시작..."
docker-compose up -d postgres-replica1 postgres-replica2

# 복제본이 준비될 때까지 대기
sleep 10

# 4. pgBouncer 시작
echo "🎯 pgBouncer 연결 풀 시작..."
docker-compose up -d pgbouncer

# 5. HAProxy 시작
echo "⚖️ HAProxy 로드 밸런서 시작..."
docker-compose up -d haproxy

# 6. 복제 상태 확인
echo "📊 복제 상태 확인..."
docker exec postgres-master psql -U $DB_USER -d $DB_NAME -c "
SELECT 
    client_addr AS replica,
    state,
    sync_state,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS lag
FROM pg_stat_replication;
"

# 7. 연결 테스트
echo "🔍 연결 테스트..."

# 마스터 연결 테스트
echo "마스터 (쓰기):"
docker exec postgres-master psql -U $DB_USER -d $DB_NAME -c "SELECT 'Master OK' AS status;"

# 복제본 연결 테스트
echo "복제본 1 (읽기):"
docker exec postgres-replica1 psql -U $DB_USER -d $DB_NAME -c "SELECT 'Replica1 OK' AS status;"

echo "복제본 2 (읽기):"
docker exec postgres-replica2 psql -U $DB_USER -d $DB_NAME -c "SELECT 'Replica2 OK' AS status;"

# HAProxy 통계 확인
echo "📈 HAProxy 통계: http://localhost:8404/stats (admin/admin)"

echo "
✨ PostgreSQL 복제 설정 완료!

연결 정보:
- 마스터 (쓰기): localhost:5432
- 복제본 1 (읽기): localhost:5433
- 복제본 2 (읽기): localhost:5434
- pgBouncer: localhost:6432
- HAProxy (읽기 LB): localhost:5435

환경 변수 설정:
export DATABASE_URL='postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME'
export DATABASE_REPLICA_1_URL='postgresql://$DB_USER:$DB_PASSWORD@localhost:5433/$DB_NAME'
export DATABASE_REPLICA_2_URL='postgresql://$DB_USER:$DB_PASSWORD@localhost:5434/$DB_NAME'
export PGBOUNCER_URL='postgresql://$DB_USER:$DB_PASSWORD@localhost:6432/$DB_NAME'
export DATABASE_READ_URL='postgresql://$DB_USER:$DB_PASSWORD@localhost:5435/$DB_NAME'
"