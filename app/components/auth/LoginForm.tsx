import { Form, Link, useActionData, useSearchParams } from '@remix-run/react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { useRef } from 'react';

interface LoginFormProps {
  error?: string;
}

export function LoginForm({ error }: LoginFormProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  const actionData = useActionData<{ error?: string }>();
  const formRef = useRef<HTMLFormElement>(null);

  const handleTestLogin = (email: string, password: string) => {
    // 폼 값 설정
    const emailInput = document.getElementById('emailOrUsername') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    
    if (emailInput && passwordInput) {
      emailInput.value = email;
      passwordInput.value = password;
      
      // 폼 제출
      if (formRef.current) {
        formRef.current.requestSubmit();
      }
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">로그인</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          계정이 없으신가요?{' '}
          <Link
            to={{
              pathname: '/auth/register',
              search: searchParams.toString(),
            }}
            className="font-medium text-primary hover:underline"
          >
            회원가입
          </Link>
        </p>
      </div>

      <Form ref={formRef} method="post" className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        
        <div className="space-y-2">
          <label htmlFor="emailOrUsername" className="text-sm font-medium">
            이메일 또는 사용자명
          </label>
          <Input
            id="emailOrUsername"
            name="emailOrUsername"
            type="text"
            autoComplete="username"
            required
            aria-describedby="emailOrUsername-error"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            비밀번호
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-describedby="password-error"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="remember" className="text-sm">
              로그인 상태 유지
            </label>
          </div>

          <Link
            to="/auth/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        {(error || actionData?.error) && (
          <div className="rounded-md bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {error || actionData?.error}
            </p>
          </div>
        )}

        <Button type="submit" className="w-full">
          로그인
        </Button>
      </Form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">또는</span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          테스트 계정으로 둘러보기
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleTestLogin('admin@bleecms.com', 'admin123!@#')}
            className="w-full"
          >
            <div className="text-left">
              <div className="font-medium">관리자</div>
              <div className="text-xs text-muted-foreground">admin@bleecms.com</div>
            </div>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleTestLogin('user1@example.com', 'password123')}
            className="w-full"
          >
            <div className="text-left">
              <div className="font-medium">일반 사용자</div>
              <div className="text-xs text-muted-foreground">user1@example.com</div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}