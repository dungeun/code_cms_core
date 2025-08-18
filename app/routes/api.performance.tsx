/**
 * 성능 분석 및 최적화 API 엔드포인트
 * 종합적인 성능 메트릭 제공 및 최적화 관리
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAdmin } from '~/lib/auth.server';
import { getPerformanceManager } from '~/lib/performance/performance-manager.server';
import { performance } from 'perf_hooks';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const detailed = url.searchParams.get('detailed') === 'true';

  // 기본 성능 정보는 인증 불요 (모니터링용)
  const start = performance.now();
  
  try {
    const performanceManager = getPerformanceManager();

    switch (action) {
      case 'quick-status': {
        // 빠른 상태 체크 (로드 밸런서/모니터링용)
        const quickMetrics = {
          timestamp: new Date().toISOString(),
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          responseTime: performance.now() - start,
        };
        
        return json(quickMetrics, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Response-Time': `${quickMetrics.responseTime.toFixed(2)}ms`,
          },
        });
      }

      case 'targets': {
        // 성능 목표 조회
        const targets = performanceManager.getPerformanceTargets();
        return json({ targets }, {
          headers: { 'Cache-Control': 'public, max-age=300' }, // 5분 캐시
        });
      }

      case 'analysis': {
        // 관리자 전용
        await requireAdmin(request);
        
        // 종합 성능 분석 실행
        const analysis = await performanceManager.runComprehensiveAnalysis();
        
        return json(analysis, {
          headers: {
            'Cache-Control': 'private, max-age=60', // 1분 캐시
            'X-Analysis-Time': `${analysis.analysisTime}ms`,
          },
        });
      }

      default: {
        // 기본 성능 메트릭 (제한된 정보)
        const basicMetrics = {
          timestamp: new Date().toISOString(),
          uptime: Math.round(process.uptime()),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          },
          responseTime: Math.round(performance.now() - start),
        };

        return json(basicMetrics, {
          headers: {
            'Cache-Control': 'public, max-age=30',
            'X-Response-Time': `${basicMetrics.responseTime}ms`,
          },
        });
      }
    }
  } catch (error) {
    console.error('성능 API 오류:', error);
    
    return json(
      { 
        error: '성능 데이터를 가져올 수 없습니다',
        timestamp: new Date().toISOString(),
        responseTime: Math.round(performance.now() - start),
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${Math.round(performance.now() - start)}ms`,
        },
      }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // 관리자 권한 필요
  await requireAdmin(request);
  
  const formData = await request.formData();
  const action = formData.get('_action') as string;
  
  const start = performance.now();
  
  try {
    const performanceManager = getPerformanceManager();

    switch (action) {
      case 'run-optimization': {
        // 자동 최적화 실행
        console.log('🚀 관리자가 성능 최적화를 시작했습니다...');
        
        const results = await performanceManager.runAutoOptimization();
        
        return json({
          success: true,
          message: '성능 최적화가 완료되었습니다',
          results,
          responseTime: Math.round(performance.now() - start),
        });
      }

      case 'update-targets': {
        // 성능 목표 업데이트
        const targets = JSON.parse(formData.get('targets') as string || '{}');
        
        performanceManager.setPerformanceTargets(targets);
        
        return json({
          success: true,
          message: '성능 목표가 업데이트되었습니다',
          targets: performanceManager.getPerformanceTargets(),
          responseTime: Math.round(performance.now() - start),
        });
      }

      case 'analyze-bundle': {
        // 번들 성능 분석
        const bundleOptimizer = (await import('~/lib/performance/bundle-optimizer.server')).getBundleOptimizer();
        const analysis = bundleOptimizer.analyzeBundlePerformance();
        
        return json({
          success: true,
          analysis,
          responseTime: Math.round(performance.now() - start),
        });
      }

      case 'analyze-database': {
        // 데이터베이스 성능 분석
        const databaseOptimizer = (await import('~/lib/performance/database-optimizer.server')).getDatabaseOptimizer();
        
        const [performanceReport, indexAnalysis, poolOptimization] = await Promise.all([
          databaseOptimizer.generatePerformanceReport(),
          databaseOptimizer.analyzeIndexes(),
          databaseOptimizer.optimizeConnectionPool(),
        ]);
        
        return json({
          success: true,
          performanceReport,
          indexAnalysis,
          poolOptimization,
          responseTime: Math.round(performance.now() - start),
        });
      }

      case 'optimize-images': {
        // 이미지 최적화 및 정리
        const imageOptimizer = (await import('~/lib/performance/image-optimizer.server')).getImageOptimizer();
        
        const cleanupResult = await imageOptimizer.cleanupOldImages();
        
        return json({
          success: true,
          message: `이미지 정리 완료: ${cleanupResult.deletedFiles}개 파일, ${cleanupResult.freedMB}MB 확보`,
          cleanupResult,
          responseTime: Math.round(performance.now() - start),
        });
      }

      case 'clear-cache': {
        // 성능 관련 캐시 정리
        const databaseOptimizer = (await import('~/lib/performance/database-optimizer.server')).getDatabaseOptimizer();
        const pattern = formData.get('pattern') as string || undefined;
        
        await databaseOptimizer.invalidateQueryCache(pattern);
        
        return json({
          success: true,
          message: pattern ? 
            `패턴 "${pattern}"과 일치하는 캐시가 정리되었습니다` :
            '모든 쿼리 캐시가 정리되었습니다',
          responseTime: Math.round(performance.now() - start),
        });
      }

      case 'preload-critical': {
        // 중요 청크 preload
        const bundleOptimizer = (await import('~/lib/performance/bundle-optimizer.server')).getBundleOptimizer();
        
        await bundleOptimizer.preloadCriticalChunks();
        
        return json({
          success: true,
          message: '중요 청크 preload가 완료되었습니다',
          responseTime: Math.round(performance.now() - start),
        });
      }

      case 'collect-webvitals': {
        // Web Vitals 데이터 수집
        const metricsData = JSON.parse(formData.get('metrics') as string || '{}');
        
        // Redis에 Web Vitals 데이터 저장
        const redis = (await import('~/lib/redis/cluster.server')).getRedisCluster();
        
        for (const [metric, value] of Object.entries(metricsData)) {
          if (typeof value === 'number' && !isNaN(value)) {
            await redis.lpush(`webvitals:${metric}`, value.toString());
            await redis.ltrim(`webvitals:${metric}`, 0, 999); // 최근 1000개 유지
          }
        }
        
        return json({
          success: true,
          message: 'Web Vitals 데이터가 수집되었습니다',
          responseTime: Math.round(performance.now() - start),
        });
      }

      default: {
        return json(
          {
            success: false,
            error: '알 수 없는 액션입니다',
            action,
            responseTime: Math.round(performance.now() - start),
          },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error(`성능 액션 실행 실패 (${action}):`, error);
    
    return json(
      {
        success: false,
        error: error.message || '성능 작업 실행에 실패했습니다',
        action,
        responseTime: Math.round(performance.now() - start),
      },
      { status: 500 }
    );
  }
}

/**
 * Web Vitals 수집을 위한 클라이언트 스크립트 제공
 */
export function generateWebVitalsScript(): string {
  return `
    // Web Vitals 자동 수집 스크립트
    (function() {
      // Web Vitals 라이브러리가 있는 경우에만 실행
      if (typeof webVitals !== 'undefined') {
        const sendMetrics = (metrics) => {
          fetch('/api/performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              '_action': 'collect-webvitals',
              'metrics': JSON.stringify(metrics)
            })
          }).catch(console.warn);
        };

        const metrics = {};
        
        webVitals.getLCP((metric) => {
          metrics.lcp = metric.value;
          sendMetrics(metrics);
        });
        
        webVitals.getFID((metric) => {
          metrics.fid = metric.value;
          sendMetrics(metrics);
        });
        
        webVitals.getCLS((metric) => {
          metrics.cls = metric.value;
          sendMetrics(metrics);
        });
        
        webVitals.getFCP((metric) => {
          metrics.fcp = metric.value;
          sendMetrics(metrics);
        });
        
        webVitals.getTTFB((metric) => {
          metrics.ttfb = metric.value;
          sendMetrics(metrics);
        });
      }
    })();
  `;
}

// 성능 최적화 스케줄러 설정
let optimizationScheduler: NodeJS.Timeout | null = null;

/**
 * 자동 성능 최적화 스케줄러 시작
 */
export function startPerformanceScheduler(): void {
  if (optimizationScheduler) return;
  
  console.log('📊 성능 최적화 스케줄러 시작...');
  
  // 매시간마다 자동 최적화 실행
  optimizationScheduler = setInterval(async () => {
    try {
      console.log('🔄 자동 성능 최적화 실행 중...');
      
      const performanceManager = getPerformanceManager();
      const results = await performanceManager.runAutoOptimization();
      
      console.log(`✅ 자동 성능 최적화 완료 (점수: ${results.improvementScore})`);
    } catch (error) {
      console.error('❌ 자동 성능 최적화 실패:', error);
    }
  }, 60 * 60 * 1000); // 1시간마다
}

/**
 * 자동 성능 최적화 스케줄러 중지
 */
export function stopPerformanceScheduler(): void {
  if (optimizationScheduler) {
    clearInterval(optimizationScheduler);
    optimizationScheduler = null;
    console.log('⏹️  성능 최적화 스케줄러 중지됨');
  }
}