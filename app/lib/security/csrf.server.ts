// CSRF 보호 시스템

import { createCookie } from "@remix-run/node";
import crypto from "node:crypto";

// CSRF 토큰 쿠키 설정
export const csrfCookie = createCookie("csrf-token", {
  maxAge: 60 * 60 * 24, // 24시간
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  secrets: [process.env.SESSION_SECRET!]
});

// CSRF 토큰 생성
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// CSRF 토큰 검증 (개선된 버전)
export function validateCSRFToken(
  requestToken: string | undefined,
  sessionId: string
): boolean {
  if (!requestToken || !sessionId) {
    return false;
  }
  
  try {
    // 세션 기반 토큰 생성
    const expectedToken = crypto
      .createHmac('sha256', process.env.SESSION_SECRET!)
      .update(sessionId)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(requestToken, 'hex'),
      Buffer.from(expectedToken, 'hex')
    );
  } catch (error) {
    console.error('CSRF token validation error:', error);
    return false;
  }
}

// 세션 기반 CSRF 토큰 생성
export function generateCSRFTokenForSession(sessionId: string): string {
  return crypto
    .createHmac('sha256', process.env.SESSION_SECRET!)
    .update(sessionId)
    .digest('hex');
}

// 기존 검증 함수 (호환성 유지)
export function verifyCSRFToken(
  sessionToken: string | undefined,
  requestToken: string | undefined
): boolean {
  if (!sessionToken || !requestToken) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sessionToken, 'hex'),
      Buffer.from(requestToken, 'hex')
    );
  } catch (error) {
    return false;
  }
}

// 요청에서 CSRF 토큰 추출
export function extractCSRFToken(request: Request): string | null {
  // POST/PUT/DELETE 요청에서 토큰 확인
  const contentType = request.headers.get("content-type");
  
  if (contentType?.includes("application/json")) {
    // JSON 요청: X-CSRF-Token 헤더에서 추출
    return request.headers.get("X-CSRF-Token");
  } else if (contentType?.includes("application/x-www-form-urlencoded")) {
    // Form 요청: _csrf 필드에서 추출 (나중에 formData에서 처리)
    return null; // formData에서 처리해야 함
  }
  
  return null;
}

// CSRF 미들웨어
export async function requireCSRF(request: Request): Promise<void> {
  const method = request.method;
  
  // GET, HEAD, OPTIONS 요청은 CSRF 검증 생략
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return;
  }
  
  // 세션에서 CSRF 토큰 가져오기
  const cookieHeader = request.headers.get("Cookie");
  const sessionToken = await csrfCookie.parse(cookieHeader);
  
  // 요청에서 CSRF 토큰 가져오기
  let requestToken = extractCSRFToken(request);
  
  // Form 데이터에서 토큰 추출 (필요한 경우)
  if (!requestToken && request.headers.get("content-type")?.includes("form-urlencoded")) {
    const formData = await request.clone().formData();
    requestToken = formData.get("_csrf") as string;
  }
  
  // CSRF 토큰 검증
  if (!verifyCSRFToken(sessionToken, requestToken)) {
    throw new Error("Invalid CSRF token");
  }
}

// React 컴포넌트에서 사용할 CSRF 토큰 제공
export function CSRFTokenInput({ token }: { token: string }) {
  return <input type="hidden" name="_csrf" value={token} />;
}

// API 요청용 CSRF 헤더 설정
export function getCSRFHeaders(token: string): HeadersInit {
  return {
    'X-CSRF-Token': token,
    'Content-Type': 'application/json'
  };
}