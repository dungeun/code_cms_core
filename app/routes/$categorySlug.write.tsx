import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Layout } from "~/components/layout/Layout";
import { PostEditor } from "~/components/editor/PostEditor";
import { db } from "~/lib/db.server";
import { requireUserId } from "~/lib/auth.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const { categorySlug } = params;

  // 카테고리 확인
  const category = await db.category.findUnique({
    where: { slug: categorySlug },
  });

  if (!category) {
    throw new Response("카테고리를 찾을 수 없습니다.", { status: 404 });
  }

  // 모든 카테고리 가져오기 (카테고리 선택용)
  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
  });

  // 사용자 정보 가져오기 (관리자 여부 확인)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return json({
    category,
    categories,
    isAdmin: user?.role === "ADMIN",
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const { categorySlug } = params;

  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const categoryId = formData.get("categoryId") as string;
  const isPinned = formData.get("isPinned") === "on";
  const isDraft = formData.get("isDraft") === "true";

  // 유효성 검사
  if (!title || !content || !categoryId) {
    return json(
      { error: "제목, 내용, 카테고리는 필수입니다." },
      { status: 400 }
    );
  }

  // 카테고리 확인
  const category = await db.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    return json(
      { error: "유효하지 않은 카테고리입니다." },
      { status: 400 }
    );
  }

  // 공지사항 설정은 관리자만 가능
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const canSetPinned = user?.role === "ADMIN";

  try {
    // 게시글 생성
    const post = await db.post.create({
      data: {
        title,
        content,
        categoryId,
        authorId: userId,
        isPinned: canSetPinned && isPinned,
        isPublished: !isDraft,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
      },
    });

    // 임시저장이면 목록으로, 아니면 상세 페이지로 이동
    if (isDraft) {
      return redirect(`/board/${category.slug}?message=draft_saved`);
    } else {
      return redirect(`/board/${category.slug}/${post.id}`);
    }
  } catch (error) {
    console.error("게시글 작성 오류:", error);
    return json(
      { error: "게시글 작성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export default function BoardWritePage() {
  const { category, categories, isAdmin } = useLoaderData<typeof loader>();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">새 글 작성</h1>
        
        <PostEditor
          categories={categories}
          isAdmin={isAdmin}
          mode="create"
        />
      </div>
    </Layout>
  );
}