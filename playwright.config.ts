import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 테스트 설정
 * 크로스 브라우저 테스트 및 시각적 회귀 테스트
 */

export default defineConfig({
  testDir: './tests/e2e',
  
  // 병렬 실행 설정
  fullyParallel: true,
  
  // CI에서만 실패 시 재시도
  retries: process.env.CI ? 2 : 0,
  
  // 워커 수 설정
  workers: process.env.CI ? 1 : undefined,
  
  // 리포터 설정
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report.json' }],
    ['junit', { outputFile: 'playwright-results.xml' }]
  ],
  
  // 전역 설정
  use: {
    // 액션 전 대기 시간
    actionTimeout: 30000,
    
    // 브라우저 컨텍스트 설정
    baseURL: 'http://127.0.0.1:3000',
    
    // 실패 시 스크린샷
    screenshot: 'only-on-failure',
    
    // 실패 시 비디오 녹화
    video: 'retain-on-failure',
    
    // 추적 정보 수집
    trace: 'retain-on-failure',
    
    // 기본 뷰포트
    viewport: { width: 1280, height: 720 },
  },
  
  // 테스트 실행 전 서버 시작
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  
  // 테스트 프로젝트 (브라우저별)
  projects: [
    // 데스크톱 브라우저
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // 모바일 브라우저
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    
    // 태블릿
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },
    
    // 접근성 테스트 (고대비 모드)
    {
      name: 'high-contrast',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        extraHTTPHeaders: {
          'prefers-reduced-motion': 'reduce',
        },
      },
    },
  ],
  
  // 테스트 매치 패턴
  testMatch: [
    'tests/e2e/**/*.{test,spec}.{js,ts}',
  ],
  
  // 테스트 출력 디렉토리
  outputDir: 'e2e-results/',
  
  // 전역 설정
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  
  // 타임아웃 설정
  timeout: 60000, // 60초
  expect: {
    timeout: 10000, // 10초
    // 시각적 비교 임계값
    threshold: 0.2,
  },
});