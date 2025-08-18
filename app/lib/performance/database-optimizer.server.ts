/**
 * 데이터베이스 성능 최적화 시스템
 * 쿼리 최적화, 인덱스 관리, 연결 풀 최적화
 */
import { db } from '~/utils/db.server';
import { performance } from 'perf_hooks';
import { getMetricsCollector } from '../monitoring/metrics-collector.server';
import { getRedisCluster } from '../redis/cluster.server';

/**
 * 데이터베이스 최적화 매니저
 */
export class DatabaseOptimizer {
  private queryCache = new Map<string, QueryCacheEntry>();
  private slowQueryThreshold = 100; // 100ms
  private metricsCollector = getMetricsCollector();
  private redis = getRedisCluster();

  /**
   * 최적화된 쿼리 실행
   */
  async executeOptimizedQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    cacheOptions?: QueryCacheOptions
  ): Promise<T> {
    const start = performance.now();
    
    try {
      // 캐시 확인
      if (cacheOptions?.cache && cacheOptions.ttl) {
        const cached = await this.getQueryFromCache<T>(queryKey, cacheOptions.ttl);
        if (cached !== null) {
          const duration = performance.now() - start;
          this.metricsCollector.recordDatabaseQuery('SELECT', 'cached', 'read', duration, 'success');
          return cached;
        }
      }

      // 쿼리 실행
      const result = await queryFn();
      const duration = performance.now() - start;
      
      // 느린 쿼리 감지
      if (duration > this.slowQueryThreshold) {
        console.warn(`🐌 느린 쿼리 감지: ${queryKey} (${duration.toFixed(2)}ms)`);
        await this.logSlowQuery(queryKey, duration);
      }

      // 결과 캐싱
      if (cacheOptions?.cache && cacheOptions.ttl) {
        await this.setQueryCache(queryKey, result, cacheOptions.ttl);
      }

      // 메트릭 기록
      this.metricsCollector.recordDatabaseQuery('SELECT', 'unknown', 'read', duration, 'success');

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.metricsCollector.recordDatabaseQuery('SELECT', 'unknown', 'read', duration, 'error');
      
      console.error(`❌ 쿼리 실행 실패: ${queryKey}`, error);
      throw error;
    }
  }

  /**
   * 배치 쿼리 최적화
   */
  async executeBatch<T>(
    operations: Array<() => Promise<T>>,
    options?: { parallel?: boolean; batchSize?: number }
  ): Promise<T[]> {
    const { parallel = true, batchSize = 10 } = options || {};

    if (parallel) {
      // 병렬 실행 (배치 크기 제한)
      const results: T[] = [];
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(op => op()));
        results.push(...batchResults);
      }
      return results;
    } else {
      // 순차 실행
      const results: T[] = [];
      for (const operation of operations) {
        results.push(await operation());
      }
      return results;
    }
  }

  /**
   * 쿼리 캐시에서 조회
   */
  private async getQueryFromCache<T>(key: string, ttl: number): Promise<T | null> {
    try {
      const cacheKey = `query:${key}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached) as T;
      }
      
      return null;
    } catch (error) {
      console.warn('캐시 조회 실패:', error);
      return null;
    }
  }

  /**
   * 쿼리 결과 캐싱
   */
  private async setQueryCache<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const cacheKey = `query:${key}`;
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
    } catch (error) {
      console.warn('캐시 저장 실패:', error);
    }
  }

  /**
   * 느린 쿼리 로깅
   */
  private async logSlowQuery(queryKey: string, duration: number): Promise<void> {
    const logEntry = {
      query: queryKey,
      duration: duration,
      timestamp: new Date().toISOString(),
      pid: process.pid,
    };

    try {
      await this.redis.lpush('slow_queries', JSON.stringify(logEntry));
      await this.redis.ltrim('slow_queries', 0, 999); // 최근 1000개만 유지
    } catch (error) {
      console.error('느린 쿼리 로깅 실패:', error);
    }
  }

  /**
   * 데이터베이스 인덱스 분석 및 추천
   */
  async analyzeIndexes(): Promise<IndexAnalysis> {
    try {
      // 사용되지 않는 인덱스 조회
      const unusedIndexes = await db.$queryRaw`
        SELECT 
          schemaname, 
          tablename, 
          indexname, 
          idx_tup_read, 
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE idx_tup_read = 0 AND idx_tup_fetch = 0
        ORDER BY schemaname, tablename, indexname
      ` as UnusedIndex[];

      // 느린 쿼리 패턴 분석
      const tableStats = await db.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_tup_ins,
          n_tup_upd,
          n_tup_del
        FROM pg_stat_user_tables
        WHERE seq_scan > idx_scan AND seq_tup_read > 10000
        ORDER BY seq_tup_read DESC
      ` as TableStats[];

      // 인덱스 추천
      const recommendations = this.generateIndexRecommendations(tableStats);

      return {
        unusedIndexes,
        slowTables: tableStats,
        recommendations,
        totalUnusedIndexes: unusedIndexes.length,
        tablesNeedingIndexes: tableStats.length,
      };
    } catch (error) {
      console.error('인덱스 분석 실패:', error);
      return {
        unusedIndexes: [],
        slowTables: [],
        recommendations: [],
        totalUnusedIndexes: 0,
        tablesNeedingIndexes: 0,
      };
    }
  }

  /**
   * 인덱스 추천 생성
   */
  private generateIndexRecommendations(tableStats: TableStats[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    tableStats.forEach(stat => {
      if (stat.seq_scan > stat.idx_scan * 10) { // 시퀀셜 스캔이 인덱스 스캔보다 10배 많은 경우
        recommendations.push({
          table: `${stat.schemaname}.${stat.tablename}`,
          type: 'create_index',
          reason: 'Sequential scans are significantly higher than index scans',
          impact: 'high',
          sql: `-- Consider adding indexes to frequently queried columns on ${stat.tablename}`,
          seqScanRatio: Math.round((stat.seq_scan / (stat.idx_scan || 1)) * 100) / 100
        });
      }
    });

    return recommendations.sort((a, b) => (b.seqScanRatio || 0) - (a.seqScanRatio || 0));
  }

  /**
   * 연결 풀 최적화
   */
  async optimizeConnectionPool(): Promise<PoolOptimization> {
    try {
      // 현재 연결 상태 조회
      const connectionStats = await db.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) filter (where state = 'active') as active_connections,
          count(*) filter (where state = 'idle') as idle_connections,
          count(*) filter (where state = 'idle in transaction') as idle_in_transaction,
          max(now() - state_change) as longest_idle,
          avg(now() - query_start) filter (where state = 'active') as avg_query_duration
        FROM pg_stat_activity 
        WHERE datname = current_database()
      ` as ConnectionStats[];

      const stats = connectionStats[0];
      if (!stats) {
        throw new Error('연결 통계를 가져올 수 없습니다');
      }

      // 최적화 권장사항 생성
      const recommendations: string[] = [];
      let optimalPoolSize = 10;

      if (Number(stats.active_connections) > Number(stats.total_connections) * 0.8) {
        recommendations.push('활성 연결이 많습니다. 연결 풀 크기를 늘리는 것을 고려하세요.');
        optimalPoolSize = Number(stats.total_connections) + 5;
      }

      if (Number(stats.idle_connections) > Number(stats.total_connections) * 0.5) {
        recommendations.push('유휴 연결이 많습니다. 연결 풀 크기를 줄이는 것을 고려하세요.');
        optimalPoolSize = Math.max(5, Number(stats.total_connections) - 3);
      }

      if (Number(stats.idle_in_transaction) > 0) {
        recommendations.push('트랜잭션 내 유휴 연결이 있습니다. 트랜잭션 타임아웃을 설정하세요.');
      }

      return {
        currentStats: stats,
        recommendations,
        optimalPoolSize,
        efficiency: this.calculatePoolEfficiency(stats),
      };
    } catch (error) {
      console.error('연결 풀 분석 실패:', error);
      throw error;
    }
  }

  /**
   * 연결 풀 효율성 계산
   */
  private calculatePoolEfficiency(stats: ConnectionStats): number {
    const total = Number(stats.total_connections);
    const active = Number(stats.active_connections);
    const idle = Number(stats.idle_connections);
    
    if (total === 0) return 0;
    
    // 이상적인 비율: 활성 70%, 유휴 30%
    const activeRatio = active / total;
    const idealActiveRatio = 0.7;
    
    const efficiency = 100 - Math.abs(activeRatio - idealActiveRatio) * 100;
    return Math.max(0, Math.min(100, efficiency));
  }

  /**
   * 쿼리 성능 보고서 생성
   */
  async generatePerformanceReport(): Promise<PerformanceReport> {
    try {
      const [indexAnalysis, poolOptimization] = await Promise.all([
        this.analyzeIndexes(),
        this.optimizeConnectionPool(),
      ]);

      // 느린 쿼리 조회
      const slowQueries = await this.redis.lrange('slow_queries', 0, 9);
      const parsedSlowQueries = slowQueries.map(q => JSON.parse(q));

      // 전체 점수 계산
      const score = this.calculateOverallScore(indexAnalysis, poolOptimization);

      return {
        timestamp: new Date().toISOString(),
        indexAnalysis,
        poolOptimization,
        slowQueries: parsedSlowQueries,
        score,
        recommendations: [
          ...indexAnalysis.recommendations.map(r => r.reason),
          ...poolOptimization.recommendations,
        ],
      };
    } catch (error) {
      console.error('성능 보고서 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 전체 성능 점수 계산
   */
  private calculateOverallScore(
    indexAnalysis: IndexAnalysis, 
    poolOptimization: PoolOptimization
  ): number {
    let score = 100;

    // 인덱스 관련 감점
    score -= indexAnalysis.unusedIndexes.length * 2;
    score -= indexAnalysis.tablesNeedingIndexes * 5;

    // 연결 풀 관련 점수 (70% 가중치)
    score = score * 0.3 + poolOptimization.efficiency * 0.7;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 캐시 무효화
   */
  async invalidateQueryCache(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        const keys = await this.redis.keys(`query:*${pattern}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        const keys = await this.redis.keys('query:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (error) {
      console.error('캐시 무효화 실패:', error);
    }
  }
}

// 인터페이스 정의
interface QueryCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

interface QueryCacheOptions {
  cache: boolean;
  ttl: number; // seconds
}

interface UnusedIndex {
  schemaname: string;
  tablename: string;
  indexname: string;
  idx_tup_read: bigint;
  idx_tup_fetch: bigint;
}

interface TableStats {
  schemaname: string;
  tablename: string;
  seq_scan: bigint;
  seq_tup_read: bigint;
  idx_scan: bigint;
  idx_tup_fetch: bigint;
  n_tup_ins: bigint;
  n_tup_upd: bigint;
  n_tup_del: bigint;
}

interface IndexRecommendation {
  table: string;
  type: 'create_index' | 'drop_index';
  reason: string;
  impact: 'low' | 'medium' | 'high';
  sql: string;
  seqScanRatio?: number;
}

interface IndexAnalysis {
  unusedIndexes: UnusedIndex[];
  slowTables: TableStats[];
  recommendations: IndexRecommendation[];
  totalUnusedIndexes: number;
  tablesNeedingIndexes: number;
}

interface ConnectionStats {
  total_connections: bigint;
  active_connections: bigint;
  idle_connections: bigint;
  idle_in_transaction: bigint;
  longest_idle: any;
  avg_query_duration: any;
}

interface PoolOptimization {
  currentStats: ConnectionStats;
  recommendations: string[];
  optimalPoolSize: number;
  efficiency: number;
}

interface PerformanceReport {
  timestamp: string;
  indexAnalysis: IndexAnalysis;
  poolOptimization: PoolOptimization;
  slowQueries: any[];
  score: number;
  recommendations: string[];
}

// 전역 데이터베이스 최적화 인스턴스
let databaseOptimizer: DatabaseOptimizer | null = null;

/**
 * 데이터베이스 최적화 인스턴스 가져오기
 */
export function getDatabaseOptimizer(): DatabaseOptimizer {
  if (!databaseOptimizer) {
    databaseOptimizer = new DatabaseOptimizer();
  }
  return databaseOptimizer;
}

export default getDatabaseOptimizer;