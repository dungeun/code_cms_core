import React from 'react';
import { Link } from '@remix-run/react';
import type { BlockConfig } from '~/stores/page-builder.store';

interface HeroBlockProps {
  block: BlockConfig;
  isEditing?: boolean;
  onSettingsChange?: (settings: Record<string, any>) => void;
}

export function HeroBlock({ block, isEditing, onSettingsChange }: HeroBlockProps) {
  const { title, subtitle, backgroundImage, height, textAlign } = block.settings;

  if (isEditing) {
    return (
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-lg">히어로 섹션 설정</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onSettingsChange?.({ ...block.settings, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            부제목
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => onSettingsChange?.({ ...block.settings, subtitle: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            배경 이미지 URL
          </label>
          <input
            type="text"
            value={backgroundImage}
            onChange={(e) => onSettingsChange?.({ ...block.settings, backgroundImage: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            높이
          </label>
          <select
            value={height}
            onChange={(e) => onSettingsChange?.({ ...block.settings, height: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="200px">200px (모바일)</option>
            <option value="300px">300px</option>
            <option value="400px">400px</option>
            <option value="500px">500px</option>
            <option value="600px">600px</option>
            <option value="70vh">화면 높이 70%</option>
            <option value="100vh">전체 화면</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            텍스트 정렬
          </label>
          <select
            value={textAlign}
            onChange={(e) => onSettingsChange?.({ ...block.settings, textAlign: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="left">왼쪽</option>
            <option value="center">가운데</option>
            <option value="right">오른쪽</option>
          </select>
        </div>
      </div>
    );
  }

  const getResponsiveHeight = () => {
    // 모바일에서는 높이를 줄임
    if (height === '600px') return 'h-[400px] sm:h-[500px] md:h-[600px]';
    if (height === '500px') return 'h-[350px] sm:h-[400px] md:h-[500px]';
    if (height === '400px') return 'h-[300px] sm:h-[350px] md:h-[400px]';
    if (height === '300px') return 'h-[250px] sm:h-[300px]';
    if (height === '200px') return 'h-[200px]';
    if (height === '70vh') return 'h-[70vh]';
    if (height === '100vh') return 'h-screen';
    return 'h-[300px] sm:h-[400px] md:h-[500px]';
  };

  const getTextAlignment = () => {
    if (textAlign === 'left') return 'text-left';
    if (textAlign === 'right') return 'text-right';
    return 'text-center';
  };

  return (
    <div
      className={`relative flex items-center justify-center text-white ${getResponsiveHeight()}`}
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundColor: backgroundImage ? undefined : '#1f2937',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black bg-opacity-40" />
      <div className={`relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 ${getTextAlignment()}`}>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">
          {title}
        </h1>
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8">
          {subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-center">
          <Link
            to="/posts"
            className="w-full sm:w-auto inline-block px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm sm:text-base text-center"
          >
            게시물 보기
          </Link>
          <Link
            to="/admin"
            className="w-full sm:w-auto inline-block px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-800 rounded-lg transition-colors text-sm sm:text-base text-center"
          >
            관리자 페이지
          </Link>
        </div>
      </div>
    </div>
  );
}