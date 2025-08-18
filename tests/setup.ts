/**
 * Jest 테스트 설정
 * 전역 설정 및 모의 객체 구성
 */
import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'file:./test.db';

// 전역 모의 객체
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Remix 모의 객체
jest.mock('@remix-run/node', () => ({
  json: jest.fn((data, init) => ({ data, init })),
  redirect: jest.fn((url) => ({ type: 'redirect', url })),
  createCookieSessionStorage: jest.fn(() => ({
    getSession: jest.fn(),
    commitSession: jest.fn(),
    destroySession: jest.fn(),
  })),
}));

// 데이터베이스 모의 객체
jest.mock('~/lib/db.server', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    post: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

// Redis 모의 객체
jest.mock('~/lib/redis/cluster.server', () => ({
  getRedisCluster: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
    lpush: jest.fn(),
    rpush: jest.fn(),
    lpop: jest.fn(),
    rpop: jest.fn(),
    llen: jest.fn(),
    ltrim: jest.fn(),
  })),
}));

// 성능 모의 객체
jest.mock('~/lib/performance/performance-manager.server', () => ({
  getPerformanceManager: jest.fn(() => ({
    runComprehensiveAnalysis: jest.fn(() => Promise.resolve({
      overallScore: 85,
      bundleOptimization: { score: 88 },
      databaseOptimization: { score: 82 },
      imageOptimization: { score: 90 },
    })),
    runAutoOptimization: jest.fn(() => Promise.resolve({
      improvementScore: 15,
      optimizations: ['Bundle splitting', 'Image optimization'],
    })),
    getPerformanceTargets: jest.fn(() => ({
      bundleSize: 500,
      loadTime: 3000,
      firstContentfulPaint: 1500,
    })),
    setPerformanceTargets: jest.fn(),
  })),
}));

// 아키텍처 모의 객체
jest.mock('~/lib/architecture/architecture-analyzer.server', () => ({
  getArchitectureAnalyzer: jest.fn(() => ({
    runComprehensiveAnalysis: jest.fn(() => Promise.resolve({
      overallScore: 92,
      codeStructure: { score: 90 },
      dependencyAnalysis: { score: 95 },
      designPatterns: { score: 88 },
    })),
  })),
}));

// 메트릭 수집기 모의 객체
jest.mock('~/lib/monitoring/metrics-collector.server', () => ({
  getMetricsCollector: jest.fn(() => ({
    recordHttpRequest: jest.fn(),
    recordDatabaseQuery: jest.fn(),
    recordCacheHit: jest.fn(),
    recordCacheMiss: jest.fn(),
    getMetrics: jest.fn(() => ({
      http: { requests: 100, avgResponseTime: 150 },
      database: { queries: 50, avgQueryTime: 25 },
      cache: { hits: 80, misses: 20 },
    })),
  })),
}));

// 테스트 도구 함수
export function createMockRequest(method: string = 'GET', url: string = '/', body?: any): Request {
  const mockRequest = {
    method,
    url: `http://localhost:3000${url}`,
    headers: new Headers({
      'Content-Type': 'application/json',
      'User-Agent': 'Test Agent',
    }),
    body: body ? JSON.stringify(body) : null,
    json: () => Promise.resolve(body),
    formData: () => {
      const formData = new FormData();
      if (body) {
        Object.entries(body).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
      }
      return Promise.resolve(formData);
    },
  } as unknown as Request;

  return mockRequest;
}

export function createMockSession(data: any = {}) {
  return {
    get: jest.fn((key) => data[key]),
    set: jest.fn((key, value) => { data[key] = value; }),
    has: jest.fn((key) => key in data),
    unset: jest.fn((key) => { delete data[key]; }),
    flash: jest.fn(),
  };
}

export function createMockUser(overrides: any = {}) {
  return {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    provider: 'local',
    providerId: null,
    avatar: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockPost(overrides: any = {}) {
  return {
    id: '1',
    title: 'Test Post',
    content: 'Test content',
    slug: 'test-post',
    published: true,
    featured: false,
    authorId: '1',
    categoryId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockCategory(overrides: any = {}) {
  return {
    id: '1',
    name: 'Test Category',
    slug: 'test-category',
    description: 'Test description',
    color: '#000000',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// 테스트 라이프사이클 훅
beforeAll(async () => {
  // 전역 설정
});

afterAll(async () => {
  // 전역 정리
});

beforeEach(() => {
  // 각 테스트 전 설정
  jest.clearAllMocks();
});

afterEach(() => {
  // 각 테스트 후 정리
  jest.restoreAllMocks();
});

// 비동기 테스트 헬퍼
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 에러 무시 헬퍼
export function suppressConsoleError(fn: () => void) {
  const originalError = console.error;
  console.error = jest.fn();
  
  try {
    fn();
  } finally {
    console.error = originalError;
  }
}

// 테스트 시간 측정 헬퍼
export class TestTimer {
  private startTime: number = 0;
  
  start() {
    this.startTime = Date.now();
  }
  
  end() {
    return Date.now() - this.startTime;
  }
}