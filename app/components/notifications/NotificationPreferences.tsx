/**
 * 알림 설정 컴포넌트
 * 사용자가 알림 수신 방법을 설정할 수 있는 UI
 */

import { useState, useEffect } from 'react';
import { Switch } from '~/components/ui/switch';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  NotificationChannel,
  NotificationType,
  NotificationPreferences,
} from '~/lib/notifications/notification.types';
import { useToast } from '~/components/ui/use-toast';

interface NotificationPreferencesFormProps {
  userId: string;
  initialPreferences?: NotificationPreferences;
  onSave?: (preferences: NotificationPreferences) => Promise<void>;
}

export function NotificationPreferencesForm({
  userId,
  initialPreferences,
  onSave,
}: NotificationPreferencesFormProps) {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    initialPreferences || {
      userId,
      channels: {
        [NotificationChannel.IN_APP]: true,
        [NotificationChannel.EMAIL]: true,
        [NotificationChannel.SMS]: false,
        [NotificationChannel.PUSH]: true,
        [NotificationChannel.KAKAO]: false,
      },
      types: {},
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'Asia/Seoul',
      },
      doNotDisturb: false,
    }
  );
  
  const [isSaving, setIsSaving] = useState(false);
  
  // 채널 토글
  const toggleChannel = (channel: NotificationChannel) => {
    setPreferences(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: !prev.channels[channel],
      },
    }));
  };
  
  // 알림 타입 토글
  const toggleNotificationType = (type: NotificationType, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      types: {
        ...prev.types,
        [type]: {
          ...prev.types[type],
          enabled,
        },
      },
    }));
  };
  
  // 조용한 시간 토글
  const toggleQuietHours = () => {
    setPreferences(prev => ({
      ...prev,
      quietHours: {
        ...prev.quietHours!,
        enabled: !prev.quietHours?.enabled,
      },
    }));
  };
  
  // 방해 금지 토글
  const toggleDoNotDisturb = () => {
    setPreferences(prev => ({
      ...prev,
      doNotDisturb: !prev.doNotDisturb,
    }));
  };
  
  // 저장
  const handleSave = async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      await onSave(preferences);
      toast({
        title: '설정 저장 완료',
        description: '알림 설정이 업데이트되었습니다.',
      });
    } catch (error) {
      toast({
        title: '오류',
        description: '설정 저장에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const notificationTypes = [
    {
      category: '사용자',
      types: [
        { type: NotificationType.USER_MESSAGE, label: '메시지' },
        { type: NotificationType.USER_MENTION, label: '멘션' },
        { type: NotificationType.USER_FOLLOW, label: '팔로우' },
      ],
    },
    {
      category: '콘텐츠',
      types: [
        { type: NotificationType.CONTENT_COMMENT, label: '댓글' },
        { type: NotificationType.CONTENT_LIKE, label: '좋아요' },
        { type: NotificationType.CONTENT_SHARE, label: '공유' },
        { type: NotificationType.CONTENT_PUBLISH, label: '게시' },
      ],
    },
    {
      category: '결제',
      types: [
        { type: NotificationType.PAYMENT_SUCCESS, label: '결제 성공' },
        { type: NotificationType.PAYMENT_FAILED, label: '결제 실패' },
        { type: NotificationType.PAYMENT_REFUND, label: '환불' },
      ],
    },
    {
      category: '보안',
      types: [
        { type: NotificationType.SECURITY_LOGIN, label: '로그인' },
        { type: NotificationType.SECURITY_PASSWORD_CHANGE, label: '비밀번호 변경' },
        { type: NotificationType.SECURITY_SUSPICIOUS, label: '의심스러운 활동' },
      ],
    },
  ];
  
  return (
    <div className="space-y-6">
      <Tabs defaultValue="channels" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="channels">알림 채널</TabsTrigger>
          <TabsTrigger value="types">알림 타입</TabsTrigger>
          <TabsTrigger value="settings">기타 설정</TabsTrigger>
        </TabsList>
        
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>알림 수신 채널</CardTitle>
              <CardDescription>
                알림을 받을 채널을 선택하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="in-app" className="flex flex-col gap-1">
                  <span>앱 내 알림</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    브라우저에서 실시간 알림을 받습니다.
                  </span>
                </Label>
                <Switch
                  id="in-app"
                  checked={preferences.channels[NotificationChannel.IN_APP]}
                  onCheckedChange={() => toggleChannel(NotificationChannel.IN_APP)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="flex flex-col gap-1">
                  <span>이메일</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    중요한 알림을 이메일로 받습니다.
                  </span>
                </Label>
                <Switch
                  id="email"
                  checked={preferences.channels[NotificationChannel.EMAIL]}
                  onCheckedChange={() => toggleChannel(NotificationChannel.EMAIL)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="sms" className="flex flex-col gap-1">
                  <span>SMS</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    긴급한 알림을 문자로 받습니다.
                  </span>
                </Label>
                <Switch
                  id="sms"
                  checked={preferences.channels[NotificationChannel.SMS] || false}
                  onCheckedChange={() => toggleChannel(NotificationChannel.SMS)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="push" className="flex flex-col gap-1">
                  <span>푸시 알림</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    모바일 앱에서 푸시 알림을 받습니다.
                  </span>
                </Label>
                <Switch
                  id="push"
                  checked={preferences.channels[NotificationChannel.PUSH] || false}
                  onCheckedChange={() => toggleChannel(NotificationChannel.PUSH)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="kakao" className="flex flex-col gap-1">
                  <span>카카오톡 알림톡</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    카카오톡으로 알림을 받습니다.
                  </span>
                </Label>
                <Switch
                  id="kakao"
                  checked={preferences.channels[NotificationChannel.KAKAO] || false}
                  onCheckedChange={() => toggleChannel(NotificationChannel.KAKAO)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="types" className="space-y-4">
          {notificationTypes.map((category) => (
            <Card key={category.category}>
              <CardHeader>
                <CardTitle>{category.category} 알림</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.types.map((type) => (
                  <div key={type.type} className="flex items-center justify-between">
                    <Label htmlFor={type.type}>{type.label}</Label>
                    <Switch
                      id={type.type}
                      checked={preferences.types[type.type]?.enabled !== false}
                      onCheckedChange={(enabled) => 
                        toggleNotificationType(type.type, enabled)
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>방해 금지 모드</CardTitle>
              <CardDescription>
                모든 알림을 일시적으로 비활성화합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="dnd">방해 금지 모드</Label>
                <Switch
                  id="dnd"
                  checked={preferences.doNotDisturb || false}
                  onCheckedChange={toggleDoNotDisturb}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>조용한 시간</CardTitle>
              <CardDescription>
                설정한 시간 동안 푸시 알림을 받지 않습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="quiet-hours">조용한 시간 사용</Label>
                <Switch
                  id="quiet-hours"
                  checked={preferences.quietHours?.enabled || false}
                  onCheckedChange={toggleQuietHours}
                />
              </div>
              
              {preferences.quietHours?.enabled && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="quiet-start">시작</Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      value={preferences.quietHours.start}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        quietHours: {
                          ...prev.quietHours!,
                          start: e.target.value,
                        },
                      }))}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label htmlFor="quiet-end">종료</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={preferences.quietHours.end}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        quietHours: {
                          ...prev.quietHours!,
                          end: e.target.value,
                        },
                      }))}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  );
}