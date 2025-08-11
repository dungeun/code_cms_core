// 보안 미들웨어 시스템

import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { requireCSRF } from "./csrf.server";
import { 
  validateIPAddress, 
  validateUserAgent, 
  getCSPHeader,
  validateEnvironmentVariables 
} from "./validation.server";

// 환경 변수 검증 (앱 시작시 실행)
validateEnvironmentVariables();

// Helmet 보안 헤더 설정
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", // React hydration용 (개선 필요)
        "https://js.tosspayments.com",
        "https://t1.daumcdn.net"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", // Tailwind용
        "https://fonts.googleapis.com"
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      frameSrc: ["https://js.tosspayments.com", "https://t1.daumcdn.net"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    },
    reportOnly: false
  },
  crossOriginEmbedderPolicy: false, // Remix와 호환성
  hsts: {
    maxAge: 31536000, // 1년
    includeSubDomains: true,
    preload: true
  }
});

// 기본 보안 미들웨어
export function basicSecurity(req: Request, res: Response, next: NextFunction) {
  // IP 주소 검증
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  if (!validateIPAddress(clientIP)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // User Agent 검증
  const userAgent = req.headers['user-agent'];
  if (!validateUserAgent(userAgent)) {
    return res.status(403).json({ error: 'Invalid user agent' });
  }
  
  // 추가 보안 헤더
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
}

// API 요청 속도 제한
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // IP당 최대 100회
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  keyGenerator: (req) => {
    return req.ip + ':' + req.route?.path || 'unknown';
  }
});

// 로그인 시도 속도 제한 (더 엄격)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // IP당 최대 5회 시도
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true // 성공한 요청은 카운트하지 않음
});

// 파일 업로드 속도 제한
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 20, // IP당 최대 20회 업로드
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many file uploads from this IP, please try again later.',
    retryAfter: '1 hour'
  }
});

// CSRF 보호 미들웨어 (Remix 액션용)
export async function csrfProtection(request: Request): Promise<void> {
  await requireCSRF(request);
}

// 관리자 권한 확인 미들웨어
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

// 인증된 사용자 확인 미들웨어
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  next();
}

// 보안 감사 로그
export function securityAuditLog(req: Request, action: string, details?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    action,
    details,
    userId: (req as any).user?.id
  };
  
  // 실제 환경에서는 보안 로그 시스템으로 전송
  console.log('[SECURITY AUDIT]', JSON.stringify(logEntry));
}

// SQL 인젝션 탐지 미들웨어
export function detectSQLInjection(req: Request, res: Response, next: NextFunction) {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(OR\s+\d+\s*=\s*\d+|AND\s+\d+\s*=\s*\d+)/gi,
    /(--|\/\*|\*\/)/g
  ];
  
  // 요청 본문, 쿼리 파라미터, 헤더 검사
  const checkSources = [
    JSON.stringify(req.body),
    JSON.stringify(req.query),
    JSON.stringify(req.params)
  ].join(' ');
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(checkSources)
  );
  
  if (isSuspicious) {
    securityAuditLog(req, 'SQL_INJECTION_ATTEMPT', {
      body: req.body,
      query: req.query,
      params: req.params
    });
    
    return res.status(400).json({ error: 'Invalid request format' });
  }
  
  next();
}

// XSS 탐지 미들웨어
export function detectXSS(req: Request, res: Response, next: NextFunction) {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi
  ];
  
  const checkSources = [
    JSON.stringify(req.body),
    JSON.stringify(req.query)
  ].join(' ');
  
  const hasXSS = xssPatterns.some(pattern => pattern.test(checkSources));
  
  if (hasXSS) {
    securityAuditLog(req, 'XSS_ATTEMPT', {
      body: req.body,
      query: req.query
    });
    
    return res.status(400).json({ error: 'Invalid content detected' });
  }
  
  next();
}

// 보안 미들웨어 체인
export const securityMiddlewares = [
  basicSecurity,
  securityHeaders,
  detectSQLInjection,
  detectXSS
];

// 보안 설정 검증 함수
export function validateSecurityConfig(): {
  isSecure: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // NODE_ENV 확인
  if (process.env.NODE_ENV !== 'production') {
    warnings.push('NODE_ENV가 production으로 설정되지 않았습니다');
  }
  
  // SESSION_SECRET 강도 확인
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    warnings.push('SESSION_SECRET이 너무 짧습니다 (최소 32자)');
  }
  
  // HTTPS 확인 (프로덕션 환경)
  if (process.env.NODE_ENV === 'production' && !process.env.FORCE_HTTPS) {
    warnings.push('프로덕션 환경에서 HTTPS가 강제되지 않았습니다');
  }
  
  return {
    isSecure: warnings.length === 0,
    warnings
  };
}