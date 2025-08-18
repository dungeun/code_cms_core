/**
 * Jest 설정 (단위 테스트)
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/app', '<rootDir>/tests'],
  
  // 테스트 파일 패턴
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/app/**/*.test.ts',
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
  
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  
  // 커버리지 임계값
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  // 설정
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // 테스트 타임아웃
  testTimeout: 10000,
  
  // 모의 객체 설정
  clearMocks: true,
  restoreMocks: true,
  
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