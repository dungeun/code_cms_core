import { Link } from "@remix-run/react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { MessageCircle, ThumbsUp, Eye, User } from "lucide-react";

interface MobilePostCardProps {
  post: {
    id: number;
    title: string;
    content: string;
    author: string;
    authorAvatar?: string;
    createdAt: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    category?: string;
    tags?: string[];
    isPinned?: boolean;
    isHot?: boolean;
    hasImage?: boolean;
    slug?: string;
  };
  categorySlug: string;
}

export function MobilePostCard({ post, categorySlug }: MobilePostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
    locale: ko,
  });

  // Extract preview text from content (remove HTML tags)
  const previewText = post.content
    .replace(/<[^>]*>/g, "")
    .slice(0, 100)
    .trim();

  return (
    <Card className="relative overflow-hidden touch-manipulation hover:shadow-md transition-shadow duration-200">
      <Link
        to={`/${categorySlug}/${post.slug || post.id}`}
        className="block"
        prefetch="intent"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {post.isPinned && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    공지
                  </Badge>
                )}
                {post.isHot && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700">
                    인기
                  </Badge>
                )}
                {post.category && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {post.category}
                  </Badge>
                )}
              </div>
              <h3 className="font-medium text-base line-clamp-2 break-all">
                {post.title}
                {post.hasImage && (
                  <span className="ml-1 text-gray-400">📷</span>
                )}
              </h3>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          <p className="text-sm text-gray-600 line-clamp-2 break-all">
            {previewText}...
          </p>
        </CardContent>

        <CardFooter className="pt-0 pb-3">
          <div className="flex items-center justify-between w-full text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {post.author}
              </span>
              <span>{timeAgo}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <Eye className="w-3 h-3" />
                {post.viewCount}
              </span>
              <span className="flex items-center gap-0.5">
                <ThumbsUp className="w-3 h-3" />
                {post.likeCount}
              </span>
              <span className="flex items-center gap-0.5">
                <MessageCircle className="w-3 h-3" />
                {post.commentCount}
              </span>
            </div>
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
}