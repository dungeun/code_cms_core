// 카카오 OAuth 인증 시스템

import { redirect } from '@remix-run/node';
import { prisma } from '../../db.server';
import { createSession } from '../session.server';
import { generateJWT } from '../jwt.server';

// 카카오 OAuth 설정
const KAKAO_CONFIG = {
  clientId: process.env.KAKAO_CLIENT_ID!,
  clientSecret: process.env.KAKAO_CLIENT_SECRET!,
  redirectUri: process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao/callback',
  authUrl: 'https://kauth.kakao.com/oauth/authorize',
  tokenUrl: 'https://kauth.kakao.com/oauth/token',
  userInfoUrl: 'https://kapi.kakao.com/v2/user/me'
};

// 카카오 사용자 정보 타입
interface KakaoUserInfo {
  id: number;
  connected_at: string;
  kakao_account: {
    email?: string;
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
    };
  };
}

// 인증 URL 생성
export function generateKakaoAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: KAKAO_CONFIG.clientId,
    redirect_uri: KAKAO_CONFIG.redirectUri,
    response_type: 'code',
    scope: 'profile_nickname,profile_image,account_email'
  });

  if (state) {
    params.append('state', state);
  }

  return `${KAKAO_CONFIG.authUrl}?${params.toString()}`;
}

// 액세스 토큰 교환
async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KAKAO_CONFIG.clientId,
    client_secret: KAKAO_CONFIG.clientSecret,
    redirect_uri: KAKAO_CONFIG.redirectUri,
    code
  });

  const response = await fetch(KAKAO_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenParams.toString()
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('카카오 토큰 교환 실패:', errorData);
    throw new Error('카카오 토큰 교환에 실패했습니다');
  }

  return await response.json();
}

// 사용자 정보 조회
async function fetchKakaoUserInfo(accessToken: string): Promise<KakaoUserInfo> {
  const response = await fetch(KAKAO_CONFIG.userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('카카오 사용자 정보 조회 실패:', errorData);
    throw new Error('카카오 사용자 정보 조회에 실패했습니다');
  }

  return await response.json();
}

// 카카오 OAuth 콜백 처리
export async function handleKakaoCallback(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');

  // 에러 처리
  if (error) {
    console.error('카카오 OAuth 에러:', error);
    throw redirect('/login?error=oauth_error');
  }

  if (!code) {
    throw redirect('/login?error=missing_code');
  }

  try {
    // 1. 액세스 토큰 교환
    const tokenData = await exchangeCodeForToken(code);

    // 2. 사용자 정보 조회
    const userInfo = await fetchKakaoUserInfo(tokenData.access_token);

    // 3. 이메일 확인
    const email = userInfo.kakao_account.email;
    if (!email || !userInfo.kakao_account.is_email_verified) {
      throw redirect('/login?error=email_required');
    }

    // 4. 사용자 찾기 또는 생성
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // 새 사용자 생성
      user = await prisma.user.create({
        data: {
          email,
          name: userInfo.kakao_account.profile?.nickname || '카카오 사용자',
          profileImage: userInfo.kakao_account.profile?.profile_image_url,
          role: 'USER',
          emailVerified: new Date(),
          provider: 'kakao',
          providerId: userInfo.id.toString()
        }
      });

      console.log('새 카카오 사용자 생성:', user.id);
    } else {
      // 기존 사용자 정보 업데이트
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: userInfo.kakao_account.profile?.nickname || user.name,
          profileImage: userInfo.kakao_account.profile?.profile_image_url || user.profileImage,
          provider: 'kakao',
          providerId: userInfo.id.toString(),
          lastLoginAt: new Date()
        }
      });
    }

    // 5. OAuth 토큰 저장 (선택적)
    await prisma.oAuthToken.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'kakao'
        }
      },
      create: {
        userId: user.id,
        provider: 'kakao',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000)
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000)
      }
    });

    // 6. 세션 생성
    const session = await createSession(user.id);
    
    // 7. JWT 토큰 생성 (선택적)
    const jwtToken = generateJWT({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // 8. 대시보드로 리다이렉트
    const redirectUrl = state ? decodeURIComponent(state) : '/dashboard';
    
    return redirect(redirectUrl, {
      headers: {
        'Set-Cookie': session.cookie,
        'Authorization': `Bearer ${jwtToken}`
      }
    });

  } catch (error) {
    console.error('카카오 OAuth 처리 실패:', error);
    
    if (error instanceof Response) {
      return error; // redirect 응답
    }
    
    throw redirect('/login?error=oauth_failed');
  }
}

// 카카오 계정 연동 해제
export async function unlinkKakaoAccount(userId: string, accessToken: string): Promise<boolean> {
  try {
    // 카카오 API로 연결 해제 요청
    const response = await fetch('https://kapi.kakao.com/v1/user/unlink', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.ok) {
      // 로컬 DB에서 OAuth 토큰 삭제
      await prisma.oAuthToken.deleteMany({
        where: {
          userId,
          provider: 'kakao'
        }
      });

      // 사용자 정보에서 카카오 연동 정보 제거
      await prisma.user.update({
        where: { id: userId },
        data: {
          provider: null,
          providerId: null
        }
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error('카카오 계정 연동 해제 실패:', error);
    return false;
  }
}

// 카카오 프로필 동기화
export async function syncKakaoProfile(userId: string): Promise<boolean> {
  try {
    const oauthToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'kakao'
        }
      }
    });

    if (!oauthToken || oauthToken.expiresAt < new Date()) {
      return false; // 토큰 만료 또는 없음
    }

    const userInfo = await fetchKakaoUserInfo(oauthToken.accessToken);
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: userInfo.kakao_account.profile?.nickname,
        profileImage: userInfo.kakao_account.profile?.profile_image_url
      }
    });

    return true;
  } catch (error) {
    console.error('카카오 프로필 동기화 실패:', error);
    return false;
  }
}

// 카카오 친구 정보 조회 (선택적 기능)
export async function getKakaoFriends(accessToken: string): Promise<any[]> {
  try {
    const response = await fetch('https://kapi.kakao.com/v1/api/talk/friends', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.elements || [];
  } catch (error) {
    console.error('카카오 친구 정보 조회 실패:', error);
    return [];
  }
}

// 카카오톡 메시지 발송 (선택적 기능)
export async function sendKakaoMessage(
  accessToken: string,
  templateId: number,
  templateArgs?: Record<string, string>
): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      template_id: templateId.toString()
    });

    if (templateArgs) {
      params.append('template_args', JSON.stringify(templateArgs));
    }

    const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    return response.ok;
  } catch (error) {
    console.error('카카오톡 메시지 발송 실패:', error);
    return false;
  }
}