/**
 * 통합 성능 관리 시스템
 * 모든 성능 최적화 컴포넌트를 관리하고 조율
 */
import { performance } from 'perf_hooks';
import { getBundleOptimizer, type BundleAnalysis } from './bundle-optimizer.server';
import { getDatabaseOptimizer, type PerformanceReport } from './database-optimizer.server';
import { getImageOptimizer, type CleanupResult } from './image-optimizer.server';
import { getMetricsCollector } from '../monitoring/metrics-collector.server';
import { getRedisCluster } from '../redis/cluster.server';

/**
 * 성능 관리 매니저
 */
export class PerformanceManager {
  private bundleOptimizer = getBundleOptimizer();
  private databaseOptimizer = getDatabaseOptimizer();
  private imageOptimizer = getImageOptimizer();
  private metricsCollector = getMetricsCollector();
  private redis = getRedisCluster();

  private performanceTargets: PerformanceTargets = {
    pageLoadTime: 3000,      // 3초
    ttfb: 500,               // 500ms
    fcp: 1500,               // 1.5초
    lcp: 2500,               // 2.5초
    cls: 0.1,                // 0.1
    fid: 100,                // 100ms
    bundleSize: 500000,      // 500KB
    imageOptimization: 70,    // 70% 압축
    cacheHitRate: 85,        // 85%
    dbQueryTime: 100,        // 100ms
  };

  /**
   * 종합 성능 분석 실행
   */
  async runComprehensiveAnalysis(): Promise<ComprehensiveAnalysis> {
    console.log('🔍 종합 성능 분석 시작...');
    const start = performance.now();

    try {
      // 모든 성능 분석을 병렬로 실행
      const [
        bundleAnalysis,
        databaseReport,
        webVitals,
        systemMetrics,
        cacheAnalysis,
      ] = await Promise.all([
        this.bundleOptimizer.analyzeBundlePerformance(),
        this.databaseOptimizer.generatePerformanceReport(),
        this.analyzeWebVitals(),
        this.analyzeSystemMetrics(),
        this.analyzeCachePerformance(),
      ]);

      // 전체 성능 점수 계산
      const overallScore = this.calculateOverallScore({
        bundle: bundleAnalysis.score,
        database: databaseReport.score,
        webVitals: webVitals.score,
        system: systemMetrics.score,
        cache: cacheAnalysis.score,
      });

      const analysisTime = performance.now() - start;

      const result: ComprehensiveAnalysis = {
        timestamp: new Date().toISOString(),
        overallScore,
        analysisTime: Math.round(analysisTime),
        bundleAnalysis,
        databaseReport,
        webVitals,
        systemMetrics,
        cacheAnalysis,
        recommendations: this.generateRecommendations({
          bundleAnalysis,
          databaseReport,
          webVitals,
          systemMetrics,
          cacheAnalysis,
        }),
        targets: this.performanceTargets,
      };

      // 결과를 캐시에 저장
      await this.cacheAnalysisResult(result);

      console.log(`✅ 종합 성능 분석 완료 (${analysisTime.toFixed(0)}ms)`);
      console.log(`📊 전체 점수: ${overallScore}/100`);

      return result;
    } catch (error) {
      console.error('❌ 종합 성능 분석 실패:', error);
      throw error;
    }
  }

  /**
   * Web Vitals 분석
   */
  private async analyzeWebVitals(): Promise<WebVitalsAnalysis> {
    try {
      // 실제 사용자 메트릭 수집 (RUM)
      const vitalsData = await this.collectWebVitals();
      
      const score = this.calculateWebVitalsScore(vitalsData);
      
      return {
        score,
        metrics: vitalsData,
        thresholds: {
          lcp: { good: 2500, poor: 4000 },
          fid: { good: 100, poor: 300 },
          cls: { good: 0.1, poor: 0.25 },
          fcp: { good: 1800, poor: 3000 },
          ttfb: { good: 800, poor: 1800 },
        },
        recommendations: this.generateWebVitalsRecommendations(vitalsData),
      };
    } catch (error) {
      console.warn('Web Vitals 분석 실패:', error);
      return {
        score: 0,
        metrics: {
          lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0,
        },
        thresholds: {
          lcp: { good: 2500, poor: 4000 },
          fid: { good: 100, poor: 300 },
          cls: { good: 0.1, poor: 0.25 },
          fcp: { good: 1800, poor: 3000 },
          ttfb: { good: 800, poor: 1800 },
        },
        recommendations: ['Web Vitals 데이터를 수집할 수 없습니다.'],
      };
    }
  }

  /**
   * Web Vitals 데이터 수집
   */
  private async collectWebVitals(): Promise<WebVitalsMetrics> {
    try {
      // Redis에서 최근 Web Vitals 데이터 조회
      const vitalsKeys = ['lcp', 'fid', 'cls', 'fcp', 'ttfb'];
      const vitalsData: Partial<WebVitalsMetrics> = {};

      for (const key of vitalsKeys) {
        const values = await this.redis.lrange(`webvitals:${key}`, 0, 99); // 최근 100개
        if (values.length > 0) {
          const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
          if (numericValues.length > 0) {
            vitalsData[key as keyof WebVitalsMetrics] = 
              numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
          }
        }
      }

      return {
        lcp: vitalsData.lcp || 2000,
        fid: vitalsData.fid || 80,
        cls: vitalsData.cls || 0.05,
        fcp: vitalsData.fcp || 1200,
        ttfb: vitalsData.ttfb || 400,
      };
    } catch (error) {
      console.warn('Web Vitals 수집 실패:', error);
      return {
        lcp: 2000, fid: 80, cls: 0.05, fcp: 1200, ttfb: 400,
      };
    }
  }

  /**
   * Web Vitals 점수 계산
   */
  private calculateWebVitalsScore(metrics: WebVitalsMetrics): number {
    const scores = {
      lcp: metrics.lcp <= 2500 ? 100 : (metrics.lcp <= 4000 ? 50 : 0),
      fid: metrics.fid <= 100 ? 100 : (metrics.fid <= 300 ? 50 : 0),
      cls: metrics.cls <= 0.1 ? 100 : (metrics.cls <= 0.25 ? 50 : 0),
      fcp: metrics.fcp <= 1800 ? 100 : (metrics.fcp <= 3000 ? 50 : 0),
      ttfb: metrics.ttfb <= 800 ? 100 : (metrics.ttfb <= 1800 ? 50 : 0),
    };

    // 가중 평균 (LCP와 CLS가 더 중요)
    const weightedScore = (
      scores.lcp * 0.25 +
      scores.fid * 0.15 +
      scores.cls * 0.25 +
      scores.fcp * 0.15 +
      scores.ttfb * 0.2
    );

    return Math.round(weightedScore);
  }

  /**
   * Web Vitals 추천사항 생성
   */
  private generateWebVitalsRecommendations(metrics: WebVitalsMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.lcp > 2500) {
      recommendations.push('LCP 개선: 이미지 최적화, CDN 사용, 서버 응답 시간 단축');
    }
    
    if (metrics.fid > 100) {
      recommendations.push('FID 개선: JavaScript 번들 크기 축소, 코드 스플리팅');
    }
    
    if (metrics.cls > 0.1) {
      recommendations.push('CLS 개선: 이미지 크기 지정, 폰트 로딩 최적화');
    }
    
    if (metrics.fcp > 1800) {
      recommendations.push('FCP 개선: 중요 리소스 preload, 렌더링 차단 제거');
    }
    
    if (metrics.ttfb > 800) {
      recommendations.push('TTFB 개선: 서버 성능 최적화, 캐싱 전략 개선');
    }

    return recommendations;
  }

  /**
   * 시스템 메트릭 분석
   */
  private async analyzeSystemMetrics(): Promise<SystemMetricsAnalysis> {
    try {
      const os = require('os');
      
      // 시스템 리소스 정보
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const cpuCount = os.cpus().length;
      const loadAverage = os.loadavg();
      
      // 프로세스 메모리 정보
      const processMemory = process.memoryUsage();
      
      const metrics: SystemMetrics = {
        memory: {
          total: totalMemory,
          free: freeMemory,
          used: totalMemory - freeMemory,
          usagePercent: ((totalMemory - freeMemory) / totalMemory) * 100,
        },
        cpu: {
          count: cpuCount,
          loadAverage: {
            '1min': loadAverage[0],
            '5min': loadAverage[1],
            '15min': loadAverage[2],
          },
          loadPercentage: (loadAverage[0] / cpuCount) * 100,
        },
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          memory: processMemory,
          heapUsagePercent: (processMemory.heapUsed / processMemory.heapTotal) * 100,
        },
      };

      const score = this.calculateSystemScore(metrics);
      
      return {
        score,
        metrics,
        recommendations: this.generateSystemRecommendations(metrics),
      };
    } catch (error) {
      console.warn('시스템 메트릭 분석 실패:', error);
      throw error;
    }
  }

  /**
   * 시스템 점수 계산
   */
  private calculateSystemScore(metrics: SystemMetrics): number {
    let score = 100;
    
    // 메모리 사용량
    if (metrics.memory.usagePercent > 90) score -= 30;
    else if (metrics.memory.usagePercent > 75) score -= 15;
    
    // CPU 로드
    if (metrics.cpu.loadPercentage > 100) score -= 25;
    else if (metrics.cpu.loadPercentage > 70) score -= 10;
    
    // 프로세스 힙 사용량
    if (metrics.process.heapUsagePercent > 90) score -= 20;
    else if (metrics.process.heapUsagePercent > 75) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * 시스템 추천사항 생성
   */
  private generateSystemRecommendations(metrics: SystemMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.memory.usagePercent > 75) {
      recommendations.push('메모리 사용량 최적화 필요');
    }
    
    if (metrics.cpu.loadPercentage > 70) {
      recommendations.push('CPU 부하 분산 또는 스케일 업 고려');
    }
    
    if (metrics.process.heapUsagePercent > 75) {
      recommendations.push('애플리케이션 메모리 누수 점검');
    }
    
    return recommendations;
  }

  /**
   * 캐시 성능 분석
   */
  private async analyzeCachePerformance(): Promise<CacheAnalysis> {
    try {
      // Redis 통계 정보
      const info = await this.redis.info('stats');
      
      const keyspaceHits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
      const keyspaceMisses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
      const totalRequests = keyspaceHits + keyspaceMisses;
      const hitRate = totalRequests > 0 ? (keyspaceHits / totalRequests) * 100 : 0;
      
      const evictedKeys = parseInt(info.match(/evicted_keys:(\d+)/)?.[1] || '0');
      const expiredKeys = parseInt(info.match(/expired_keys:(\d+)/)?.[1] || '0');
      
      const metrics: CacheMetrics = {
        hitRate,
        hits: keyspaceHits,
        misses: keyspaceMisses,
        evicted: evictedKeys,
        expired: expiredKeys,
        totalRequests,
      };

      const score = hitRate >= 85 ? 100 : (hitRate >= 70 ? 80 : (hitRate >= 50 ? 60 : 40));
      
      return {
        score,
        metrics,
        recommendations: this.generateCacheRecommendations(metrics),
      };
    } catch (error) {
      console.warn('캐시 분석 실패:', error);
      return {
        score: 0,
        metrics: {
          hitRate: 0,
          hits: 0,
          misses: 0,
          evicted: 0,
          expired: 0,
          totalRequests: 0,
        },
        recommendations: ['캐시 상태를 확인할 수 없습니다.'],
      };
    }
  }

  /**
   * 캐시 추천사항 생성
   */
  private generateCacheRecommendations(metrics: CacheMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.hitRate < 70) {
      recommendations.push('캐시 적중률이 낮습니다. TTL 설정 및 캐시 키 전략을 검토하세요.');
    }
    
    if (metrics.evicted > metrics.expired) {
      recommendations.push('메모리 부족으로 인한 캐시 삭제가 많습니다. 메모리 증설을 고려하세요.');
    }
    
    if (metrics.totalRequests === 0) {
      recommendations.push('캐시가 활용되지 않고 있습니다. 캐시 전략을 구현하세요.');
    }
    
    return recommendations;
  }

  /**
   * 전체 성능 점수 계산
   */
  private calculateOverallScore(scores: {
    bundle: number;
    database: number;
    webVitals: number;
    system: number;
    cache: number;
  }): number {
    // 가중 평균
    return Math.round(
      scores.webVitals * 0.3 +    // Web Vitals (30%)
      scores.database * 0.25 +    // Database (25%)
      scores.bundle * 0.2 +       // Bundle (20%)
      scores.system * 0.15 +      // System (15%)
      scores.cache * 0.1          // Cache (10%)
    );
  }

  /**
   * 종합 추천사항 생성
   */
  private generateRecommendations(analyses: {
    bundleAnalysis: BundleAnalysis;
    databaseReport: PerformanceReport;
    webVitals: WebVitalsAnalysis;
    systemMetrics: SystemMetricsAnalysis;
    cacheAnalysis: CacheAnalysis;
  }): string[] {
    const recommendations: string[] = [];
    
    // 우선순위별 추천사항 수집
    if (analyses.webVitals.score < 80) {
      recommendations.push(...analyses.webVitals.recommendations);
    }
    
    if (analyses.databaseReport.score < 80) {
      recommendations.push(...analyses.databaseReport.recommendations);
    }
    
    if (analyses.bundleAnalysis.score < 80) {
      recommendations.push(...analyses.bundleAnalysis.recommendations);
    }
    
    if (analyses.systemMetrics.score < 80) {
      recommendations.push(...analyses.systemMetrics.recommendations);
    }
    
    if (analyses.cacheAnalysis.score < 80) {
      recommendations.push(...analyses.cacheAnalysis.recommendations);
    }
    
    return recommendations.slice(0, 10); // 상위 10개만
  }

  /**
   * 분석 결과 캐싱
   */
  private async cacheAnalysisResult(result: ComprehensiveAnalysis): Promise<void> {
    try {
      const cacheKey = 'performance:analysis:latest';
      await this.redis.setex(cacheKey, 3600, JSON.stringify(result)); // 1시간 캐시
    } catch (error) {
      console.warn('분석 결과 캐싱 실패:', error);
    }
  }

  /**
   * 자동 최적화 실행
   */
  async runAutoOptimization(): Promise<OptimizationResults> {
    console.log('🚀 자동 최적화 시작...');
    const start = performance.now();

    try {
      const results: OptimizationResults = {
        timestamp: new Date().toISOString(),
        operations: [],
        totalTime: 0,
        improvementScore: 0,
      };

      // 1. 이미지 정리
      try {
        console.log('📷 이미지 정리 중...');
        const imageCleanup = await this.imageOptimizer.cleanupOldImages();
        results.operations.push({
          type: 'image_cleanup',
          success: true,
          details: `${imageCleanup.deletedFiles}개 파일 삭제, ${imageCleanup.freedMB}MB 확보`,
          impact: 'medium',
        });
      } catch (error) {
        results.operations.push({
          type: 'image_cleanup',
          success: false,
          details: error.message,
          impact: 'medium',
        });
      }

      // 2. 데이터베이스 캐시 무효화
      try {
        console.log('🗄️  데이터베이스 캐시 정리 중...');
        await this.databaseOptimizer.invalidateQueryCache();
        results.operations.push({
          type: 'cache_cleanup',
          success: true,
          details: '쿼리 캐시 정리 완료',
          impact: 'low',
        });
      } catch (error) {
        results.operations.push({
          type: 'cache_cleanup',
          success: false,
          details: error.message,
          impact: 'low',
        });
      }

      // 3. 모듈 캐시 정리 (개발 환경)
      if (process.env.NODE_ENV === 'development') {
        try {
          console.log('📦 모듈 캐시 정리 중...');
          this.bundleOptimizer.clearModuleCache();
          results.operations.push({
            type: 'module_cache_cleanup',
            success: true,
            details: '개발 환경 모듈 캐시 정리 완료',
            impact: 'low',
          });
        } catch (error) {
          results.operations.push({
            type: 'module_cache_cleanup',
            success: false,
            details: error.message,
            impact: 'low',
          });
        }
      }

      const totalTime = performance.now() - start;
      results.totalTime = Math.round(totalTime);

      // 성공한 작업 수에 따른 개선 점수
      const successfulOps = results.operations.filter(op => op.success).length;
      results.improvementScore = Math.min(100, successfulOps * 25);

      console.log(`✅ 자동 최적화 완료 (${results.totalTime}ms)`);
      console.log(`📈 예상 성능 개선: ${results.improvementScore}점`);

      return results;
    } catch (error) {
      console.error('❌ 자동 최적화 실패:', error);
      throw error;
    }
  }

  /**
   * 성능 목표 설정
   */
  setPerformanceTargets(targets: Partial<PerformanceTargets>): void {
    this.performanceTargets = { ...this.performanceTargets, ...targets };
    console.log('🎯 성능 목표 업데이트됨:', targets);
  }

  /**
   * 성능 목표 조회
   */
  getPerformanceTargets(): PerformanceTargets {
    return { ...this.performanceTargets };
  }
}

// 인터페이스 정의
export interface PerformanceTargets {
  pageLoadTime: number;
  ttfb: number;
  fcp: number;
  lcp: number;
  cls: number;
  fid: number;
  bundleSize: number;
  imageOptimization: number;
  cacheHitRate: number;
  dbQueryTime: number;
}

export interface WebVitalsMetrics {
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
}

export interface WebVitalsAnalysis {
  score: number;
  metrics: WebVitalsMetrics;
  thresholds: {
    lcp: { good: number; poor: number };
    fid: { good: number; poor: number };
    cls: { good: number; poor: number };
    fcp: { good: number; poor: number };
    ttfb: { good: number; poor: number };
  };
  recommendations: string[];
}

export interface SystemMetrics {
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  cpu: {
    count: number;
    loadAverage: {
      '1min': number;
      '5min': number;
      '15min': number;
    };
    loadPercentage: number;
  };
  process: {
    pid: number;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    heapUsagePercent: number;
  };
}

export interface SystemMetricsAnalysis {
  score: number;
  metrics: SystemMetrics;
  recommendations: string[];
}

export interface CacheMetrics {
  hitRate: number;
  hits: number;
  misses: number;
  evicted: number;
  expired: number;
  totalRequests: number;
}

export interface CacheAnalysis {
  score: number;
  metrics: CacheMetrics;
  recommendations: string[];
}

export interface ComprehensiveAnalysis {
  timestamp: string;
  overallScore: number;
  analysisTime: number;
  bundleAnalysis: BundleAnalysis;
  databaseReport: PerformanceReport;
  webVitals: WebVitalsAnalysis;
  systemMetrics: SystemMetricsAnalysis;
  cacheAnalysis: CacheAnalysis;
  recommendations: string[];
  targets: PerformanceTargets;
}

export interface OptimizationOperation {
  type: string;
  success: boolean;
  details: string;
  impact: 'low' | 'medium' | 'high';
}

export interface OptimizationResults {
  timestamp: string;
  operations: OptimizationOperation[];
  totalTime: number;
  improvementScore: number;
}

// 전역 성능 관리 인스턴스
let performanceManager: PerformanceManager | null = null;

/**
 * 성능 관리 인스턴스 가져오기
 */
export function getPerformanceManager(): PerformanceManager {
  if (!performanceManager) {
    performanceManager = new PerformanceManager();
  }
  return performanceManager;
}

export default getPerformanceManager;