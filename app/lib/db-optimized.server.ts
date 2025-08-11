/**
 * 최적화된 데이터베이스 쿼리 헬퍼
 * N+1 문제 해결 및 성능 최적화
 */

import { db } from '~/utils/db.server';
import type { Prisma } from '@prisma/client';

// 게시글 조회 최적화
export const optimizedPostQueries = {
  /**
   * 단일 게시글 조회 (모든 관련 데이터 한 번에 로드)
   */
  findPostWithDetails: (slug: string) => {
    return db.post.findFirst({
      where: { slug },
      include: {
        author: { 
          select: { 
            id: true,
            username: true, 
            name: true,
            email: true,
            role: true 
          } 
        },
        menu: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true
          }
        },
        comments: {
          include: {
            author: { 
              select: { 
                id: true,
                username: true, 
                name: true,
                email: true 
              } 
            },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: { comments: true }
        }
      },
    });
  },

  /**
   * 카테고리별 게시글 목록 (페이지네이션 포함)
   */
  findPostsByCategory: (
    categorySlug: string, 
    options: { page?: number; limit?: number; includeNotice?: boolean } = {}
  ) => {
    const { page = 1, limit = 20, includeNotice = true } = options;
    const skip = (page - 1) * limit;

    return db.$transaction([
      // 게시글 목록
      db.post.findMany({
        where: {
          menu: { slug: categorySlug },
          isPublished: true,
          ...(includeNotice ? {} : { isNotice: false })
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              name: true
            }
          },
          menu: {
            select: {
              name: true,
              slug: true
            }
          },
          _count: {
            select: { comments: true }
          }
        },
        orderBy: [
          { isNotice: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      // 전체 개수
      db.post.count({
        where: {
          menu: { slug: categorySlug },
          isPublished: true,
          ...(includeNotice ? {} : { isNotice: false })
        }
      })
    ]);
  },

  /**
   * 인기 게시글 (조회수 + 좋아요 기준)
   */
  findPopularPosts: (limit: number = 10, days: number = 7) => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    return db.post.findMany({
      where: {
        isPublished: true,
        createdAt: { gte: sinceDate }
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true
          }
        },
        menu: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      orderBy: [
        { views: 'desc' },
        { likes: 'desc' }
      ],
      take: limit
    });
  },

  /**
   * 최신 게시글
   */
  findRecentPosts: (limit: number = 10) => {
    return db.post.findMany({
      where: {
        isPublished: true
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true
          }
        },
        menu: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
};

// 댓글 시스템 최적화
export const optimizedCommentQueries = {
  /**
   * 게시글의 댓글 목록 (페이지네이션)
   */
  findCommentsByPost: (
    postId: string, 
    options: { page?: number; limit?: number } = {}
  ) => {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    return db.$transaction([
      db.comment.findMany({
        where: { postId },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit
      }),
      db.comment.count({ where: { postId } })
    ]);
  }
};

// 통계 및 대시보드 최적화
export const optimizedStatsQueries = {
  /**
   * 관리자 대시보드 통계 (한 번의 트랜잭션으로)
   */
  getAdminStats: () => {
    return db.$transaction([
      // 전체 게시글 수
      db.post.count(),
      // 전체 사용자 수  
      db.user.count(),
      // 전체 댓글 수
      db.comment.count(),
      // 오늘 게시글 수
      db.post.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      // 활성 사용자 수 (최근 30일)
      db.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);
  },

  /**
   * 게시글 조회수 증가 (배치 처리용)
   */
  incrementViewsBatch: (postIds: string[]) => {
    return db.$transaction(
      postIds.map(id => 
        db.post.update({
          where: { id },
          data: { views: { increment: 1 } }
        })
      )
    );
  }
};

// 검색 최적화
export const optimizedSearchQueries = {
  /**
   * 전문 검색 (제목, 내용, 작성자)
   */
  searchPosts: (
    query: string,
    options: { 
      categorySlug?: string; 
      page?: number; 
      limit?: number;
      sortBy?: 'relevance' | 'date' | 'views';
    } = {}
  ) => {
    const { categorySlug, page = 1, limit = 20, sortBy = 'relevance' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.PostWhereInput = {
      isPublished: true,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { author: { name: { contains: query, mode: 'insensitive' } } },
        { author: { username: { contains: query, mode: 'insensitive' } } }
      ],
      ...(categorySlug && { menu: { slug: categorySlug } })
    };

    const orderBy: Prisma.PostOrderByWithRelationInput = 
      sortBy === 'date' ? { createdAt: 'desc' } :
      sortBy === 'views' ? { views: 'desc' } :
      { createdAt: 'desc' }; // 기본값 (관련도는 DB 검색 엔진 필요)

    return db.$transaction([
      db.post.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              name: true
            }
          },
          menu: {
            select: {
              name: true,
              slug: true
            }
          },
          _count: {
            select: { comments: true }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      db.post.count({ where })
    ]);
  }
};

// 캐싱 헬퍼 (향후 Redis 통합 준비)
export const cacheKeys = {
  popularPosts: (days: number) => `popular_posts_${days}d`,
  recentPosts: (limit: number) => `recent_posts_${limit}`,
  categoryPosts: (slug: string, page: number) => `category_${slug}_page_${page}`,
  userStats: (userId: string) => `user_stats_${userId}`,
  adminStats: () => `admin_stats_${new Date().toDateString()}`
};

// 성능 모니터링을 위한 쿼리 실행 시간 측정
export function withQueryTiming<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = performance.now();
    
    try {
      const result = await queryFn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 개발 환경에서 로그 출력
      if (process.env.NODE_ENV === 'development' && duration > 100) {
        console.warn(`⚠️  느린 쿼리 감지: ${queryName} (${duration.toFixed(2)}ms)`);
      }
      
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}