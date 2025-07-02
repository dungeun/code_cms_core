import { Form, Link, useActionData } from '@remix-run/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { useEffect } from 'react';

// 비밀번호 재설정 요청 폼 스키마
const resetRequestSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
});

// 비밀번호 재설정 폼 스키마
const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      '비밀번호는 대문자, 소문자, 숫자를 포함해야 합니다'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

export type ResetRequestFormData = z.infer<typeof resetRequestSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface PasswordResetFormProps {
  mode: 'request' | 'reset';
  token?: string;
  error?: string;
  success?: boolean;
}

export function PasswordResetForm({ mode, token, error, success }: PasswordResetFormProps) {
  const actionData = useActionData<{ error?: string; success?: boolean }>();
  
  if (mode === 'request') {
    return <ResetRequestForm error={error || actionData?.error} success={success || actionData?.success} />;
  }
  
  return <ResetPasswordForm token={token} error={error || actionData?.error} />;
}

function ResetRequestForm({ error, success }: { error?: string; success?: boolean }) {
  const {
    register,
    formState: { errors },
    setError,
  } = useForm<ResetRequestFormData>({
    resolver: zodResolver(resetRequestSchema),
  });

  useEffect(() => {
    if (error) {
      setError('root', { message: error });
    }
  }, [error, setError]);

  if (success) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">이메일을 확인하세요</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            비밀번호 재설정 링크를 이메일로 보내드렸습니다.
          </p>
        </div>
        <div className="rounded-lg bg-green-50 p-4">
          <p className="text-sm text-green-800">
            이메일이 도착하지 않았다면 스팸 폴더를 확인해주세요.
          </p>
        </div>
        <div className="text-center">
          <Link to="/auth/login" className="text-sm text-primary hover:underline">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">비밀번호 찾기</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
        </p>
      </div>

      <Form method="post" className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            이메일
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby="email-error"
          />
          {errors.email && (
            <p className="text-sm text-destructive" id="email-error">
              {errors.email.message}
            </p>
          )}
        </div>

        {(error || errors.root) && (
          <div className="rounded-md bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {error || errors.root?.message}
            </p>
          </div>
        )}

        <Button type="submit" className="w-full">
          재설정 링크 보내기
        </Button>
      </Form>

      <div className="text-center">
        <Link to="/auth/login" className="text-sm text-primary hover:underline">
          로그인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

function ResetPasswordForm({ token, error }: { token?: string; error?: string }) {
  const {
    register,
    formState: { errors },
    setError,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    if (error) {
      setError('root', { message: error });
    }
  }, [error, setError]);

  if (!token) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">잘못된 링크</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            비밀번호 재설정 링크가 올바르지 않습니다.
          </p>
        </div>
        <div className="text-center">
          <Link to="/auth/forgot-password" className="text-sm text-primary hover:underline">
            비밀번호 재설정 다시 요청하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">새 비밀번호 설정</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          새로운 비밀번호를 입력해주세요.
        </p>
      </div>

      <Form method="post" className="space-y-4">
        <input type="hidden" name="token" value={token} />
        
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            새 비밀번호
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="password-error"
          />
          {errors.password && (
            <p className="text-sm text-destructive" id="password-error">
              {errors.password.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            대문자, 소문자, 숫자를 포함한 8자 이상
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            비밀번호 확인
          </label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            aria-invalid={errors.confirmPassword ? true : undefined}
            aria-describedby="confirmPassword-error"
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive" id="confirmPassword-error">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {(error || errors.root) && (
          <div className="rounded-md bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {error || errors.root?.message}
            </p>
          </div>
        )}

        <Button type="submit" className="w-full">
          비밀번호 재설정
        </Button>
      </Form>
    </div>
  );
}