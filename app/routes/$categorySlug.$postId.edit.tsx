import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Layout } from "~/components/layout/Layout";
import { PostEditor } from "~/components/editor/PostEditor";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/lib/auth.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const { categorySlug, postId } = params;

  // 게시글 가져오기
  const post = await db.post.findUnique({
    where: { id: postId },
    include: {
      category: true,
      author: {
        select: { id: true, username: true, role: true },
      },
    },
  });

  if (!post) {
    throw new Response("게시글을 찾을 수 없습니다.", { status: 404 });
  }

  // 수정 권한 확인
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const isAdmin = user?.role === "ADMIN";
  const isAuthor = post.authorId === userId;

  if (!isAuthor && !isAdmin) {
    throw new Response("수정 권한이 없습니다.", { status: 403 });
  }

  // 모든 카테고리 가져오기
  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
  });

  return json({
    post,
    categories,
    isAdmin,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const { categorySlug, postId } = params;

  // 게시글 확인
  const existingPost = await db.post.findUnique({
    where: { id: postId },
    include: { category: true },
  });

  if (!existingPost) {
    return json(
      { error: "게시글을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 수정 권한 확인
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const isAdmin = user?.role === "ADMIN";
  const isAuthor = existingPost.authorId === userId;

  if (!isAuthor && !isAdmin) {
    return json(
      { error: "수정 권한이 없습니다." },
      { status: 403 }
    );
  }

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

  try {
    // 게시글 수정
    const updatedPost = await db.post.update({
      where: { id: postId },
      data: {
        title,
        content,
        categoryId,
        isPinned: isAdmin ? isPinned : existingPost.isPinned,
        isPublished: !isDraft,
        updatedAt: new Date(),
      },
    });

    // 임시저장이면 목록으로, 아니면 상세 페이지로 이동
    if (isDraft) {
      return redirect(`/board/${category.slug}?message=draft_saved`);
    } else {
      return redirect(`/board/${category.slug}/${updatedPost.id}`);
    }
  } catch (error) {
    console.error("게시글 수정 오류:", error);
    return json(
      { error: "게시글 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export default function BoardEditPage() {
  const { post, categories, isAdmin } = useLoaderData<typeof loader>();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">글 수정</h1>
        
        <PostEditor
          post={post}
          categories={categories}
          isAdmin={isAdmin}
          mode="edit"
        />
      </div>
    </Layout>
  );
}