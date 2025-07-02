import React from 'react';
import { Link } from '@remix-run/react';
import type { BlockConfig } from '~/stores/page-builder.store';

interface BannerBlockProps {
  block: BlockConfig;
  isEditing?: boolean;
  onSettingsChange?: (settings: Record<string, any>) => void;
}

export function BannerBlock({ block, isEditing, onSettingsChange }: BannerBlockProps) {
  const { content, backgroundColor, textColor, padding, link } = block.settings;

  if (isEditing) {
    return (
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-lg">배너 설정</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            내용 (HTML 지원)
          </label>
          <textarea
            value={content}
            onChange={(e) => onSettingsChange?.({ ...block.settings, content: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            배경색
          </label>
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => onSettingsChange?.({ ...block.settings, backgroundColor: e.target.value })}
            className="w-full h-10 px-3 py-1 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            텍스트 색상
          </label>
          <input
            type="color"
            value={textColor}
            onChange={(e) => onSettingsChange?.({ ...block.settings, textColor: e.target.value })}
            className="w-full h-10 px-3 py-1 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            패딩
          </label>
          <select
            value={padding}
            onChange={(e) => onSettingsChange?.({ ...block.settings, padding: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="0.5rem 1rem">작게 (모바일)</option>
            <option value="1rem 1.5rem">보통 (모바일)</option>
            <option value="1rem">작게</option>
            <option value="2rem">보통</option>
            <option value="3rem">크게</option>
            <option value="4rem">매우 크게</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            링크 URL (선택사항)
          </label>
          <input
            type="text"
            value={link}
            onChange={(e) => onSettingsChange?.({ ...block.settings, link: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="https://example.com"
          />
        </div>
      </div>
    );
  }

  const getResponsivePadding = () => {
    if (padding === '0.5rem 1rem') return 'py-2 px-4';
    if (padding === '1rem 1.5rem') return 'py-4 px-6';
    if (padding === '1rem') return 'p-4';
    if (padding === '2rem') return 'p-4 sm:p-8';
    if (padding === '3rem') return 'p-6 sm:p-12';
    if (padding === '4rem') return 'p-8 sm:p-16';
    return 'p-4 sm:p-8';
  };

  const bannerContent = (
    <div
      className={`text-center ${getResponsivePadding()} banner-content`}
      style={{
        backgroundColor,
        color: textColor,
      }}
    >
      <div 
        className="max-w-4xl mx-auto text-sm sm:text-base md:text-lg"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );

  if (link) {
    const isExternal = link.startsWith('http');
    
    if (isExternal) {
      return (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block hover:opacity-90 transition-opacity touch-manipulation"
        >
          {bannerContent}
        </a>
      );
    }
    
    return (
      <Link to={link} className="block hover:opacity-90 transition-opacity touch-manipulation">
        {bannerContent}
      </Link>
    );
  }

  return bannerContent;
}