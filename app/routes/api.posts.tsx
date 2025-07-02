import { json, type ActionFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { requireUserId } from "~/lib/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  
  if (request.method === "POST") {
    // 게시글 생성
    const data = await request.json();
    const { title, content, categoryId, isPinned, isDraft } = data;

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

      return json({ success: true, post });
    } catch (error) {
      console.error("게시글 작성 오류:", error);
      return json(
        { error: "게시글 작성 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  }

  return json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}