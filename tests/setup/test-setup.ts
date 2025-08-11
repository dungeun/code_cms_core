// 테스트 설정 파일

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-secret-key';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';

// 전역 모킹
global.fetch = vi.fn();

// localStorage 모킹
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

// sessionStorage 모킹
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

// matchMedia 모킹 (반응형 테스트용)
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
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

// File API 모킹
global.File = class File {
  constructor(
    public bits: BlobPart[], 
    public name: string, 
    public options?: FilePropertyBag
  ) {}
  
  get size() { return 1024; }
  get type() { return 'text/plain'; }
  get lastModified() { return Date.now(); }
};

global.FileReader = class FileReader {
  result: string | ArrayBuffer | null = null;
  readyState = FileReader.DONE;
  
  static readonly EMPTY = 0;
  static readonly LOADING = 1;
  static readonly DONE = 2;
  
  onload = vi.fn();
  onerror = vi.fn();
  onabort = vi.fn();
  
  readAsDataURL = vi.fn((file: File) => {
    this.result = `data:${file.type};base64,dGVzdA==`;
    this.onload?.(new Event('load'));
  });
  
  readAsText = vi.fn((file: File) => {
    this.result = 'test content';
    this.onload?.(new Event('load'));
  });
  
  abort = vi.fn();
};

// Crypto API 모킹
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
    getRandomValues: vi.fn((arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      generateKey: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      digest: vi.fn(),
    }
  }
});

// 타임존 설정
process.env.TZ = 'Asia/Seoul';

// 콘솔 에러/경고 필터링 (노이즈 제거)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  // 특정 에러 메시지는 무시 (테스트에서 예상되는 에러들)
  const message = args[0]?.toString() || '';
  if (
    message.includes('Warning: ReactDOM.render is deprecated') ||
    message.includes('Warning: Failed prop type') ||
    message.includes('Not implemented: HTMLCanvasElement.prototype.getContext')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
  const message = args[0]?.toString() || '';
  if (
    message.includes('componentWillMount') ||
    message.includes('componentWillReceiveProps')
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// 전역 에러 핸들러
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 메모리 정리 헬퍼
global.gc && global.gc();