// 네이버 OAuth 인증 시스템

import { redirect } from '@remix-run/node';
import { prisma } from '../../db.server';
import { createSession } from '../session.server';
import { generateJWT } from '../jwt.server';

// 네이버 OAuth 설정
const NAVER_CONFIG = {
  clientId: process.env.NAVER_CLIENT_ID!,
  clientSecret: process.env.NAVER_CLIENT_SECRET!,
  redirectUri: process.env.NAVER_REDIRECT_URI || 'http://localhost:3000/auth/naver/callback',
  authUrl: 'https://nid.naver.com/oauth2.0/authorize',
  tokenUrl: 'https://nid.naver.com/oauth2.0/token',
  userInfoUrl: 'https://openapi.naver.com/v1/nid/me'
};

// 네이버 사용자 정보 타입
interface NaverUserInfo {
  resultcode: string;
  message: string;
  response: {
    id: string;
    email: string;
    verified_email: string;
    name: string;
    gender: string;
    age: string;
    birthday: string;
    profile_image: string;
    birthyear: string;
    mobile: string;
  };
}

// 인증 URL 생성
export function generateNaverAuthUrl(state?: string): string {
  const generatedState = state || Math.random().toString(36).substring(2, 15);
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: NAVER_CONFIG.clientId,
    redirect_uri: NAVER_CONFIG.redirectUri,
    state: generatedState
  });

  return `${NAVER_CONFIG.authUrl}?${params.toString()}`;
}

// 액세스 토큰 교환
async function exchangeCodeForToken(code: string, state: string): Promise<{
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}> {
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: NAVER_CONFIG.clientId,
    client_secret: NAVER_CONFIG.clientSecret,
    code,
    state
  });

  const response = await fetch(NAVER_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenParams.toString()
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('네이버 토큰 교환 실패:', errorData);
    throw new Error('네이버 토큰 교환에 실패했습니다');
  }

  const data = await response.json();
  
  if (data.error) {
    console.error('네이버 토큰 교환 에러:', data.error_description);
    throw new Error(data.error_description || '토큰 교환 실패');
  }

  return data;
}

// 사용자 정보 조회
async function fetchNaverUserInfo(accessToken: string): Promise<NaverUserInfo> {
  const response = await fetch(NAVER_CONFIG.userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('네이버 사용자 정보 조회 실패:', errorData);
    throw new Error('네이버 사용자 정보 조회에 실패했습니다');
  }

  return await response.json();
}

// 네이버 OAuth 콜백 처리
export async function handleNaverCallback(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // 에러 처리
  if (error) {
    console.error('네이버 OAuth 에러:', error, errorDescription);
    throw redirect('/login?error=oauth_error');
  }

  if (!code || !state) {
    throw redirect('/login?error=missing_params');
  }

  try {
    // 1. 액세스 토큰 교환
    const tokenData = await exchangeCodeForToken(code, state);

    // 2. 사용자 정보 조회
    const userInfo = await fetchNaverUserInfo(tokenData.access_token);

    // 3. 응답 검증
    if (userInfo.resultcode !== '00') {
      console.error('네이버 사용자 정보 조회 실패:', userInfo.message);
      throw redirect('/login?error=userinfo_failed');
    }

    const profile = userInfo.response;
    const email = profile.email;

    if (!email) {
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
          name: profile.name || '네이버 사용자',
          profileImage: profile.profile_image,
          role: 'USER',
          emailVerified: new Date(), // 네이버는 이메일 인증된 계정만 제공
          provider: 'naver',
          providerId: profile.id,
          // 추가 네이버 정보 저장 (선택적)
          metadata: {
            gender: profile.gender,
            age: profile.age,
            birthday: profile.birthday,
            birthyear: profile.birthyear,
            mobile: profile.mobile
          }
        }
      });

      console.log('새 네이버 사용자 생성:', user.id);
    } else {
      // 기존 사용자 정보 업데이트
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.name || user.name,
          profileImage: profile.profile_image || user.profileImage,
          provider: 'naver',
          providerId: profile.id,
          lastLoginAt: new Date(),
          metadata: {
            ...((user.metadata as any) || {}),
            gender: profile.gender,
            age: profile.age,
            birthday: profile.birthday,
            birthyear: profile.birthyear,
            mobile: profile.mobile
          }
        }
      });
    }

    // 5. OAuth 토큰 저장
    await prisma.oAuthToken.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'naver'
        }
      },
      create: {
        userId: user.id,
        provider: 'naver',
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
    
    // 7. JWT 토큰 생성
    const jwtToken = generateJWT({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // 8. 대시보드로 리다이렉트
    const redirectUrl = '/dashboard';
    
    return redirect(redirectUrl, {
      headers: {
        'Set-Cookie': session.cookie,
        'Authorization': `Bearer ${jwtToken}`
      }
    });

  } catch (error) {
    console.error('네이버 OAuth 처리 실패:', error);
    
    if (error instanceof Response) {
      return error; // redirect 응답
    }
    
    throw redirect('/login?error=oauth_failed');
  }
}

// 액세스 토큰 갱신
export async function refreshNaverToken(userId: string): Promise<boolean> {
  try {
    const oauthToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'naver'
        }
      }
    });

    if (!oauthToken?.refreshToken) {
      return false;
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: NAVER_CONFIG.clientId,
      client_secret: NAVER_CONFIG.clientSecret,
      refresh_token: oauthToken.refreshToken
    });

    const response = await fetch(NAVER_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      return false;
    }

    const tokenData = await response.json();

    if (tokenData.error) {
      return false;
    }

    // 토큰 업데이트
    await prisma.oAuthToken.update({
      where: { id: oauthToken.id },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || oauthToken.refreshToken,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000)
      }
    });

    return true;
  } catch (error) {
    console.error('네이버 토큰 갱신 실패:', error);
    return false;
  }
}

// 네이버 계정 연동 해제
export async function unlinkNaverAccount(userId: string, accessToken: string): Promise<boolean> {
  try {
    // 네이버 API로 연결 해제 요청
    const params = new URLSearchParams({
      grant_type: 'delete',
      client_id: NAVER_CONFIG.clientId,
      client_secret: NAVER_CONFIG.clientSecret,
      access_token: accessToken
    });

    const response = await fetch(NAVER_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (response.ok) {
      // 로컬 DB에서 OAuth 토큰 삭제
      await prisma.oAuthToken.deleteMany({
        where: {
          userId,
          provider: 'naver'
        }
      });

      // 사용자 정보에서 네이버 연동 정보 제거
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
    console.error('네이버 계정 연동 해제 실패:', error);
    return false;
  }
}

// 네이버 프로필 동기화
export async function syncNaverProfile(userId: string): Promise<boolean> {
  try {
    const oauthToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'naver'
        }
      }
    });

    if (!oauthToken) {
      return false;
    }

    // 토큰 만료 확인 및 갱신
    if (oauthToken.expiresAt < new Date()) {
      const refreshed = await refreshNaverToken(userId);
      if (!refreshed) {
        return false;
      }
      
      // 갱신된 토큰 다시 조회
      const updatedToken = await prisma.oAuthToken.findUnique({
        where: { id: oauthToken.id }
      });
      
      if (!updatedToken) {
        return false;
      }
      
      const userInfo = await fetchNaverUserInfo(updatedToken.accessToken);
      
      if (userInfo.resultcode === '00') {
        const profile = userInfo.response;
        
        await prisma.user.update({
          where: { id: userId },
          data: {
            name: profile.name,
            profileImage: profile.profile_image,
            metadata: {
              gender: profile.gender,
              age: profile.age,
              birthday: profile.birthday,
              birthyear: profile.birthyear,
              mobile: profile.mobile
            }
          }
        });
        
        return true;
      }
    } else {
      const userInfo = await fetchNaverUserInfo(oauthToken.accessToken);
      
      if (userInfo.resultcode === '00') {
        const profile = userInfo.response;
        
        await prisma.user.update({
          where: { id: userId },
          data: {
            name: profile.name,
            profileImage: profile.profile_image
          }
        });
        
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('네이버 프로필 동기화 실패:', error);
    return false;
  }
}

// 네이버 쇼핑 API 연동 (선택적 기능)
export async function getNaverShoppingSearch(
  accessToken: string,
  query: string,
  options?: {
    display?: number;
    start?: number;
    sort?: 'sim' | 'date' | 'asc' | 'dsc';
  }
): Promise<any> {
  try {
    const params = new URLSearchParams({
      query,
      display: (options?.display || 10).toString(),
      start: (options?.start || 1).toString(),
      sort: options?.sort || 'sim'
    });

    const response = await fetch(`https://openapi.naver.com/v1/search/shop?${params.toString()}`, {
      headers: {
        'X-Naver-Client-Id': NAVER_CONFIG.clientId,
        'X-Naver-Client-Secret': NAVER_CONFIG.clientSecret
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('네이버 쇼핑 검색 실패:', error);
    return null;
  }
}