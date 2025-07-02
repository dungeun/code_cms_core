import { useState } from "react";
import { useSearchParams, Link } from "@remix-run/react";
import {
  Table,
  TableBody,
  TableCaption,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { BoardHeader } from "./BoardHeader";
import { BoardRow } from "./BoardRow";
import { MobilePostCard } from "~/components/mobile/MobilePostCard";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter } from "lucide-react";
import { cn } from "~/lib/utils";

interface Post {
  id: string;
  number: number;
  title: string;
  slug: string;
  content?: string;
  author: string;
  authorAvatar?: string;
  createdAt: Date | string;
  views: number;
  likes: number;
  commentCount?: number;
  isNotice?: boolean;
  isNew?: boolean;
  isHot?: boolean;
  category?: string;
  tags?: string[];
  hasImage?: boolean;
}

interface KoreanBoardProps {
  posts: Post[];
  totalPosts: number;
  currentPage: number;
  categorySlug: string;
  categoryName: string;
  isLoggedIn?: boolean;
}

const POSTS_PER_PAGE = 50;
const PAGE_NUMBERS_TO_SHOW = 15;

export function KoreanBoard({
  posts,
  totalPosts,
  currentPage,
  categorySlug,
  categoryName,
  isLoggedIn = false,
}: KoreanBoardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const sortBy = searchParams.get("sort") || "latest";

  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
  const pageGroupSize = PAGE_NUMBERS_TO_SHOW;
  const currentGroup = Math.floor((currentPage - 1) / pageGroupSize);
  const startPage = currentGroup * pageGroupSize + 1;
  const endPage = Math.min(startPage + pageGroupSize - 1, totalPages);

  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", page.toString());
    setSearchParams(newParams);
  };

  const handleSortChange = (newSort: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("sort", newSort);
    newParams.delete("page"); // 정렬 변경시 첫 페이지로
    setSearchParams(newParams);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchTerm) {
      newParams.set("search", searchTerm);
    } else {
      newParams.delete("search");
    }
    newParams.delete("page"); // 검색시 첫 페이지로
    setSearchParams(newParams);
  };

  return (
    <div className="space-y-4">
      {/* 서브 히어로 섹션 */}
      <div className="bg-primary/5 border-y border-primary/20 py-6 sm:py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-center">{categoryName}</h1>
          <p className="text-center text-sm sm:text-base text-muted-foreground mt-2">
            {categoryName} 관련 정보와 토론을 나누는 공간입니다
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        {/* 검색 및 정렬 */}
        <div className="flex flex-col gap-3 mb-4">
          {/* 모바일: 검색 바 */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="검색어를 입력하세요"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 text-sm sm:text-base"
            />
            <Button type="submit" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
              <Search className="h-4 w-4" />
            </Button>
          </form>
          
          {/* 모바일: 필터 및 정렬 */}
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="flex-1 sm:w-[180px] text-sm sm:text-base">
                <SelectValue placeholder="정렬 기준" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">최신순</SelectItem>
                <SelectItem value="views">조회순</SelectItem>
                <SelectItem value="likes">추천순</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="md:hidden h-9 w-9">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 게시판 - 데스크톱: 테이블, 모바일: 카드 */}
        {/* 모바일 뷰 */}
        <div className="md:hidden space-y-3">
          {posts.map((post) => (
            <MobilePostCard
              key={post.id}
              post={{
                id: parseInt(post.id),
                title: post.title,
                content: post.content || "",
                author: post.author,
                authorAvatar: post.authorAvatar,
                createdAt: typeof post.createdAt === 'string' ? post.createdAt : post.createdAt.toISOString(),
                viewCount: post.views,
                likeCount: post.likes,
                commentCount: post.commentCount || 0,
                category: post.category,
                tags: post.tags,
                isPinned: post.isNotice,
                isHot: post.isHot,
                hasImage: post.hasImage,
                slug: post.slug,
              }}
              categorySlug={categorySlug}
            />
          ))}
          {posts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              게시글이 없습니다.
            </div>
          )}
        </div>

        {/* 데스크톱 뷰 */}
        <div className="hidden md:block border rounded-lg overflow-hidden">
          <Table>
            <BoardHeader />
            <TableBody>
              {posts.map((post) => (
                <BoardRow
                  key={post.id}
                  post={post}
                  categorySlug={categorySlug}
                />
              ))}
            </TableBody>
            {posts.length === 0 && (
              <TableCaption className="py-8">
                게시글이 없습니다.
              </TableCaption>
            )}
          </Table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-6 overflow-x-auto pb-2">
            {/* 모바일: 간소화된 페이지네이션 */}
            <div className="flex md:hidden items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-9 px-3"
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
              
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">{currentPage}</span>
                <span className="text-sm text-gray-500">/</span>
                <span className="text-sm text-gray-500">{totalPages}</span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="h-9 px-3"
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* 데스크톱: 전체 페이지네이션 */}
            <div className="hidden md:flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(Math.max(1, startPage - pageGroupSize))}
                disabled={currentGroup === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                  className="min-w-[40px]"
                >
                  {page}
                </Button>
              ))}

              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(Math.min(totalPages, endPage + 1))}
                disabled={endPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 글쓰기 버튼 */}
        {isLoggedIn && (
          <div className="flex justify-end mt-4">
            <Button asChild className="w-full sm:w-auto">
              <Link to={`/${categorySlug}/write`}>글쓰기</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}