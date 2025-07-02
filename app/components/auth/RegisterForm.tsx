import { Form, Link, useActionData, useSearchParams } from '@remix-run/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { useEffect } from 'react';

// 회원가입 폼 스키마
const registerSchema = z.object({
  username: z
    .string()
    .min(3, '사용자명은 3자 이상이어야 합니다')
    .max(20, '사용자명은 20자 이하여야 합니다')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      '사용자명은 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다'
    ),
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      '비밀번호는 대문자, 소문자, 숫자를 포함해야 합니다'
    ),
  confirmPassword: z.string(),
  name: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  error?: string;
}

export function RegisterForm({ error }: RegisterFormProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  const actionData = useActionData<{ error?: string; fieldErrors?: Record<string, string> }>();
  
  const {
    register,
    formState: { errors },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (actionData?.error) {
      setError('root', { message: actionData.error });
    }
    if (actionData?.fieldErrors) {
      Object.entries(actionData.fieldErrors).forEach(([field, message]) => {
        setError(field as keyof RegisterFormData, { message });
      });
    }
  }, [actionData, setError]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">회원가입</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link
            to={{
              pathname: '/auth/login',
              search: searchParams.toString(),
            }}
            className="font-medium text-primary hover:underline"
          >
            로그인
          </Link>
        </p>
      </div>

      <Form method="post" className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium">
            사용자명 <span className="text-destructive">*</span>
          </label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            {...register('username')}
            aria-invalid={errors.username ? true : undefined}
            aria-describedby="username-error"
          />
          {errors.username && (
            <p className="text-sm text-destructive" id="username-error">
              {errors.username.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            이메일 <span className="text-destructive">*</span>
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

        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            이름 (선택사항)
          </label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            {...register('name')}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            비밀번호 <span className="text-destructive">*</span>
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
            비밀번호 확인 <span className="text-destructive">*</span>
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

        <div className="text-xs text-muted-foreground">
          회원가입 시{' '}
          <Link to="/terms" className="underline">
            이용약관
          </Link>{' '}
          및{' '}
          <Link to="/privacy" className="underline">
            개인정보처리방침
          </Link>
          에 동의하는 것으로 간주합니다.
        </div>

        <Button type="submit" className="w-full">
          회원가입
        </Button>
      </Form>
    </div>
  );
}