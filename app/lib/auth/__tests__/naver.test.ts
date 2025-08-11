/**
 * 네이버 OAuth 테스트
 */

import {
  getNaverAuthUrl,
  generateState,
  validateState,
  NAVER_CONFIG,
} from '../naver.server';

describe('Naver OAuth', () => {
  describe('getNaverAuthUrl', () => {
    it('올바른 네이버 인증 URL을 생성해야 함', () => {
      const state = 'test-state';
      const url = getNaverAuthUrl(state);
      
      expect(url).toContain(NAVER_CONFIG.authorizationUrl);
      expect(url).toContain(`client_id=${NAVER_CONFIG.clientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(NAVER_CONFIG.redirectUri)}`);
      expect(url).toContain('response_type=code');
      expect(url).toContain(`state=${state}`);
    });

    it('state 없이도 URL을 생성해야 함', () => {
      const url = getNaverAuthUrl();
      
      expect(url).toContain('state=');
      expect(url).toContain(NAVER_CONFIG.authorizationUrl);
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
  });

  describe('NAVER_CONFIG', () => {
    it('필수 설정값이 있어야 함', () => {
      expect(NAVER_CONFIG.authorizationUrl).toBe('https://nid.naver.com/oauth2.0/authorize');
      expect(NAVER_CONFIG.tokenUrl).toBe('https://nid.naver.com/oauth2.0/token');
      expect(NAVER_CONFIG.userInfoUrl).toBe('https://openapi.naver.com/v1/nid/me');
    });

    it('환경 변수에서 설정을 읽어야 함', () => {
      // 환경 변수가 설정되어 있다면 해당 값을 사용
      if (process.env.NAVER_CLIENT_ID) {
        expect(NAVER_CONFIG.clientId).toBe(process.env.NAVER_CLIENT_ID);
      }
      
      if (process.env.NAVER_REDIRECT_URI) {
        expect(NAVER_CONFIG.redirectUri).toBe(process.env.NAVER_REDIRECT_URI);
      }
    });
  });
});

// Mock 데이터
export const mockNaverProfile = {
  resultcode: '00',
  message: 'success',
  response: {
    id: 'naver_unique_id_123',
    nickname: '테스트유저',
    name: '홍길동',
    email: 'test@naver.com',
    gender: 'M' as const,
    age: '20-29',
    birthday: '01-01',
    birthyear: '1990',
    profile_image: 'https://phinf.pstatic.net/test/profile.jpg',
    mobile: '010-1234-5678',
    mobile_e164: '+821012345678',
  },
};

export const mockTokenResponse = {
  access_token: 'test_access_token_abc',
  refresh_token: 'test_refresh_token_xyz',
  token_type: 'bearer',
  expires_in: '3600',
};