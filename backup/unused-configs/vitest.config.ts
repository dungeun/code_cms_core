/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // 테스트 환경 설정
    environment: 'node',
    
    // 글로벌 설정
    globals: true,
    
    // 테스트 파일 패턴
    include: [
      'tests/unit/**/*.{test,spec}.{js,ts}',
      'tests/integration/**/*.{test,spec}.{js,ts}',
      'tests/performance/**/*.{test,spec}.{js,ts}'
    ],
    
    // 제외할 파일 패턴
    exclude: [
      'node_modules',
      'build',
      'dist',
      'tests/e2e'
    ],
    
    // 타임아웃 설정
    testTimeout: 30000, // 30초
    hookTimeout: 10000, // 10초
    
    // 병렬 실행 설정
    threads: true,
    minThreads: 1,
    maxThreads: 4,
    
    // 커버리지 설정
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/build/',
        '**/dist/',
        'app/entry.client.tsx',
        'app/entry.server.tsx',
        'app/root.tsx'
      ],
      // 커버리지 임계값
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    },
    
    // 리포터 설정
    reporter: [
      'default',
      'json',
      'junit'
    ],
    
    // 출력 파일
    outputFile: {
      json: './test-results/results.json',
      junit: './test-results/junit.xml'
    },
    
    // 설정 파일 감시
    watchExclude: [
      'node_modules/**',
      'build/**',
      'dist/**'
    ],
    
    // 테스트 환경 변수
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
      REDIS_URL: 'redis://localhost:6379/1',
      JWT_SECRET: 'test-secret',
      ENCRYPTION_KEY: 'test-encryption-key'
    },
    
    // 테스트 설정 파일
    setupFiles: [
      './tests/setup/test-setup.ts'
    ],
    
    // 각 테스트 파일 실행 전 설정
    globalSetup: './tests/setup/global-setup.ts',
    globalTeardown: './tests/setup/global-teardown.ts'
  },
  
  // 경로 별칭 설정
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
      '@': resolve(__dirname, './')
    }
  },
  
  // 의존성 최적화
  optimizeDeps: {
    include: [
      'vitest',
      '@testing-library/jest-dom'
    ]
  }
});