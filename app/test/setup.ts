/**
 * 테스트 환경 설정
 * Vitest 실행 전에 필요한 설정들을 초기화
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';

// Testing Library matchers 확장
expect.extend(matchers);

// 각 테스트 후 cleanup
afterEach(() => {
  cleanup();
});

// 환경 변수 모킹
vi.mock('~/lib/env.server', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./test.db',
    SESSION_SECRET: 'test-session-secret-for-testing-only',
    BCRYPT_ROUNDS: 4, // 테스트에서는 빠르게
    SESSION_MAX_AGE: 3600000,
    RATE_LIMIT_WINDOW: 60000,
    RATE_LIMIT_MAX: 100
  },
  security: {
    sessionConfig: {
      name: 'test_session',
      secure: false,
      secrets: ['test-session-secret'],
      sameSite: 'lax',
      maxAge: 3600000,
      httpOnly: true,
    },
    bcryptRounds: 4,
    rateLimit: {
      windowMs: 60000,
      max: 100,
    }
  }
}));

// 콘솔 경고 무시 (테스트 출력 정리용)
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  // React 18 관련 경고 무시
  if (args[0]?.includes?.('ReactDOMTestUtils.act')) {
    return;
  }
  originalConsoleWarn.call(console, ...args);
};

// 글로벌 fetch 모킹 (Node.js 18 이하 지원)
if (!globalThis.fetch) {
  const { fetch } = await import('undici');
  globalThis.fetch = fetch as any;
}

// 브라우저 API 모킹
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ResizeObserver 모킹
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// IntersectionObserver 모킹
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));