/**
 * 종합적인 입력 검증 스키마
 * Zod를 사용한 타입 안전 검증
 */
import { z } from 'zod';

// 기본 보안 정규식
const SAFE_TEXT_REGEX = /^[a-zA-Z0-9가-힣\s\-_.@()[\]{}:;,'"!?]*$/;
const USERNAME_REGEX = /^[a-zA-Z0-9가-힣_-]{3,20}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_REGEX = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/;

// 사용자 관련 검증
export const userSchemas = {
  register: z.object({
    username: z.string()
      .min(3, '사용자명은 최소 3자 이상이어야 합니다.')
      .max(20, '사용자명은 최대 20자까지 입력 가능합니다.')
      .regex(USERNAME_REGEX, '사용자명은 영문, 한글, 숫자, 하이픈, 언더스코어만 사용 가능합니다.'),
    
    email: z.string()
      .email('올바른 이메일 형식을 입력해주세요.')
      .max(254, '이메일이 너무 깁니다.')
      .toLowerCase()
      .transform(email => email.trim()),
    
    password: z.string()
      .min(12, '비밀번호는 최소 12자 이상이어야 합니다.')
      .max(128, '비밀번호가 너무 깁니다.')
      .regex(/(?=.*[a-z])/, '소문자를 포함해야 합니다.')
      .regex(/(?=.*[A-Z])/, '대문자를 포함해야 합니다.')
      .regex(/(?=.*\d)/, '숫자를 포함해야 합니다.')
      .regex(/(?=.*[@$!%*?&])/, '특수문자(@$!%*?&)를 포함해야 합니다.')
      .refine(password => {
        // 연속된 같은 문자 방지
        return !/(.)\\1{2,}/.test(password);
      }, '연속된 같은 문자는 3개 이상 사용할 수 없습니다.')
      .refine(password => {
        // 일반적인 패스워드 패턴 방지
        const common = ['123456', 'password', 'admin', 'qwerty', '111111'];
        return !common.some(p => password.toLowerCase().includes(p));
      }, '너무 간단하거나 흔한 패스워드입니다.'),
    
    confirmPassword: z.string(),
    
    name: z.string()
      .min(1, '이름을 입력해주세요.')
      .max(50, '이름이 너무 깁니다.')
      .regex(SAFE_TEXT_REGEX, '이름에 허용되지 않은 문자가 포함되어 있습니다.')
      .transform(name => name.trim()),
      
    terms: z.literal(true, {
      errorMap: () => ({ message: '이용약관에 동의해주세요.' })
    }),
    
    privacy: z.literal(true, {
      errorMap: () => ({ message: '개인정보 처리방침에 동의해주세요.' })
    })
  }).refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
  }),

  login: z.object({
    emailOrUsername: z.string()
      .min(1, '이메일 또는 사용자명을 입력해주세요.')
      .max(254, '입력값이 너무 깁니다.')
      .transform(input => input.trim().toLowerCase()),
    
    password: z.string()
      .min(1, '비밀번호를 입력해주세요.')
      .max(128, '비밀번호가 너무 깁니다.'),
    
    rememberMe: z.boolean().optional().default(false),
    
    captcha: z.string().optional(), // 브루트 포스 공격 방지용
  }),

  forgotPassword: z.object({
    email: z.string()
      .email('올바른 이메일 형식을 입력해주세요.')
      .max(254, '이메일이 너무 깁니다.')
      .toLowerCase()
      .transform(email => email.trim()),
  }),

  resetPassword: z.object({
    token: z.string()
      .min(1, '재설정 토큰이 없습니다.')
      .max(256, '토큰이 유효하지 않습니다.'),
    
    password: z.string()
      .min(12, '비밀번호는 최소 12자 이상이어야 합니다.')
      .max(128, '비밀번호가 너무 깁니다.')
      .regex(/(?=.*[a-z])/, '소문자를 포함해야 합니다.')
      .regex(/(?=.*[A-Z])/, '대문자를 포함해야 합니다.')
      .regex(/(?=.*\d)/, '숫자를 포함해야 합니다.')
      .regex(/(?=.*[@$!%*?&])/, '특수문자(@$!%*?&)를 포함해야 합니다.'),
    
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
  }),
};

// 게시글 관련 검증
export const postSchemas = {
  create: z.object({
    title: z.string()
      .min(1, '제목을 입력해주세요.')
      .max(200, '제목은 최대 200자까지 입력 가능합니다.')
      .regex(SAFE_TEXT_REGEX, '제목에 허용되지 않은 문자가 포함되어 있습니다.')
      .transform(title => title.trim()),
    
    slug: z.string()
      .min(1, 'URL 슬러그를 입력해주세요.')
      .max(100, 'URL 슬러그가 너무 깁니다.')
      .regex(SLUG_REGEX, 'URL 슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.')
      .transform(slug => slug.toLowerCase()),
    
    content: z.string()
      .min(1, '내용을 입력해주세요.')
      .max(50000, '내용이 너무 깁니다. (최대 50,000자)')
      .transform(content => content.trim()),
    
    excerpt: z.string()
      .max(500, '요약은 최대 500자까지 입력 가능합니다.')
      .optional()
      .transform(excerpt => excerpt?.trim()),
    
    menuId: z.string()
      .min(1, '카테고리를 선택해주세요.')
      .regex(/^[a-zA-Z0-9_-]+$/, '유효하지 않은 카테고리 ID입니다.'),
    
    isNotice: z.boolean().optional().default(false),
    isPublished: z.boolean().optional().default(true),
    
    tags: z.array(z.string().max(50)).max(10).optional(),
    
    publishedAt: z.string().datetime().optional(),
  }),

  update: z.object({
    id: z.string().min(1, '게시글 ID가 필요합니다.'),
    title: z.string().min(1).max(200).optional(),
    slug: z.string().regex(SLUG_REGEX).optional(),
    content: z.string().min(1).max(50000).optional(),
    excerpt: z.string().max(500).optional(),
    menuId: z.string().min(1).optional(),
    isNotice: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),

  delete: z.object({
    id: z.string().min(1, '삭제할 게시글 ID가 필요합니다.'),
    confirm: z.literal(true, {
      errorMap: () => ({ message: '삭제 확인이 필요합니다.' })
    }),
  }),
};

// 댓글 관련 검증
export const commentSchemas = {
  create: z.object({
    postId: z.string().min(1, '게시글 ID가 필요합니다.'),
    content: z.string()
      .min(1, '댓글 내용을 입력해주세요.')
      .max(1000, '댓글은 최대 1,000자까지 입력 가능합니다.')
      .regex(SAFE_TEXT_REGEX, '댓글에 허용되지 않은 문자가 포함되어 있습니다.')
      .transform(content => content.trim()),
    
    parentId: z.string().optional(), // 답글용
  }),

  update: z.object({
    id: z.string().min(1, '댓글 ID가 필요합니다.'),
    content: z.string().min(1).max(1000)
      .transform(content => content.trim()),
  }),

  delete: z.object({
    id: z.string().min(1, '삭제할 댓글 ID가 필요합니다.'),
  }),
};

// 메뉴/카테고리 관련 검증
export const menuSchemas = {
  create: z.object({
    name: z.string()
      .min(1, '메뉴명을 입력해주세요.')
      .max(50, '메뉴명은 최대 50자까지 입력 가능합니다.')
      .regex(SAFE_TEXT_REGEX, '메뉴명에 허용되지 않은 문자가 포함되어 있습니다.')
      .transform(name => name.trim()),
    
    slug: z.string()
      .min(1, 'URL 슬러그를 입력해주세요.')
      .max(50, 'URL 슬러그가 너무 깁니다.')
      .regex(SLUG_REGEX, 'URL 슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.'),
    
    description: z.string()
      .max(200, '설명은 최대 200자까지 입력 가능합니다.')
      .optional()
      .transform(desc => desc?.trim()),
    
    icon: z.string()
      .max(50, '아이콘 코드가 너무 깁니다.')
      .optional(),
    
    order: z.number()
      .int('순서는 정수여야 합니다.')
      .min(0, '순서는 0 이상이어야 합니다.')
      .max(1000, '순서가 너무 큽니다.')
      .optional()
      .default(0),
    
    isActive: z.boolean().optional().default(true),
  }),

  update: z.object({
    id: z.string().min(1, '메뉴 ID가 필요합니다.'),
    name: z.string().min(1).max(50).optional(),
    slug: z.string().regex(SLUG_REGEX).optional(),
    description: z.string().max(200).optional(),
    icon: z.string().max(50).optional(),
    order: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional(),
  }),
};

// 파일 업로드 관련 검증
export const fileSchemas = {
  upload: z.object({
    filename: z.string()
      .min(1, '파일명이 필요합니다.')
      .max(255, '파일명이 너무 깁니다.')
      .regex(/^[a-zA-Z0-9가-힣._-]+$/, '파일명에 허용되지 않은 문자가 포함되어 있습니다.'),
    
    mimetype: z.string()
      .regex(/^(image|video|application|text)\\/[a-zA-Z0-9][a-zA-Z0-9!#$&\\-\\^_]{0,126}$/, 
             '허용되지 않은 파일 형식입니다.'),
    
    size: z.number()
      .positive('파일 크기가 유효하지 않습니다.')
      .max(10 * 1024 * 1024, '파일 크기는 10MB를 초과할 수 없습니다.'), // 10MB
    
    category: z.enum(['image', 'document', 'media', 'other']).optional().default('other'),
  }),
};

// API 관련 검증
export const apiSchemas = {
  pagination: z.object({
    page: z.coerce.number()
      .int('페이지는 정수여야 합니다.')
      .min(1, '페이지는 1 이상이어야 합니다.')
      .max(10000, '페이지가 너무 큽니다.')
      .optional()
      .default(1),
    
    limit: z.coerce.number()
      .int('리미트는 정수여야 합니다.')
      .min(1, '리미트는 1 이상이어야 합니다.')
      .max(100, '리미트는 100 이하여야 합니다.')
      .optional()
      .default(10),
    
    sort: z.string()
      .regex(/^[a-zA-Z0-9_]+$/, '정렬 필드가 유효하지 않습니다.')
      .optional()
      .default('createdAt'),
    
    order: z.enum(['asc', 'desc']).optional().default('desc'),
    
    search: z.string()
      .max(100, '검색어가 너무 깁니다.')
      .regex(SAFE_TEXT_REGEX, '검색어에 허용되지 않은 문자가 포함되어 있습니다.')
      .optional()
      .transform(search => search?.trim()),
  }),

  search: z.object({
    query: z.string()
      .min(1, '검색어를 입력해주세요.')
      .max(100, '검색어가 너무 깁니다.')
      .regex(SAFE_TEXT_REGEX, '검색어에 허용되지 않은 문자가 포함되어 있습니다.')
      .transform(query => query.trim()),
    
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),
};

// 설정 관련 검증
export const configSchemas = {
  site: z.object({
    title: z.string().min(1).max(100).transform(s => s.trim()),
    description: z.string().max(500).optional().transform(s => s?.trim()),
    keywords: z.string().max(200).optional(),
    language: z.enum(['ko', 'en', 'ja', 'zh']).default('ko'),
    timezone: z.string().default('Asia/Seoul'),
    logo: z.string().url().optional(),
    favicon: z.string().url().optional(),
  }),

  email: z.object({
    host: z.string().min(1, 'SMTP 호스트를 입력해주세요.'),
    port: z.number().int().min(1).max(65535),
    user: z.string().email('올바른 이메일 형식을 입력해주세요.'),
    password: z.string().min(1, 'SMTP 비밀번호를 입력해주세요.'),
    secure: z.boolean().default(true),
    from: z.string().email('발신자 이메일 형식이 올바르지 않습니다.'),
  }),

  security: z.object({
    sessionTimeout: z.number().int().min(3600).max(2592000), // 1시간 ~ 30일
    maxLoginAttempts: z.number().int().min(3).max(20).default(5),
    lockoutDuration: z.number().int().min(300).max(86400).default(900), // 5분 ~ 24시간
    passwordMinLength: z.number().int().min(8).max(128).default(12),
    requireTwoFactor: z.boolean().default(false),
    allowedOrigins: z.array(z.string().url()).optional(),
    trustedProxies: z.array(z.string().ip()).optional(),
  }),
};

// 헬퍼 함수
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { success: boolean; data?: T; errors?: z.ZodError } => {
    try {
      const result = schema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, errors: error };
      }
      throw error;
    }
  };
}

// 검증 오류 메시지 포맷터
export function formatValidationErrors(errors: z.ZodError): Record<string, string> {
  const formattedErrors: Record<string, string> = {};
  
  for (const error of errors.errors) {
    const path = error.path.join('.');
    formattedErrors[path] = error.message;
  }
  
  return formattedErrors;
}

// XSS 방지를 위한 HTML 이스케이프
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// URL 유효성 검증
export function isValidUrl(url: string, allowedProtocols: string[] = ['http', 'https']): boolean {
  try {
    const parsed = new URL(url);
    return allowedProtocols.includes(parsed.protocol.slice(0, -1));
  } catch {
    return false;
  }
}

// Export 모든 스키마
export const schemas = {
  user: userSchemas,
  post: postSchemas,
  comment: commentSchemas,
  menu: menuSchemas,
  file: fileSchemas,
  api: apiSchemas,
  config: configSchemas,
};

export default schemas;