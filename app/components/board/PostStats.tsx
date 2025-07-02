import { Eye, ThumbsUp } from "lucide-react";

interface PostStatsProps {
  views: number;
  likes: number;
}

export function PostStats({ views, likes }: PostStatsProps) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-1">
        <Eye className="h-3 w-3" />
        <span>{views.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <ThumbsUp className="h-3 w-3" />
        <span>{likes.toLocaleString()}</span>
      </div>
    </div>
  );
}