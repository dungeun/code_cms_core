/**
 * 테스트 유틸리티 함수들
 * 테스트 작성을 위한 헬퍼 함수와 모킹 도구
 */

import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';

// 테스트용 라우터 래퍼
interface TestRouterOptions {
  initialEntries?: string[];
  initialIndex?: number;
}

export function createTestRouter(
  routes: Array<{ path: string; element: React.ReactElement }>,
  options: TestRouterOptions = {}
) {
  return createMemoryRouter(routes, {
    initialEntries: options.initialEntries || ['/'],
    initialIndex: options.initialIndex || 0,
  });
}

// 커스텀 render 함수 (라우터 포함)
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  routes?: Array<{ path: string; element: React.ReactElement }>;
  routerOptions?: TestRouterOptions;
}

export function renderWithRouter(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) {
  const { routes, routerOptions, ...renderOptions } = options;
  
  if (routes) {
    const router = createTestRouter(routes, routerOptions);
    return {
      user: userEvent.setup(),
      ...render(<RouterProvider router={router} />, renderOptions),
    };
  }
  
  return {
    user: userEvent.setup(),
    ...render(ui, renderOptions),
  };
}

// 표준 render 함수 (userEvent 포함)
export function renderWithUser(
  ui: React.ReactElement,
  options: RenderOptions = {}
) {
  return {
    user: userEvent.setup(),
    ...render(ui, options),
  };
}

// 모킹 헬퍼
export const mockFunctions = {
  // Remix 관련 모킹
  createMockLoader: <T>(data: T) => vi.fn().mockResolvedValue(data),
  createMockAction: <T>(data: T) => vi.fn().mockResolvedValue(data),
  
  // Request 객체 모킹
  createMockRequest: (options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}) => {
    const {
      method = 'GET',
      url = 'http://localhost:3000',
      headers = {},
      body
    } = options;
    
    return new Request(url, {
      method,
      headers,
      body,
    });
  },
  
  // FormData 모킹
  createMockFormData: (data: Record<string, string>) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });
    return formData;
  },
  
  // 데이터베이스 모킹
  createMockPrisma: () => ({
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    menu: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  }),
};

// 테스트 데이터 팩토리
export const testData = {
  // 사용자 데이터
  createUser: (overrides: Partial<any> = {}) => ({
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER' as const,
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  createAdmin: (overrides: Partial<any> = {}) => ({
    id: 'admin-1',
    username: 'admin',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN' as const,
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  // 게시글 데이터
  createPost: (overrides: Partial<any> = {}) => ({
    id: 'post-1',
    title: 'Test Post',
    slug: 'test-post',
    content: 'This is a test post content.',
    excerpt: 'Test excerpt',
    menuId: 'menu-1',
    authorId: 'user-1',
    views: 0,
    likes: 0,
    isNotice: false,
    isPublished: true,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  // 메뉴 데이터
  createMenu: (overrides: Partial<any> = {}) => ({
    id: 'menu-1',
    name: 'General',
    slug: 'general',
    description: 'General discussion',
    icon: null,
    order: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  // 댓글 데이터
  createComment: (overrides: Partial<any> = {}) => ({
    id: 'comment-1',
    postId: 'post-1',
    authorId: 'user-1',
    content: 'This is a test comment.',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  // 세션 데이터
  createSession: (overrides: Partial<any> = {}) => ({
    id: 'session-1',
    userId: 'user-1',
    token: 'test-session-token',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24시간 후
    createdAt: new Date(),
    ...overrides,
  }),
};

// 비동기 테스트 헬퍼
export const asyncUtils = {
  // Promise 지연
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // 조건이 만족될 때까지 대기
  waitUntil: async (
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await asyncUtils.delay(interval);
    }
    
    throw new Error(`조건이 ${timeout}ms 내에 만족되지 않았습니다.`);
  },
  
  // 에러가 발생할 때까지 대기
  waitForError: async (fn: () => Promise<any>) => {
    try {
      await fn();
      throw new Error('예상한 에러가 발생하지 않았습니다.');
    } catch (error) {
      return error;
    }
  },
};

// 스냅샷 테스트 헬퍼
export const snapshotUtils = {
  // 날짜 필드 정규화
  normalizeDates: (obj: any): any => {
    if (obj instanceof Date) {
      return '[Date]';
    }
    if (Array.isArray(obj)) {
      return obj.map(snapshotUtils.normalizeDates);
    }
    if (typeof obj === 'object' && obj !== null) {
      const normalized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key.endsWith('At') || key.endsWith('Date')) {
          normalized[key] = '[Date]';
        } else {
          normalized[key] = snapshotUtils.normalizeDates(value);
        }
      }
      return normalized;
    }
    return obj;
  },
  
  // ID 필드 정규화
  normalizeIds: (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(snapshotUtils.normalizeIds);
    }
    if (typeof obj === 'object' && obj !== null) {
      const normalized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'id' || key.endsWith('Id')) {
          normalized[key] = '[ID]';
        } else {
          normalized[key] = snapshotUtils.normalizeIds(value);
        }
      }
      return normalized;
    }
    return obj;
  },
};