// 카테고리(메뉴) 관리 API 엔드포인트

import type { ActionFunction, LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireUser } from '../lib/auth.server';
import { db } from '~/utils/db.server';
import { validateInput } from '../lib/security/validation.server';
import { z } from 'zod';

// 카테고리 목록 조회
export const loader: LoaderFunction = async ({ request }) => {
  const user = await requireUser(request);
  
  // 관리자만 접근 가능
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (dbUser?.role !== 'ADMIN') {
    throw new Response('Unauthorized', { status: 403 });
  }

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get('includeInactive') === 'true';

  const where = includeInactive ? {} : { isActive: true };

  const categories = await db.menu.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      order: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          posts: true,
        },
      },
    },
    orderBy: { order: 'asc' },
  });

  return json({
    categories: categories.map(category => ({
      ...category,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
      postCount: category._count.posts,
    }))
  });
};

// 카테고리 관리 액션
const categoryActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    data: z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      order: z.number().int().min(0).max(999),
      isActive: z.boolean().optional().default(true),
    }),
  }),
  z.object({
    action: z.literal('update'),
    categoryId: z.string(),
    data: z.object({
      name: z.string().min(1).max(100).optional(),
      slug: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      order: z.number().int().min(0).max(999).optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  z.object({
    action: z.literal('delete'),
    categoryId: z.string(),
  }),
  z.object({
    action: z.literal('reorder'),
    categories: z.array(z.object({
      id: z.string(),
      order: z.number().int().min(0),
    })),
  }),
]);

export const action: ActionFunction = async ({ request }) => {
  const user = await requireUser(request);
  
  // 관리자만 접근 가능
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (dbUser?.role !== 'ADMIN') {
    throw new Response('Unauthorized', { status: 403 });
  }

  try {
    const body = await request.json();
    const validatedData = await validateInput(categoryActionSchema, body);

    switch (validatedData.action) {
      case 'create': {
        // 슬러그 중복 확인
        const existingCategory = await db.menu.findUnique({
          where: { slug: validatedData.data.slug },
        });

        if (existingCategory) {
          return json({ 
            error: '이미 사용 중인 슬러그입니다.' 
          }, { status: 400 });
        }

        const newCategory = await db.menu.create({
          data: validatedData.data,
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            order: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                posts: true,
              },
            },
          },
        });

        return json({
          success: true,
          category: {
            ...newCategory,
            createdAt: newCategory.createdAt.toISOString(),
            postCount: newCategory._count.posts,
          }
        });
      }

      case 'update': {
        const updateData: any = {};
        
        if (validatedData.data.name) updateData.name = validatedData.data.name;
        if (validatedData.data.description !== undefined) updateData.description = validatedData.data.description;
        if (validatedData.data.order !== undefined) updateData.order = validatedData.data.order;
        if (validatedData.data.isActive !== undefined) updateData.isActive = validatedData.data.isActive;
        
        // 슬러그 중복 확인 (업데이트하는 경우)
        if (validatedData.data.slug) {
          const existingCategory = await db.menu.findFirst({
            where: {
              AND: [
                { id: { not: validatedData.categoryId } },
                { slug: validatedData.data.slug },
              ],
            },
          });

          if (existingCategory) {
            return json({ 
              error: '이미 사용 중인 슬러그입니다.' 
            }, { status: 400 });
          }
          
          updateData.slug = validatedData.data.slug;
        }

        const updatedCategory = await db.menu.update({
          where: { id: validatedData.categoryId },
          data: updateData,
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            order: true,
            isActive: true,
            updatedAt: true,
            _count: {
              select: {
                posts: true,
              },
            },
          },
        });

        return json({
          success: true,
          category: {
            ...updatedCategory,
            updatedAt: updatedCategory.updatedAt.toISOString(),
            postCount: updatedCategory._count.posts,
          }
        });
      }

      case 'delete': {
        // 게시물이 있는 카테고리는 삭제 불가
        const postCount = await db.post.count({
          where: { menuId: validatedData.categoryId },
        });

        if (postCount > 0) {
          return json({ 
            error: `게시물이 ${postCount}개 있는 카테고리는 삭제할 수 없습니다.` 
          }, { status: 400 });
        }

        await db.menu.delete({
          where: { id: validatedData.categoryId },
        });

        return json({ success: true });
      }

      case 'reorder': {
        // 트랜잭션으로 순서 변경
        await db.$transaction(
          validatedData.categories.map(({ id, order }) =>
            db.menu.update({
              where: { id },
              data: { order },
            })
          )
        );

        return json({ success: true });
      }
    }

  } catch (error) {
    console.error('Category management error:', error);
    
    if (error instanceof z.ZodError) {
      return json({ 
        error: '입력 데이터가 올바르지 않습니다.',
        details: error.errors 
      }, { status: 400 });
    }

    return json({ 
      error: '카테고리 관리 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
};