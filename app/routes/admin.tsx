import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { AdminLayout } from "~/components/admin/AdminLayout";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/utils/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  
  // 관리자 권한 체크
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!dbUser || dbUser.role !== 'ADMIN') {
    throw redirect('/');
  }

  return json({ user: dbUser });
}

export default function AdminRoute() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <AdminLayout user={user}>
      <Outlet />
    </AdminLayout>
  );
}