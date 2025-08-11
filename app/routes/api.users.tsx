// 사용자 관리 API 엔드포인트

import type { ActionFunction, LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireUser } from '../lib/auth.server';
import { db } from '~/utils/db.server';
import { validateInput } from '../lib/security/validation.server';
import { z } from 'zod';

// 사용자 목록 조회
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
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || 'all';

  const skip = (page - 1) * limit;

  // 검색 조건 구성
  const where: any = {};
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status !== 'all') {
    where.isActive = status === 'active';
  }

  // 사용자 목록 조회
  const [users, totalCount] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return json({
    users: users.map(user => ({
      ...user,
      lastLoginAt: user.lastLoginAt?.toISOString(),
      createdAt: user.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    }
  });
};

// 사용자 관리 액션 (생성, 수정, 삭제, 상태 변경)
const userActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    data: z.object({
      name: z.string().min(1).max(100),
      email: z.string().email().max(255),
      username: z.string().min(3).max(50),
      password: z.string().min(8).max(128),
      role: z.enum(['USER', 'ADMIN']),
    }),
  }),
  z.object({
    action: z.literal('update'),
    userId: z.string(),
    data: z.object({
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().max(255).optional(),
      username: z.string().min(3).max(50).optional(),
      role: z.enum(['USER', 'ADMIN']).optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  z.object({
    action: z.literal('delete'),
    userId: z.string(),
  }),
  z.object({
    action: z.literal('bulk-action'),
    userIds: z.array(z.string()),
    bulkAction: z.enum(['activate', 'suspend', 'delete']),
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
    const validatedData = await validateInput(userActionSchema, body);

    switch (validatedData.action) {
      case 'create': {
        // 이메일/사용자명 중복 확인
        const existingUser = await db.user.findFirst({
          where: {
            OR: [
              { email: validatedData.data.email },
              { username: validatedData.data.username },
            ],
          },
        });

        if (existingUser) {
          return json({ 
            error: '이미 사용 중인 이메일 또는 사용자명입니다.' 
          }, { status: 400 });
        }

        // 비밀번호 해시화
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(validatedData.data.password, 10);

        const newUser = await db.user.create({
          data: {
            ...validatedData.data,
            password: hashedPassword,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });

        return json({
          success: true,
          user: {
            ...newUser,
            createdAt: newUser.createdAt.toISOString(),
          }
        });
      }

      case 'update': {
        const updateData: any = {};
        
        if (validatedData.data.name) updateData.name = validatedData.data.name;
        if (validatedData.data.email) updateData.email = validatedData.data.email;
        if (validatedData.data.username) updateData.username = validatedData.data.username;
        if (validatedData.data.role) updateData.role = validatedData.data.role;
        if (validatedData.data.isActive !== undefined) updateData.isActive = validatedData.data.isActive;

        // 이메일/사용자명 중복 확인 (업데이트하는 경우)
        if (updateData.email || updateData.username) {
          const conditions: any[] = [];
          if (updateData.email) conditions.push({ email: updateData.email });
          if (updateData.username) conditions.push({ username: updateData.username });

          const existingUser = await db.user.findFirst({
            where: {
              AND: [
                { id: { not: validatedData.userId } },
                { OR: conditions },
              ],
            },
          });

          if (existingUser) {
            return json({ 
              error: '이미 사용 중인 이메일 또는 사용자명입니다.' 
            }, { status: 400 });
          }
        }

        const updatedUser = await db.user.update({
          where: { id: validatedData.userId },
          data: updateData,
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            isActive: true,
            updatedAt: true,
          },
        });

        return json({
          success: true,
          user: {
            ...updatedUser,
            updatedAt: updatedUser.updatedAt.toISOString(),
          }
        });
      }

      case 'delete': {
        // 자기 자신은 삭제할 수 없음
        if (validatedData.userId === user.id) {
          return json({ 
            error: '본인 계정은 삭제할 수 없습니다.' 
          }, { status: 400 });
        }

        await db.user.delete({
          where: { id: validatedData.userId },
        });

        return json({ success: true });
      }

      case 'bulk-action': {
        // 자기 자신이 포함된 경우 제외
        const userIds = validatedData.userIds.filter(id => id !== user.id);

        if (userIds.length === 0) {
          return json({ 
            error: '본인 계정은 일괄 처리할 수 없습니다.' 
          }, { status: 400 });
        }

        switch (validatedData.bulkAction) {
          case 'activate':
            await db.user.updateMany({
              where: { id: { in: userIds } },
              data: { isActive: true },
            });
            break;

          case 'suspend':
            await db.user.updateMany({
              where: { id: { in: userIds } },
              data: { isActive: false },
            });
            break;

          case 'delete':
            await db.user.deleteMany({
              where: { id: { in: userIds } },
            });
            break;
        }

        return json({ 
          success: true, 
          affected: userIds.length 
        });
      }
    }

  } catch (error) {
    console.error('User management error:', error);
    
    if (error instanceof z.ZodError) {
      return json({ 
        error: '입력 데이터가 올바르지 않습니다.',
        details: error.errors 
      }, { status: 400 });
    }

    return json({ 
      error: '사용자 관리 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
};