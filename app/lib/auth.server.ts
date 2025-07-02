import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '~/utils/db.server';
import { createCookieSessionStorage, redirect } from '@remix-run/node';
import type { User } from '@prisma/client';

// 세션 스토리지 설정
const sessionSecret = process.env.SESSION_SECRET || 'default-session-secret';
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET 환경 변수가 설정되지 않았습니다. 프로덕션에서는 반드시 설정하세요.');
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'blee_session',
    secure: process.env.NODE_ENV === 'production',
    secrets: [sessionSecret],
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30일
    httpOnly: true,
  },
});

// 비밀번호 해시화
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// 비밀번호 검증
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// 사용자 생성
export async function createUser({
  username,
  email,
  password,
  name,
}: {
  username: string;
  email: string;
  password: string;
  name?: string;
}) {
  const hashedPassword = await hashPassword(password);
  
  return db.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      name,
    },
  });
}

// 사용자 조회 (이메일로)
export async function getUserByEmail(email: string) {
  return db.user.findUnique({
    where: { email },
  });
}

// 사용자 조회 (사용자명으로)
export async function getUserByUsername(username: string) {
  return db.user.findUnique({
    where: { username },
  });
}

// 사용자 조회 (ID로)
export async function getUserById(id: string) {
  return db.user.findUnique({
    where: { id },
  });
}

// 로그인 검증
export async function verifyLogin(emailOrUsername: string, password: string) {
  console.log('Attempting login with:', emailOrUsername);
  
  try {
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername },
        ],
        isActive: true,
      },
    });

    console.log('User found:', user ? 'yes' : 'no');
    
    if (!user) {
      return null;
    }

    const isValidPassword = await verifyPassword(password, user.password);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return null;
    }

    // 마지막 로그인 시간 업데이트
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return user;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

// 세션 생성
export async function createUserSession(userId: string, redirectTo: string, remember: boolean = false) {
  const session = await sessionStorage.getSession();
  
  // 세션 토큰 생성
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (remember ? 30 : 1)); // remember me: 30일, 아니면 1일

  // DB에 세션 저장
  await db.session.create({
    data: {
      userId,
      token: sessionToken,
      expiresAt,
    },
  });

  session.set('sessionToken', sessionToken);
  
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session, {
        maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24, // 30일 또는 1일
      }),
    },
  });
}

// 세션에서 사용자 ID 가져오기
export async function getUserId(request: Request): Promise<string | null> {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const sessionToken = session.get('sessionToken');
  
  if (!sessionToken) {
    return null;
  }

  // DB에서 세션 확인
  const userSession = await db.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!userSession || userSession.expiresAt < new Date()) {
    // 만료된 세션 삭제
    if (userSession) {
      await db.session.delete({ where: { id: userSession.id } });
    }
    return null;
  }

  return userSession.userId;
}

// 세션에서 사용자 정보 가져오기
export async function getUser(request: Request): Promise<User | null> {
  const userId = await getUserId(request);
  if (!userId) {
    return null;
  }

  return db.user.findUnique({
    where: { id: userId },
  });
}

// 로그아웃
export async function logout(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const sessionToken = session.get('sessionToken');
  
  if (sessionToken) {
    // DB에서 세션 삭제
    await db.session.deleteMany({
      where: { token: sessionToken },
    });
  }

  return redirect('/', {
    headers: {
      'Set-Cookie': await sessionStorage.destroySession(session),
    },
  });
}

// 인증 필요
export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
    throw redirect(`/auth/login?${searchParams}`);
  }
  return userId;
}

// 사용자 인증 필요
export async function requireUser(request: Request) {
  const userId = await requireUserId(request);
  
  const user = await db.user.findUnique({
    where: { id: userId },
  });
  
  if (!user) {
    throw logout(request);
  }
  
  return user;
}

// 관리자 권한 필요
export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  
  if (user.role !== 'ADMIN') {
    throw new Response('권한이 없습니다', { status: 403 });
  }
  
  return user;
}

// 비밀번호 재설정 토큰 생성
export async function createPasswordResetToken(email: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    // 보안상 사용자가 없어도 에러를 발생시키지 않음
    return;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date();
  resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1시간 후 만료

  await db.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiry,
    },
  });

  return { user, resetToken };
}

// 비밀번호 재설정
export async function resetPassword(token: string, newPassword: string) {
  const user = await db.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new Error('유효하지 않거나 만료된 토큰입니다.');
  }

  const hashedPassword = await hashPassword(newPassword);

  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return user;
}

// 이메일 확인
export async function verifyEmail(userId: string) {
  return db.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
}