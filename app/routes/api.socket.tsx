// Socket.IO 실시간 통신 API 엔드포인트

import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireUser } from '../lib/auth.server';
import { getSocketIOInstance } from '../lib/socket/socket.server';
import { validateInput } from '../lib/security/validation.server';
import { z } from 'zod';

// Socket 이벤트 스키마
const socketEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('new-post'),
    data: z.object({
      postId: z.string(),
      title: z.string(),
      author: z.string(),
      categorySlug: z.string(),
    }),
  }),
  z.object({
    type: z.literal('new-comment'),
    data: z.object({
      postId: z.string(),
      commentId: z.string(),
      content: z.string(),
      author: z.string(),
    }),
  }),
  z.object({
    type: z.literal('notification'),
    data: z.object({
      userId: z.string(),
      message: z.string(),
      type: z.enum(['info', 'success', 'warning', 'error']),
    }),
  }),
  z.object({
    type: z.literal('admin-broadcast'),
    data: z.object({
      message: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
    }),
  }),
]);

export const action: ActionFunction = async ({ request }) => {
  const user = await requireUser(request);

  try {
    const body = await request.json();
    const validatedData = await validateInput(socketEventSchema, body);
    const io = getSocketIOInstance();

    if (!io) {
      return json({ 
        error: 'Socket.IO 서버가 초기화되지 않았습니다.' 
      }, { status: 500 });
    }

    switch (validatedData.type) {
      case 'new-post': {
        // 새 게시물 알림 - 모든 사용자에게 브로드캐스트
        io.emit('post:new', {
          id: validatedData.data.postId,
          title: validatedData.data.title,
          author: validatedData.data.author,
          categorySlug: validatedData.data.categorySlug,
          timestamp: new Date().toISOString(),
        });

        // 카테고리 구독자들에게도 알림
        io.to(`category:${validatedData.data.categorySlug}`).emit('category:new-post', {
          id: validatedData.data.postId,
          title: validatedData.data.title,
          author: validatedData.data.author,
          timestamp: new Date().toISOString(),
        });

        return json({ success: true, event: 'new-post broadcasted' });
      }

      case 'new-comment': {
        // 새 댓글 알림 - 해당 게시물을 보고 있는 사용자들에게
        io.to(`post:${validatedData.data.postId}`).emit('comment:new', {
          id: validatedData.data.commentId,
          postId: validatedData.data.postId,
          content: validatedData.data.content,
          author: validatedData.data.author,
          timestamp: new Date().toISOString(),
        });

        return json({ success: true, event: 'new-comment broadcasted' });
      }

      case 'notification': {
        // 특정 사용자에게 개인 알림
        io.to(`user:${validatedData.data.userId}`).emit('notification', {
          message: validatedData.data.message,
          type: validatedData.data.type,
          timestamp: new Date().toISOString(),
        });

        return json({ success: true, event: 'notification sent' });
      }

      case 'admin-broadcast': {
        // 관리자만 전체 브로드캐스트 가능
        const dbUser = await import('../lib/auth.server').then(m => 
          import('~/utils/db.server').then(db => 
            db.db.user.findUnique({
              where: { id: user.id },
              select: { role: true },
            })
          )
        );

        if (!dbUser || dbUser.role !== 'ADMIN') {
          return json({ error: '권한이 없습니다.' }, { status: 403 });
        }

        // 전체 사용자에게 관리자 공지사항 브로드캐스트
        io.emit('admin:broadcast', {
          message: validatedData.data.message,
          priority: validatedData.data.priority,
          timestamp: new Date().toISOString(),
        });

        return json({ success: true, event: 'admin-broadcast sent' });
      }
    }

  } catch (error) {
    console.error('Socket event error:', error);
    
    if (error instanceof z.ZodError) {
      return json({ 
        error: '이벤트 데이터가 올바르지 않습니다.',
        details: error.errors 
      }, { status: 400 });
    }

    return json({ 
      error: 'Socket 이벤트 처리 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
};