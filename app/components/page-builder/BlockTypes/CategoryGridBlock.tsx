import React from 'react';
import { Link } from '@remix-run/react';
import type { BlockConfig } from '~/stores/page-builder.store';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  postCount?: number;
  icon?: string;
}

interface CategoryGridBlockProps {
  block: BlockConfig;
  categories?: Category[];
  isEditing?: boolean;
  onSettingsChange?: (settings: Record<string, any>) => void;
}

export function CategoryGridBlock({ block, categories = [], isEditing, onSettingsChange }: CategoryGridBlockProps) {
  const { title, columns, showPostCount, showIcon } = block.settings;

  if (isEditing) {
    return (
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-lg">카테고리 그리드 설정</h3>
        
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
            컬럼 수
          </label>
          <select
            value={columns}
            onChange={(e) => onSettingsChange?.({ ...block.settings, columns: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="3">3열</option>
            <option value="4">4열</option>
            <option value="5">5열</option>
            <option value="6">6열</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showPostCount}
              onChange={(e) => onSettingsChange?.({ ...block.settings, showPostCount: e.target.checked })}
              className="mr-2"
            />
            게시물 수 표시
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showIcon}
              onChange={(e) => onSettingsChange?.({ ...block.settings, showIcon: e.target.checked })}
              className="mr-2"
            />
            아이콘 표시
          </label>
        </div>
      </div>
    );
  }

  const gridCols = {
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6',
  }[columns] || 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <div className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8">{title}</h2>
        
        <div className={`grid ${gridCols} gap-4`}>
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/posts?category=${category.slug}`}
              className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow text-center group"
            >
              {showIcon && category.icon && (
                <div className="text-4xl mb-3">{category.icon}</div>
              )}
              
              <h3 className="font-semibold text-lg mb-1 group-hover:text-blue-600">
                {category.name}
              </h3>
              
              {category.description && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {category.description}
                </p>
              )}
              
              {showPostCount && category.postCount !== undefined && (
                <p className="text-sm text-gray-500">
                  {category.postCount}개의 게시물
                </p>
              )}
            </Link>
          ))}
        </div>

        {categories.length === 0 && (
          <p className="text-center text-gray-500 py-8">카테고리가 없습니다.</p>
        )}
      </div>
    </div>
  );
}