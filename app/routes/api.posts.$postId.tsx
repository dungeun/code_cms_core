import { json, type ActionFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { requireUserId } from "~/lib/auth.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const { postId } = params;

  if (!postId) {
    return json(
      { error: "게시글 ID가 필요합니다." },
      { status: 400 }
    );
  }

  if (request.method === "PUT") {
    // 게시글 수정
    const data = await request.json();
    const { title, content, categoryId, isPinned, isDraft } = data;

    // 게시글 확인
    const existingPost = await db.post.findUnique({
      where: { id: postId },
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

      return json({ success: true, post: updatedPost });
    } catch (error) {
      console.error("게시글 수정 오류:", error);
      return json(
        { error: "게시글 수정 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  }

  return json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}