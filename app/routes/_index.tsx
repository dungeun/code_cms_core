import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { db } from "~/utils/db.server";
import { getUser } from "~/lib/auth.server";
import { CategorySection } from "~/components/home/CategorySection";
import { Sidebar } from "~/components/layout/Sidebar";

export const meta: MetaFunction = () => {
  return [
    { title: "Blee CMS - 현대적인 콘텐츠 관리 시스템" },
    { name: "description", content: "Blee CMS로 콘텐츠를 효율적으로 관리하세요" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  // 활성 카테고리 가져오기
  const categories = await db.menu.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      order: true,
    },
    orderBy: { order: "asc" },
  });

  // 카테고리별 최신 게시물 가져오기
  const categoryPosts = await Promise.all(
    categories.slice(0, 8).map(async (category) => {
      const posts = await db.post.findMany({
        where: {
          menuId: category.id,
          isPublished: true,
          publishedAt: {
            lte: new Date(),
          },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          views: true,
          author: {
            select: {
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
        orderBy: { publishedAt: "desc" },
        take: 6,
      });

      return {
        category,
        posts: posts.map((post) => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          publishedAt: post.publishedAt?.toISOString(),
          viewCount: post.views,
          commentCount: post._count.comments,
          author: {
            name: post.author.name || post.author.email,
          },
        })),
      };
    })
  );

  // 인기 게시물 (조회수 기준)
  const popularPosts = await db.post.findMany({
    where: {
      isPublished: true,
      publishedAt: {
        lte: new Date(),
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      views: true,
      menu: {
        select: {
          slug: true,
        },
      },
    },
    orderBy: { views: "desc" },
    take: 10,
  });

  // 회원 랭킹 (게시글 수 기준)
  const memberRankings = await db.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      _count: {
        select: {
          posts: {
            where: {
              isPublished: true,
            },
          },
        },
      },
    },
    orderBy: {
      posts: {
        _count: "desc",
      },
    },
    take: 10,
  });

  // 최근 댓글
  const recentComments = await db.comment.findMany({
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: {
        select: {
          name: true,
          username: true,
        },
      },
      post: {
        select: {
          title: true,
          slug: true,
          menu: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return json({
    user,
    categoryPosts,
    popularPosts: popularPosts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      viewCount: post.views,
      category: post.menu ? { slug: post.menu.slug } : undefined,
    })),
    memberRankings: memberRankings.map((member, index) => ({
      id: member.id,
      name: member.name || "",
      username: member.username || "",
      postCount: member._count.posts,
      rank: index + 1,
    })),
    recentComments: recentComments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      author: {
        name: comment.author.name || "",
        username: comment.author.username || "",
      },
      post: {
        title: comment.post.title,
        slug: comment.post.slug,
        category: comment.post.menu ? { slug: comment.post.menu.slug } : undefined,
      },
    })),
  });
}

export default function Index() {
  const { user, categoryPosts, popularPosts, memberRankings, recentComments } = useLoaderData<typeof loader>();

  const categoryColors = [
    "blue", "green", "purple", "orange", "red", "yellow", "gray", "blue"
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 왼쪽 사이드바 - 데스크톱에서만 표시 */}
          <div className="hidden lg:block lg:col-span-1">
            {/* 간단한 메뉴나 광고 영역 */}
          </div>

          {/* 메인 콘텐츠 영역 - 너비 확장 */}
          <main className="lg:col-span-9">
            {/* 상단 배너/공지사항 영역 - 높이 두 배 */}
            <div className="mb-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-12 text-white">
              <h1 className="text-3xl font-bold mb-4">Blee CMS 커뮤니티</h1>
              <p className="text-blue-100 text-lg">다양한 주제로 자유롭게 소통하는 공간입니다</p>
            </div>

            {/* 카테고리별 섹션 - 2개씩 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categoryPosts.map((section, index) => (
                <CategorySection
                  key={section.category.id}
                  title={section.category.name}
                  slug={section.category.slug}
                  posts={section.posts}
                  color={categoryColors[index % categoryColors.length]}
                />
              ))}
            </div>
          </main>

          {/* 오른쪽 사이드바 */}
          <aside className="lg:col-span-2">
            <Sidebar
              popularPosts={popularPosts}
              memberRankings={memberRankings}
              recentComments={recentComments}
              position="right"
              user={user}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}