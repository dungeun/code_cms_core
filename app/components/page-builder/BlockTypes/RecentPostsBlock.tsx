import React from 'react';
import { Link } from '@remix-run/react';
import type { BlockConfig } from '~/stores/page-builder.store';

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  thumbnail?: string;
  publishedAt: string;
  author?: {
    name: string;
  };
  viewCount?: number;
}

interface RecentPostsBlockProps {
  block: BlockConfig;
  posts?: Post[];
  isEditing?: boolean;
  onSettingsChange?: (settings: Record<string, any>) => void;
}

export function RecentPostsBlock({ block, posts = [], isEditing, onSettingsChange }: RecentPostsBlockProps) {
  const { title, count, columns, showThumbnail, showExcerpt, showDate, showAuthor } = block.settings;

  if (isEditing) {
    return (
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-lg">최근 게시물 설정</h3>
        
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
            표시 개수
          </label>
          <input
            type="number"
            value={count}
            min="1"
            max="12"
            onChange={(e) => onSettingsChange?.({ ...block.settings, count: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            컬럼 수
          </label>
          <select
            value={columns}
            onChange={(e) => onSettingsChange?.({ ...block.settings, columns: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="2">2열</option>
            <option value="3">3열</option>
            <option value="4">4열</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showThumbnail}
              onChange={(e) => onSettingsChange?.({ ...block.settings, showThumbnail: e.target.checked })}
              className="mr-2"
            />
            썸네일 표시
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showExcerpt}
              onChange={(e) => onSettingsChange?.({ ...block.settings, showExcerpt: e.target.checked })}
              className="mr-2"
            />
            요약 표시
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showDate}
              onChange={(e) => onSettingsChange?.({ ...block.settings, showDate: e.target.checked })}
              className="mr-2"
            />
            날짜 표시
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showAuthor}
              onChange={(e) => onSettingsChange?.({ ...block.settings, showAuthor: e.target.checked })}
              className="mr-2"
            />
            작성자 표시
          </label>
        </div>
      </div>
    );
  }

  const displayPosts = posts.slice(0, count);
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  }[columns] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="py-8 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">{title}</h2>
        
        <div className={`grid ${gridCols} gap-4 sm:gap-6`}>
          {displayPosts.map((post) => (
            <article key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow touch-manipulation">
              {showThumbnail && post.thumbnail && (
                <Link to={`/posts/${post.slug}`} className="block">
                  <img
                    src={post.thumbnail}
                    alt={post.title}
                    className="w-full h-40 sm:h-48 object-cover"
                    loading="lazy"
                  />
                </Link>
              )}
              
              <div className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold mb-2 line-clamp-2">
                  <Link to={`/posts/${post.slug}`} className="hover:text-blue-600 transition-colors">
                    {post.title}
                  </Link>
                </h3>
                
                {showExcerpt && post.excerpt && (
                  <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3">
                    {post.excerpt}
                  </p>
                )}
                
                <div className="flex flex-wrap items-center text-xs sm:text-sm text-gray-500 gap-2 sm:gap-4">
                  {showDate && (
                    <time dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString('ko-KR')}
                    </time>
                  )}
                  {showAuthor && post.author && (
                    <span>량 {post.author.name}</span>
                  )}
                  {post.viewCount !== undefined && (
                    <span>조회 {post.viewCount}</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {displayPosts.length === 0 && (
          <p className="text-center text-gray-500 py-8">게시물이 없습니다.</p>
        )}
      </div>
    </div>
  );
}