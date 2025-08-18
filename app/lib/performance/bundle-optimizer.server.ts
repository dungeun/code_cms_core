/**
 * 번들 최적화 및 코드 스플리팅 관리
 * 성능 최적화를 위한 동적 임포트 및 lazy loading 시스템
 */
import { performance } from 'perf_hooks';
import { getMetricsCollector } from '../monitoring/metrics-collector.server';

/**
 * 번들 최적화 매니저
 */
export class BundleOptimizer {
  private loadedModules = new Set<string>();
  private moduleLoadTimes = new Map<string, number>();
  private metricsCollector = getMetricsCollector();

  /**
   * 모듈 동적 로딩 (성능 모니터링 포함)
   */
  async loadModule<T>(
    modulePath: string, 
    chunkName?: string,
    preloadDependencies?: string[]
  ): Promise<T> {
    const start = performance.now();
    
    try {
      // 이미 로드된 모듈은 캐시에서 반환
      if (this.loadedModules.has(modulePath)) {
        return require(modulePath) as T;
      }

      // 의존성 preload
      if (preloadDependencies) {
        await this.preloadDependencies(preloadDependencies);
      }

      // 동적 임포트
      const module = await import(modulePath) as T;
      
      // 로딩 완료 기록
      this.loadedModules.add(modulePath);
      const loadTime = performance.now() - start;
      this.moduleLoadTimes.set(modulePath, loadTime);

      // 메트릭 기록
      this.metricsCollector.recordHttpRequest(
        'DYNAMIC_IMPORT',
        chunkName || modulePath,
        200,
        loadTime
      );

      console.log(`✅ 모듈 로드 완료: ${modulePath} (${loadTime.toFixed(2)}ms)`);
      
      return module;
    } catch (error) {
      const loadTime = performance.now() - start;
      
      // 에러 메트릭 기록
      this.metricsCollector.recordHttpRequest(
        'DYNAMIC_IMPORT',
        chunkName || modulePath,
        500,
        loadTime
      );

      console.error(`❌ 모듈 로드 실패: ${modulePath}`, error);
      throw error;
    }
  }

  /**
   * 의존성 preload
   */
  private async preloadDependencies(dependencies: string[]): Promise<void> {
    const preloadPromises = dependencies.map(async (dep) => {
      if (!this.loadedModules.has(dep)) {
        try {
          await import(dep);
          this.loadedModules.add(dep);
        } catch (error) {
          console.warn(`⚠️  의존성 preload 실패: ${dep}`, error);
        }
      }
    });

    await Promise.all(preloadPromises);
  }

  /**
   * 컴포넌트 lazy loading 래퍼
   */
  createLazyComponent<T extends React.ComponentType<any>>(
    factory: () => Promise<{ default: T }>,
    fallback?: React.ComponentType
  ): React.LazyExoticComponent<T> {
    return React.lazy(async () => {
      const start = performance.now();
      
      try {
        const component = await factory();
        const loadTime = performance.now() - start;
        
        console.log(`🎨 컴포넌트 로드 완료: ${loadTime.toFixed(2)}ms`);
        
        return component;
      } catch (error) {
        console.error('❌ 컴포넌트 로드 실패:', error);
        
        // 에러 컴포넌트 반환
        return {
          default: fallback || (() => React.createElement('div', {}, '컴포넌트 로드 실패'))
        };
      }
    });
  }

  /**
   * 청크 우선순위 preload
   */
  async preloadCriticalChunks(): Promise<void> {
    const criticalChunks = [
      // 관리자 패널 관련
      '/chunks/admin-dashboard',
      '/chunks/admin-posts',
      '/chunks/admin-users',
      
      // 사용자 인터페이스
      '/chunks/post-editor',
      '/chunks/comment-system',
      '/chunks/user-profile',
      
      // 공통 유틸리티
      '/chunks/ui-components',
      '/chunks/form-validation',
    ];

    console.log('🚀 중요 청크 preload 시작...');
    
    const preloadPromises = criticalChunks.map(async (chunk) => {
      try {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'script';
        link.href = chunk;
        document.head.appendChild(link);
      } catch (error) {
        console.warn(`⚠️  청크 preload 실패: ${chunk}`, error);
      }
    });

    await Promise.all(preloadPromises);
    console.log('✅ 중요 청크 preload 완료');
  }

  /**
   * 번들 분석 및 최적화 제안
   */
  analyzeBundlePerformance(): BundleAnalysis {
    const totalModules = this.loadedModules.size;
    const avgLoadTime = Array.from(this.moduleLoadTimes.values())
      .reduce((sum, time) => sum + time, 0) / this.moduleLoadTimes.size || 0;
    
    const slowModules = Array.from(this.moduleLoadTimes.entries())
      .filter(([, time]) => time > 100)
      .sort(([, a], [, b]) => b - a);

    const recommendations: string[] = [];
    
    if (avgLoadTime > 50) {
      recommendations.push('평균 모듈 로드 시간이 50ms를 초과합니다. 코드 스플리팅을 고려하세요.');
    }
    
    if (slowModules.length > 0) {
      recommendations.push(`느린 모듈 감지: ${slowModules.slice(0, 3).map(([path]) => path).join(', ')}`);
    }
    
    if (totalModules > 50) {
      recommendations.push('로드된 모듈이 많습니다. 불필요한 모듈 로딩을 줄이세요.');
    }

    return {
      totalModules,
      avgLoadTime: Math.round(avgLoadTime * 100) / 100,
      slowModules: slowModules.slice(0, 5),
      recommendations,
      score: this.calculatePerformanceScore(avgLoadTime, slowModules.length)
    };
  }

  /**
   * 성능 점수 계산
   */
  private calculatePerformanceScore(avgLoadTime: number, slowModuleCount: number): number {
    let score = 100;
    
    // 평균 로드 시간에 따른 감점
    if (avgLoadTime > 100) score -= 30;
    else if (avgLoadTime > 50) score -= 15;
    else if (avgLoadTime > 25) score -= 5;
    
    // 느린 모듈 수에 따른 감점
    score -= slowModuleCount * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 모듈 캐시 관리
   */
  clearModuleCache(modulePath?: string): void {
    if (modulePath) {
      this.loadedModules.delete(modulePath);
      this.moduleLoadTimes.delete(modulePath);
      delete require.cache[require.resolve(modulePath)];
    } else {
      this.loadedModules.clear();
      this.moduleLoadTimes.clear();
      
      // 전체 require 캐시 클리어 (개발 환경에서만)
      if (process.env.NODE_ENV === 'development') {
        Object.keys(require.cache).forEach(key => {
          delete require.cache[key];
        });
      }
    }
  }

  /**
   * 런타임 통계
   */
  getStats(): BundleStats {
    return {
      loadedModules: Array.from(this.loadedModules),
      moduleLoadTimes: Object.fromEntries(this.moduleLoadTimes),
      totalLoadTime: Array.from(this.moduleLoadTimes.values()).reduce((sum, time) => sum + time, 0),
      averageLoadTime: Array.from(this.moduleLoadTimes.values()).reduce((sum, time) => sum + time, 0) / this.moduleLoadTimes.size || 0,
    };
  }
}

/**
 * 번들 분석 결과 인터페이스
 */
export interface BundleAnalysis {
  totalModules: number;
  avgLoadTime: number;
  slowModules: Array<[string, number]>;
  recommendations: string[];
  score: number;
}

/**
 * 번들 통계 인터페이스  
 */
export interface BundleStats {
  loadedModules: string[];
  moduleLoadTimes: Record<string, number>;
  totalLoadTime: number;
  averageLoadTime: number;
}

// 전역 번들 최적화 인스턴스
let bundleOptimizer: BundleOptimizer | null = null;

/**
 * 번들 최적화 인스턴스 가져오기
 */
export function getBundleOptimizer(): BundleOptimizer {
  if (!bundleOptimizer) {
    bundleOptimizer = new BundleOptimizer();
  }
  return bundleOptimizer;
}

/**
 * React lazy 컴포넌트 생성 헬퍼
 */
export const createLazyComponent = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) => {
  return getBundleOptimizer().createLazyComponent(factory, fallback);
};

export default getBundleOptimizer;