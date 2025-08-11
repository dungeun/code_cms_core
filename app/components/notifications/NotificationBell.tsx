/**
 * 알림 벨 컴포넌트
 * 헤더에 표시되는 알림 아이콘과 배지
 */

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '~/hooks/useSocketConnection';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { NotificationItem } from './NotificationItem';
import { NotificationType, NotificationPriority } from '~/lib/notifications/notification.types';

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  
  // 알림 소리 재생
  useEffect(() => {
    if (unreadCount > 0 && !isOpen) {
      // 새 알림 소리 재생
      playNotificationSound();
    }
  }, [unreadCount]);
  
  const playNotificationSound = () => {
    // 브라우저 알림 소리
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(() => {
      // 소리 재생 실패 무시
    });
  };
  
  const handleMarkAllRead = () => {
    markAllAsRead();
  };
  
  const recentNotifications = notifications.slice(0, 5);
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`relative ${className}`}
          aria-label="알림"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center"
              variant="destructive"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuHeader className="flex items-center justify-between">
          <span className="font-semibold">알림</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs"
            >
              모두 읽음
            </Button>
          )}
        </DropdownMenuHeader>
        
        <DropdownMenuSeparator />
        
        {recentNotifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            새로운 알림이 없습니다.
          </div>
        ) : (
          <>
            {recentNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={() => markAsRead(notification.id)}
              />
            ))}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="text-center text-sm">
              <a href="/notifications" className="w-full">
                모든 알림 보기
              </a>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}