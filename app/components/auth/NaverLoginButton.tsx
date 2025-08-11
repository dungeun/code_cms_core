/**
 * 네이버 로그인 버튼 컴포넌트
 */

import { Button } from '~/components/ui/button';

interface NaverLoginButtonProps {
  returnTo?: string;
  className?: string;
}

export function NaverLoginButton({ returnTo, className }: NaverLoginButtonProps) {
  const loginUrl = returnTo 
    ? `/auth/naver?returnTo=${encodeURIComponent(returnTo)}`
    : '/auth/naver';

  return (
    <a href={loginUrl} className="block">
      <Button
        type="button"
        className={`w-full bg-[#03C75A] text-white hover:bg-[#02B050] ${className}`}
        size="lg"
      >
        <svg
          className="mr-2 h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/>
        </svg>
        네이버로 시작하기
      </Button>
    </a>
  );
}

/**
 * 네이버 로그인 버튼 (작은 버전)
 */
export function NaverLoginButtonSmall({ returnTo, className }: NaverLoginButtonProps) {
  const loginUrl = returnTo 
    ? `/auth/naver?returnTo=${encodeURIComponent(returnTo)}`
    : '/auth/naver';

  return (
    <a href={loginUrl}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`bg-[#03C75A] text-white border-[#03C75A] hover:bg-[#02B050] ${className}`}
      >
        <svg
          className="mr-1 h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/>
        </svg>
        네이버
      </Button>
    </a>
  );
}

/**
 * 네이버 로그인 아이콘 버튼
 */
export function NaverLoginIcon({ returnTo, className }: NaverLoginButtonProps) {
  const loginUrl = returnTo 
    ? `/auth/naver?returnTo=${encodeURIComponent(returnTo)}`
    : '/auth/naver';

  return (
    <a href={loginUrl} title="네이버로 로그인">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#03C75A] hover:bg-[#02B050] transition-colors ${className}`}>
        <svg
          className="h-5 w-5 text-white"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/>
        </svg>
      </div>
    </a>
  );
}