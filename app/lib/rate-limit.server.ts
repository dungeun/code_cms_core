/**
 * Rate Limiting 시스템
 * DDoS 공격 및 브루트포스 공격 방지
 */

import { env } from './env.server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// 메모리 기반 Rate Limit 저장소 (프로덕션에서는 Redis 사용 권장)
const rateLimitStore = new Map<string, RateLimitEntry>();

// 정리 주기적으로 실행
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // 1분마다 정리

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Rate Limit 체크 및 업데이트
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = env.RATE_LIMIT_MAX,
  windowMs: number = env.RATE_LIMIT_WINDOW
): RateLimitResult {
  const now = Date.now();
  const key = `${identifier}:${Math.floor(now / windowMs)}`;
  
  const entry = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };
  
  if (now > entry.resetTime) {
    // 윈도우가 리셋되었음
    entry.count = 1;
    entry.resetTime = now + windowMs;
  } else {
    entry.count++;
  }
  
  rateLimitStore.set(key, entry);
  
  const remaining = Math.max(0, maxRequests - entry.count);
  const success = entry.count <= maxRequests;
  
  const result: RateLimitResult = {
    success,
    limit: maxRequests,
    remaining,
    reset: entry.resetTime,
  };
  
  if (!success) {
    result.retryAfter = Math.ceil((entry.resetTime - now) / 1000);
  }
  
  return result;
}

/**
 * IP 기반 Rate Limiting
 */
export function checkIPRateLimit(request: Request): RateLimitResult {
  const ip = getClientIP(request);
  return checkRateLimit(`ip:${ip}`);
}

/**
 * 사용자 기반 Rate Limiting (로그인 시도 등)
 */
export function checkUserRateLimit(identifier: string): RateLimitResult {
  // 로그인 시도는 더 엄격하게 (5분에 10번)
  return checkRateLimit(`user:${identifier}`, 10, 5 * 60 * 1000);
}

/**
 * API 엔드포인트별 Rate Limiting
 */
export function checkEndpointRateLimit(request: Request, endpoint: string): RateLimitResult {
  const ip = getClientIP(request);
  return checkRateLimit(`endpoint:${endpoint}:${ip}`, 30, 60 * 1000); // 1분에 30번
}

/**
 * 클라이언트 IP 주소 추출
 */
function getClientIP(request: Request): string {
  // Cloudflare, nginx 등의 프록시 헤더 확인
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Remix에서 클라이언트 IP 추출 (개발 환경)
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return 'unknown';
}

/**
 * Rate Limit 에러 응답 생성
 */
export function createRateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
      retryAfter: result.retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.reset).toISOString(),
        ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() })
      }
    }
  );
}

/**
 * Rate Limit 미들웨어 (Remix action/loader에서 사용)
 */
export function withRateLimit<T extends any[]>(
  handler: (...args: T) => Promise<Response>,
  options: {
    type?: 'ip' | 'user' | 'endpoint';
    identifier?: string;
    maxRequests?: number;
    windowMs?: number;
  } = {}
) {
  return async (...args: T): Promise<Response> => {
    const request = args[0] as Request;
    
    let result: RateLimitResult;
    
    switch (options.type) {
      case 'user':
        result = checkUserRateLimit(options.identifier || 'anonymous');
        break;
      case 'endpoint':
        result = checkEndpointRateLimit(request, options.identifier || 'unknown');
        break;
      case 'ip':
      default:
        result = checkIPRateLimit(request);
        break;
    }
    
    if (!result.success) {
      return createRateLimitResponse(result);
    }
    
    return handler(...args);
  };
}