-- 복제 사용자 생성
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'repl_password';

-- 복제 슬롯 생성 (각 복제본용)
SELECT pg_create_physical_replication_slot('replica1_slot');
SELECT pg_create_physical_replication_slot('replica2_slot');

-- 복제 권한 부여
GRANT CONNECT ON DATABASE blee_cms TO replicator;
GRANT USAGE ON SCHEMA public TO replicator;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO replicator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO replicator;

-- 모니터링용 뷰 생성
CREATE OR REPLACE VIEW replication_status AS
SELECT 
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state
FROM pg_stat_replication;

-- 복제 지연 확인 함수
CREATE OR REPLACE FUNCTION check_replication_lag()
RETURNS TABLE(
    replica_addr inet,
    lag_bytes bigint,
    lag_seconds numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        client_addr,
        pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes,
        EXTRACT(EPOCH FROM replay_lag) AS lag_seconds
    FROM pg_stat_replication
    WHERE state = 'streaming';
END;
$$ LANGUAGE plpgsql;

-- 복제 상태 알림 트리거
CREATE OR REPLACE FUNCTION notify_replication_issue()
RETURNS trigger AS $$
DECLARE
    lag_bytes bigint;
BEGIN
    -- 복제 지연이 100MB 이상이면 알림
    SELECT MAX(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn))
    INTO lag_bytes
    FROM pg_stat_replication;
    
    IF lag_bytes > 104857600 THEN  -- 100MB
        RAISE NOTICE 'Replication lag exceeded 100MB: % bytes', lag_bytes;
        -- 여기에 알림 로직 추가 (예: pg_notify)
        PERFORM pg_notify('replication_alert', 
            json_build_object(
                'type', 'high_lag',
                'lag_bytes', lag_bytes,
                'timestamp', NOW()
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;