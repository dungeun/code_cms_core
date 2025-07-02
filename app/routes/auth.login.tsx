import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { LoginForm } from '~/components/auth/LoginForm';
import { createUserSession, getUserId, verifyLogin } from '~/lib/auth.server';
import { safeRedirect } from '~/lib/utils';

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect('/');
  
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const emailOrUsername = formData.get('emailOrUsername');
  const password = formData.get('password');
  const remember = formData.get('remember') === 'on';
  const redirectTo = safeRedirect(formData.get('redirectTo'), '/');

  if (typeof emailOrUsername !== 'string' || emailOrUsername.length === 0) {
    return json(
      { error: '이메일 또는 사용자명을 입력하세요' },
      { status: 400 }
    );
  }

  if (typeof password !== 'string' || password.length === 0) {
    return json(
      { error: '비밀번호를 입력하세요' },
      { status: 400 }
    );
  }

  const user = await verifyLogin(emailOrUsername, password);

  if (!user) {
    return json(
      { error: '이메일/사용자명 또는 비밀번호가 올바르지 않습니다' },
      { status: 400 }
    );
  }

  return createUserSession(user.id, redirectTo, remember);
}

export default function LoginPage() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div className="container py-8">
      <LoginForm />
    </div>
  );
}