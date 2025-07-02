import { redirect } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { getUser, getUserId, requireAdmin as requireAdminUser, requireUser as requireAuthUser } from '~/lib/auth.server';

/**
 * 사용자 인증이 필요한 라우트를 위한 헬퍼 함수
 * 인증되지 않은 경우 로그인 페이지로 리다이렉트
 */
export async function requireAuth(
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

/**
 * 사용자 정보가 필요한 라우트를 위한 헬퍼 함수
 */
export async function requireUser(request: Request) {
  return requireAuthUser(request);
}

/**
 * 관리자 권한이 필요한 라우트를 위한 헬퍼 함수
 */
export async function requireAdmin(request: Request) {
  return requireAdminUser(request);
}

/**
 * 글쓰기 권한 체크
 * 현재는 로그인한 모든 사용자가 글쓰기 가능
 * 추후 권한 세분화 필요시 수정
 */
export async function requireWritePermission(request: Request) {
  const user = await requireUser(request);
  
  // 비활성화된 사용자는 글쓰기 불가
  if (!user.isActive) {
    throw new Response('계정이 비활성화되었습니다', { status: 403 });
  }
  
  return user;
}

/**
 * 특정 리소스의 소유자인지 확인
 */
export async function requireOwnership(
  request: Request,
  resourceOwnerId: string
) {
  const user = await requireUser(request);
  
  // 관리자는 모든 리소스에 접근 가능
  if (user.role === 'ADMIN') {
    return user;
  }
  
  // 소유자가 아닌 경우
  if (user.id !== resourceOwnerId) {
    throw new Response('권한이 없습니다', { status: 403 });
  }
  
  return user;
}

/**
 * 선택적 사용자 정보 가져오기
 * 로그인하지 않아도 접근 가능하지만 사용자 정보가 필요한 경우
 */
export async function getOptionalUser(request: Request) {
  return getUser(request);
}

/**
 * 보호된 라우트를 위한 loader 래퍼
 * 인증 체크를 자동으로 수행
 */
export function protectedLoader<T extends LoaderFunctionArgs>(
  loader: (args: T & { userId: string }) => ReturnType<T['params']>
) {
  return async (args: T) => {
    const userId = await requireAuth(args.request);
    return loader({ ...args, userId });
  };
}

/**
 * 관리자 전용 라우트를 위한 loader 래퍼
 */
export function adminLoader<T extends LoaderFunctionArgs>(
  loader: (args: T & { user: Awaited<ReturnType<typeof requireAdmin>> }) => ReturnType<T['params']>
) {
  return async (args: T) => {
    const user = await requireAdmin(args.request);
    return loader({ ...args, user });
  };
}