import React from 'react';
import { Link } from '@remix-run/react';
import type { BlockConfig } from '~/stores/page-builder.store';

interface Post {
  id: string;
  title: string;
  slug: string;
  thumbnail?: string;
  viewCount: number;
  publishedAt: string;
}

interface PopularPostsBlockProps {
  block: BlockConfig;
  posts?: Post[];
  isEditing?: boolean;
  onSettingsChange?: (settings: Record<string, any>) => void;
}

export function PopularPostsBlock({ block, posts = [], isEditing, onSettingsChange }: PopularPostsBlockProps) {
  const { title, count, period, showThumbnail, showViewCount } = block.settings;

  if (isEditing) {
    return (
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-lg">인기 게시물 설정</h3>
        
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
            max="10"
            onChange={(e) => onSettingsChange?.({ ...block.settings, count: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            기간
          </label>
          <select
            value={period}
            onChange={(e) => onSettingsChange?.({ ...block.settings, period: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="week">최근 1주</option>
            <option value="month">최근 1개월</option>
            <option value="all">전체 기간</option>
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
              checked={showViewCount}
              onChange={(e) => onSettingsChange?.({ ...block.settings, showViewCount: e.target.checked })}
              className="mr-2"
            />
            조회수 표시
          </label>
        </div>
      </div>
    );
  }

  const displayPosts = posts.slice(0, count);

  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">{title}</h2>
          
          <div className="space-y-4">
            {displayPosts.map((post, index) => (
              <div key={post.id} className="flex items-start space-x-4 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-gray-400 w-8">
                  {index + 1}
                </div>
                
                {showThumbnail && post.thumbnail && (
                  <Link to={`/posts/${post.slug}`} className="flex-shrink-0">
                    <img
                      src={post.thumbnail}
                      alt={post.title}
                      className="w-20 h-20 object-cover rounded"
                    />
                  </Link>
                )}
                
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    <Link to={`/posts/${post.slug}`} className="hover:text-blue-600">
                      {post.title}
                    </Link>
                  </h3>
                  
                  <div className="flex items-center text-sm text-gray-500 space-x-4">
                    <time dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString('ko-KR')}
                    </time>
                    {showViewCount && (
                      <span>조회 {post.viewCount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {displayPosts.length === 0 && (
            <p className="text-center text-gray-500 py-8">인기 게시물이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}