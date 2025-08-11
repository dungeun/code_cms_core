/**
 * PostgreSQL 연결 풀 최적화 및 읽기 복제본 라우팅
 * 10,000+ 동시 사용자를 위한 데이터베이스 최적화
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';

/**
 * 데이터베이스 연결 설정
 */
export interface DatabaseConfig {
  master: {
    url: string;
    connectionLimit: number;
  };
  replicas: Array<{
    url: string;
    connectionLimit: number;
    weight: number; // 트래픽 가중치
  }>;
  pgBouncer?: {
    enabled: boolean;
    poolMode: 'session' | 'transaction' | 'statement';
    maxClients: number;
    defaultPoolSize: number;
  };
}

/**
 * 최적화된 Prisma 클라이언트 생성
 */
function createOptimizedPrismaClient(
  databaseUrl: string,
  connectionLimit: number = 100
): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn']
      : ['error'],
    // 연결 풀 최적화
    datasourceUrl: `${databaseUrl}?connection_limit=${connectionLimit}&pool_timeout=20&connect_timeout=10&socket_timeout=10&statement_timeout=30000`,
  });
}

/**
 * 읽기 복제본 라우터
 */
class ReadReplicaRouter {
  private replicas: Array<{
    client: PrismaClient;
    weight: number;
    connections: number;
    errors: number;
    lastError?: Date;
  }> = [];
  
  private totalWeight: number = 0;
  private currentIndex: number = 0;
  
  constructor(replicaConfigs: DatabaseConfig['replicas']) {
    for (const config of replicaConfigs) {
      const client = createOptimizedPrismaClient(config.url, config.connectionLimit);
      this.replicas.push({
        client,
        weight: config.weight,
        connections: 0,
        errors: 0,
      });
      this.totalWeight += config.weight;
    }
  }
  
  /**
   * 가중치 기반 라운드로빈으로 읽기 복제본 선택
   */
  getReadReplica(): PrismaClient {
    if (this.replicas.length === 0) {
      throw new Error('No read replicas available');
    }
    
    // 건강한 복제본만 필터링
    const healthyReplicas = this.replicas.filter(r => {
      // 최근 1분 내 에러가 5개 이상이면 제외
      if (r.errors > 5 && r.lastError) {
        const timeSinceError = Date.now() - r.lastError.getTime();
        if (timeSinceError < 60000) {
          return false;
        } else {
          // 1분 지나면 에러 카운트 리셋
          r.errors = 0;
        }
      }
      return true;
    });
    
    if (healthyReplicas.length === 0) {
      // 모든 복제본이 문제있으면 첫 번째 복제본 사용
      console.error('All read replicas unhealthy, using first replica');
      return this.replicas[0].client;
    }
    
    // 가중치 기반 선택
    let randomWeight = Math.random() * this.totalWeight;
    for (const replica of healthyReplicas) {
      randomWeight -= replica.weight;
      if (randomWeight <= 0) {
        replica.connections++;
        return replica.client;
      }
    }
    
    // 폴백: 첫 번째 건강한 복제본
    return healthyReplicas[0].client;
  }
  
  /**
   * 복제본 에러 기록
   */
  recordError(client: PrismaClient): void {
    const replica = this.replicas.find(r => r.client === client);
    if (replica) {
      replica.errors++;
      replica.lastError = new Date();
    }
  }
  
  /**
   * 복제본 상태 조회
   */
  getStats() {
    return this.replicas.map((r, i) => ({
      index: i,
      weight: r.weight,
      connections: r.connections,
      errors: r.errors,
      lastError: r.lastError,
      healthy: r.errors <= 5 || !r.lastError || 
        (Date.now() - r.lastError.getTime() > 60000),
    }));
  }
  
  /**
   * 모든 복제본 연결 종료
   */
  async disconnect(): Promise<void> {
    await Promise.all(
      this.replicas.map(r => r.client.$disconnect())
    );
  }
}

/**
 * 데이터베이스 매니저
 */
export class DatabaseManager {
  private master: PrismaClient;
  private replicaRouter?: ReadReplicaRouter;
  private pgBouncerPool?: Pool;
  private config: DatabaseConfig;
  
  // 메트릭
  private metrics = {
    totalQueries: 0,
    readQueries: 0,
    writeQueries: 0,
    avgResponseTime: 0,
    activeConnections: 0,
    errors: 0,
  };
  
  constructor(config: DatabaseConfig) {
    this.config = config;
    
    // 마스터 연결
    this.master = createOptimizedPrismaClient(
      config.master.url,
      config.master.connectionLimit
    );
    
    // 읽기 복제본 설정
    if (config.replicas && config.replicas.length > 0) {
      this.replicaRouter = new ReadReplicaRouter(config.replicas);
    }
    
    // pgBouncer 설정
    if (config.pgBouncer?.enabled) {
      this.setupPgBouncer();
    }
    
    // 메트릭 수집 시작
    this.startMetricsCollection();
  }
  
  /**
   * 쓰기 작업용 클라이언트
   */
  get write(): PrismaClient {
    this.metrics.writeQueries++;
    this.metrics.totalQueries++;
    return this.master;
  }
  
  /**
   * 읽기 작업용 클라이언트
   */
  get read(): PrismaClient {
    this.metrics.readQueries++;
    this.metrics.totalQueries++;
    
    // 복제본이 있으면 복제본 사용
    if (this.replicaRouter) {
      try {
        return this.replicaRouter.getReadReplica();
      } catch (error) {
        console.error('Failed to get read replica, falling back to master:', error);
        this.metrics.errors++;
      }
    }
    
    // 복제본이 없으면 마스터 사용
    return this.master;
  }
  
  /**
   * 트랜잭션 실행 (마스터에서만)
   */
  async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await this.master.$transaction(fn, {
        maxWait: options?.maxWait || 5000,
        timeout: options?.timeout || 30000,
        isolationLevel: options?.isolationLevel,
      });
      
      this.updateResponseTime(Date.now() - startTime);
      return result;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }
  
  /**
   * 배치 쿼리 실행
   */
  async batch(queries: Array<() => Promise<any>>): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      const results = await Promise.all(queries.map(q => q()));
      this.updateResponseTime(Date.now() - startTime);
      return results;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }
  
  /**
   * pgBouncer 설정
   */
  private setupPgBouncer(): void {
    if (!this.config.pgBouncer) return;
    
    const { maxClients, defaultPoolSize } = this.config.pgBouncer;
    
    // pgBouncer 연결 풀 생성
    this.pgBouncerPool = new Pool({
      host: process.env.PGBOUNCER_HOST || 'localhost',
      port: parseInt(process.env.PGBOUNCER_PORT || '6432'),
      database: process.env.PGBOUNCER_DATABASE || process.env.DATABASE_NAME,
      user: process.env.PGBOUNCER_USER || process.env.DATABASE_USER,
      password: process.env.PGBOUNCER_PASSWORD || process.env.DATABASE_PASSWORD,
      max: defaultPoolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    console.log(`pgBouncer configured: max_clients=${maxClients}, pool_size=${defaultPoolSize}`);
  }
  
  /**
   * 연결 풀 상태 조회
   */
  async getPoolStats() {
    const stats: any = {
      master: {
        activeConnections: this.metrics.activeConnections,
      },
      replicas: this.replicaRouter?.getStats() || [],
      metrics: this.metrics,
    };
    
    // pgBouncer 상태
    if (this.pgBouncerPool) {
      stats.pgBouncer = {
        totalCount: this.pgBouncerPool.totalCount,
        idleCount: this.pgBouncerPool.idleCount,
        waitingCount: this.pgBouncerPool.waitingCount,
      };
    }
    
    return stats;
  }
  
  /**
   * 헬스체크
   */
  async healthCheck(): Promise<{
    master: boolean;
    replicas: boolean[];
    overall: boolean;
  }> {
    const results = {
      master: false,
      replicas: [] as boolean[],
      overall: false,
    };
    
    // 마스터 체크
    try {
      await this.master.$queryRaw`SELECT 1`;
      results.master = true;
    } catch (error) {
      console.error('Master health check failed:', error);
    }
    
    // 복제본 체크
    if (this.replicaRouter) {
      const replicaStats = this.replicaRouter.getStats();
      for (const replica of replicaStats) {
        results.replicas.push(replica.healthy);
      }
    }
    
    results.overall = results.master && 
      (results.replicas.length === 0 || results.replicas.some(r => r));
    
    return results;
  }
  
  /**
   * 응답 시간 업데이트
   */
  private updateResponseTime(responseTime: number): void {
    const alpha = 0.1; // 지수 이동 평균 계수
    this.metrics.avgResponseTime = 
      alpha * responseTime + (1 - alpha) * this.metrics.avgResponseTime;
  }
  
  /**
   * 메트릭 수집 시작
   */
  private startMetricsCollection(): void {
    // 1분마다 메트릭 로깅
    setInterval(() => {
      const readRatio = this.metrics.totalQueries > 0
        ? (this.metrics.readQueries / this.metrics.totalQueries * 100).toFixed(1)
        : 0;
      
      console.log('Database Metrics:', {
        totalQueries: this.metrics.totalQueries,
        readRatio: `${readRatio}%`,
        avgResponseTime: `${this.metrics.avgResponseTime.toFixed(2)}ms`,
        errors: this.metrics.errors,
        poolEfficiency: this.calculatePoolEfficiency(),
      });
      
      // 메트릭 리셋 (errors 제외)
      this.metrics.totalQueries = 0;
      this.metrics.readQueries = 0;
      this.metrics.writeQueries = 0;
    }, 60000);
  }
  
  /**
   * 연결 풀 효율성 계산
   */
  private calculatePoolEfficiency(): string {
    const totalConnections = this.config.master.connectionLimit + 
      (this.config.replicas?.reduce((sum, r) => sum + r.connectionLimit, 0) || 0);
    
    const efficiency = this.metrics.activeConnections > 0
      ? (this.metrics.activeConnections / totalConnections * 100).toFixed(1)
      : '0';
    
    return `${efficiency}%`;
  }
  
  /**
   * 연결 종료
   */
  async disconnect(): Promise<void> {
    await this.master.$disconnect();
    
    if (this.replicaRouter) {
      await this.replicaRouter.disconnect();
    }
    
    if (this.pgBouncerPool) {
      await this.pgBouncerPool.end();
    }
  }
}

// 환경 변수에서 설정 로드
const databaseConfig: DatabaseConfig = {
  master: {
    url: process.env.DATABASE_URL || '',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '100'),
  },
  replicas: [],
  pgBouncer: {
    enabled: process.env.PGBOUNCER_ENABLED === 'true',
    poolMode: (process.env.PGBOUNCER_POOL_MODE as any) || 'transaction',
    maxClients: parseInt(process.env.PGBOUNCER_MAX_CLIENTS || '1000'),
    defaultPoolSize: parseInt(process.env.PGBOUNCER_DEFAULT_POOL_SIZE || '25'),
  },
};

// 읽기 복제본 설정 (최대 3개)
for (let i = 1; i <= 3; i++) {
  const url = process.env[`DATABASE_REPLICA_${i}_URL`];
  if (url) {
    databaseConfig.replicas.push({
      url,
      connectionLimit: parseInt(process.env[`DATABASE_REPLICA_${i}_LIMIT`] || '50'),
      weight: parseInt(process.env[`DATABASE_REPLICA_${i}_WEIGHT`] || '1'),
    });
  }
}

// 전역 데이터베이스 매니저 인스턴스
let dbManager: DatabaseManager | null = null;

/**
 * 데이터베이스 매니저 가져오기
 */
export function getDbManager(): DatabaseManager {
  if (!dbManager) {
    dbManager = new DatabaseManager(databaseConfig);
  }
  return dbManager;
}

// 편의 export
export const db = {
  get read() {
    return getDbManager().read;
  },
  get write() {
    return getDbManager().write;
  },
  transaction: (fn: any, options?: any) => getDbManager().transaction(fn, options),
  batch: (queries: any[]) => getDbManager().batch(queries),
  healthCheck: () => getDbManager().healthCheck(),
  getPoolStats: () => getDbManager().getPoolStats(),
};

// Prisma 미들웨어로 쿼리 로깅 및 모니터링
const setupPrismaMiddleware = (client: PrismaClient) => {
  client.$use(async (params, next) => {
    const before = Date.now();
    
    const result = await next(params);
    
    const after = Date.now();
    const duration = after - before;
    
    // 느린 쿼리 로깅 (50ms 이상)
    if (duration > 50) {
      console.warn(`Slow query detected: ${params.model}.${params.action} took ${duration}ms`);
    }
    
    return result;
  });
};