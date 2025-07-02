import { json, type ActionFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { requireUserId } from "~/lib/auth.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const { postId } = params;

  if (request.method !== "DELETE") {
    return json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  if (!postId) {
    return json(
      { error: "게시글 ID가 필요합니다." },
      { status: 400 }
    );
  }

  // 게시글 확인
  const post = await db.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      categoryId: true,
    },
  });

  if (!post) {
    return json(
      { error: "게시글을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 삭제 권한 확인
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const isAdmin = user?.role === "ADMIN";
  const isAuthor = post.authorId === userId;

  if (!isAuthor && !isAdmin) {
    return json(
      { error: "삭제 권한이 없습니다." },
      { status: 403 }
    );
  }

  try {
    // 관련된 좋아요 먼저 삭제
    await db.postLike.deleteMany({
      where: { postId },
    });

    // 관련된 댓글 먼저 삭제
    await db.comment.deleteMany({
      where: { postId },
    });

    // 게시글 삭제
    await db.post.delete({
      where: { id: postId },
    });

    return json({ success: true, message: "게시글이 삭제되었습니다." });
  } catch (error) {
    console.error("게시글 삭제 오류:", error);
    return json(
      { error: "게시글 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}