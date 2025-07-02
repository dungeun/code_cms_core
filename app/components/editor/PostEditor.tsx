import React, { useState } from "react";
import { Form, useNavigation } from "@remix-run/react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { RichTextEditor } from "./RichTextEditor";
import type { Category, Post } from "@prisma/client";

interface PostEditorProps {
  post?: Post & { category?: Category };
  categories: Category[];
  isAdmin?: boolean;
  mode: "create" | "edit";
}

export function PostEditor({ post, categories, isAdmin = false, mode }: PostEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  
  const [title, setTitle] = useState(post?.title || "");
  const [content, setContent] = useState(post?.content || "");
  const [categoryId, setCategoryId] = useState(post?.categoryId || "");
  const [isPinned, setIsPinned] = useState(post?.isPinned || false);
  const [isDraft, setIsDraft] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSaveDraft = () => {
    setIsDraft(true);
    // Form will be submitted with isDraft = true
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Form method="post" className="space-y-6">
        {/* 제목 입력 */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            제목
          </label>
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            required
            className="w-full"
          />
        </div>

        {/* 카테고리 선택 */}
        <div>
          <label htmlFor="categoryId" className="block text-sm font-medium mb-2">
            카테고리
          </label>
          <input type="hidden" name="categoryId" value={categoryId} />
          <Select
            value={categoryId}
            onValueChange={setCategoryId}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="카테고리를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 공지사항 설정 (관리자만) */}
        {isAdmin && (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isPinned"
              name="isPinned"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="isPinned" className="text-sm font-medium">
              공지사항으로 설정
            </label>
          </div>
        )}

        {/* 내용 입력 */}
        <div>
          <label htmlFor="content" className="block text-sm font-medium mb-2">
            내용
          </label>
          <input type="hidden" name="content" value={content} />
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="내용을 입력하세요"
            rows={15}
          />
        </div>

        {/* 파일 첨부 (추후 구현) */}
        <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-sm text-gray-500">
          파일 첨부 기능은 추후 구현 예정입니다.
        </div>

        {/* 미리보기 */}
        {showPreview && (
          <div className="border rounded-lg p-6 bg-gray-50">
            <h3 className="font-bold text-lg mb-2">미리보기</h3>
            <div className="space-y-4">
              <h4 className="text-2xl font-bold">{title || "제목 없음"}</h4>
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-sans">{content || "내용 없음"}</pre>
              </div>
            </div>
          </div>
        )}

        {/* 임시 저장 플래그 */}
        <input type="hidden" name="isDraft" value={isDraft.toString()} />

        {/* 버튼들 */}
        <div className="flex items-center justify-between">
          <div className="space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? "미리보기 닫기" : "미리보기"}
            </Button>
            <Button
              type="submit"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
            >
              임시 저장
            </Button>
          </div>
          <div className="space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.history.back()}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              onClick={() => setIsDraft(false)}
            >
              {isSubmitting 
                ? (mode === "create" ? "작성 중..." : "수정 중...") 
                : (mode === "create" ? "작성 완료" : "수정 완료")
              }
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
}