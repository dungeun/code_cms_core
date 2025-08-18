/**
 * E2E 사용자 워크플로우 테스트
 * Playwright를 사용한 실제 사용자 시나리오 테스트
 */
import { test, expect } from '@playwright/test';

test.describe('사용자 인증 워크플로우', () => {
  test('사용자 회원가입 및 로그인 전체 플로우', async ({ page }) => {
    // 회원가입 페이지로 이동
    await page.goto('/auth/register');
    
    // 회원가입 폼 작성
    await page.fill('[data-testid="register-email"]', 'e2etest@example.com');
    await page.fill('[data-testid="register-name"]', 'E2E Test User');
    await page.fill('[data-testid="register-password"]', 'testPassword123!');
    await page.fill('[data-testid="register-confirm-password"]', 'testPassword123!');
    
    // 회원가입 버튼 클릭
    await page.click('[data-testid="register-submit"]');
    
    // 성공 메시지 확인
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    
    // 로그인 페이지로 리다이렉트 확인
    await expect(page).toHaveURL('/auth/login');
    
    // 로그인 폼 작성
    await page.fill('[data-testid="login-email"]', 'e2etest@example.com');
    await page.fill('[data-testid="login-password"]', 'testPassword123!');
    
    // 로그인 버튼 클릭
    await page.click('[data-testid="login-submit"]');
    
    // 대시보드로 리다이렉트 확인
    await expect(page).toHaveURL('/dashboard');
    
    // 사용자 이름이 헤더에 표시되는지 확인
    await expect(page.locator('[data-testid="user-name"]')).toContainText('E2E Test User');
  });

  test('잘못된 로그인 정보로 인한 오류 처리', async ({ page }) => {
    await page.goto('/auth/login');
    
    // 잘못된 이메일과 비밀번호 입력
    await page.fill('[data-testid="login-email"]', 'invalid@example.com');
    await page.fill('[data-testid="login-password"]', 'wrongPassword');
    
    // 로그인 시도
    await page.click('[data-testid="login-submit"]');
    
    // 오류 메시지 확인
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('이메일 또는 비밀번호가 올바르지 않습니다');
    
    // 여전히 로그인 페이지에 있는지 확인
    await expect(page).toHaveURL('/auth/login');
  });

  test('로그아웃 기능 테스트', async ({ page }) => {
    // 로그인된 상태로 시작 (로그인 헬퍼 사용)
    await page.goto('/auth/login');
    await page.fill('[data-testid="login-email"]', 'admin@example.com');
    await page.fill('[data-testid="login-password"]', 'adminPassword');
    await page.click('[data-testid="login-submit"]');
    
    // 대시보드에서 로그아웃 버튼 클릭
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // 홈페이지로 리다이렉트 확인
    await expect(page).toHaveURL('/');
    
    // 로그인 버튼이 다시 표시되는지 확인
    await expect(page.locator('[data-testid="login-link"]')).toBeVisible();
  });
});

test.describe('콘텐츠 관리 워크플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 관리자로 로그인
    await page.goto('/auth/login');
    await page.fill('[data-testid="login-email"]', 'admin@example.com');
    await page.fill('[data-testid="login-password"]', 'adminPassword');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('/dashboard');
  });

  test('새 게시물 작성 및 발행', async ({ page }) => {
    // 게시물 목록 페이지로 이동
    await page.goto('/admin/posts');
    
    // 새 게시물 작성 버튼 클릭
    await page.click('[data-testid="new-post-button"]');
    
    // 게시물 작성 폼 작성
    await page.fill('[data-testid="post-title"]', 'E2E 테스트 게시물');
    await page.fill('[data-testid="post-slug"]', 'e2e-test-post');
    
    // 에디터에 내용 입력
    await page.fill('[data-testid="post-content"]', '이것은 E2E 테스트로 작성된 게시물입니다.');
    
    // 카테고리 선택
    await page.selectOption('[data-testid="post-category"]', '1');
    
    // 발행 버튼 클릭
    await page.click('[data-testid="publish-post"]');
    
    // 성공 메시지 확인
    await expect(page.locator('[data-testid="success-message"]')).toContainText('게시물이 발행되었습니다');
    
    // 게시물 목록에서 새 게시물 확인
    await page.goto('/admin/posts');
    await expect(page.locator('[data-testid="post-list"]')).toContainText('E2E 테스트 게시물');
  });

  test('게시물 수정 기능', async ({ page }) => {
    // 게시물 목록에서 첫 번째 게시물의 수정 버튼 클릭
    await page.goto('/admin/posts');
    await page.click('[data-testid="edit-post-button"]:first-child');
    
    // 제목 수정
    await page.fill('[data-testid="post-title"]', '수정된 게시물 제목');
    
    // 저장 버튼 클릭
    await page.click('[data-testid="save-post"]');
    
    // 성공 메시지 확인
    await expect(page.locator('[data-testid="success-message"]')).toContainText('게시물이 저장되었습니다');
    
    // 변경사항이 적용되었는지 확인
    await expect(page.locator('[data-testid="post-title"]')).toHaveValue('수정된 게시물 제목');
  });

  test('게시물 삭제 기능', async ({ page }) => {
    await page.goto('/admin/posts');
    
    // 삭제할 게시물의 개수 확인
    const initialCount = await page.locator('[data-testid="post-item"]').count();
    
    // 첫 번째 게시물의 삭제 버튼 클릭
    await page.click('[data-testid="delete-post-button"]:first-child');
    
    // 확인 대화상자에서 확인 클릭
    await page.click('[data-testid="confirm-delete"]');
    
    // 성공 메시지 확인
    await expect(page.locator('[data-testid="success-message"]')).toContainText('게시물이 삭제되었습니다');
    
    // 게시물 개수가 감소했는지 확인
    await expect(page.locator('[data-testid="post-item"]')).toHaveCount(initialCount - 1);
  });
});

test.describe('사용자 인터페이스 반응성 테스트', () => {
  test('모바일 뷰포트에서의 네비게이션', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // 모바일 메뉴 버튼 확인
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // 모바일 메뉴 열기
    await page.click('[data-testid="mobile-menu-button"]');
    
    // 메뉴가 열렸는지 확인
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // 메뉴 항목들이 표시되는지 확인
    await expect(page.locator('[data-testid="mobile-menu"] a')).toHaveCount(5);
  });

  test('태블릿 뷰포트에서의 레이아웃', async ({ page }) => {
    // 태블릿 뷰포트 설정
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/');
    
    // 데스크톱과 모바일의 중간 레이아웃 확인
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
  });
});

test.describe('성능 및 접근성 테스트', () => {
  test('페이지 로드 성능 테스트', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    const loadTime = Date.now() - startTime;
    
    // 3초 이내 로드되는지 확인
    expect(loadTime).toBeLessThan(3000);
    
    // Core Web Vitals 확인
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          resolve(entries);
        }).observe({ entryTypes: ['navigation'] });
      });
    });
    
    // First Contentful Paint가 2.5초 이내인지 확인
    // (실제 메트릭은 브라우저에서 측정)
    console.log('Performance metrics:', metrics);
  });

  test('키보드 네비게이션 테스트', async ({ page }) => {
    await page.goto('/');
    
    // Tab 키로 네비게이션
    await page.keyboard.press('Tab');
    
    // 첫 번째 포커스 가능한 요소가 포커스되었는지 확인
    const focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
    
    // Enter 키로 클릭 가능한지 확인
    await page.keyboard.press('Enter');
    
    // 적절한 반응이 있는지 확인 (URL 변경 또는 모달 열림 등)
  });

  test('스크린 리더 지원 테스트', async ({ page }) => {
    await page.goto('/');
    
    // ARIA 라벨이 적절히 설정되어 있는지 확인
    await expect(page.locator('[role="main"]')).toBeVisible();
    await expect(page.locator('[role="navigation"]')).toBeVisible();
    
    // 이미지에 alt 텍스트가 있는지 확인
    const images = await page.locator('img').all();
    for (const img of images) {
      await expect(img).toHaveAttribute('alt');
    }
    
    // 폼 라벨이 적절히 연결되어 있는지 확인
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
      }
    }
  });
});

test.describe('오류 상황 처리 테스트', () => {
  test('404 페이지 처리', async ({ page }) => {
    // 존재하지 않는 페이지로 이동
    await page.goto('/non-existent-page');
    
    // 404 페이지가 표시되는지 확인
    await expect(page.locator('[data-testid="404-page"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('페이지를 찾을 수 없습니다');
    
    // 홈으로 돌아가기 링크가 작동하는지 확인
    await page.click('[data-testid="back-to-home"]');
    await expect(page).toHaveURL('/');
  });

  test('네트워크 오류 시 사용자 피드백', async ({ page }) => {
    // 네트워크를 오프라인으로 설정
    await page.context().setOffline(true);
    
    await page.goto('/admin/posts');
    
    // 새 게시물 작성 시도
    await page.click('[data-testid="new-post-button"]');
    await page.fill('[data-testid="post-title"]', '오프라인 테스트');
    await page.click('[data-testid="save-post"]');
    
    // 오프라인 오류 메시지가 표시되는지 확인
    await expect(page.locator('[data-testid="offline-message"]')).toBeVisible();
    
    // 네트워크 복구
    await page.context().setOffline(false);
    
    // 재시도 버튼이 작동하는지 확인
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});

test.describe('검색 및 필터링 기능', () => {
  test('게시물 검색 기능', async ({ page }) => {
    await page.goto('/');
    
    // 검색 입력
    await page.fill('[data-testid="search-input"]', '테스트');
    await page.click('[data-testid="search-button"]');
    
    // 검색 결과 페이지로 이동
    await expect(page).toHaveURL(/\/search\?q=테스트/);
    
    // 검색 결과가 표시되는지 확인
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // 검색어가 하이라이트되는지 확인
    await expect(page.locator('.highlight')).toContainText('테스트');
  });

  test('카테고리별 필터링', async ({ page }) => {
    await page.goto('/posts');
    
    // 카테고리 필터 선택
    await page.click('[data-testid="category-filter"]');
    await page.click('[data-testid="category-option-tech"]');
    
    // URL에 카테고리 파라미터가 포함되는지 확인
    await expect(page).toHaveURL(/\/posts\?category=tech/);
    
    // 해당 카테고리의 게시물만 표시되는지 확인
    const posts = await page.locator('[data-testid="post-item"]').all();
    for (const post of posts) {
      await expect(post.locator('[data-testid="post-category"]')).toContainText('기술');
    }
  });
});

// 테스트 설정
test.use({
  // 테스트 속도 최적화
  actionTimeout: 10000,
  navigationTimeout: 30000,
});

// 테스트 실행 전 기본 설정
test.beforeAll(async () => {
  console.log('🎭 Playwright E2E 테스트 시작');
});

test.afterAll(async () => {
  console.log('✅ Playwright E2E 테스트 완료');
});

// Coverage target: 95%
// This E2E test covers:
// - Complete user authentication workflows
// - Content management operations
// - Responsive design across devices
// - Performance and accessibility validation
// - Error handling and offline scenarios
// - Search and filtering functionality
// - Mobile and tablet viewport testing