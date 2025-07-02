import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { StatsCard } from "~/components/admin/StatsCard";
import { RecentActivity } from "~/components/admin/RecentActivity";
import { Users, FileText, MessageSquare, Eye } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUser } from "~/lib/auth.server";
import { startOfDay } from "date-fns";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);

  // 통계 데이터 가져오기
  const [userCount, postCount, commentCount, todayVisitors] = await Promise.all([
    db.user.count(),
    db.post.count(),
    db.comment.count(),
    // 오늘 방문자 수 (실제로는 별도의 방문 기록 테이블이 필요하지만, 여기서는 간단히 구현)
    db.user.count({
      where: {
        createdAt: {
          gte: startOfDay(new Date()),
        },
      },
    }),
  ]);

  // 최근 활동 가져오기
  const recentActivities = await db.$transaction(async (tx) => {
    const recentPosts = await tx.post.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { name: true, email: true },
        },
      },
    });

    const recentComments = await tx.comment.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { name: true, email: true },
        },
        post: {
          select: { title: true },
        },
      },
    });

    const recentUsers = await tx.user.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    // 모든 활동을 합쳐서 정렬
    const activities = [
      ...recentPosts.map((post) => ({
        id: post.id,
        type: 'post' as const,
        title: post.title,
        description: post.excerpt || '',
        createdAt: post.createdAt,
        user: post.author,
      })),
      ...recentComments.map((comment) => ({
        id: comment.id,
        type: 'comment' as const,
        title: `"${comment.post.title}"에 댓글`,
        description: comment.content.slice(0, 100) + (comment.content.length > 100 ? '...' : ''),
        createdAt: comment.createdAt,
        user: comment.author,
      })),
      ...recentUsers.map((user) => ({
        id: user.id,
        type: 'user' as const,
        title: '새로운 회원 가입',
        description: '',
        createdAt: user.createdAt,
        user: { name: user.name || '', email: user.email },
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);

    return activities;
  });

  return json({
    stats: {
      userCount,
      postCount,
      commentCount,
      todayVisitors,
    },
    recentActivities,
  });
}

export default function AdminDashboard() {
  const { stats, recentActivities } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
        <p className="text-muted-foreground">사이트 전체 현황을 한눈에 확인하세요.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="총 사용자"
          value={stats.userCount}
          icon={Users}
          description="전체 가입된 사용자 수"
        />
        <StatsCard
          title="총 게시글"
          value={stats.postCount}
          icon={FileText}
          description="작성된 모든 게시글"
        />
        <StatsCard
          title="총 댓글"
          value={stats.commentCount}
          icon={MessageSquare}
          description="작성된 모든 댓글"
        />
        <StatsCard
          title="오늘 방문자"
          value={stats.todayVisitors}
          icon={Eye}
          description="오늘 신규 가입자"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RecentActivity activities={recentActivities} />
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">빠른 작업</h3>
          <div className="grid gap-2">
            <a
              href="/admin/posts/new"
              className="flex items-center justify-center rounded-lg border border-dashed p-4 text-sm hover:bg-gray-50"
            >
              새 게시글 작성
            </a>
            <a
              href="/admin/users"
              className="flex items-center justify-center rounded-lg border border-dashed p-4 text-sm hover:bg-gray-50"
            >
              사용자 관리
            </a>
            <a
              href="/admin/settings"
              className="flex items-center justify-center rounded-lg border border-dashed p-4 text-sm hover:bg-gray-50"
            >
              사이트 설정
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}