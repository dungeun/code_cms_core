import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams } from "@remix-run/react";
import { UserTable } from "~/components/admin/UserTable";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Search } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUser } from "~/lib/auth.server";
import { z } from "zod";

const actionSchema = z.object({
  intent: z.enum(['updateRole', 'updateActive']),
  userId: z.string(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';

  const users = await db.user.findMany({
    where: search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
          comments: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return json({ users });
}

export async function action({ request }: ActionFunctionArgs) {
  const currentUser = await requireUser(request);
  
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  
  try {
    const parsed = actionSchema.parse(data);
    
    // 자기 자신의 권한은 변경할 수 없음
    if (parsed.userId === currentUser.id && parsed.intent === 'updateRole') {
      return json({ error: '자신의 권한은 변경할 수 없습니다.' }, { status: 400 });
    }

    if (parsed.intent === 'updateRole' && parsed.role) {
      await db.user.update({
        where: { id: parsed.userId },
        data: { role: parsed.role },
      });
    } else if (parsed.intent === 'updateActive' && parsed.isActive !== undefined) {
      await db.user.update({
        where: { id: parsed.userId },
        data: { isActive: parsed.isActive === 'true' },
      });
    }

    return json({ success: true });
  } catch (error) {
    return json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
}

export default function AdminUsers() {
  const { users } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleRoleChange = (userId: string, role: 'USER' | 'ADMIN') => {
    fetcher.submit(
      { intent: 'updateRole', userId, role },
      { method: 'post' }
    );
  };

  const handleActiveChange = (userId: string, isActive: boolean) => {
    fetcher.submit(
      { intent: 'updateActive', userId, isActive: String(isActive) },
      { method: 'post' }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">사용자 관리</h2>
        <p className="text-muted-foreground">모든 사용자를 관리하고 권한을 설정합니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
          <CardDescription>총 {users.length}명의 사용자</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <form className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  name="search"
                  placeholder="이메일 또는 이름으로 검색..."
                  defaultValue={searchParams.get('search') || ''}
                  className="pl-8"
                />
              </div>
              <Button type="submit">검색</Button>
              {searchParams.get('search') && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSearchParams({})}
                >
                  초기화
                </Button>
              )}
            </form>
          </div>

          <UserTable
            users={users}
            onRoleChange={handleRoleChange}
            onActiveChange={handleActiveChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}