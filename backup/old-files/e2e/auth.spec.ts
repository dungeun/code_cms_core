/**
 * 인증 시스템 E2E 테스트
 * 로그인, 로그아웃, 회원가입 플로우 테스트
 */

import { test, expect } from '@playwright/test';

// 테스트 계정 정보
const testUsers = {
  admin: {
    email: 'admin@example.com',
    password: 'SecureAdminPassword123!@#',
    name: 'Admin User',
  },
  user: {
    email: 'user@example.com', 
    password: 'SecureUserPassword123',
    name: 'Regular User',
  },
  newUser: {
    username: 'newuser',
    email: 'newuser@example.com',
    password: 'NewUserPassword123',
    name: 'New User',
  }
};

test.describe('인증 시스템', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 홈페이지로 이동
    await page.goto('/');
  });

  test.describe('로그인', () => {
    test('관리자 로그인이 성공적으로 작동한다', async ({ page }) => {
      // 로그인 페이지로 이동
      await page.click('text=로그인');
      await expect(page).toHaveURL('/auth/login');
      
      // 로그인 폼 확인
      await expect(page.locator('h1')).toContainText('로그인');
      
      // 관리자 테스트 계정으로 로그인
      await page.fill('#emailOrUsername', testUsers.admin.email);
      await page.fill('#password', testUsers.admin.password);
      await page.click('button[type="submit"]');
      
      // 로그인 후 리다이렉션 확인
      await expect(page).toHaveURL('/');
      
      // 로그인 상태 확인 (사용자 메뉴 또는 로그아웃 버튼 존재)
      await expect(page.locator('text=로그아웃')).toBeVisible();
    });

    test('일반 사용자 로그인이 성공적으로 작동한다', async ({ page }) => {
      await page.goto('/auth/login');
      
      await page.fill('#emailOrUsername', testUsers.user.email);
      await page.fill('#password', testUsers.user.password);
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL('/');
      await expect(page.locator('text=로그아웃')).toBeVisible();
    });

    test('테스트 계정 버튼으로 빠른 로그인한다', async ({ page }) => {
      await page.goto('/auth/login');
      
      // 관리자 테스트 계정 버튼 클릭
      await page.click('text=관리자');
      
      // 로그인 성공 확인
      await expect(page).toHaveURL('/');
      await expect(page.locator('text=로그아웃')).toBeVisible();
    });

    test('잘못된 크리덴셜로 로그인 실패한다', async ({ page }) => {
      await page.goto('/auth/login');
      
      await page.fill('#emailOrUsername', 'wrong@example.com');
      await page.fill('#password', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      // 에러 메시지 확인
      await expect(page.locator('.text-destructive')).toBeVisible();
      
      // 로그인 페이지에 남아있는지 확인
      await expect(page).toHaveURL('/auth/login');
    });

    test('빈 필드로 로그인 실패한다', async ({ page }) => {
      await page.goto('/auth/login');
      
      await page.click('button[type="submit"]');
      
      // HTML5 validation 메시지 확인
      const emailInput = page.locator('#emailOrUsername');
      await expect(emailInput).toHaveAttribute('required');
      
      const passwordInput = page.locator('#password');
      await expect(passwordInput).toHaveAttribute('required');
    });

    test('로그인 상태 유지 옵션이 작동한다', async ({ page }) => {
      await page.goto('/auth/login');
      
      // "로그인 상태 유지" 체크박스 선택
      await page.check('#remember');
      
      await page.fill('#emailOrUsername', testUsers.user.email);
      await page.fill('#password', testUsers.user.password);
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL('/');
      
      // 쿠키 확인 (30일 만료)
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'blee_session');
      expect(sessionCookie).toBeTruthy();
      
      // 30일 후 만료 시간인지 확인 (대략적으로)
      const thirtyDaysFromNow = Date.now() + (30 * 24 * 60 * 60 * 1000);
      expect(sessionCookie!.expires * 1000).toBeGreaterThan(Date.now() + (29 * 24 * 60 * 60 * 1000));
    });
  });

  test.describe('로그아웃', () => {
    test.beforeEach(async ({ page }) => {
      // 각 테스트 전에 로그인
      await page.goto('/auth/login');
      await page.fill('#emailOrUsername', testUsers.user.email);
      await page.fill('#password', testUsers.user.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/');
    });

    test('로그아웃이 성공적으로 작동한다', async ({ page }) => {
      // 로그아웃 버튼 클릭
      await page.click('text=로그아웃');
      
      // 홈페이지로 리다이렉션 확인
      await expect(page).toHaveURL('/');
      
      // 로그인 버튼이 다시 표시되는지 확인
      await expect(page.locator('text=로그인')).toBeVisible();
      
      // 세션 쿠키가 삭제되었는지 확인
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'blee_session');
      expect(sessionCookie?.value || '').toBe('');
    });

    test('로그아웃 후 보호된 페이지 접근 시 로그인 페이지로 리다이렉션된다', async ({ page }) => {
      await page.click('text=로그아웃');
      
      // 관리자 페이지 접근 시도
      await page.goto('/admin');
      
      // 로그인 페이지로 리다이렉션 확인
      await expect(page).toHaveURL(/\/auth\/login/);
      
      // 리다이렉트 파라미터 확인
      const url = new URL(page.url());
      expect(url.searchParams.get('redirectTo')).toBe('/admin');
    });
  });

  test.describe('회원가입', () => {
    test('새로운 사용자 회원가입이 성공적으로 작동한다', async ({ page }) => {
      await page.goto('/auth/register');
      
      // 회원가입 폼 확인
      await expect(page.locator('h1')).toContainText('회원가입');
      
      // 폼 작성
      await page.fill('#username', testUsers.newUser.username);
      await page.fill('#email', testUsers.newUser.email);
      await page.fill('#password', testUsers.newUser.password);
      await page.fill('#name', testUsers.newUser.name);
      
      await page.click('button[type="submit"]');
      
      // 회원가입 후 로그인 페이지로 리다이렉션
      await expect(page).toHaveURL('/auth/login');
      
      // 성공 메시지 확인 (있다면)
      const successMessage = page.locator('.text-green-600');
      if (await successMessage.isVisible()) {
        await expect(successMessage).toContainText('회원가입');
      }
    });

    test('중복된 이메일로 회원가입 실패한다', async ({ page }) => {
      await page.goto('/auth/register');
      
      // 이미 존재하는 이메일로 회원가입 시도
      await page.fill('#username', 'duplicateuser');
      await page.fill('#email', testUsers.user.email); // 중복 이메일
      await page.fill('#password', 'Password123');
      await page.fill('#name', 'Duplicate User');
      
      await page.click('button[type="submit"]');
      
      // 에러 메시지 확인
      await expect(page.locator('.text-destructive')).toContainText('이미');
    });

    test('약한 비밀번호로 회원가입 실패한다', async ({ page }) => {
      await page.goto('/auth/register');
      
      await page.fill('#username', 'weakuser');
      await page.fill('#email', 'weak@example.com');
      await page.fill('#password', '123'); // 약한 비밀번호
      await page.fill('#name', 'Weak User');
      
      await page.click('button[type="submit"]');
      
      // 클라이언트 사이드 validation 또는 서버 에러 확인
      const errorMessage = page.locator('.text-destructive');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText('비밀번호');
      } else {
        // HTML5 validation
        const passwordInput = page.locator('#password');
        expect(await passwordInput.getAttribute('minlength')).toBeTruthy();
      }
    });

    test('로그인 페이지로의 링크가 작동한다', async ({ page }) => {
      await page.goto('/auth/register');
      
      await page.click('text=로그인');
      
      await expect(page).toHaveURL('/auth/login');
    });
  });

  test.describe('비밀번호 재설정', () => {
    test('비밀번호 재설정 페이지가 표시된다', async ({ page }) => {
      await page.goto('/auth/login');
      await page.click('text=비밀번호를 잊으셨나요?');
      
      await expect(page).toHaveURL('/auth/forgot-password');
      await expect(page.locator('h1')).toContainText('비밀번호 재설정');
    });

    test('이메일 입력 폼이 작동한다', async ({ page }) => {
      await page.goto('/auth/forgot-password');
      
      await page.fill('#email', testUsers.user.email);
      await page.click('button[type="submit"]');
      
      // 성공 메시지 확인 (실제로는 이메일이 발송되지 않더라도 보안상 성공 메시지 표시)
      await expect(page.locator('text=이메일을 확인')).toBeVisible();
    });

    test('존재하지 않는 이메일도 성공 메시지를 표시한다', async ({ page }) => {
      await page.goto('/auth/forgot-password');
      
      await page.fill('#email', 'nonexistent@example.com');
      await page.click('button[type="submit"]');
      
      // 보안상 동일한 메시지 표시
      await expect(page.locator('text=이메일을 확인')).toBeVisible();
    });
  });

  test.describe('접근성', () => {
    test('로그인 폼이 접근성 요구사항을 만족한다', async ({ page }) => {
      await page.goto('/auth/login');
      
      // 폼 레이블과 입력 필드 연결 확인
      const emailInput = page.locator('#emailOrUsername');
      await expect(emailInput).toHaveAttribute('aria-describedby');
      
      const passwordInput = page.locator('#password');
      await expect(passwordInput).toHaveAttribute('aria-describedby');
      
      // 자동완성 속성 확인
      await expect(emailInput).toHaveAttribute('autocomplete', 'username');
      await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });

    test('키보드 네비게이션이 작동한다', async ({ page }) => {
      await page.goto('/auth/login');
      
      // Tab 키로 폼 필드 간 이동
      await page.keyboard.press('Tab');
      await expect(page.locator('#emailOrUsername')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('#password')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('#remember')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('button[type="submit"]')).toBeFocused();
    });
  });
  
  test.describe('반응형 디자인', () => {
    test('모바일에서 로그인 폼이 올바르게 표시된다', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      await page.goto('/auth/login');
      
      // 폼이 화면에 맞게 조정되는지 확인
      const form = page.locator('form');
      const boundingBox = await form.boundingBox();
      expect(boundingBox!.width).toBeLessThanOrEqual(375);
      
      // 테스트 계정 버튼이 2열로 배치되는지 확인
      await expect(page.locator('.grid-cols-2')).toBeVisible();
    });
    
    test('태블릿에서 레이아웃이 적절하다', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      await page.goto('/auth/login');
      
      const container = page.locator('.max-w-md');
      await expect(container).toBeVisible();
    });
  });
});