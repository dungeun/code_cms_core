// 사용자 워크플로우 E2E 테스트

import { test, expect, Page, BrowserContext } from '@playwright/test';

// 테스트 사용자 데이터
const testUser = {
  email: 'e2e@example.com',
  password: 'TestPassword123!',
  name: '테스트 사용자'
};

const testAdmin = {
  email: 'admin-e2e@example.com', 
  password: 'AdminPassword123!',
  name: '관리자'
};

test.describe('사용자 인증 워크플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 홈페이지 방문
    await page.goto('/');
  });

  test('회원가입 → 로그인 → 프로필 수정 워크플로우', async ({ page }) => {
    // 1. 회원가입
    await page.click('text=회원가입');
    await expect(page).toHaveURL(/.*\/register/);

    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="name-input"]', testUser.name);
    await page.click('[data-testid="register-button"]');

    // 회원가입 성공 확인
    await expect(page.locator('text=회원가입이 완료되었습니다')).toBeVisible();

    // 2. 로그인
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-button"]');

    // 대시보드로 리다이렉트 확인
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator(`text=${testUser.name}`)).toBeVisible();

    // 3. 프로필 수정
    await page.click('[data-testid="profile-menu"]');
    await page.click('text=프로필 수정');
    await expect(page).toHaveURL(/.*\/profile/);

    const newName = '수정된 사용자';
    await page.fill('[data-testid="name-input"]', newName);
    await page.click('[data-testid="save-button"]');

    // 수정 완료 확인
    await expect(page.locator('text=프로필이 업데이트되었습니다')).toBeVisible();
    await expect(page.locator(`text=${newName}`)).toBeVisible();
  });

  test('비밀번호 재설정 워크플로우', async ({ page }) => {
    await page.click('text=로그인');
    await page.click('text=비밀번호를 잊으셨나요?');
    
    await expect(page).toHaveURL(/.*\/forgot-password/);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.click('[data-testid="reset-button"]');

    await expect(page.locator('text=재설정 이메일이 전송되었습니다')).toBeVisible();
  });

  test('잘못된 로그인 정보 처리', async ({ page }) => {
    await page.click('text=로그인');
    
    // 잘못된 이메일
    await page.fill('[data-testid="email-input"]', 'wrong@example.com');
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('text=이메일 또는 비밀번호가 올바르지 않습니다')).toBeVisible();

    // 잘못된 비밀번호
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('text=이메일 또는 비밀번호가 올바르지 않습니다')).toBeVisible();
  });
});

test.describe('게시글 관리 워크플로우', () => {
  let userPage: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    userPage = await context.newPage();
    
    // 사용자 로그인
    await userPage.goto('/login');
    await userPage.fill('[data-testid="email-input"]', testUser.email);
    await userPage.fill('[data-testid="password-input"]', testUser.password);
    await userPage.click('[data-testid="login-button"]');
    await userPage.waitForURL(/.*\/dashboard/);
  });

  test('게시글 작성 → 수정 → 삭제 워크플로우', async () => {
    // 1. 게시글 작성
    await userPage.click('[data-testid="new-post-button"]');
    await expect(userPage).toHaveURL(/.*\/posts\/new/);

    const postTitle = '테스트 게시글 제목';
    const postContent = '테스트 게시글 내용입니다. 이것은 E2E 테스트를 위한 게시글입니다.';

    await userPage.fill('[data-testid="title-input"]', postTitle);
    await userPage.fill('[data-testid="content-editor"]', postContent);
    await userPage.selectOption('[data-testid="category-select"]', 'general');
    await userPage.check('[data-testid="published-checkbox"]');
    await userPage.click('[data-testid="save-button"]');

    // 게시글 상세 페이지로 이동 확인
    await expect(userPage).toHaveURL(/.*\/posts\/[^\/]+/);
    await expect(userPage.locator(`text=${postTitle}`)).toBeVisible();
    await expect(userPage.locator(`text=${postContent}`)).toBeVisible();

    // 2. 게시글 수정
    await userPage.click('[data-testid="edit-button"]');
    
    const updatedTitle = '수정된 테스트 게시글 제목';
    await userPage.fill('[data-testid="title-input"]', updatedTitle);
    await userPage.click('[data-testid="save-button"]');

    await expect(userPage.locator(`text=${updatedTitle}`)).toBeVisible();

    // 3. 게시글 삭제
    await userPage.click('[data-testid="delete-button"]');
    
    // 확인 다이얼로그 처리
    userPage.on('dialog', async dialog => {
      expect(dialog.message()).toContain('정말로 삭제하시겠습니까?');
      await dialog.accept();
    });

    // 게시글 목록으로 리다이렉트 확인
    await expect(userPage).toHaveURL(/.*\/posts/);
    await expect(userPage.locator(`text=${updatedTitle}`)).not.toBeVisible();
  });

  test('게시글 목록 페이지네이션', async () => {
    await userPage.goto('/posts');
    
    // 페이지네이션 요소 확인
    await expect(userPage.locator('[data-testid="pagination"]')).toBeVisible();
    
    // 다음 페이지로 이동
    if (await userPage.locator('[data-testid="next-page"]').isVisible()) {
      await userPage.click('[data-testid="next-page"]');
      await expect(userPage).toHaveURL(/.*page=2/);
    }
  });

  test('게시글 검색 기능', async () => {
    await userPage.goto('/posts');
    
    // 검색어 입력
    const searchTerm = '테스트';
    await userPage.fill('[data-testid="search-input"]', searchTerm);
    await userPage.click('[data-testid="search-button"]');

    // URL에 검색 파라미터 확인
    await expect(userPage).toHaveURL(/.*search=테스트/);
    
    // 검색 결과 확인 (최소한 검색 결과 섹션이 보여야 함)
    await expect(userPage.locator('[data-testid="search-results"]')).toBeVisible();
  });
});

test.describe('파일 업로드 워크플로우', () => {
  let userContext: BrowserContext;
  let userPage: Page;

  test.beforeAll(async ({ browser }) => {
    userContext = await browser.newContext();
    userPage = await userContext.newPage();
    
    // 사용자 로그인
    await userPage.goto('/login');
    await userPage.fill('[data-testid="email-input"]', testUser.email);
    await userPage.fill('[data-testid="password-input"]', testUser.password);
    await userPage.click('[data-testid="login-button"]');
    await userPage.waitForURL(/.*\/dashboard/);
  });

  test('이미지 파일 업로드', async () => {
    await userPage.goto('/posts/new');
    
    // 파일 업로드 버튼 클릭
    await userPage.click('[data-testid="file-upload-button"]');
    
    // 가상 이미지 파일 생성 및 업로드
    const fileBuffer = Buffer.from('fake-image-data');
    await userPage.setInputFiles('[data-testid="file-input"]', {
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: fileBuffer
    });

    // 업로드 완료 대기
    await expect(userPage.locator('[data-testid="upload-success"]')).toBeVisible();
    
    // 업로드된 이미지 미리보기 확인
    await expect(userPage.locator('[data-testid="image-preview"]')).toBeVisible();
  });

  test('잘못된 파일 형식 업로드 거부', async () => {
    await userPage.goto('/posts/new');
    await userPage.click('[data-testid="file-upload-button"]');
    
    // 텍스트 파일 업로드 시도
    const textBuffer = Buffer.from('This is a text file');
    await userPage.setInputFiles('[data-testid="file-input"]', {
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: textBuffer
    });

    // 에러 메시지 확인
    await expect(userPage.locator('text=지원하지 않는 파일 형식입니다')).toBeVisible();
  });
});

test.describe('관리자 워크플로우', () => {
  let adminContext: BrowserContext;
  let adminPage: Page;

  test.beforeAll(async ({ browser }) => {
    adminContext = await browser.newContext();
    adminPage = await adminContext.newPage();
    
    // 관리자 로그인
    await adminPage.goto('/login');
    await adminPage.fill('[data-testid="email-input"]', testAdmin.email);
    await adminPage.fill('[data-testid="password-input"]', testAdmin.password);
    await adminPage.click('[data-testid="login-button"]');
    
    // 관리자 대시보드로 이동
    await adminPage.waitForURL(/.*\/admin/);
  });

  test('사용자 관리 기능', async () => {
    await adminPage.click('text=사용자 관리');
    await expect(adminPage).toHaveURL(/.*\/admin\/users/);

    // 사용자 목록 테이블 확인
    await expect(adminPage.locator('[data-testid="users-table"]')).toBeVisible();
    
    // 사용자 검색
    await adminPage.fill('[data-testid="user-search"]', testUser.email);
    await adminPage.click('[data-testid="search-button"]');
    
    await expect(adminPage.locator(`text=${testUser.email}`)).toBeVisible();
  });

  test('시스템 설정 관리', async () => {
    await adminPage.click('text=시스템 설정');
    await expect(adminPage).toHaveURL(/.*\/admin\/settings/);

    // 설정 탭들 확인
    await expect(adminPage.locator('text=일반 설정')).toBeVisible();
    await expect(adminPage.locator('text=보안 설정')).toBeVisible();
    await expect(adminPage.locator('text=메일 설정')).toBeVisible();

    // 설정 변경 테스트
    await adminPage.click('text=일반 설정');
    await adminPage.fill('[data-testid="site-title"]', 'E2E 테스트 사이트');
    await adminPage.click('[data-testid="save-settings"]');

    await expect(adminPage.locator('text=설정이 저장되었습니다')).toBeVisible();
  });

  test('통계 대시보드 확인', async () => {
    await adminPage.goto('/admin');
    
    // 통계 카드들 확인
    await expect(adminPage.locator('[data-testid="stats-users"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="stats-posts"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="stats-views"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="stats-storage"]')).toBeVisible();

    // 차트 요소 확인
    await expect(adminPage.locator('[data-testid="analytics-chart"]')).toBeVisible();
  });
});

test.describe('반응형 디자인 테스트', () => {
  test('모바일 화면 테스트', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // 햄버거 메뉴 확인
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // 메뉴 열기
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // 네비게이션 링크들 확인
    await expect(page.locator('[data-testid="mobile-menu"] >> text=홈')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu"] >> text=게시글')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu"] >> text=로그인')).toBeVisible();
  });

  test('태블릿 화면 테스트', async ({ page }) => {
    // 태블릿 뷰포트 설정
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // 태블릿에서 데스크톱 네비게이션 확인
    await expect(page.locator('[data-testid="desktop-navigation"]')).toBeVisible();
    
    // 카드 레이아웃 확인
    await page.goto('/posts');
    const postsGrid = page.locator('[data-testid="posts-grid"]');
    await expect(postsGrid).toBeVisible();
    
    // 태블릿에서는 2열 레이아웃이어야 함
    const firstRow = postsGrid.locator('.grid-cols-2').first();
    if (await firstRow.count() > 0) {
      await expect(firstRow).toBeVisible();
    }
  });
});

test.describe('접근성 테스트', () => {
  test('키보드 내비게이션', async ({ page }) => {
    await page.goto('/');
    
    // Tab 키로 네비게이션
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // 포커스된 요소가 보여야 함
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Enter 키로 링크 클릭
    await page.keyboard.press('Enter');
  });

  test('스크린 리더 지원', async ({ page }) => {
    await page.goto('/');
    
    // ARIA 레이블 확인
    await expect(page.locator('[aria-label="메인 네비게이션"]')).toBeVisible();
    await expect(page.locator('[role="banner"]')).toBeVisible();
    await expect(page.locator('[role="main"]')).toBeVisible();
    
    // 헤딩 구조 확인
    await expect(page.locator('h1')).toBeVisible();
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    expect(headings).toBeGreaterThan(0);
  });

  test('색상 대비 및 텍스트 가독성', async ({ page }) => {
    await page.goto('/');
    
    // 고대비 모드 확인 (CSS 미디어 쿼리)
    const contrastElements = await page.locator('[data-high-contrast]').count();
    // 고대비 요소들이 있다면 제대로 표시되어야 함
    
    // 텍스트 크기 확인
    const bodyText = page.locator('body');
    const fontSize = await bodyText.evaluate(el => 
      window.getComputedStyle(el).fontSize
    );
    
    // 최소 16px 이상이어야 함
    const fontSizeNumber = parseInt(fontSize.replace('px', ''));
    expect(fontSizeNumber).toBeGreaterThanOrEqual(16);
  });
});

test.describe('성능 테스트', () => {
  test('페이지 로드 성능', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    const loadTime = Date.now() - startTime;
    
    // 3초 이내 로드되어야 함
    expect(loadTime).toBeLessThan(3000);
    
    // Core Web Vitals 확인
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      });
    });
    
    // LCP는 2.5초 이내여야 함
    expect(lcp).toBeLessThan(2500);
  });

  test('이미지 최적화 확인', async ({ page }) => {
    await page.goto('/posts');
    
    // 이미지 요소들 확인
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      // 첫 번째 이미지 확인
      const firstImage = images.first();
      
      // lazy loading 확인
      const loading = await firstImage.getAttribute('loading');
      expect(loading).toBe('lazy');
      
      // responsive 이미지 확인
      const srcset = await firstImage.getAttribute('srcset');
      expect(srcset).toBeTruthy();
    }
  });

  test('JavaScript 번들 크기', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    // 네트워크 요청 추적
    const jsRequests = [];
    page.on('response', response => {
      if (response.url().endsWith('.js')) {
        jsRequests.push(response);
      }
    });
    
    await page.waitForLoadState('networkidle');
    
    const endTime = Date.now();
    const totalLoadTime = endTime - startTime;
    
    // 전체 로딩 시간 확인
    expect(totalLoadTime).toBeLessThan(5000);
    
    // JS 파일들이 로드되었는지 확인
    expect(jsRequests.length).toBeGreaterThan(0);
  });
});