/**
 * 알림 API 라우트
 * 알림 조회, 생성, 업데이트를 처리하는 API 엔드포인트
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAuth } from '~/lib/auth.server';
import { getNotificationManager } from '~/lib/notifications/notification.manager';
import { 
  NotificationType, 
  NotificationPriority,
  NotificationDataSchema,
} from '~/lib/notifications/notification.types';

/**
 * GET /api/notifications
 * 사용자 알림 조회
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const url = new URL(request.url);
  
  const manager = getNotificationManager();
  
  // 필터 파라미터
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const type = url.searchParams.get('type') as NotificationType | null;
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  // 알림 조회
  const notifications = await manager.getUserNotifications(user.id, {
    unreadOnly,
    types: type ? [type] : undefined,
  });
  
  // 페이지네이션
  const paginatedNotifications = notifications.slice(offset, offset + limit);
  
  // 통계
  const stats = await manager.getNotificationStats(user.id);
  
  return json({
    notifications: paginatedNotifications,
    stats,
    total: notifications.length,
    offset,
    limit,
  });
}

/**
 * POST /api/notifications
 * 알림 처리 (읽음, 생성 등)
 */
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const data = await request.json();
  const { action } = data;
  
  const manager = getNotificationManager();
  
  switch (action) {
    case 'mark-read': {
      const { notificationId } = data;
      if (!notificationId) {
        return json({ error: '알림 ID가 필요합니다.' }, { status: 400 });
      }
      
      await manager.markAsRead(notificationId, user.id);
      return json({ success: true });
    }
    
    case 'mark-all-read': {
      await manager.markAllAsRead(user.id);
      return json({ success: true });
    }
    
    case 'create': {
      // 관리자만 알림 생성 가능
      if (user.role !== 'ADMIN') {
        return json({ error: '권한이 없습니다.' }, { status: 403 });
      }
      
      const { userId, type, priority, data: notificationData } = data;
      
      // 데이터 검증
      const validationResult = NotificationDataSchema.safeParse(notificationData);
      if (!validationResult.success) {
        return json({ 
          error: '잘못된 알림 데이터',
          details: validationResult.error.errors,
        }, { status: 400 });
      }
      
      const notification = await manager.createNotification(
        userId,
        type as NotificationType,
        validationResult.data,
        {
          priority: priority as NotificationPriority,
        }
      );
      
      return json({ success: true, notification });
    }
    
    case 'update-preferences': {
      const { preferences } = data;
      await manager.updateUserPreferences(user.id, preferences);
      return json({ success: true });
    }
    
    case 'get-preferences': {
      const preferences = await manager.getUserPreferences(user.id);
      return json({ preferences });
    }
    
    default:
      return json({ error: '잘못된 액션' }, { status: 400 });
  }
}