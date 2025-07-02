import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useSubmit, useNavigate, Link } from "@remix-run/react";
import { db } from "~/utils/db.server";
import { getUser } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { 
  Eye, 
  ThumbsUp, 
  MessageSquare, 
  ChevronLeft, 
  Share2,
  Bookmark,
  MoreVertical,
  Edit,
  Trash2,
  Calendar,
  User
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { categorySlug, postId } = params;
  const user = await getUser(request);

  console.log('==== POST DETAIL LOADER ====');
  console.log('Loading post:', { categorySlug, postId }); // Debug log

  // slug로 게시글 찾기
  const post = await db.post.findFirst({
    where: { slug: postId },
    include: {
      author: { 
        select: { 
          id: true,
          username: true, 
          name: true,
          email: true,
          role: true 
        } 
      },
      menu: true,
      comments: {
        include: {
          author: { 
            select: { 
              id: true,
              username: true, 
              name: true,
              email: true 
            } 
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { comments: true }
      }
    },
  });

  if (!post) {
    console.error('Post not found:', postId);
    throw new Response("게시글을 찾을 수 없습니다", { status: 404 });
  }
  
  if (post.menu.slug !== categorySlug) {
    console.error('Category mismatch:', { expected: categorySlug, actual: post.menu.slug });
    throw new Response("잘못된 카테고리입니다", { status: 404 });
  }

  // 조회수 증가
  await db.post.update({
    where: { id: post.id },
    data: { views: { increment: 1 } },
  });

  // 사용자가 이미 추천했는지 확인
  const hasLiked = false; // 추후 PostLike 모델 추가 시 구현

  return json({
    post: {
      ...post,
      views: post.views + 1, // 증가된 조회수 반영
    },
    user,
    isAuthor: user?.id === post.authorId,
    isAdmin: user?.role === "ADMIN",
    hasLiked,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("_action");
  const user = await getUser(request);

  if (!user) {
    return redirect("/auth/login");
  }

  const { postId } = params;
  const post = await db.post.findFirst({
    where: { slug: postId },
    select: { id: true, authorId: true, menu: { select: { slug: true } } }
  });

  if (!post) {
    throw new Response("게시글을 찾을 수 없습니다", { status: 404 });
  }

  switch (action) {
    case "delete":
      if (user.id !== post.authorId && user.role !== "ADMIN") {
        throw new Response("권한이 없습니다", { status: 403 });
      }
      await db.post.delete({ where: { id: post.id } });
      return redirect(`/${post.menu.slug}`);

    case "like":
      // 추후 PostLike 모델 추가 시 구현
      await db.post.update({
        where: { id: post.id },
        data: { likes: { increment: 1 } }
      });
      return json({ success: true });

    case "comment":
      const content = formData.get("content") as string;
      if (!content || content.trim().length === 0) {
        return json({ error: "댓글 내용을 입력하세요" }, { status: 400 });
      }

      await db.comment.create({
        data: {
          content: content.trim(),
          postId: post.id,
          authorId: user.id,
        },
      });
      return json({ success: true });

    default:
      return json({ error: "Invalid action" }, { status: 400 });
  }
}

export default function PostDetail() {
  const { post, user, isAuthor, isAdmin, hasLiked } = useLoaderData<typeof loader>();
  
  // Debug log
  console.log('Rendering post detail:', { 
    title: post.title, 
    content: post.content,
    contentLength: post.content?.length 
  });
  
  // 클라이언트 측 디버그 로그
  if (typeof window !== 'undefined') {
    console.log('Post data in browser:', post);
  }
  const submit = useSubmit();
  const navigate = useNavigate();

  const handleLike = () => {
    submit({ _action: "like" }, { method: "post", replace: true });
  };

  const handleDelete = () => {
    if (confirm("정말 삭제하시겠습니까?")) {
      submit({ _action: "delete" }, { method: "post" });
    }
  };

  return (
    <div className="min-h-screen">
      {/* 서브 히어로 섹션 */}
      <div className="bg-primary/5 border-y border-primary/20 py-6 sm:py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-center">{post.menu.name}</h1>
          <p className="text-center text-sm sm:text-base text-muted-foreground mt-2">
            {post.menu.name} 관련 정보와 토론을 나누는 공간입니다
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        {/* 상단 네비게이션 */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to={`/${post.menu.slug}`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>{post.menu.name} 게시판으로 돌아가기</span>
          </Link>
          
          {(isAuthor || isAdmin) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/${post.menu.slug}/${post.slug}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  수정
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* 게시글 본문 */}
        <article className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* 헤더 */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                  {post.isNotice && (
                    <Badge variant="destructive" className="mr-2 align-middle">공지</Badge>
                  )}
                  {post.title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{post.author.name || post.author.username || post.author.email.split('@')[0]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <time>{formatDistanceToNow(new Date(post.publishedAt || post.createdAt), { addSuffix: true, locale: ko })}</time>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{post.views}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    <span>{post._count.comments}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 본문 */}
          <div className="p-6">
            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-base sm:text-lg">
              {post.content || <span className="text-gray-500 italic">내용이 없습니다</span>}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="p-6 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Button
                variant={hasLiked ? "default" : "outline"}
                size="sm"
                onClick={handleLike}
                disabled={!user}
              >
                <ThumbsUp className={cn("h-4 w-4 mr-2", hasLiked && "fill-current")} />
                추천 {post.likes > 0 && `(${post.likes})`}
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                공유
              </Button>
              <Button variant="outline" size="sm">
                <Bookmark className="h-4 w-4 mr-2" />
                북마크
              </Button>
            </div>
          </div>
        </article>

        {/* 댓글 섹션 */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">댓글 {post._count.comments}개</h2>
          </div>

          {/* 댓글 작성 */}
          {user ? (
            <Form method="post" className="p-6 border-b border-gray-200">
              <input type="hidden" name="_action" value="comment" />
              <Textarea
                name="content"
                placeholder="댓글을 작성하세요..."
                className="w-full mb-4"
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit">댓글 작성</Button>
              </div>
            </Form>
          ) : (
            <div className="p-6 border-b border-gray-200 text-center">
              <p className="text-gray-500 mb-4">댓글을 작성하려면 로그인이 필요합니다.</p>
              <Link to="/auth/login">
                <Button>로그인</Button>
              </Link>
            </div>
          )}

          {/* 댓글 목록 */}
          <div className="divide-y divide-gray-200">
            {post.comments.length > 0 ? (
              post.comments.map((comment) => (
                <div key={comment.id} className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {comment.author.name || comment.author.username || comment.author.email.split('@')[0]}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ko })}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-500">
                아직 댓글이 없습니다. 첫 번째 댓글을 작성해보세요!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}