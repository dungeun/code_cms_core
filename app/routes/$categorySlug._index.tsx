import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { KoreanBoard } from "~/components/board/KoreanBoard";
import { db } from "~/utils/db.server";
import { getUser } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { PenSquare } from "lucide-react";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { categorySlug } = params;
  
  console.log('==== CATEGORY LIST LOADER ====');
  console.log('Category slug:', categorySlug);
  
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;
  const sort = url.searchParams.get("sort") || "latest";
  const search = url.searchParams.get("search") || "";
  const user = await getUser(request);
  
  const postsPerPage = 50;
  const skip = (page - 1) * postsPerPage;

  // 메뉴 찾기
  const menu = await db.menu.findUnique({
    where: { slug: categorySlug },
  });

  if (!menu) {
    throw new Response("메뉴를 찾을 수 없습니다", { status: 404 });
  }

  // 검색 조건
  const searchCondition = search
    ? {
        OR: [
          { title: { contains: search } },
          { content: { contains: search } },
        ],
      }
    : {};

  // 정렬 조건
  const orderBy = 
    sort === "views" ? { views: "desc" as const } :
    sort === "likes" ? { likes: "desc" as const } :
    { createdAt: "desc" as const };

  // 공지사항 가져오기
  const notices = await db.post.findMany({
    where: {
      menuId: menu.id,
      isNotice: true,
      isPublished: true,
    },
    include: {
      author: { select: { username: true, name: true, email: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // 일반 게시글 가져오기
  const [posts, totalCount] = await Promise.all([
    db.post.findMany({
      where: {
        menuId: menu.id,
        isNotice: false,
        isPublished: true,
        ...searchCondition,
      },
      include: {
        author: { select: { username: true, name: true, email: true } },
        _count: { select: { comments: true } },
      },
      orderBy,
      skip,
      take: postsPerPage - notices.length, // 공지사항 수만큼 빼기
    }),
    db.post.count({
      where: {
        menuId: menu.id,
        isNotice: false,
        isPublished: true,
        ...searchCondition,
      },
    }),
  ]);

  // 게시글 번호 계산 및 포맷팅
  const formattedNotices = notices.map((post) => ({
    id: post.id,
    number: 0, // 공지사항은 번호 대신 "공지" 뱃지
    title: post.title,
    slug: post.slug,
    author: post.author.name || post.author.username || post.author.email.split('@')[0],
    createdAt: post.createdAt.toISOString(),
    views: post.views,
    likes: post.likes,
    commentCount: post._count.comments,
    isNotice: true,
  }));

  const formattedPosts = posts.map((post, index) => ({
    id: post.id,
    number: totalCount - skip - index, // 역순 번호
    title: post.title,
    slug: post.slug,
    author: post.author.name || post.author.username || post.author.email.split('@')[0],
    createdAt: post.createdAt.toISOString(),
    views: post.views,
    likes: post.likes,
    commentCount: post._count.comments,
    isNotice: false,
  }));

  // 현재 페이지에 표시할 게시글 합치기
  const allPosts = page === 1 ? [...formattedNotices, ...formattedPosts] : formattedPosts;

  const totalPages = Math.ceil((totalCount + notices.length) / postsPerPage);

  return json({
    menu,
    posts: allPosts,
    currentPage: page,
    totalPages,
    totalPosts: totalCount + notices.length,
    sort,
    search,
    user,
  });
}

export default function CategoryPage() {
  const { menu, posts, currentPage, totalPages, totalPosts, sort, search, user } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">{menu.name}</h1>
            {user && (
              <Link to={`/${menu.slug}/write`}>
                <Button>
                  <PenSquare className="h-4 w-4 mr-2" />
                  글쓰기
                </Button>
              </Link>
            )}
          </div>
          {menu.description && (
            <p className="text-gray-600">{menu.description}</p>
          )}
        </div>

        {/* 게시판 */}
        <KoreanBoard
          posts={posts}
          currentPage={currentPage}
          totalPosts={totalPosts}
          categorySlug={menu.slug}
          categoryName={menu.name}
          isLoggedIn={!!user}
        />
      </div>
    </div>
  );
}