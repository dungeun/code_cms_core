import React, { forwardRef } from "react";
import { Textarea } from "~/components/ui/textarea";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

// 간단한 텍스트 에디터 - 추후 TipTap 등으로 업그레이드 가능
export const RichTextEditor = forwardRef<HTMLTextAreaElement, RichTextEditorProps>(
  ({ value, onChange, placeholder, className, rows = 10 }, ref) => {
    return (
      <div className="w-full">
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          rows={rows}
        />
        <div className="mt-2 text-sm text-gray-500">
          마크다운 문법을 지원합니다. (추후 리치 텍스트 에디터로 업그레이드 예정)
        </div>
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";