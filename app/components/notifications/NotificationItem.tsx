/**
 * 알림 아이템 컴포넌트
 * 개별 알림을 표시하는 컴포넌트
 */

import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Bell,
  MessageSquare,
  Heart,
  UserPlus,
  DollarSign,
  Shield,
  AlertCircle,
  Info,
  CheckCircle,
} from 'lucide-react';
import { NotificationType, NotificationPriority } from '~/lib/notifications/notification.types';
import { cn } from '~/lib/utils';

interface NotificationItemProps {
  notification: any;
  onRead?: () => void;
  className?: string;
}

export function NotificationItem({ 
  notification, 
  onRead,
  className = '' 
}: NotificationItemProps) {
  const isUnread = notification.status !== 'READ';
  
  // 알림 타입별 아이콘
  const getIcon = () => {
    switch (notification.type) {
      case NotificationType.USER_MESSAGE:
      case NotificationType.USER_MENTION:
      case NotificationType.CONTENT_COMMENT:
        return <MessageSquare className="h-4 w-4" />;
        
      case NotificationType.CONTENT_LIKE:
        return <Heart className="h-4 w-4" />;
        
      case NotificationType.USER_FOLLOW:
        return <UserPlus className="h-4 w-4" />;
        
      case NotificationType.PAYMENT_SUCCESS:
      case NotificationType.PAYMENT_FAILED:
      case NotificationType.PAYMENT_REFUND:
        return <DollarSign className="h-4 w-4" />;
        
      case NotificationType.SECURITY_LOGIN:
      case NotificationType.SECURITY_PASSWORD_CHANGE:
      case NotificationType.SECURITY_SUSPICIOUS:
        return <Shield className="h-4 w-4" />;
        
      case NotificationType.SYSTEM:
      case NotificationType.SYSTEM_MAINTENANCE:
      case NotificationType.SYSTEM_UPDATE:
        return <Info className="h-4 w-4" />;
        
      default:
        return <Bell className="h-4 w-4" />;
    }
  };
  
  // 우선순위별 색상
  const getPriorityColor = () => {
    switch (notification.priority) {
      case NotificationPriority.CRITICAL:
        return 'text-red-600 bg-red-50';
      case NotificationPriority.URGENT:
        return 'text-orange-600 bg-orange-50';
      case NotificationPriority.HIGH:
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };
  
  const handleClick = () => {
    if (isUnread && onRead) {
      onRead();
    }
    
    // 액션 URL로 이동
    if (notification.data?.actionUrl) {
      window.location.href = notification.data.actionUrl;
    }
  };
  
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors',
        isUnread && 'bg-blue-50/50',
        className
      )}
      onClick={handleClick}
    >
      <div className={cn(
        'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
        getPriorityColor()
      )}>
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className={cn(
              'text-sm line-clamp-1',
              isUnread ? 'font-semibold' : 'font-normal'
            )}>
              {notification.data?.title}
            </p>
            {notification.data?.message && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {notification.data.message}
              </p>
            )}
          </div>
          
          {isUnread && (
            <div className="flex-shrink-0">
              <div className="w-2 h-2 bg-blue-600 rounded-full" />
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
              locale: ko,
            })}
          </span>
          
          {notification.data?.actionLabel && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-primary hover:underline">
                {notification.data.actionLabel}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}