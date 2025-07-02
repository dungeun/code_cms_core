import { Link } from "@remix-run/react";
import { TableCell, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { MessageSquare, Pin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "~/lib/utils";

interface BoardRowProps {
  post: {
    id: string;
    number: number;
    title: string;
    slug: string;
    author: string;
    createdAt: Date | string;
    views: number;
    likes: number;
    commentCount?: number;
    isNotice?: boolean;
    isNew?: boolean;
    isHot?: boolean;
  };
  categorySlug: string;
}

export function BoardRow({ post, categorySlug }: BoardRowProps) {
  const {
    id,
    number,
    title,
    slug,
    author,
    createdAt,
    views,
    likes,
    commentCount = 0,
    isNotice = false,
    isNew = false,
    isHot = false,
  } = post;

  // 날짜 포맷
  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - dateObj.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 1) {
      return formatDistanceToNow(dateObj, { addSuffix: true, locale: ko });
    } else if (hours < 24) {
      return `${Math.floor(hours)}시간 전`;
    } else if (dateObj.toDateString() === now.toDateString()) {
      return dateObj.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return dateObj.toLocaleDateString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
      });
    }
  };

  return (
    <TableRow className={isNotice ? "bg-primary/5" : "hover:bg-muted/50"}>
      <TableCell className="text-center text-sm">
        {isNotice ? (
          <Badge variant="secondary" className="gap-1">
            <Pin className="h-3 w-3" />
            공지
          </Badge>
        ) : (
          <span className="text-muted-foreground">{number}</span>
        )}
      </TableCell>
      <TableCell>
        <Link
          to={`/${categorySlug}/${slug}`}
          className="flex items-center gap-2 hover:underline"
        >
          <span className={cn(
            "text-gray-900",
            isNotice && "font-semibold"
          )}>{title}</span>
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-primary">
              <MessageSquare className="h-3 w-3" />
              <span className="text-xs font-semibold">{commentCount}</span>
            </span>
          )}
          {isNew && (
            <Badge variant="default" className="h-5 px-1.5 text-[10px]">
              NEW
            </Badge>
          )}
          {isHot && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
              인기
            </Badge>
          )}
        </Link>
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {author}
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {formatDate(createdAt)}
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {views.toLocaleString()}
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {likes.toLocaleString()}
      </TableCell>
    </TableRow>
  );
}