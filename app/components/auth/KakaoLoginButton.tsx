/**
 * 카카오 로그인 버튼 컴포넌트
 */

import { Button } from '~/components/ui/button';

interface KakaoLoginButtonProps {
  returnTo?: string;
  className?: string;
}

export function KakaoLoginButton({ returnTo, className }: KakaoLoginButtonProps) {
  const loginUrl = returnTo 
    ? `/auth/kakao?returnTo=${encodeURIComponent(returnTo)}`
    : '/auth/kakao';

  return (
    <a href={loginUrl} className="block">
      <Button
        type="button"
        className={`w-full bg-[#FEE500] text-black hover:bg-[#FDD835] ${className}`}
        size="lg"
      >
        <svg
          className="mr-2 h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 3C6.48 3 2 6.64 2 11.11c0 2.89 1.88 5.42 4.7 6.86l-.78 2.84c-.08.29.04.6.28.78.14.1.3.15.47.15.12 0 .24-.03.35-.08l3.36-2.25c.54.08 1.08.12 1.62.12 5.52 0 10-3.64 10-8.11S17.52 3 12 3z"/>
        </svg>
        카카오로 시작하기
      </Button>
    </a>
  );
}

/**
 * 카카오 로그인 버튼 (작은 버전)
 */
export function KakaoLoginButtonSmall({ returnTo, className }: KakaoLoginButtonProps) {
  const loginUrl = returnTo 
    ? `/auth/kakao?returnTo=${encodeURIComponent(returnTo)}`
    : '/auth/kakao';

  return (
    <a href={loginUrl}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`bg-[#FEE500] text-black border-[#FEE500] hover:bg-[#FDD835] ${className}`}
      >
        <svg
          className="mr-1 h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 3C6.48 3 2 6.64 2 11.11c0 2.89 1.88 5.42 4.7 6.86l-.78 2.84c-.08.29.04.6.28.78.14.1.3.15.47.15.12 0 .24-.03.35-.08l3.36-2.25c.54.08 1.08.12 1.62.12 5.52 0 10-3.64 10-8.11S17.52 3 12 3z"/>
        </svg>
        카카오
      </Button>
    </a>
  );
}

/**
 * 카카오 로그인 아이콘 버튼
 */
export function KakaoLoginIcon({ returnTo, className }: KakaoLoginButtonProps) {
  const loginUrl = returnTo 
    ? `/auth/kakao?returnTo=${encodeURIComponent(returnTo)}`
    : '/auth/kakao';

  return (
    <a href={loginUrl} title="카카오로 로그인">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE500] hover:bg-[#FDD835] transition-colors ${className}`}>
        <svg
          className="h-6 w-6 text-black"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 3C6.48 3 2 6.64 2 11.11c0 2.89 1.88 5.42 4.7 6.86l-.78 2.84c-.08.29.04.6.28.78.14.1.3.15.47.15.12 0 .24-.03.35-.08l3.36-2.25c.54.08 1.08.12 1.62.12 5.52 0 10-3.64 10-8.11S17.52 3 12 3z"/>
        </svg>
      </div>
    </a>
  );
}