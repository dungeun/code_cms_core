// 데이터베이스 읽기 복제본 연결 시스템

import { PrismaClient } from "@prisma/client";

// 프라이머리 데이터베이스 (쓰기)
export const primaryDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

// 읽기 전용 복제본 데이터베이스들
const readReplicas = [
  process.env.DATABASE_READ_URL_1,
  process.env.DATABASE_READ_URL_2,
  process.env.DATABASE_READ_URL_3
].filter(Boolean).map(url => 
  new PrismaClient({
    datasources: { db: { url } },
    log: ['error']
  })
);

// 읽기 전용 DB가 없으면 프라이머리 사용
if (readReplicas.length === 0) {
  readReplicas.push(primaryDb);
}

// 로드 밸런서 상태
let currentReplicaIndex = 0;
const replicaHealthStatus = new Map<number, boolean>();

// 헬스 체크 함수
async function checkReplicaHealth(index: number): Promise<boolean> {
  try {
    await readReplicas[index].$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error(`Read replica ${index} health check failed:`, error);
    return false;
  }
}

// 정기적인 헬스 체크 (1분마다)
setInterval(async () => {
  for (let i = 0; i < readReplicas.length; i++) {
    const isHealthy = await checkReplicaHealth(i);
    replicaHealthStatus.set(i, isHealthy);
  }
}, 60000);

// 읽기용 DB 선택 (라운드 로빈)
function selectReadReplica(): PrismaClient {
  const healthyReplicas = readReplicas.filter((_, index) => 
    replicaHealthStatus.get(index) !== false
  );
  
  if (healthyReplicas.length === 0) {
    console.warn('No healthy read replicas, falling back to primary');
    return primaryDb;
  }
  
  // 라운드 로빈 방식으로 선택
  currentReplicaIndex = (currentReplicaIndex + 1) % healthyReplicas.length;
  return healthyReplicas[currentReplicaIndex];
}

// 읽기 전용 쿼리 실행
export function getReadOnlyDb(): PrismaClient {
  return selectReadReplica();
}

// 트랜잭션 지원 데이터베이스 래퍼
export class DatabaseManager {
  // 읽기 쿼리
  static async read<T>(
    operation: (db: PrismaClient) => Promise<T>
  ): Promise<T> {
    const readDb = getReadOnlyDb();
    return await operation(readDb);
  }
  
  // 쓰기 쿼리 (프라이머리만)
  static async write<T>(
    operation: (db: PrismaClient) => Promise<T>
  ): Promise<T> {
    return await operation(primaryDb);
  }
  
  // 트랜잭션 (프라이머리만)
  static async transaction<T>(
    operations: (db: PrismaClient) => Promise<T>
  ): Promise<T> {
    return await primaryDb.$transaction(async (tx) => {
      return await operations(tx);
    });
  }
  
  // 읽기 후 쓰기 (read-after-write consistency)
  static async readAfterWrite<T>(
    writeOperation: (db: PrismaClient) => Promise<any>,
    readOperation: (db: PrismaClient) => Promise<T>
  ): Promise<T> {
    // 쓰기 작업 먼저 실행
    await writeOperation(primaryDb);
    
    // 잠시 대기 (복제 지연 고려)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 프라이머리에서 읽기 (일관성 보장)
    return await readOperation(primaryDb);
  }
}

// 캐시와 통합된 데이터베이스 작업
export class CachedDatabaseManager extends DatabaseManager {
  // 캐시된 읽기
  static async cachedRead<T>(
    cacheKey: string,
    operation: (db: PrismaClient) => Promise<T>,
    ttl = 300 // 5분
  ): Promise<T> {
    // 캐시에서 먼저 확인
    const cached = await cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    // 데이터베이스에서 조회
    const result = await this.read(operation);
    
    // 결과 캐싱
    await cache.set(cacheKey, result, { ttl });
    
    return result;
  }
  
  // 쓰기 후 캐시 무효화
  static async writeAndInvalidate<T>(
    operation: (db: PrismaClient) => Promise<T>,
    invalidationKeys: string[]
  ): Promise<T> {
    const result = await this.write(operation);
    
    // 관련 캐시 무효화
    await cache.deletePattern(`*{${invalidationKeys.join(',')}}*`);
    
    return result;
  }
}

// 데이터베이스 메트릭 수집
export class DatabaseMetrics {
  private static queryCount = 0;
  private static slowQueries: Array<{query: string, duration: number, timestamp: Date}> = [];
  
  static incrementQueryCount() {
    this.queryCount++;
  }
  
  static recordSlowQuery(query: string, duration: number) {
    this.slowQueries.push({
      query,
      duration,
      timestamp: new Date()
    });
    
    // 최근 100개만 유지
    if (this.slowQueries.length > 100) {
      this.slowQueries = this.slowQueries.slice(-100);
    }
  }
  
  static getMetrics() {
    return {
      totalQueries: this.queryCount,
      slowQueries: this.slowQueries,
      avgSlowQueryDuration: this.slowQueries.length > 0 
        ? this.slowQueries.reduce((sum, q) => sum + q.duration, 0) / this.slowQueries.length
        : 0
    };
  }
}

// 연결 풀 상태 모니터링
export async function getConnectionPoolStatus() {
  try {
    const primaryStatus = await primaryDb.$queryRaw`
      SELECT 
        numbackends as active_connections,
        setting as max_connections
      FROM pg_stat_database 
      JOIN pg_settings ON name = 'max_connections'
      WHERE datname = current_database()
    ` as any[];
    
    return {
      primary: {
        active: primaryStatus[0]?.active_connections || 0,
        max: parseInt(primaryStatus[0]?.max_connections || '100')
      },
      replicas: readReplicas.length,
      healthyReplicas: Array.from(replicaHealthStatus.values())
        .filter(Boolean).length
    };
  } catch (error) {
    console.error('Failed to get connection pool status:', error);
    return null;
  }
}

// 정리 함수
export async function cleanup() {
  await primaryDb.$disconnect();
  await Promise.all(
    readReplicas.map(replica => replica.$disconnect())
  );
}

// 프로세스 종료 시 정리
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);