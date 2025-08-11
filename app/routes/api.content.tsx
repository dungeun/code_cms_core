// 콘텐츠 관리 API 엔드포인트

import type { ActionFunction, LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireUser } from '../lib/auth.server';
import { db } from '~/utils/db.server';
import { validateInput } from '../lib/security/validation.server';
import { notifyNewPost } from '../lib/realtime/notification-system.server';
import { z } from 'zod';

// 콘텐츠 조회
export const loader: LoaderFunction = async ({ request }) => {
  const user = await requireUser(request);
  const url = new URL(request.url);
  
  const action = url.searchParams.get('action') || 'list';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const search = url.searchParams.get('search') || '';
  const categoryId = url.searchParams.get('categoryId') || '';
  const status = url.searchParams.get('status') || 'all';

  const skip = (page - 1) * limit;

  try {
    switch (action) {
      case 'list': {
        // 검색 조건 구성
        const where: any = {};
        
        if (search) {
          where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
            { excerpt: { contains: search, mode: 'insensitive' } },
          ];
        }

        if (categoryId) {
          where.menuId = categoryId;
        }

        if (status !== 'all') {
          where.isPublished = status === 'published';
        }

        // 관리자가 아닌 경우 자신의 게시물만 조회
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });

        if (dbUser?.role !== 'ADMIN') {
          where.authorId = user.id;
        }

        const [posts, totalCount] = await Promise.all([
          db.post.findMany({
            where,
            include: {
              author: { select: { id: true, name: true, email: true } },
              menu: { select: { id: true, name: true, slug: true } },
              _count: {
                select: {
                  comments: true,
                  likes: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          db.post.count({ where }),
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        return json({
          posts: posts.map(post => ({
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            isPublished: post.isPublished,
            publishedAt: post.publishedAt?.toISOString(),
            views: post.views,
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
            author: {
              id: post.author.id,
              name: post.author.name || post.author.email,
            },
            category: post.menu ? {
              id: post.menu.id,
              name: post.menu.name,
              slug: post.menu.slug,
            } : null,
            stats: {
              comments: post._count.comments,
              likes: post._count.likes,
            },
          })),
          pagination: {
            page,
            limit,
            totalCount,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        });
      }

      case 'get': {
        const postId = url.searchParams.get('id');
        if (!postId) {
          throw new Response('Post ID required', { status: 400 });
        }

        const post = await db.post.findUnique({
          where: { id: postId },
          include: {
            author: { select: { id: true, name: true, email: true } },
            menu: { select: { id: true, name: true, slug: true } },
            tags: { select: { id: true, name: true } },
            _count: {
              select: {
                comments: true,
                likes: true,
              },
            },
          },
        });

        if (!post) {
          throw new Response('Post not found', { status: 404 });
        }

        // 권한 확인 (관리자가 아닌 경우 자신의 게시물만 조회 가능)
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });

        if (dbUser?.role !== 'ADMIN' && post.authorId !== user.id) {
          throw new Response('Unauthorized', { status: 403 });
        }

        return json({
          post: {
            id: post.id,
            title: post.title,
            slug: post.slug,
            content: post.content,
            excerpt: post.excerpt,
            isPublished: post.isPublished,
            publishedAt: post.publishedAt?.toISOString(),
            views: post.views,
            metaTitle: post.metaTitle,
            metaDescription: post.metaDescription,
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
            author: {
              id: post.author.id,
              name: post.author.name || post.author.email,
            },
            category: post.menu ? {
              id: post.menu.id,
              name: post.menu.name,
              slug: post.menu.slug,
            } : null,
            tags: post.tags.map(tag => ({
              id: tag.id,
              name: tag.name,
            })),
            stats: {
              comments: post._count.comments,
              likes: post._count.likes,
            },
          },
        });
      }

      default:
        throw new Response('Invalid action', { status: 400 });
    }
  } catch (error) {
    console.error('Content API loader error:', error);
    
    if (error instanceof Response) {
      throw error;
    }

    return json({ 
      error: '콘텐츠 조회 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
};

// 콘텐츠 관리 액션
const contentActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    data: z.object({
      title: z.string().min(1).max(200),
      slug: z.string().min(1).max(200).optional(),
      content: z.string().min(1),
      excerpt: z.string().max(500).optional(),
      menuId: z.string(),
      isPublished: z.boolean().default(false),
      publishedAt: z.string().optional(),
      metaTitle: z.string().max(200).optional(),
      metaDescription: z.string().max(300).optional(),
      tags: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    action: z.literal('update'),
    postId: z.string(),
    data: z.object({
      title: z.string().min(1).max(200).optional(),
      slug: z.string().min(1).max(200).optional(),
      content: z.string().min(1).optional(),
      excerpt: z.string().max(500).optional(),
      menuId: z.string().optional(),
      isPublished: z.boolean().optional(),
      publishedAt: z.string().optional(),
      metaTitle: z.string().max(200).optional(),
      metaDescription: z.string().max(300).optional(),
      tags: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    action: z.literal('delete'),
    postId: z.string(),
  }),
  z.object({
    action: z.literal('publish'),
    postId: z.string(),
    publishNow: z.boolean().default(true),
    publishAt: z.string().optional(),
  }),
  z.object({
    action: z.literal('unpublish'),
    postId: z.string(),
  }),
  z.object({
    action: z.literal('bulk-action'),
    postIds: z.array(z.string()),
    bulkAction: z.enum(['publish', 'unpublish', 'delete']),
  }),
]);

export const action: ActionFunction = async ({ request }) => {
  const user = await requireUser(request);

  try {
    const body = await request.json();
    const validatedData = await validateInput(contentActionSchema, body);

    switch (validatedData.action) {
      case 'create': {
        // 슬러그 자동 생성 (없는 경우)
        let slug = validatedData.data.slug;
        if (!slug) {
          slug = validatedData.data.title
            .toLowerCase()
            .replace(/[^a-z0-9가-힣]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        }

        // 슬러그 중복 확인
        const existingPost = await db.post.findUnique({
          where: { slug },
        });

        if (existingPost) {
          slug = `${slug}-${Date.now()}`;
        }

        // 게시물 생성
        const post = await db.post.create({
          data: {
            title: validatedData.data.title,
            slug,
            content: validatedData.data.content,
            excerpt: validatedData.data.excerpt,
            menuId: validatedData.data.menuId,
            authorId: user.id,
            isPublished: validatedData.data.isPublished,
            publishedAt: validatedData.data.publishedAt ? 
              new Date(validatedData.data.publishedAt) : 
              (validatedData.data.isPublished ? new Date() : null),
            metaTitle: validatedData.data.metaTitle,
            metaDescription: validatedData.data.metaDescription,
          },
          include: {
            author: { select: { name: true, email: true } },
            menu: { select: { name: true, slug: true } },
          },
        });

        // 태그 연결
        if (validatedData.data.tags && validatedData.data.tags.length > 0) {
          const tagConnections = validatedData.data.tags.map(tagId => ({
            postId: post.id,
            tagId,
          }));

          await db.postTag.createMany({
            data: tagConnections,
            skipDuplicates: true,
          });
        }

        // 발행된 게시물인 경우 실시간 알림
        if (post.isPublished) {
          await notifyNewPost(post.id, user.id);
        }

        return json({
          success: true,
          post: {
            id: post.id,
            title: post.title,
            slug: post.slug,
            isPublished: post.isPublished,
            createdAt: post.createdAt.toISOString(),
          },
        });
      }

      case 'update': {
        // 게시물 존재 및 권한 확인
        const existingPost = await db.post.findUnique({
          where: { id: validatedData.postId },
          select: { authorId: true, isPublished: true },
        });

        if (!existingPost) {
          return json({ error: '게시물을 찾을 수 없습니다.' }, { status: 404 });
        }

        // 권한 확인
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });

        if (dbUser?.role !== 'ADMIN' && existingPost.authorId !== user.id) {
          return json({ error: '권한이 없습니다.' }, { status: 403 });
        }

        // 업데이트 데이터 구성
        const updateData: any = {};
        
        if (validatedData.data.title) updateData.title = validatedData.data.title;
        if (validatedData.data.content) updateData.content = validatedData.data.content;
        if (validatedData.data.excerpt !== undefined) updateData.excerpt = validatedData.data.excerpt;
        if (validatedData.data.menuId) updateData.menuId = validatedData.data.menuId;
        if (validatedData.data.isPublished !== undefined) {
          updateData.isPublished = validatedData.data.isPublished;
          
          // 발행 상태가 변경되는 경우 발행일 설정
          if (validatedData.data.isPublished && !existingPost.isPublished) {
            updateData.publishedAt = validatedData.data.publishedAt ? 
              new Date(validatedData.data.publishedAt) : new Date();
          } else if (!validatedData.data.isPublished) {
            updateData.publishedAt = null;
          }
        }
        if (validatedData.data.metaTitle !== undefined) updateData.metaTitle = validatedData.data.metaTitle;
        if (validatedData.data.metaDescription !== undefined) updateData.metaDescription = validatedData.data.metaDescription;

        // 슬러그 업데이트 (중복 확인)
        if (validatedData.data.slug) {
          const existingSlug = await db.post.findFirst({
            where: {
              AND: [
                { id: { not: validatedData.postId } },
                { slug: validatedData.data.slug },
              ],
            },
          });

          if (existingSlug) {
            return json({ 
              error: '이미 사용 중인 슬러그입니다.' 
            }, { status: 400 });
          }
          
          updateData.slug = validatedData.data.slug;
        }

        // 게시물 업데이트
        const updatedPost = await db.post.update({
          where: { id: validatedData.postId },
          data: updateData,
        });

        // 태그 업데이트
        if (validatedData.data.tags) {
          // 기존 태그 연결 삭제
          await db.postTag.deleteMany({
            where: { postId: validatedData.postId },
          });

          // 새 태그 연결
          if (validatedData.data.tags.length > 0) {
            const tagConnections = validatedData.data.tags.map(tagId => ({
              postId: validatedData.postId,
              tagId,
            }));

            await db.postTag.createMany({
              data: tagConnections,
              skipDuplicates: true,
            });
          }
        }

        // 새로 발행된 경우 실시간 알림
        if (updateData.isPublished && !existingPost.isPublished) {
          await notifyNewPost(validatedData.postId, user.id);
        }

        return json({
          success: true,
          post: {
            id: updatedPost.id,
            title: updatedPost.title,
            isPublished: updatedPost.isPublished,
            updatedAt: updatedPost.updatedAt.toISOString(),
          },
        });
      }

      case 'delete': {
        // 권한 확인
        const post = await db.post.findUnique({
          where: { id: validatedData.postId },
          select: { authorId: true },
        });

        if (!post) {
          return json({ error: '게시물을 찾을 수 없습니다.' }, { status: 404 });
        }

        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });

        if (dbUser?.role !== 'ADMIN' && post.authorId !== user.id) {
          return json({ error: '권한이 없습니다.' }, { status: 403 });
        }

        // 게시물 삭제 (관련 데이터 cascade 삭제)
        await db.post.delete({
          where: { id: validatedData.postId },
        });

        return json({ success: true });
      }

      case 'publish': {
        const publishDate = validatedData.publishNow ? new Date() :
          (validatedData.publishAt ? new Date(validatedData.publishAt) : new Date());

        const post = await db.post.update({
          where: { id: validatedData.postId },
          data: {
            isPublished: true,
            publishedAt: publishDate,
          },
        });

        // 실시간 알림
        if (publishDate <= new Date()) {
          await notifyNewPost(validatedData.postId, user.id);
        }

        return json({ 
          success: true, 
          publishedAt: post.publishedAt?.toISOString() 
        });
      }

      case 'unpublish': {
        await db.post.update({
          where: { id: validatedData.postId },
          data: {
            isPublished: false,
            publishedAt: null,
          },
        });

        return json({ success: true });
      }

      case 'bulk-action': {
        // 권한 확인 (관리자만)
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });

        if (dbUser?.role !== 'ADMIN') {
          // 일반 사용자는 자신의 게시물만 처리 가능
          const posts = await db.post.findMany({
            where: { 
              id: { in: validatedData.postIds },
              authorId: user.id,
            },
            select: { id: true },
          });
          
          validatedData.postIds = posts.map(p => p.id);
        }

        if (validatedData.postIds.length === 0) {
          return json({ error: '처리할 게시물이 없습니다.' }, { status: 400 });
        }

        switch (validatedData.bulkAction) {
          case 'publish':
            await db.post.updateMany({
              where: { id: { in: validatedData.postIds } },
              data: { 
                isPublished: true,
                publishedAt: new Date(),
              },
            });
            break;

          case 'unpublish':
            await db.post.updateMany({
              where: { id: { in: validatedData.postIds } },
              data: { 
                isPublished: false,
                publishedAt: null,
              },
            });
            break;

          case 'delete':
            await db.post.deleteMany({
              where: { id: { in: validatedData.postIds } },
            });
            break;
        }

        return json({ 
          success: true, 
          affected: validatedData.postIds.length 
        });
      }
    }

  } catch (error) {
    console.error('Content API action error:', error);
    
    if (error instanceof z.ZodError) {
      return json({ 
        error: '입력 데이터가 올바르지 않습니다.',
        details: error.errors 
      }, { status: 400 });
    }

    return json({ 
      error: '콘텐츠 관리 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
};