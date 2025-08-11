/**
 * 네이버 OAuth 인증 핸들러
 * 네이버 아이디로 로그인 API를 사용한 소셜 로그인 구현
 */

import { db } from '~/utils/db.server';
import { getSessionManager } from '../session.server';
import crypto from 'crypto';

/**
 * 네이버 OAuth 설정
 */
export const NAVER_CONFIG = {
  clientId: process.env.NAVER_CLIENT_ID || '',
  clientSecret: process.env.NAVER_CLIENT_SECRET || '',
  redirectUri: process.env.NAVER_REDIRECT_URI || 'http://localhost:3000/auth/naver/callback',
  authorizationUrl: 'https://nid.naver.com/oauth2.0/authorize',
  tokenUrl: 'https://nid.naver.com/oauth2.0/token',
  userInfoUrl: 'https://openapi.naver.com/v1/nid/me',
};

/**
 * 네이버 사용자 프로필
 */
export interface NaverProfile {
  resultcode: string;
  message: string;
  response?: {
    id: string;
    nickname?: string;
    name?: string;
    email?: string;
    gender?: 'F' | 'M' | 'U';
    age?: string;
    birthday?: string;
    birthyear?: string;
    profile_image?: string;
    mobile?: string;
    mobile_e164?: string;
  };
}

/**
 * 네이버 로그인 URL 생성
 */
export function getNaverAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: NAVER_CONFIG.clientId,
    redirect_uri: NAVER_CONFIG.redirectUri,
    state: state || generateState(),
  });

  return `${NAVER_CONFIG.authorizationUrl}?${params.toString()}`;
}

/**
 * State 파라미터 생성 (CSRF 방지)
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * State 파라미터 검증
 */
export function validateState(state: string, sessionState: string): boolean {
  return state === sessionState;
}

/**
 * 인증 코드로 액세스 토큰 교환
 */
export async function exchangeCodeForToken(code: string, state: string): Promise<{
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: string;
}> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: NAVER_CONFIG.clientId,
    client_secret: NAVER_CONFIG.clientSecret,
    code,
    state,
  });

  const response = await fetch(NAVER_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`네이버 토큰 교환 실패: ${error}`);
  }

  return await response.json();
}

/**
 * 액세스 토큰으로 사용자 정보 조회
 */
export async function getNaverUserInfo(accessToken: string): Promise<NaverProfile> {
  const response = await fetch(NAVER_CONFIG.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`네이버 사용자 정보 조회 실패: ${error}`);
  }

  const data = await response.json();
  
  // 네이버 API 응답 성공 확인
  if (data.resultcode !== '00') {
    throw new Error(`네이버 API 오류: ${data.message}`);
  }

  return data;
}

/**
 * 네이버 사용자 처리 (가입 또는 로그인)
 */
export async function handleNaverUser(
  profile: NaverProfile,
  accessToken: string,
  refreshToken: string
): Promise<{ user: any; isNewUser: boolean }> {
  if (!profile.response) {
    throw new Error('네이버 프로필 정보가 없습니다.');
  }

  const naverUser = profile.response;
  const providerId = naverUser.id;
  const email = naverUser.email;
  const name = naverUser.name || naverUser.nickname;
  const profileImage = naverUser.profile_image;

  // 기존 OAuth 계정 확인
  const existingOAuth = await db.oAuthAccount.findUnique({
    where: {
      provider_providerId: {
        provider: 'naver',
        providerId,
      },
    },
    include: {
      user: true,
    },
  });

  if (existingOAuth) {
    // 기존 사용자 - 토큰 업데이트
    await db.oAuthAccount.update({
      where: { id: existingOAuth.id },
      data: {
        accessToken,
        refreshToken,
        tokenExpiry: new Date(Date.now() + 3600 * 1000), // 1시간 후
        profileData: naverUser as any,
        updatedAt: new Date(),
      },
    });

    // 사용자 정보 업데이트
    const updatedUser = await db.user.update({
      where: { id: existingOAuth.userId },
      data: {
        lastLoginAt: new Date(),
        profileImage: profileImage || existingOAuth.user.profileImage,
        name: name || existingOAuth.user.name,
      },
    });

    return { user: updatedUser, isNewUser: false };
  }

  // 이메일로 기존 사용자 확인
  let user = null;
  if (email) {
    user = await db.user.findUnique({
      where: { email },
    });
  }

  if (user) {
    // 기존 사용자에 네이버 계정 연결
    await db.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: 'naver',
        providerId,
        accessToken,
        refreshToken,
        tokenExpiry: new Date(Date.now() + 3600 * 1000),
        scope: 'basic',
        profileData: naverUser as any,
      },
    });

    // 사용자 정보 업데이트
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        profileImage: profileImage || user.profileImage,
        provider: user.provider || 'naver',
        providerId: user.providerId || providerId,
      },
    });

    return { user: updatedUser, isNewUser: false };
  }

  // 새 사용자 생성
  const username = `naver_${providerId}`;
  const newUser = await db.user.create({
    data: {
      username,
      email: email || `${username}@naver.local`,
      name,
      provider: 'naver',
      providerId,
      profileImage,
      emailVerified: !!email,
      emailVerifiedAt: email ? new Date() : null,
      lastLoginAt: new Date(),
      oauthAccounts: {
        create: {
          provider: 'naver',
          providerId,
          accessToken,
          refreshToken,
          tokenExpiry: new Date(Date.now() + 3600 * 1000),
          scope: 'basic',
          profileData: naverUser as any,
        },
      },
    },
  });

  return { user: newUser, isNewUser: true };
}

/**
 * 토큰 갱신
 */
export async function refreshNaverToken(refreshToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: string;
}> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: NAVER_CONFIG.clientId,
    client_secret: NAVER_CONFIG.clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(NAVER_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`네이버 토큰 갱신 실패: ${error}`);
  }

  return await response.json();
}

/**
 * 네이버 계정 연결 해제
 */
export async function unlinkNaverAccount(userId: string): Promise<void> {
  const oauthAccount = await db.oAuthAccount.findFirst({
    where: {
      userId,
      provider: 'naver',
    },
  });

  if (!oauthAccount) {
    throw new Error('연결된 네이버 계정이 없습니다.');
  }

  // 네이버 API로 연결 해제 요청
  if (oauthAccount.accessToken) {
    try {
      const params = new URLSearchParams({
        grant_type: 'delete',
        client_id: NAVER_CONFIG.clientId,
        client_secret: NAVER_CONFIG.clientSecret,
        access_token: oauthAccount.accessToken,
        service_provider: 'NAVER',
      });

      const response = await fetch(NAVER_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        console.error('네이버 연결 해제 실패:', await response.text());
      }
    } catch (error) {
      console.error('네이버 연결 해제 중 오류:', error);
    }
  }

  // DB에서 OAuth 계정 삭제
  await db.oAuthAccount.delete({
    where: { id: oauthAccount.id },
  });
}

/**
 * 네이버 로그인 콜백 처리
 */
export async function handleNaverCallback(
  code: string,
  state: string,
  sessionState: string
): Promise<{ sessionToken: string; user: any; isNewUser: boolean }> {
  // State 검증 (CSRF 방지)
  if (!validateState(state, sessionState)) {
    throw new Error('잘못된 state 파라미터입니다.');
  }

  // 액세스 토큰 획득
  const tokenData = await exchangeCodeForToken(code, state);

  // 사용자 정보 조회
  const profile = await getNaverUserInfo(tokenData.access_token);

  // 사용자 처리
  const { user, isNewUser } = await handleNaverUser(
    profile,
    tokenData.access_token,
    tokenData.refresh_token
  );

  // 세션 생성
  const sessionManager = getSessionManager();
  const sessionToken = await sessionManager.createSession({
    userId: user.id,
    userAgent: 'Naver OAuth',
    ipAddress: '0.0.0.0',
    rememberMe: true,
  });

  return { sessionToken, user, isNewUser };
}