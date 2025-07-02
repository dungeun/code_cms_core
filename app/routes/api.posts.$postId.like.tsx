import { json, type ActionFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { requireUserId } from "~/lib/auth.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const { postId } = params;

  if (request.method !== "POST") {
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
  });

  if (!post) {
    return json(
      { error: "게시글을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  try {
    // 이미 추천했는지 확인
    const existingLike = await db.postLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (existingLike) {
      // 이미 추천한 경우, 추천 취소
      await db.postLike.delete({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      // 추천 수 감소
      const updatedPost = await db.post.update({
        where: { id: postId },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
        select: {
          likeCount: true,
        },
      });

      return json({
        success: true,
        liked: false,
        likeCount: updatedPost.likeCount,
        message: "추천을 취소했습니다.",
      });
    } else {
      // 추천하지 않은 경우, 추천 추가
      await db.postLike.create({
        data: {
          postId,
          userId,
        },
      });

      // 추천 수 증가
      const updatedPost = await db.post.update({
        where: { id: postId },
        data: {
          likeCount: {
            increment: 1,
          },
        },
        select: {
          likeCount: true,
        },
      });

      return json({
        success: true,
        liked: true,
        likeCount: updatedPost.likeCount,
        message: "추천했습니다.",
      });
    }
  } catch (error) {
    console.error("추천 처리 오류:", error);
    return json(
      { error: "추천 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}