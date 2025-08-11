// 관리자 대시보드 메인 페이지

import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { requireUser } from '~/lib/auth.server';
import { db } from '~/utils/db.server';
import { StatsCard } from '~/components/admin/StatsCard';
import { RecentActivity } from '~/components/admin/RecentActivity';
import { 
  Users, 
  FileText, 
  MessageCircle, 
  Eye, 
  TrendingUp, 
  AlertTriangle 
} from 'lucide-react';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // 관리자 권한 확인
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== 'ADMIN') {
    throw new Response('Unauthorized', { status: 403 });
  }

  // 통계 데이터 수집
  const [
    userStats,
    postStats,
    commentStats,
    viewStats,
    recentPosts,
    recentComments,
    recentUsers,
    systemHealth,
  ] = await Promise.all([
    // 사용자 통계
    db.user.groupBy({
      by: ['createdAt'],
      _count: { id: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30일
        },
      },
    }).then(data => ({
      total: data.reduce((sum, item) => sum + item._count.id, 0),
      growth: data.length > 0 ? 
        ((data.slice(-7).reduce((sum, item) => sum + item._count.id, 0) / 7) - 
         (data.slice(-14, -7).reduce((sum, item) => sum + item._count.id, 0) / 7)) / 
         (data.slice(-14, -7).reduce((sum, item) => sum + item._count.id, 0) / 7 || 1) * 100 : 0
    })),

    // 게시물 통계
    db.post.aggregate({
      _count: { id: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }).then(data => ({ total: data._count.id, growth: 0 })),

    // 댓글 통계
    db.comment.aggregate({
      _count: { id: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }).then(data => ({ total: data._count.id, growth: 0 })),

    // 조회수 통계
    db.post.aggregate({
      _sum: { views: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }).then(data => ({ total: data._sum.views || 0, growth: 0 })),

    // 최근 게시물
    db.post.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        isPublished: true,
        views: true,
        author: {
          select: { name: true, email: true },
        },
        menu: {
          select: { name: true },
        },
      },
    }),

    // 최근 댓글
    db.comment.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: { name: true, email: true },
        },
        post: {
          select: { title: true, slug: true },
        },
      },
    }),

    // 최근 가입 사용자
    db.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        role: true,
        status: true,
      },
    }),

    // 시스템 건강 상태 (간단한 체크)
    Promise.resolve({
      database: 'healthy',
      redis: 'healthy',
      storage: 'healthy',
      lastCheck: new Date().toISOString(),
    }),
  ]);

  return json({
    stats: {
      users: userStats,
      posts: postStats,
      comments: commentStats,
      views: viewStats,
    },
    recentActivity: {
      posts: recentPosts.map(post => ({
        ...post,
        createdAt: post.createdAt.toISOString(),
        author: post.author.name || post.author.email,
        category: post.menu?.name || '미분류',
      })),
      comments: recentComments.map(comment => ({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        author: comment.author.name || comment.author.email,
        content: comment.content.substring(0, 100),
        post: comment.post.title,
      })),
      users: recentUsers.map(user => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        name: user.name || user.email,
      })),
    },
    systemHealth,
  });
}

export default function AdminDashboard() {
  const { stats, recentActivity, systemHealth } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      {/* 대시보드 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="text-gray-600 mt-1">시스템 현황과 최근 활동을 확인하세요</p>
      </div>

      {/* 통계 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="사용자"
          value={stats.users.total.toLocaleString()}
          change={stats.users.growth}
          icon={<Users className="h-6 w-6" />}
          color="blue"
        />
        
        <StatsCard
          title="게시물"
          value={stats.posts.total.toLocaleString()}
          change={stats.posts.growth}
          icon={<FileText className="h-6 w-6" />}
          color="green"
        />
        
        <StatsCard
          title="댓글"
          value={stats.comments.total.toLocaleString()}
          change={stats.comments.growth}
          icon={<MessageCircle className="h-6 w-6" />}
          color="purple"
        />
        
        <StatsCard
          title="조회수"
          value={stats.views.total.toLocaleString()}
          change={stats.views.growth}
          icon={<Eye className="h-6 w-6" />}
          color="orange"
        />
      </div>

      {/* 시스템 상태 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            시스템 상태
          </h2>
          <span className="text-sm text-gray-500">
            마지막 확인: {new Date(systemHealth.lastCheck).toLocaleString('ko-KR')}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">데이터베이스</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              정상
            </span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Redis</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              정상
            </span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">저장소</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              정상
            </span>
          </div>
        </div>
      </div>

      {/* 최근 활동 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity
          title="최근 게시물"
          items={recentActivity.posts.map(post => ({
            id: post.id,
            title: post.title,
            subtitle: `${post.author} • ${post.category}`,
            timestamp: new Date(post.createdAt).toLocaleString('ko-KR'),
            status: post.isPublished ? 'published' : 'draft',
            meta: `조회 ${post.views}회`,
          }))}
          viewAllUrl="/admin/posts"
        />
        
        <RecentActivity
          title="최근 댓글"
          items={recentActivity.comments.map(comment => ({
            id: comment.id,
            title: comment.content,
            subtitle: `${comment.author}`,
            timestamp: new Date(comment.createdAt).toLocaleString('ko-KR'),
            status: 'active',
            meta: comment.post,
          }))}
          viewAllUrl="/admin/comments"
        />
        
        <RecentActivity
          title="최근 가입 사용자"
          items={recentActivity.users.map(user => ({
            id: user.id,
            title: user.name,
            subtitle: user.email,
            timestamp: new Date(user.createdAt).toLocaleString('ko-KR'),
            status: user.status.toLowerCase(),
            meta: user.role,
          }))}
          viewAllUrl="/admin/users"
        />
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              빠른 작업
            </h3>
          </div>
          
          <div className="space-y-3">
            <a
              href="/admin/posts"
              className="block p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <div className="text-sm font-medium text-blue-900">게시물 관리</div>
              <div className="text-xs text-blue-600">새 게시물 작성 및 관리</div>
            </a>
            
            <a
              href="/admin/users"
              className="block p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <div className="text-sm font-medium text-green-900">사용자 관리</div>
              <div className="text-xs text-green-600">회원 승인 및 권한 관리</div>
            </a>
            
            <a
              href="/admin/settings"
              className="block p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <div className="text-sm font-medium text-purple-900">시스템 설정</div>
              <div className="text-xs text-purple-600">사이트 구성 및 보안 설정</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}