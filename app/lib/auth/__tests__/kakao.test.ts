/**
 * 카카오 OAuth 테스트
 */

import {
  getKakaoAuthUrl,
  generateState,
  validateState,
  KAKAO_CONFIG,
} from '../kakao.server';

describe('Kakao OAuth', () => {
  describe('getKakaoAuthUrl', () => {
    it('올바른 카카오 인증 URL을 생성해야 함', () => {
      const state = 'test-state';
      const url = getKakaoAuthUrl(state);
      
      expect(url).toContain(KAKAO_CONFIG.authorizationUrl);
      expect(url).toContain(`client_id=${KAKAO_CONFIG.clientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(KAKAO_CONFIG.redirectUri)}`);
      expect(url).toContain('response_type=code');
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('scope=profile_nickname');
    });

    it('state 없이도 URL을 생성해야 함', () => {
      const url = getKakaoAuthUrl();
      
      expect(url).toContain('state=');
      expect(url).toContain(KAKAO_CONFIG.authorizationUrl);
    });
  });

  describe('generateState', () => {
    it('32자리 hex 문자열을 생성해야 함', () => {
      const state = generateState();
      
      expect(state).toHaveLength(32);
      expect(state).toMatch(/^[a-f0-9]{32}$/);
    });

    it('매번 다른 state를 생성해야 함', () => {
      const state1 = generateState();
      const state2 = generateState();
      const state3 = generateState();
      
      expect(state1).not.toBe(state2);
      expect(state2).not.toBe(state3);
      expect(state1).not.toBe(state3);
    });
  });

  describe('validateState', () => {
    it('같은 state는 true를 반환해야 함', () => {
      const state = generateState();
      
      expect(validateState(state, state)).toBe(true);
    });

    it('다른 state는 false를 반환해야 함', () => {
      const state1 = generateState();
      const state2 = generateState();
      
      expect(validateState(state1, state2)).toBe(false);
    });

    it('빈 state는 false를 반환해야 함', () => {
      expect(validateState('', '')).toBe(false);
      expect(validateState('test', '')).toBe(false);
      expect(validateState('', 'test')).toBe(false);
    });
  });

  describe('KAKAO_CONFIG', () => {
    it('필수 설정값이 있어야 함', () => {
      expect(KAKAO_CONFIG.authorizationUrl).toBe('https://kauth.kakao.com/oauth/authorize');
      expect(KAKAO_CONFIG.tokenUrl).toBe('https://kauth.kakao.com/oauth/token');
      expect(KAKAO_CONFIG.userInfoUrl).toBe('https://kapi.kakao.com/v2/user/me');
      expect(KAKAO_CONFIG.logoutUrl).toBe('https://kapi.kakao.com/v1/user/logout');
    });

    it('환경 변수에서 설정을 읽어야 함', () => {
      // 환경 변수가 설정되어 있다면 해당 값을 사용
      if (process.env.KAKAO_CLIENT_ID) {
        expect(KAKAO_CONFIG.clientId).toBe(process.env.KAKAO_CLIENT_ID);
      }
      
      if (process.env.KAKAO_REDIRECT_URI) {
        expect(KAKAO_CONFIG.redirectUri).toBe(process.env.KAKAO_REDIRECT_URI);
      }
    });
  });
});

// Mock 데이터
export const mockKakaoProfile = {
  id: 123456789,
  connected_at: '2024-01-01T00:00:00Z',
  properties: {
    nickname: '테스트사용자',
    profile_image: 'https://k.kakaocdn.net/test/profile.jpg',
    thumbnail_image: 'https://k.kakaocdn.net/test/thumbnail.jpg',
  },
  kakao_account: {
    profile_nickname_needs_agreement: false,
    profile_image_needs_agreement: false,
    profile: {
      nickname: '테스트사용자',
      thumbnail_image_url: 'https://k.kakaocdn.net/test/thumbnail.jpg',
      profile_image_url: 'https://k.kakaocdn.net/test/profile.jpg',
      is_default_image: false,
    },
    has_email: true,
    email_needs_agreement: false,
    is_email_valid: true,
    is_email_verified: true,
    email: 'test@kakao.com',
  },
};

export const mockTokenResponse = {
  access_token: 'test_access_token_123',
  token_type: 'bearer',
  refresh_token: 'test_refresh_token_456',
  expires_in: 43199,
  scope: 'profile_nickname profile_image account_email',
  refresh_token_expires_in: 5183999,
};