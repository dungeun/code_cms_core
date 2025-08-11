// 관리자 분석 데이터 API

import type { LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireUser } from '../lib/auth.server';
import { db } from '~/utils/db.server';

export const loader: LoaderFunction = async ({ request }) => {
  const user = await requireUser(request);
  
  // 관리자 권한 확인
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (dbUser?.role !== 'ADMIN') {
    throw new Response('Unauthorized', { status: 403 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '7d';
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  // 기간 계산
  let dateFilter: any;
  if (startDate && endDate) {
    dateFilter = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  } else {
    const daysBack = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    dateFilter = {
      gte: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000),
    };
  }

  try {
    // 병렬로 모든 분석 데이터 수집
    const [
      userGrowth,
      postStats,
      commentStats,
      viewStats,
      categoryStats,
      popularPosts,
      activeUsers,
      deviceStats,
      trafficSources,
    ] = await Promise.all([
      // 사용자 증가 추이
      db.user.groupBy({
        by: ['createdAt'],
        _count: { id: true },
        where: { createdAt: dateFilter },
        orderBy: { createdAt: 'asc' },
      }),

      // 게시물 통계
      db.post.groupBy({
        by: ['createdAt'],
        _count: { id: true },
        _sum: { views: true },
        where: { 
          createdAt: dateFilter,
          isPublished: true,
        },
        orderBy: { createdAt: 'asc' },
      }),

      // 댓글 통계
      db.comment.groupBy({
        by: ['createdAt'],
        _count: { id: true },
        where: { createdAt: dateFilter },
        orderBy: { createdAt: 'asc' },
      }),

      // 조회수 통계 (일별)
      db.post.groupBy({
        by: ['updatedAt'], // 조회수 업데이트 시간 기준
        _sum: { views: true },
        where: { 
          updatedAt: dateFilter,
          isPublished: true,
        },
        orderBy: { updatedAt: 'asc' },
      }),

      // 카테고리별 게시물 수
      db.menu.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              posts: {
                where: {
                  isPublished: true,
                  createdAt: dateFilter,
                },
              },
            },
          },
        },
        orderBy: {
          posts: {
            _count: 'desc',
          },
        },
        take: 10,
      }),

      // 인기 게시물
      db.post.findMany({
        where: {
          isPublished: true,
          createdAt: dateFilter,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          views: true,
          author: { select: { name: true, email: true } },
          menu: { select: { name: true } },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
        orderBy: { views: 'desc' },
        take: 10,
      }),

      // 활성 사용자
      db.user.findMany({
        where: {
          lastLoginAt: dateFilter,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          lastLoginAt: true,
          _count: {
            select: {
              posts: {
                where: { createdAt: dateFilter },
              },
              comments: {
                where: { createdAt: dateFilter },
              },
            },
          },
        },
        orderBy: { lastLoginAt: 'desc' },
        take: 20,
      }),

      // 디바이스 통계 (간단한 모의 데이터)
      Promise.resolve([
        { device: 'desktop', count: Math.floor(Math.random() * 1000) + 500 },
        { device: 'mobile', count: Math.floor(Math.random() * 800) + 400 },
        { device: 'tablet', count: Math.floor(Math.random() * 200) + 100 },
      ]),

      // 트래픽 소스 (간단한 모의 데이터)
      Promise.resolve([
        { source: 'direct', count: Math.floor(Math.random() * 500) + 300 },
        { source: 'search', count: Math.floor(Math.random() * 400) + 250 },
        { source: 'social', count: Math.floor(Math.random() * 200) + 100 },
        { source: 'referral', count: Math.floor(Math.random() * 150) + 75 },
      ]),
    ]);

    // 데이터 가공 및 응답 구성
    const response = {
      period,
      dateRange: {
        start: dateFilter.gte?.toISOString(),
        end: dateFilter.lte?.toISOString() || new Date().toISOString(),
      },
      
      // 성장 지표
      growth: {
        users: {
          data: userGrowth.map(item => ({
            date: item.createdAt.toISOString().split('T')[0],
            count: item._count.id,
          })),
          total: userGrowth.reduce((sum, item) => sum + item._count.id, 0),
        },
        posts: {
          data: postStats.map(item => ({
            date: item.createdAt.toISOString().split('T')[0],
            count: item._count.id,
            views: item._sum.views || 0,
          })),
          total: postStats.reduce((sum, item) => sum + item._count.id, 0),
          totalViews: postStats.reduce((sum, item) => sum + (item._sum.views || 0), 0),
        },
        comments: {
          data: commentStats.map(item => ({
            date: item.createdAt.toISOString().split('T')[0],
            count: item._count.id,
          })),
          total: commentStats.reduce((sum, item) => sum + item._count.id, 0),
        },
      },

      // 콘텐츠 분석
      content: {
        categories: categoryStats.map(category => ({
          id: category.id,
          name: category.name,
          postCount: category._count.posts,
        })),
        popularPosts: popularPosts.map(post => ({
          id: post.id,
          title: post.title,
          views: post.views,
          comments: post._count.comments,
          likes: post._count.likes,
          author: post.author.name || post.author.email,
          category: post.menu?.name || '미분류',
        })),
      },

      // 사용자 분석
      users: {
        active: activeUsers.map(user => ({
          id: user.id,
          name: user.name || user.email,
          lastLoginAt: user.lastLoginAt?.toISOString(),
          postsInPeriod: user._count.posts,
          commentsInPeriod: user._count.comments,
          activity: user._count.posts + user._count.comments,
        })),
        devices: deviceStats,
        trafficSources,
      },

      // 요약 통계
      summary: {
        totalUsers: userGrowth.reduce((sum, item) => sum + item._count.id, 0),
        totalPosts: postStats.reduce((sum, item) => sum + item._count.id, 0),
        totalComments: commentStats.reduce((sum, item) => sum + item._count.id, 0),
        totalViews: postStats.reduce((sum, item) => sum + (item._sum.views || 0), 0),
        avgPostsPerDay: postStats.length > 0 ? 
          Math.round((postStats.reduce((sum, item) => sum + item._count.id, 0) / postStats.length) * 10) / 10 : 0,
        avgCommentsPerPost: postStats.reduce((sum, item) => sum + item._count.id, 0) > 0 ?
          Math.round((commentStats.reduce((sum, item) => sum + item._count.id, 0) / 
            postStats.reduce((sum, item) => sum + item._count.id, 0)) * 10) / 10 : 0,
      },
    };

    return json(response);

  } catch (error) {
    console.error('Analytics API error:', error);
    
    return json({ 
      error: '분석 데이터 조회 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
};