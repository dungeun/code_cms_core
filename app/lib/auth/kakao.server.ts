/**
 * 카카오 OAuth 인증 핸들러
 * Kakao Developers API를 사용한 소셜 로그인 구현
 */

import { db } from '~/utils/db.server';
import { getSessionManager } from '../session.server';
import crypto from 'crypto';

/**
 * 카카오 OAuth 설정
 */
export const KAKAO_CONFIG = {
  clientId: process.env.KAKAO_CLIENT_ID || '',
  clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
  redirectUri: process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao/callback',
  authorizationUrl: 'https://kauth.kakao.com/oauth/authorize',
  tokenUrl: 'https://kauth.kakao.com/oauth/token',
  userInfoUrl: 'https://kapi.kakao.com/v2/user/me',
  logoutUrl: 'https://kapi.kakao.com/v1/user/logout',
};

/**
 * 카카오 사용자 프로필
 */
export interface KakaoProfile {
  id: number;
  connected_at: string;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    profile_nickname_needs_agreement?: boolean;
    profile_image_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
      is_default_image?: boolean;
    };
    has_email?: boolean;
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    email?: string;
    has_age_range?: boolean;
    age_range_needs_agreement?: boolean;
    age_range?: string;
    has_birthday?: boolean;
    birthday_needs_agreement?: boolean;
    birthday?: string;
    birthday_type?: string;
    has_gender?: boolean;
    gender_needs_agreement?: boolean;
    gender?: string;
  };
}

/**
 * 카카오 로그인 URL 생성
 */
export function getKakaoAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: KAKAO_CONFIG.clientId,
    redirect_uri: KAKAO_CONFIG.redirectUri,
    response_type: 'code',
    scope: 'profile_nickname profile_image account_email',
    state: state || generateState(),
  });

  return `${KAKAO_CONFIG.authorizationUrl}?${params.toString()}`;
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
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  refresh_token_expires_in?: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KAKAO_CONFIG.clientId,
    client_secret: KAKAO_CONFIG.clientSecret,
    redirect_uri: KAKAO_CONFIG.redirectUri,
    code,
  });

  const response = await fetch(KAKAO_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`카카오 토큰 교환 실패: ${error}`);
  }

  return await response.json();
}

/**
 * 액세스 토큰으로 사용자 정보 조회
 */
export async function getKakaoUserInfo(accessToken: string): Promise<KakaoProfile> {
  const response = await fetch(KAKAO_CONFIG.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`카카오 사용자 정보 조회 실패: ${error}`);
  }

  return await response.json();
}

/**
 * 카카오 사용자 처리 (가입 또는 로그인)
 */
export async function handleKakaoUser(
  profile: KakaoProfile,
  accessToken: string,
  refreshToken?: string
): Promise<{ user: any; isNewUser: boolean }> {
  const providerId = profile.id.toString();
  const email = profile.kakao_account?.email;
  const name = profile.kakao_account?.profile?.nickname || profile.properties?.nickname;
  const profileImage = profile.kakao_account?.profile?.profile_image_url || 
                       profile.properties?.profile_image;

  // 기존 OAuth 계정 확인
  const existingOAuth = await db.oAuthAccount.findUnique({
    where: {
      provider_providerId: {
        provider: 'kakao',
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
        refreshToken: refreshToken || existingOAuth.refreshToken,
        tokenExpiry: new Date(Date.now() + 3600 * 1000), // 1시간 후
        profileData: profile as any,
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
    // 기존 사용자에 카카오 계정 연결
    await db.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: 'kakao',
        providerId,
        accessToken,
        refreshToken,
        tokenExpiry: new Date(Date.now() + 3600 * 1000),
        scope: 'profile_nickname profile_image account_email',
        profileData: profile as any,
      },
    });

    // 사용자 정보 업데이트
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        profileImage: profileImage || user.profileImage,
        provider: user.provider || 'kakao',
        providerId: user.providerId || providerId,
      },
    });

    return { user: updatedUser, isNewUser: false };
  }

  // 새 사용자 생성
  const username = `kakao_${providerId}`;
  const newUser = await db.user.create({
    data: {
      username,
      email: email || `${username}@kakao.local`,
      name,
      provider: 'kakao',
      providerId,
      profileImage,
      emailVerified: !!email,
      emailVerifiedAt: email ? new Date() : null,
      lastLoginAt: new Date(),
      oauthAccounts: {
        create: {
          provider: 'kakao',
          providerId,
          accessToken,
          refreshToken,
          tokenExpiry: new Date(Date.now() + 3600 * 1000),
          scope: 'profile_nickname profile_image account_email',
          profileData: profile as any,
        },
      },
    },
  });

  return { user: newUser, isNewUser: true };
}

/**
 * 카카오 로그아웃
 */
export async function kakaoLogout(accessToken: string): Promise<void> {
  try {
    const response = await fetch(KAKAO_CONFIG.logoutUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('카카오 로그아웃 실패:', await response.text());
    }
  } catch (error) {
    console.error('카카오 로그아웃 중 오류:', error);
  }
}

/**
 * 토큰 갱신
 */
export async function refreshKakaoToken(refreshToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: KAKAO_CONFIG.clientId,
    client_secret: KAKAO_CONFIG.clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(KAKAO_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`카카오 토큰 갱신 실패: ${error}`);
  }

  return await response.json();
}

/**
 * 카카오 계정 연결 해제
 */
export async function unlinkKakaoAccount(userId: string): Promise<void> {
  const oauthAccount = await db.oAuthAccount.findFirst({
    where: {
      userId,
      provider: 'kakao',
    },
  });

  if (!oauthAccount) {
    throw new Error('연결된 카카오 계정이 없습니다.');
  }

  // 카카오 API로 연결 해제 요청
  if (oauthAccount.accessToken) {
    try {
      const response = await fetch('https://kapi.kakao.com/v1/user/unlink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${oauthAccount.accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('카카오 연결 해제 실패:', await response.text());
      }
    } catch (error) {
      console.error('카카오 연결 해제 중 오류:', error);
    }
  }

  // DB에서 OAuth 계정 삭제
  await db.oAuthAccount.delete({
    where: { id: oauthAccount.id },
  });
}

/**
 * 카카오 로그인 콜백 처리
 */
export async function handleKakaoCallback(
  code: string,
  state: string,
  sessionState: string
): Promise<{ sessionToken: string; user: any; isNewUser: boolean }> {
  // State 검증 (CSRF 방지)
  if (!validateState(state, sessionState)) {
    throw new Error('잘못된 state 파라미터입니다.');
  }

  // 액세스 토큰 획득
  const tokenData = await exchangeCodeForToken(code);

  // 사용자 정보 조회
  const profile = await getKakaoUserInfo(tokenData.access_token);

  // 사용자 처리
  const { user, isNewUser } = await handleKakaoUser(
    profile,
    tokenData.access_token,
    tokenData.refresh_token
  );

  // 세션 생성
  const sessionManager = getSessionManager();
  const sessionToken = await sessionManager.createSession({
    userId: user.id,
    userAgent: 'Kakao OAuth',
    ipAddress: '0.0.0.0',
    rememberMe: true,
  });

  return { sessionToken, user, isNewUser };
}