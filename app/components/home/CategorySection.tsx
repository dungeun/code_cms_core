import { Link } from "@remix-run/react";
import { ChevronRight, MessageCircle, Eye, Calendar } from "lucide-react";
import { cn } from "~/lib/utils";

interface CategorySectionProps {
  title: string;
  slug: string;
  posts: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    publishedAt: string;
    viewCount: number;
    commentCount?: number;
    author: {
      name: string;
    };
  }[];
  color?: string;
}

export function CategorySection({ 
  title, 
  slug, 
  posts, 
  color = "blue"
}: CategorySectionProps) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600",
    orange: "from-orange-500 to-orange-600",
    red: "from-red-500 to-red-600",
    yellow: "from-yellow-500 to-yellow-600",
    gray: "from-gray-500 to-gray-600",
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className={cn(
        "px-4 py-3 bg-gradient-to-r flex items-center justify-between",
        colorClasses[color as keyof typeof colorClasses] || colorClasses.blue
      )}>
        <h2 className="font-semibold text-white text-lg">{title}</h2>
        <Link 
          to={`/${slug}`} 
          className="text-white/90 hover:text-white flex items-center gap-1 text-sm font-medium transition-colors"
        >
          더보기
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* 게시물 목록 */}
      <div className="divide-y divide-gray-100">
        {posts.length > 0 ? (
          posts.map((post, index) => (
            <Link
              key={post.id}
              to={`/${slug}/${post.slug}`}
              className="block hover:bg-gray-50 transition-colors"
            >
              <div className="p-4">
                <div className={cn(
                  "flex gap-4",
                  "items-center"
                )}>
                  {/* 순위 표시 (상위 3개) */}
                  {index < 3 && (
                    <div className="flex-shrink-0">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm",
                        index === 0 && "bg-gradient-to-br from-yellow-400 to-yellow-600",
                        index === 1 && "bg-gradient-to-br from-gray-400 to-gray-600",
                        index === 2 && "bg-gradient-to-br from-orange-400 to-orange-600"
                      )}>
                        {index + 1}
                      </div>
                    </div>
                  )}

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {post.title}
                    </h3>
                    
                    {post.excerpt && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(post.publishedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {post.viewCount.toLocaleString()}
                      </span>
                      {post.commentCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {post.commentCount}
                        </span>
                      )}
                      <span className="ml-auto font-medium">
                        {post.author.name}
                      </span>
                    </div>
                  </div>

                  {/* 순위 표시 (상위 3개) */}
                  {index < 3 && (
                    <div className="flex-shrink-0">
                      <span className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white",
                        index === 0 ? "bg-red-500" :
                        index === 1 ? "bg-orange-500" :
                        "bg-yellow-500"
                      )}>
                        {index + 1}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="p-8 text-center text-gray-500">
            아직 게시물이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 24) {
    if (diffInHours === 0) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      if (diffInMinutes < 60) {
        return `${diffInMinutes}분 전`;
      }
    }
    return `${diffInHours}시간 전`;
  }

  // 같은 연도면 월-일만 표시
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}.${date.getDate()}`;
  }

  // 다른 연도면 연-월-일 표시
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}