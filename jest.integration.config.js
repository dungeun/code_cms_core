/**
 * Jest 설정 (통합 테스트)
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests/integration'],
  
  // 테스트 파일 패턴
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.integration.test.ts',
  ],
  
  // 모듈 경로 매핑
  moduleNameMapping: {
    '^~/(.*)$': '<rootDir>/app/$1',
  },
  
  // 변환 설정
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  
  // 파일 확장자
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  
  // 커버리지 설정
  collectCoverage: true,
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/*.test.{ts,tsx}',
    '!app/**/*.spec.{ts,tsx}',
    '!app/entry.client.tsx',
    '!app/entry.server.tsx',
    '!app/root.tsx',
  ],
  
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  
  // 통합 테스트 커버리지 임계값 (단위 테스트보다 낮음)
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // 설정
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
  
  // 통합 테스트는 더 긴 타임아웃 필요
  testTimeout: 30000,
  
  // 모의 객체 설정
  clearMocks: true,
  restoreMocks: true,
  
  // 순차 실행 (리소스 충돌 방지)
  maxWorkers: 1,
  
  // 전역 변수
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  
  // 실행 환경 변수
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },
};