// 실시간 알림 시스템

import { getSocketIOInstance } from '../socket/socket.server';
import { db } from '~/utils/db.server';
import { sendSMS } from '../notifications/sms.server';

export interface NotificationData {
  type: 'post' | 'comment' | 'like' | 'mention' | 'system' | 'admin';
  title: string;
  message: string;
  userId: string;
  data?: any;
  priority: 'low' | 'medium' | 'high';
  channels: ('web' | 'sms' | 'email')[];
}

export interface BroadcastData {
  type: 'new-post' | 'new-comment' | 'system-announcement' | 'maintenance';
  title: string;
  message: string;
  data?: any;
  targetRooms?: string[];
  excludeUsers?: string[];
}

class RealtimeNotificationSystem {
  private io: any;

  constructor() {
    this.io = getSocketIOInstance();
  }

  // 개별 사용자에게 알림 전송
  async sendNotification(notification: NotificationData): Promise<boolean> {
    try {
      if (!this.io) {
        console.warn('Socket.IO instance not available');
        return false;
      }

      // 데이터베이스에 알림 저장
      const savedNotification = await db.notification.create({
        data: {
          type: notification.type,
          title: notification.title,
          message: notification.message,
          userId: notification.userId,
          data: notification.data,
          priority: notification.priority,
          isRead: false,
        },
      });

      // 웹 소켓으로 실시간 알림 전송
      if (notification.channels.includes('web')) {
        this.io.to(`user:${notification.userId}`).emit('notification', {
          id: savedNotification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          priority: notification.priority,
          timestamp: savedNotification.createdAt.toISOString(),
        });
      }

      // SMS 알림 전송 (높은 우선순위만)
      if (notification.channels.includes('sms') && notification.priority === 'high') {
        const user = await db.user.findUnique({
          where: { id: notification.userId },
          select: { phone: true, smsNotificationEnabled: true },
        });

        if (user?.phone && user.smsNotificationEnabled) {
          await sendSMS(user.phone, 'notification', {
            title: notification.title,
            message: notification.message,
          });
        }
      }

      // 이메일 알림은 별도 처리 (향후 구현)
      if (notification.channels.includes('email')) {
        // TODO: 이메일 발송 로직
      }

      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  // 여러 사용자에게 알림 브로드캐스트
  async broadcastNotification(broadcast: BroadcastData): Promise<boolean> {
    try {
      if (!this.io) {
        console.warn('Socket.IO instance not available');
        return false;
      }

      const broadcastData = {
        type: broadcast.type,
        title: broadcast.title,
        message: broadcast.message,
        data: broadcast.data,
        timestamp: new Date().toISOString(),
      };

      // 특정 룸에만 브로드캐스트
      if (broadcast.targetRooms) {
        broadcast.targetRooms.forEach(room => {
          this.io.to(room).emit('broadcast', broadcastData);
        });
      } else {
        // 전체 브로드캐스트
        this.io.emit('broadcast', broadcastData);
      }

      return true;
    } catch (error) {
      console.error('Failed to broadcast notification:', error);
      return false;
    }
  }

  // 새 게시물 알림
  async notifyNewPost(postId: string, authorId: string): Promise<void> {
    try {
      const post = await db.post.findUnique({
        where: { id: postId },
        include: {
          author: { select: { name: true, email: true } },
          menu: { select: { name: true, slug: true } },
        },
      });

      if (!post || !post.isPublished) return;

      // 카테고리 구독자들에게 알림
      const subscribers = await db.categorySubscription.findMany({
        where: { menuId: post.menuId },
        include: { user: { select: { id: true, name: true } } },
      });

      // 브로드캐스트
      await this.broadcastNotification({
        type: 'new-post',
        title: '새 게시물',
        message: `${post.author.name || post.author.email}님이 "${post.title}" 게시물을 올렸습니다.`,
        data: {
          postId: post.id,
          categorySlug: post.menu?.slug,
          authorName: post.author.name || post.author.email,
        },
        targetRooms: [`category:${post.menu?.slug}`],
      });

      // 개별 구독자들에게 개인 알림
      for (const subscriber of subscribers) {
        if (subscriber.userId !== authorId) {
          await this.sendNotification({
            type: 'post',
            title: '새 게시물 알림',
            message: `${post.author.name || post.author.email}님이 "${post.menu?.name}" 카테고리에 새 게시물을 작성했습니다.`,
            userId: subscriber.userId,
            priority: 'medium',
            channels: ['web'],
            data: {
              postId: post.id,
              categorySlug: post.menu?.slug,
            },
          });
        }
      }
    } catch (error) {
      console.error('Failed to notify new post:', error);
    }
  }

  // 새 댓글 알림
  async notifyNewComment(commentId: string): Promise<void> {
    try {
      const comment = await db.comment.findUnique({
        where: { id: commentId },
        include: {
          author: { select: { name: true, email: true } },
          post: {
            include: {
              author: { select: { id: true, name: true, email: true } },
              menu: { select: { slug: true } },
            },
          },
        },
      });

      if (!comment) return;

      // 게시물 작성자에게 알림 (자신의 댓글이 아닌 경우)
      if (comment.post.authorId !== comment.authorId) {
        await this.sendNotification({
          type: 'comment',
          title: '새 댓글',
          message: `"${comment.post.title}" 게시물에 새 댓글이 달렸습니다.`,
          userId: comment.post.authorId,
          priority: 'medium',
          channels: ['web', 'sms'],
          data: {
            commentId: comment.id,
            postId: comment.postId,
            categorySlug: comment.post.menu?.slug,
          },
        });
      }

      // 같은 게시물을 보고 있는 사용자들에게 실시간 브로드캐스트
      if (this.io) {
        this.io.to(`post:${comment.postId}`).emit('comment:new', {
          id: comment.id,
          content: comment.content,
          author: comment.author.name || comment.author.email,
          timestamp: comment.createdAt.toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to notify new comment:', error);
    }
  }

  // 멘션 알림
  async notifyMention(mentionedUserId: string, postId: string, mentionerName: string): Promise<void> {
    try {
      const post = await db.post.findUnique({
        where: { id: postId },
        select: { title: true, slug: true, menu: { select: { slug: true } } },
      });

      if (!post) return;

      await this.sendNotification({
        type: 'mention',
        title: '멘션 알림',
        message: `${mentionerName}님이 당신을 언급했습니다.`,
        userId: mentionedUserId,
        priority: 'high',
        channels: ['web', 'sms'],
        data: {
          postId,
          categorySlug: post.menu?.slug,
          mentionerName,
        },
      });
    } catch (error) {
      console.error('Failed to notify mention:', error);
    }
  }

  // 관리자 공지사항
  async sendAdminAnnouncement(
    title: string, 
    message: string, 
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    try {
      // 전체 사용자 목록 조회
      const users = await db.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });

      // 모든 사용자에게 알림 전송
      for (const user of users) {
        await this.sendNotification({
          type: 'admin',
          title,
          message,
          userId: user.id,
          priority,
          channels: priority === 'high' ? ['web', 'sms'] : ['web'],
        });
      }

      // 실시간 브로드캐스트
      await this.broadcastNotification({
        type: 'system-announcement',
        title,
        message,
        data: { priority },
      });
    } catch (error) {
      console.error('Failed to send admin announcement:', error);
    }
  }

  // 사용자 알림 목록 조회
  async getUserNotifications(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<any> {
    try {
      const skip = (page - 1) * limit;

      const [notifications, totalCount] = await Promise.all([
        db.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.notification.count({ where: { userId } }),
      ]);

      return {
        notifications: notifications.map(notification => ({
          ...notification,
          createdAt: notification.createdAt.toISOString(),
          updatedAt: notification.updatedAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Failed to get user notifications:', error);
      return { notifications: [], pagination: null };
    }
  }

  // 알림 읽음 처리
  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      await db.notification.updateMany({
        where: { 
          id: notificationId,
          userId, // 권한 확인
        },
        data: { isRead: true },
      });

      return true;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  // 모든 알림 읽음 처리
  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      await db.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      return true;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return false;
    }
  }

  // 읽지 않은 알림 수 조회
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await db.notification.count({
        where: { userId, isRead: false },
      });

      return count;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }
}

// 싱글톤 인스턴스
export const notificationSystem = new RealtimeNotificationSystem();

// 편의 함수들
export const sendNotification = (notification: NotificationData) =>
  notificationSystem.sendNotification(notification);

export const broadcastNotification = (broadcast: BroadcastData) =>
  notificationSystem.broadcastNotification(broadcast);

export const notifyNewPost = (postId: string, authorId: string) =>
  notificationSystem.notifyNewPost(postId, authorId);

export const notifyNewComment = (commentId: string) =>
  notificationSystem.notifyNewComment(commentId);

export const notifyMention = (mentionedUserId: string, postId: string, mentionerName: string) =>
  notificationSystem.notifyMention(mentionedUserId, postId, mentionerName);

export const sendAdminAnnouncement = (title: string, message: string, priority?: 'low' | 'medium' | 'high') =>
  notificationSystem.sendAdminAnnouncement(title, message, priority);

export const getUserNotifications = (userId: string, page?: number, limit?: number) =>
  notificationSystem.getUserNotifications(userId, page, limit);

export const markNotificationAsRead = (notificationId: string, userId: string) =>
  notificationSystem.markNotificationAsRead(notificationId, userId);

export const markAllNotificationsAsRead = (userId: string) =>
  notificationSystem.markAllNotificationsAsRead(userId);

export const getUnreadCount = (userId: string) =>
  notificationSystem.getUnreadCount(userId);