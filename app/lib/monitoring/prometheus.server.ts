/**
 * Prometheus 모니터링 설정
 * 메트릭 수집 및 익스포트
 */

import { Registry, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { performance } from 'perf_hooks';

// 메트릭 레지스트리
const register = new Registry();

// HTTP 요청 카운터
export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// HTTP 요청 지속 시간
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// 활성 연결 수
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['type'],
  registers: [register],
});

// 데이터베이스 쿼리 카운터
export const dbQueryCounter = new Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

// 데이터베이스 쿼리 지속 시간
export const dbQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// Redis 명령 카운터
export const redisCommandCounter = new Counter({
  name: 'redis_commands_total',
  help: 'Total number of Redis commands',
  labelNames: ['command', 'status'],
  registers: [register],
});

// Redis 명령 지속 시간
export const redisCommandDuration = new Histogram({
  name: 'redis_command_duration_seconds',
  help: 'Duration of Redis commands in seconds',
  labelNames: ['command'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

// 캐시 히트/미스
export const cacheCounter = new Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'],
  registers: [register],
});

// WebSocket 연결
export const websocketConnections = new Gauge({
  name: 'websocket_connections',
  help: 'Number of WebSocket connections',
  labelNames: ['namespace'],
  registers: [register],
});

// WebSocket 메시지
export const websocketMessages = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['namespace', 'event', 'direction'],
  registers: [register],
});

// 인증 시도
export const authAttempts = new Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'result'],
  registers: [register],
});

// 파일 업로드
export const fileUploads = new Counter({
  name: 'file_uploads_total',
  help: 'Total number of file uploads',
  labelNames: ['type', 'status'],
  registers: [register],
});

// 파일 업로드 크기
export const fileUploadSize = new Histogram({
  name: 'file_upload_size_bytes',
  help: 'Size of uploaded files in bytes',
  labelNames: ['type'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600],
  registers: [register],
});

// 이메일 전송
export const emailsSent = new Counter({
  name: 'emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['type', 'status'],
  registers: [register],
});

// 플러그인 실행
export const pluginExecutions = new Counter({
  name: 'plugin_executions_total',
  help: 'Total number of plugin executions',
  labelNames: ['plugin', 'method', 'status'],
  registers: [register],
});

// 플러그인 실행 시간
export const pluginExecutionDuration = new Histogram({
  name: 'plugin_execution_duration_seconds',
  help: 'Duration of plugin executions in seconds',
  labelNames: ['plugin', 'method'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// 메모리 사용량
export const memoryUsage = new Gauge({
  name: 'process_memory_usage_bytes',
  help: 'Process memory usage in bytes',
  labelNames: ['type'],
  registers: [register],
});

// CPU 사용량
export const cpuUsage = new Gauge({
  name: 'process_cpu_usage_percent',
  help: 'Process CPU usage percentage',
  registers: [register],
});

// 큐 크기
export const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Size of various queues',
  labelNames: ['queue'],
  registers: [register],
});

// 큐 처리 시간
export const queueProcessingTime = new Histogram({
  name: 'queue_processing_time_seconds',
  help: 'Time to process queue items',
  labelNames: ['queue'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// 비즈니스 메트릭
export const businessMetrics = {
  // 사용자 등록
  userRegistrations: new Counter({
    name: 'user_registrations_total',
    help: 'Total number of user registrations',
    labelNames: ['type'],
    registers: [register],
  }),

  // 활성 사용자
  activeUsers: new Gauge({
    name: 'active_users',
    help: 'Number of active users',
    labelNames: ['period'],
    registers: [register],
  }),

  // 결제
  payments: new Counter({
    name: 'payments_total',
    help: 'Total number of payments',
    labelNames: ['method', 'status'],
    registers: [register],
  }),

  // 결제 금액
  paymentAmount: new Histogram({
    name: 'payment_amount_krw',
    help: 'Payment amounts in KRW',
    labelNames: ['method'],
    buckets: [1000, 5000, 10000, 50000, 100000, 500000, 1000000],
    registers: [register],
  }),

  // 콘텐츠 생성
  contentCreated: new Counter({
    name: 'content_created_total',
    help: 'Total content created',
    labelNames: ['type'],
    registers: [register],
  }),

  // API 사용량
  apiUsage: new Counter({
    name: 'api_usage_total',
    help: 'Total API usage',
    labelNames: ['endpoint', 'client'],
    registers: [register],
  }),
};

// 메트릭 수집 헬퍼 클래스
export class MetricsCollector {
  private intervalId?: NodeJS.Timeout;

  /**
   * 시스템 메트릭 수집 시작
   */
  startCollecting(intervalMs: number = 10000) {
    this.intervalId = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
  }

  /**
   * 시스템 메트릭 수집
   */
  private collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    memoryUsage.labels('rss').set(memUsage.rss);
    memoryUsage.labels('heapTotal').set(memUsage.heapTotal);
    memoryUsage.labels('heapUsed').set(memUsage.heapUsed);
    memoryUsage.labels('external').set(memUsage.external);
    memoryUsage.labels('arrayBuffers').set(memUsage.arrayBuffers);

    const cpuUsageData = process.cpuUsage();
    const totalCpu = cpuUsageData.user + cpuUsageData.system;
    cpuUsage.set(totalCpu / 1000000); // 마이크로초를 초로 변환
  }

  /**
   * HTTP 요청 추적
   */
  trackHttpRequest(
    method: string,
    route: string,
    status: number,
    duration: number
  ) {
    httpRequestCounter.labels(method, route, String(status)).inc();
    httpRequestDuration.labels(method, route, String(status)).observe(duration);
  }

  /**
   * 데이터베이스 쿼리 추적
   */
  trackDatabaseQuery(
    operation: string,
    table: string,
    success: boolean,
    duration: number
  ) {
    dbQueryCounter.labels(operation, table, success ? 'success' : 'error').inc();
    dbQueryDuration.labels(operation, table).observe(duration);
  }

  /**
   * Redis 명령 추적
   */
  trackRedisCommand(
    command: string,
    success: boolean,
    duration: number
  ) {
    redisCommandCounter.labels(command, success ? 'success' : 'error').inc();
    redisCommandDuration.labels(command).observe(duration);
  }

  /**
   * 캐시 작업 추적
   */
  trackCacheOperation(operation: 'get' | 'set' | 'delete', hit: boolean) {
    cacheCounter.labels(operation, hit ? 'hit' : 'miss').inc();
  }

  /**
   * WebSocket 연결 추적
   */
  trackWebSocketConnection(namespace: string, delta: number) {
    websocketConnections.labels(namespace).inc(delta);
  }

  /**
   * WebSocket 메시지 추적
   */
  trackWebSocketMessage(
    namespace: string,
    event: string,
    direction: 'in' | 'out'
  ) {
    websocketMessages.labels(namespace, event, direction).inc();
  }

  /**
   * 인증 시도 추적
   */
  trackAuthAttempt(method: string, success: boolean) {
    authAttempts.labels(method, success ? 'success' : 'failure').inc();
  }

  /**
   * 파일 업로드 추적
   */
  trackFileUpload(type: string, size: number, success: boolean) {
    fileUploads.labels(type, success ? 'success' : 'failure').inc();
    if (success) {
      fileUploadSize.labels(type).observe(size);
    }
  }

  /**
   * 이메일 전송 추적
   */
  trackEmailSent(type: string, success: boolean) {
    emailsSent.labels(type, success ? 'success' : 'failure').inc();
  }

  /**
   * 플러그인 실행 추적
   */
  trackPluginExecution(
    pluginName: string,
    method: string,
    success: boolean,
    duration: number
  ) {
    pluginExecutions.labels(pluginName, method, success ? 'success' : 'error').inc();
    pluginExecutionDuration.labels(pluginName, method).observe(duration);
  }

  /**
   * 큐 메트릭 추적
   */
  trackQueueMetrics(queueName: string, size: number, processingTime?: number) {
    queueSize.labels(queueName).set(size);
    if (processingTime !== undefined) {
      queueProcessingTime.labels(queueName).observe(processingTime);
    }
  }

  /**
   * 비즈니스 메트릭 추적
   */
  trackBusinessMetrics(metric: string, labels: Record<string, string>, value?: number) {
    switch (metric) {
      case 'userRegistration':
        businessMetrics.userRegistrations.labels(labels.type || 'standard').inc();
        break;
      case 'activeUsers':
        businessMetrics.activeUsers.labels(labels.period || 'daily').set(value || 0);
        break;
      case 'payment':
        businessMetrics.payments.labels(labels.method || 'card', labels.status || 'success').inc();
        if (value) {
          businessMetrics.paymentAmount.labels(labels.method || 'card').observe(value);
        }
        break;
      case 'contentCreated':
        businessMetrics.contentCreated.labels(labels.type || 'post').inc();
        break;
      case 'apiUsage':
        businessMetrics.apiUsage.labels(labels.endpoint || '/', labels.client || 'unknown').inc();
        break;
    }
  }

  /**
   * 메트릭 내보내기
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * 메트릭 JSON 형식으로 내보내기
   */
  async getMetricsJSON() {
    return register.getMetricsAsJSON();
  }

  /**
   * 정리
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

// 싱글톤 인스턴스
let metricsCollector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
    metricsCollector.startCollecting();
  }
  return metricsCollector;
}

// Express 미들웨어
export function prometheusMiddleware(req: any, res: any, next: any) {
  const start = performance.now();
  
  res.on('finish', () => {
    const duration = (performance.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    
    getMetricsCollector().trackHttpRequest(
      req.method,
      route,
      res.statusCode,
      duration
    );
  });
  
  next();
}