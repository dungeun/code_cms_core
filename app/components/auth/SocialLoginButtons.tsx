/**
 * 소셜 로그인 버튼 통합 컴포넌트
 * 카카오, 네이버 등 여러 소셜 로그인을 한 곳에서 관리
 */

import { KakaoLoginButton, KakaoLoginButtonSmall, KakaoLoginIcon } from './KakaoLoginButton';
import { NaverLoginButton, NaverLoginButtonSmall, NaverLoginIcon } from './NaverLoginButton';

interface SocialLoginButtonsProps {
  returnTo?: string;
  className?: string;
  size?: 'large' | 'small' | 'icon';
  providers?: ('kakao' | 'naver' | 'google')[];
}

/**
 * 소셜 로그인 버튼 그룹
 */
export function SocialLoginButtons({ 
  returnTo, 
  className = '',
  size = 'large',
  providers = ['kakao', 'naver']
}: SocialLoginButtonsProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {providers.includes('kakao') && (
        size === 'large' ? <KakaoLoginButton returnTo={returnTo} /> :
        size === 'small' ? <KakaoLoginButtonSmall returnTo={returnTo} /> :
        <KakaoLoginIcon returnTo={returnTo} />
      )}
      
      {providers.includes('naver') && (
        size === 'large' ? <NaverLoginButton returnTo={returnTo} /> :
        size === 'small' ? <NaverLoginButtonSmall returnTo={returnTo} /> :
        <NaverLoginIcon returnTo={returnTo} />
      )}
    </div>
  );
}

/**
 * 소셜 로그인 아이콘 그룹 (가로 배치)
 */
export function SocialLoginIcons({ 
  returnTo, 
  className = '',
  providers = ['kakao', 'naver']
}: SocialLoginButtonsProps) {
  return (
    <div className={`flex items-center justify-center space-x-4 ${className}`}>
      {providers.includes('kakao') && <KakaoLoginIcon returnTo={returnTo} />}
      {providers.includes('naver') && <NaverLoginIcon returnTo={returnTo} />}
    </div>
  );
}

/**
 * 소셜 로그인 구분선
 */
export function SocialLoginDivider({ text = '또는' }: { text?: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-gray-300" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="bg-white px-4 text-gray-500">{text}</span>
      </div>
    </div>
  );
}

/**
 * 로그인 페이지용 소셜 로그인 섹션
 */
export function SocialLoginSection({ returnTo }: { returnTo?: string }) {
  return (
    <div className="mt-6">
      <SocialLoginDivider text="간편 로그인" />
      <SocialLoginButtons returnTo={returnTo} size="large" />
      <p className="mt-4 text-center text-xs text-gray-500">
        소셜 계정으로 로그인하면 별도 회원가입 없이 서비스를 이용할 수 있습니다.
      </p>
    </div>
  );
}