/**
 * 알림 시스템 타입 정의
 */

import { z } from 'zod';

/**
 * 알림 타입
 */
export enum NotificationType {
  // 시스템 알림
  SYSTEM = 'SYSTEM',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  SYSTEM_UPDATE = 'SYSTEM_UPDATE',
  
  // 사용자 알림
  USER_MESSAGE = 'USER_MESSAGE',
  USER_MENTION = 'USER_MENTION',
  USER_FOLLOW = 'USER_FOLLOW',
  
  // 콘텐츠 알림
  CONTENT_COMMENT = 'CONTENT_COMMENT',
  CONTENT_LIKE = 'CONTENT_LIKE',
  CONTENT_SHARE = 'CONTENT_SHARE',
  CONTENT_PUBLISH = 'CONTENT_PUBLISH',
  
  // 결제 알림
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REFUND = 'PAYMENT_REFUND',
  
  // 보안 알림
  SECURITY_LOGIN = 'SECURITY_LOGIN',
  SECURITY_PASSWORD_CHANGE = 'SECURITY_PASSWORD_CHANGE',
  SECURITY_SUSPICIOUS = 'SECURITY_SUSPICIOUS',
}

/**
 * 알림 우선순위
 */
export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL',
}

/**
 * 알림 채널
 */
export enum NotificationChannel {
  IN_APP = 'IN_APP',          // 앱 내 알림
  EMAIL = 'EMAIL',            // 이메일
  SMS = 'SMS',                // SMS
  PUSH = 'PUSH',              // 푸시 알림
  KAKAO = 'KAKAO',            // 카카오톡 알림톡
  WEBHOOK = 'WEBHOOK',        // 웹훅
}

/**
 * 알림 상태
 */
export enum NotificationStatus {
  PENDING = 'PENDING',        // 대기 중
  SENT = 'SENT',              // 전송됨
  DELIVERED = 'DELIVERED',    // 수신 확인
  READ = 'READ',              // 읽음
  FAILED = 'FAILED',          // 전송 실패
  EXPIRED = 'EXPIRED',        // 만료됨
}

/**
 * 알림 데이터 스키마
 */
export const NotificationDataSchema = z.object({
  // 기본 필드
  title: z.string(),
  message: z.string().optional(),
  icon: z.string().optional(),
  image: z.string().optional(),
  
  // 액션
  actionUrl: z.string().optional(),
  actionLabel: z.string().optional(),
  actions: z.array(z.object({
    label: z.string(),
    url: z.string(),
    style: z.enum(['primary', 'secondary', 'danger']).optional(),
  })).optional(),
  
  // 메타데이터
  metadata: z.record(z.any()).optional(),
  
  // 관련 엔티티
  relatedEntity: z.object({
    type: z.string(),
    id: z.string(),
  }).optional(),
});

export type NotificationData = z.infer<typeof NotificationDataSchema>;

/**
 * 알림 설정
 */
export interface NotificationPreferences {
  userId: string;
  channels: {
    [key in NotificationChannel]?: boolean;
  };
  types: {
    [key in NotificationType]?: {
      enabled: boolean;
      channels?: NotificationChannel[];
    };
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
    timezone: string;
  };
  doNotDisturb?: boolean;
}

/**
 * 알림 엔티티
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  status: NotificationStatus;
  data: NotificationData;
  
  // 타임스탬프
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  expiresAt?: Date;
  
  // 재시도
  retryCount?: number;
  lastRetryAt?: Date;
  
  // 에러
  error?: string;
}

/**
 * 알림 큐 아이템
 */
export interface NotificationQueueItem {
  notification: Notification;
  scheduledAt?: Date;
  attempts: number;
  maxAttempts: number;
}

/**
 * 알림 필터
 */
export interface NotificationFilter {
  userId?: string;
  types?: NotificationType[];
  priorities?: NotificationPriority[];
  channels?: NotificationChannel[];
  status?: NotificationStatus[];
  startDate?: Date;
  endDate?: Date;
  unreadOnly?: boolean;
}

/**
 * 알림 통계
 */
export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
  byChannel: Record<NotificationChannel, number>;
  byStatus: Record<NotificationStatus, number>;
}

/**
 * 알림 이벤트
 */
export interface NotificationEvent {
  type: 'created' | 'updated' | 'deleted' | 'read' | 'sent' | 'failed';
  notification: Notification;
  timestamp: Date;
}

/**
 * 알림 템플릿
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  channels: NotificationChannel[];
  
  // 템플릿 내용
  title: string;
  message: string;
  
  // 변수
  variables: string[];
  
  // 한국어 지원
  locale: 'ko' | 'en';
  
  // 활성 상태
  active: boolean;
}

/**
 * 알림 배치 작업
 */
export interface NotificationBatch {
  id: string;
  notifications: Notification[];
  scheduledAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stats: {
    total: number;
    sent: number;
    failed: number;
  };
}