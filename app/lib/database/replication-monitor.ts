/**
 * PostgreSQL 복제 모니터링 및 관리
 * 복제 상태 추적, 지연 모니터링, 자동 장애 조치
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';

/**
 * 복제 상태 정보
 */
export interface ReplicationStatus {
  clientAddr: string;
  state: string;
  sentLsn: string;
  writeLsn: string;
  flushLsn: string;
  replayLsn: string;
  writeLag: number | null;
  flushLag: number | null;
  replayLag: number | null;
  syncState: string;
  lagBytes: number;
  lagSeconds: number;
}

/**
 * 복제 모니터 설정
 */
export interface ReplicationMonitorConfig {
  masterUrl: string;
  checkInterval?: number; // 체크 간격 (ms)
  maxLagBytes?: number; // 최대 허용 지연 (bytes)
  maxLagSeconds?: number; // 최대 허용 지연 (초)
  alertThreshold?: number; // 알림 임계값 (bytes)
}

/**
 * 복제 모니터링 클래스
 */
export class ReplicationMonitor extends EventEmitter {
  private masterPool: Pool;
  private config: Required<ReplicationMonitorConfig>;
  private monitorInterval?: NodeJS.Timeout;
  private isMonitoring: boolean = false;
  
  // 메트릭
  private metrics = {
    checksPerformed: 0,
    alertsTriggered: 0,
    maxLagObserved: 0,
    avgLagBytes: 0,
    failoverCount: 0,
  };
  
  constructor(config: ReplicationMonitorConfig) {
    super();
    
    this.config = {
      checkInterval: 10000, // 10초
      maxLagBytes: 100 * 1024 * 1024, // 100MB
      maxLagSeconds: 60, // 60초
      alertThreshold: 50 * 1024 * 1024, // 50MB
      ...config,
    };
    
    // 마스터 연결 풀
    this.masterPool = new Pool({
      connectionString: this.config.masterUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  
  /**
   * 모니터링 시작
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      console.log('복제 모니터링이 이미 실행 중입니다.');
      return;
    }
    
    this.isMonitoring = true;
    console.log('🔍 PostgreSQL 복제 모니터링 시작...');
    
    // 초기 체크
    await this.checkReplication();
    
    // 주기적 체크
    this.monitorInterval = setInterval(async () => {
      try {
        await this.checkReplication();
      } catch (error) {
        console.error('복제 체크 실패:', error);
        this.emit('error', error);
      }
    }, this.config.checkInterval);
    
    // 실시간 알림 리스너 설정
    await this.setupNotificationListener();
  }
  
  /**
   * 모니터링 중지
   */
  async stop(): Promise<void> {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
    
    await this.masterPool.end();
    console.log('🛑 복제 모니터링 중지됨');
  }
  
  /**
   * 복제 상태 체크
   */
  async checkReplication(): Promise<ReplicationStatus[]> {
    this.metrics.checksPerformed++;
    
    try {
      // 복제 상태 조회
      const result = await this.masterPool.query(`
        SELECT 
          client_addr::text AS client_addr,
          state,
          sent_lsn::text,
          write_lsn::text,
          flush_lsn::text,
          replay_lsn::text,
          EXTRACT(EPOCH FROM write_lag) AS write_lag,
          EXTRACT(EPOCH FROM flush_lag) AS flush_lag,
          EXTRACT(EPOCH FROM replay_lag) AS replay_lag,
          sync_state,
          pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes
        FROM pg_stat_replication
        WHERE state = 'streaming'
      `);
      
      const replicas: ReplicationStatus[] = result.rows.map(row => ({
        clientAddr: row.client_addr,
        state: row.state,
        sentLsn: row.sent_lsn,
        writeLsn: row.write_lsn,
        flushLsn: row.flush_lsn,
        replayLsn: row.replay_lsn,
        writeLag: row.write_lag,
        flushLag: row.flush_lag,
        replayLag: row.replay_lag,
        syncState: row.sync_state,
        lagBytes: parseInt(row.lag_bytes || '0'),
        lagSeconds: row.replay_lag || 0,
      }));
      
      // 지연 분석
      for (const replica of replicas) {
        this.analyzeReplicationLag(replica);
      }
      
      // 메트릭 업데이트
      this.updateMetrics(replicas);
      
      // 이벤트 발생
      this.emit('status', replicas);
      
      return replicas;
    } catch (error) {
      console.error('복제 상태 조회 실패:', error);
      throw error;
    }
  }
  
  /**
   * 복제 지연 분석
   */
  private analyzeReplicationLag(replica: ReplicationStatus): void {
    const { lagBytes, lagSeconds, clientAddr } = replica;
    
    // 높은 지연 감지
    if (lagBytes > this.config.maxLagBytes || lagSeconds > this.config.maxLagSeconds) {
      console.error(`⚠️ 높은 복제 지연 감지 - ${clientAddr}: ${this.formatBytes(lagBytes)} / ${lagSeconds}초`);
      
      this.emit('high-lag', {
        replica: clientAddr,
        lagBytes,
        lagSeconds,
        threshold: {
          bytes: this.config.maxLagBytes,
          seconds: this.config.maxLagSeconds,
        },
      });
      
      this.metrics.alertsTriggered++;
      
      // 자동 장애 조치 고려
      if (lagBytes > this.config.maxLagBytes * 2) {
        this.considerFailover(replica);
      }
    }
    
    // 경고 수준 지연
    else if (lagBytes > this.config.alertThreshold) {
      console.warn(`📊 복제 지연 경고 - ${clientAddr}: ${this.formatBytes(lagBytes)}`);
      
      this.emit('warning', {
        replica: clientAddr,
        lagBytes,
        lagSeconds,
      });
    }
  }
  
  /**
   * 장애 조치 고려
   */
  private considerFailover(replica: ReplicationStatus): void {
    console.error(`🚨 복제본 ${replica.clientAddr} 장애 조치 필요`);
    
    this.emit('failover-needed', {
      replica: replica.clientAddr,
      reason: 'excessive_lag',
      lagBytes: replica.lagBytes,
      lagSeconds: replica.lagSeconds,
    });
    
    this.metrics.failoverCount++;
    
    // 실제 장애 조치는 외부 오케스트레이터가 처리
    // 여기서는 알림만 발생
  }
  
  /**
   * 복제 슬롯 상태 확인
   */
  async checkReplicationSlots(): Promise<any[]> {
    try {
      const result = await this.masterPool.query(`
        SELECT 
          slot_name,
          slot_type,
          active,
          active_pid,
          xmin,
          restart_lsn::text,
          confirmed_flush_lsn::text,
          pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
        FROM pg_replication_slots
      `);
      
      return result.rows;
    } catch (error) {
      console.error('복제 슬롯 조회 실패:', error);
      throw error;
    }
  }
  
  /**
   * WAL 파일 상태 확인
   */
  async checkWALStatus(): Promise<any> {
    try {
      const result = await this.masterPool.query(`
        SELECT 
          pg_current_wal_lsn() AS current_lsn,
          pg_current_wal_insert_lsn() AS insert_lsn,
          pg_current_wal_flush_lsn() AS flush_lsn,
          COUNT(*) AS wal_files,
          pg_size_pretty(SUM(size)) AS total_size
        FROM pg_ls_waldir()
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('WAL 상태 조회 실패:', error);
      throw error;
    }
  }
  
  /**
   * 복제본 프로모션 (수동 장애 조치)
   */
  async promoteReplica(replicaUrl: string): Promise<boolean> {
    const replicaPool = new Pool({
      connectionString: replicaUrl,
      max: 1,
    });
    
    try {
      // 복제본을 마스터로 승격
      await replicaPool.query('SELECT pg_promote()');
      
      console.log('✅ 복제본이 마스터로 승격되었습니다.');
      
      this.emit('promotion', {
        newMaster: replicaUrl,
        timestamp: new Date(),
      });
      
      return true;
    } catch (error) {
      console.error('복제본 승격 실패:', error);
      return false;
    } finally {
      await replicaPool.end();
    }
  }
  
  /**
   * 실시간 알림 리스너 설정
   */
  private async setupNotificationListener(): Promise<void> {
    try {
      const client = await this.masterPool.connect();
      
      // 복제 알림 채널 구독
      await client.query('LISTEN replication_alert');
      
      client.on('notification', (msg) => {
        if (msg.channel === 'replication_alert') {
          const alert = JSON.parse(msg.payload || '{}');
          console.warn('📢 복제 알림:', alert);
          this.emit('alert', alert);
        }
      });
      
      // 연결 유지
      this.on('stop', () => client.release());
      
    } catch (error) {
      console.error('알림 리스너 설정 실패:', error);
    }
  }
  
  /**
   * 메트릭 업데이트
   */
  private updateMetrics(replicas: ReplicationStatus[]): void {
    if (replicas.length === 0) return;
    
    // 최대 지연 추적
    const maxLag = Math.max(...replicas.map(r => r.lagBytes));
    if (maxLag > this.metrics.maxLagObserved) {
      this.metrics.maxLagObserved = maxLag;
    }
    
    // 평균 지연 계산 (지수 이동 평균)
    const avgLag = replicas.reduce((sum, r) => sum + r.lagBytes, 0) / replicas.length;
    const alpha = 0.1;
    this.metrics.avgLagBytes = alpha * avgLag + (1 - alpha) * this.metrics.avgLagBytes;
  }
  
  /**
   * 모니터링 메트릭 조회
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
  
  /**
   * 복제 토폴로지 조회
   */
  async getTopology(): Promise<any> {
    const replicas = await this.checkReplication();
    const slots = await this.checkReplicationSlots();
    const wal = await this.checkWALStatus();
    
    return {
      master: {
        url: this.config.masterUrl,
        wal,
      },
      replicas: replicas.map(r => ({
        address: r.clientAddr,
        state: r.state,
        lag: {
          bytes: r.lagBytes,
          seconds: r.lagSeconds,
          formatted: this.formatBytes(r.lagBytes),
        },
        syncState: r.syncState,
      })),
      slots,
      metrics: this.getMetrics(),
    };
  }
  
  /**
   * 바이트 포맷팅
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// 전역 모니터 인스턴스
let globalMonitor: ReplicationMonitor | null = null;

/**
 * 전역 복제 모니터 가져오기
 */
export function getReplicationMonitor(): ReplicationMonitor {
  if (!globalMonitor) {
    const masterUrl = process.env.DATABASE_URL || '';
    
    globalMonitor = new ReplicationMonitor({
      masterUrl,
      checkInterval: parseInt(process.env.REPLICATION_CHECK_INTERVAL || '10000'),
      maxLagBytes: parseInt(process.env.REPLICATION_MAX_LAG_BYTES || '104857600'), // 100MB
      maxLagSeconds: parseInt(process.env.REPLICATION_MAX_LAG_SECONDS || '60'),
      alertThreshold: parseInt(process.env.REPLICATION_ALERT_THRESHOLD || '52428800'), // 50MB
    });
    
    // 이벤트 핸들러 등록
    globalMonitor.on('high-lag', (data) => {
      console.error('🚨 높은 복제 지연:', data);
      // 여기에 알림 서비스 연동 (예: Slack, Email)
    });
    
    globalMonitor.on('failover-needed', (data) => {
      console.error('🔄 장애 조치 필요:', data);
      // 여기에 자동 장애 조치 로직 추가
    });
    
    // 자동 시작 (환경 변수로 제어)
    if (process.env.REPLICATION_MONITOR_ENABLED === 'true') {
      globalMonitor.start().catch(console.error);
    }
  }
  
  return globalMonitor;
}

// 복제 상태 CLI
if (require.main === module) {
  const monitor = getReplicationMonitor();
  
  async function showStatus() {
    const topology = await monitor.getTopology();
    console.log('📊 PostgreSQL 복제 토폴로지:');
    console.log(JSON.stringify(topology, null, 2));
  }
  
  const command = process.argv[2];
  
  switch (command) {
    case 'status':
      showStatus()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'monitor':
      monitor.start()
        .then(() => {
          console.log('모니터링 중... Ctrl+C로 종료');
        })
        .catch(() => process.exit(1));
      break;
      
    default:
      console.log('사용법:');
      console.log('  npm run replication:status   # 복제 상태 확인');
      console.log('  npm run replication:monitor  # 실시간 모니터링');
      process.exit(1);
  }
}