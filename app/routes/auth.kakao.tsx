/**
 * 카카오 OAuth 로그인 라우트
 * /auth/kakao - 카카오 로그인 페이지로 리다이렉트
 */

import { type LoaderFunction, redirect } from '@remix-run/node';
import { getKakaoAuthUrl, generateState } from '~/lib/auth/kakao.server';
import { commitSession, getSession } from '~/lib/session.server';

export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get('Cookie'));
  
  // State 생성 및 세션에 저장 (CSRF 방지)
  const state = generateState();
  session.set('kakao_oauth_state', state);
  
  // 리턴 URL 저장 (로그인 후 돌아갈 페이지)
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo') || '/';
  session.set('return_to', returnTo);
  
  // 카카오 로그인 URL로 리다이렉트
  const kakaoAuthUrl = getKakaoAuthUrl(state);
  
  return redirect(kakaoAuthUrl, {
    headers: {
      'Set-Cookie': await commitSession(session),
    },
  });
};