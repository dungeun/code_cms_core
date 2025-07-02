import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { FileText, MessageSquare, UserPlus } from "lucide-react";

interface Activity {
  id: string;
  type: 'post' | 'comment' | 'user';
  title: string;
  description: string;
  createdAt: Date;
  user: {
    name: string;
    email: string;
  };
}

interface RecentActivityProps {
  activities: Activity[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'post':
        return <FileText className="h-4 w-4" />;
      case 'comment':
        return <MessageSquare className="h-4 w-4" />;
      case 'user':
        return <UserPlus className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: Activity['type']) => {
    switch (type) {
      case 'post':
        return '새 게시글';
      case 'comment':
        return '새 댓글';
      case 'user':
        return '새 회원가입';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>최근 활동</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">최근 활동이 없습니다.</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                  {getIcon(activity.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">{activity.user.name || activity.user.email}</span>
                    {' '}
                    <span className="text-muted-foreground">{getTypeLabel(activity.type)}</span>
                  </p>
                  <p className="text-sm font-medium">{activity.title}</p>
                  {activity.description && (
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(activity.createdAt, { addSuffix: true, locale: ko })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}