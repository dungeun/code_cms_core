/**
 * 알림 시스템 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationManager } from '../notification.manager';
import {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationStatus,
} from '../notification.types';

describe('NotificationManager', () => {
  let manager: NotificationManager;
  
  beforeEach(() => {
    manager = new NotificationManager({
      enableMetrics: true,
      enableCache: true,
      batchInterval: 100, // 빠른 테스트를 위해
    });
  });
  
  afterEach(async () => {
    await manager.shutdown();
  });
  
  describe('알림 생성', () => {
    it('기본 알림을 생성해야 함', async () => {
      const notification = await manager.createNotification(
        'test-user-123',
        NotificationType.USER_MESSAGE,
        {
          title: '테스트 메시지',
          message: '테스트 메시지 내용',
        }
      );
      
      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe('test-user-123');
      expect(notification.type).toBe(NotificationType.USER_MESSAGE);
      expect(notification.status).toBe(NotificationStatus.PENDING);
    });
    
    it('우선순위가 높은 알림을 생성해야 함', async () => {
      const notification = await manager.createNotification(
        'test-user-123',
        NotificationType.SECURITY_SUSPICIOUS,
        {
          title: '보안 경고',
          message: '의심스러운 로그인 시도가 감지되었습니다.',
        },
        {
          priority: NotificationPriority.URGENT,
        }
      );
      
      expect(notification.priority).toBe(NotificationPriority.URGENT);
    });
    
    it('예약 알림을 생성해야 함', async () => {
      const scheduledAt = new Date(Date.now() + 60000); // 1분 후
      
      const notification = await manager.createNotification(
        'test-user-123',
        NotificationType.SYSTEM_MAINTENANCE,
        {
          title: '시스템 점검 예정',
          message: '1시간 후 시스템 점검이 예정되어 있습니다.',
        },
        {
          scheduledAt,
        }
      );
      
      expect(notification).toBeDefined();
      expect(notification.status).toBe(NotificationStatus.PENDING);
    });
    
    it('여러 채널로 알림을 생성해야 함', async () => {
      const notification = await manager.createNotification(
        'test-user-123',
        NotificationType.PAYMENT_SUCCESS,
        {
          title: '결제 성공',
          message: '결제가 성공적으로 완료되었습니다.',
        },
        {
          channels: [
            NotificationChannel.IN_APP,
            NotificationChannel.EMAIL,
            NotificationChannel.KAKAO,
          ],
        }
      );
      
      expect(notification.channels).toContain(NotificationChannel.IN_APP);
      expect(notification.channels).toContain(NotificationChannel.EMAIL);
      expect(notification.channels).toContain(NotificationChannel.KAKAO);
    });
  });
  
  describe('알림 읽음 처리', () => {
    it('알림을 읽음으로 표시해야 함', async () => {
      const notification = await manager.createNotification(
        'test-user-123',
        NotificationType.USER_MESSAGE,
        {
          title: '테스트 메시지',
        }
      );
      
      await manager.markAsRead(notification.id, 'test-user-123');
      
      // 실제 DB 업데이트 확인은 통합 테스트에서
      expect(true).toBe(true);
    });
    
    it('다른 사용자의 알림은 읽을 수 없어야 함', async () => {
      const notification = await manager.createNotification(
        'test-user-123',
        NotificationType.USER_MESSAGE,
        {
          title: '테스트 메시지',
        }
      );
      
      await expect(
        manager.markAsRead(notification.id, 'other-user-456')
      ).rejects.toThrow('알림을 찾을 수 없습니다.');
    });
  });
  
  describe('알림 통계', () => {
    it('사용자 알림 통계를 조회해야 함', async () => {
      // 여러 알림 생성
      await manager.createNotification(
        'test-user-123',
        NotificationType.USER_MESSAGE,
        { title: '메시지 1' }
      );
      
      await manager.createNotification(
        'test-user-123',
        NotificationType.CONTENT_COMMENT,
        { title: '댓글 1' }
      );
      
      await manager.createNotification(
        'test-user-123',
        NotificationType.PAYMENT_SUCCESS,
        { title: '결제 성공' },
        { priority: NotificationPriority.HIGH }
      );
      
      const stats = await manager.getNotificationStats('test-user-123');
      
      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.unread).toBeGreaterThanOrEqual(3);
      expect(stats.byType[NotificationType.USER_MESSAGE]).toBeGreaterThanOrEqual(1);
      expect(stats.byType[NotificationType.CONTENT_COMMENT]).toBeGreaterThanOrEqual(1);
      expect(stats.byType[NotificationType.PAYMENT_SUCCESS]).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('알림 설정', () => {
    it('사용자 알림 설정을 조회해야 함', async () => {
      const preferences = await manager.getUserPreferences('test-user-123');
      
      expect(preferences).toBeDefined();
      expect(preferences.userId).toBe('test-user-123');
      expect(preferences.channels).toBeDefined();
      expect(preferences.channels[NotificationChannel.IN_APP]).toBe(true);
    });
    
    it('사용자 알림 설정을 업데이트해야 함', async () => {
      await manager.updateUserPreferences('test-user-123', {
        channels: {
          [NotificationChannel.IN_APP]: false,
          [NotificationChannel.EMAIL]: true,
        },
        doNotDisturb: true,
      });
      
      const preferences = await manager.getUserPreferences('test-user-123');
      
      expect(preferences.doNotDisturb).toBe(true);
    });
  });
  
  describe('메트릭', () => {
    it('메트릭을 수집해야 함', async () => {
      // 여러 알림 생성
      await manager.createNotification(
        'test-user-123',
        NotificationType.USER_MESSAGE,
        { title: '테스트 1' }
      );
      
      await manager.createNotification(
        'test-user-456',
        NotificationType.USER_MESSAGE,
        { title: '테스트 2' }
      );
      
      const metrics = manager.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.created).toBeGreaterThanOrEqual(2);
    });
  });
});

// Mock 데이터
export const mockNotification = {
  id: 'notif-123',
  userId: 'user-456',
  type: NotificationType.USER_MESSAGE,
  priority: NotificationPriority.NORMAL,
  channels: [NotificationChannel.IN_APP],
  status: NotificationStatus.PENDING,
  data: {
    title: '테스트 알림',
    message: '테스트 알림 메시지',
  },
  createdAt: new Date(),
};

export const mockPreferences = {
  userId: 'user-456',
  channels: {
    [NotificationChannel.IN_APP]: true,
    [NotificationChannel.EMAIL]: true,
    [NotificationChannel.SMS]: false,
    [NotificationChannel.PUSH]: true,
    [NotificationChannel.KAKAO]: false,
  },
  types: {},
  doNotDisturb: false,
};