import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BlockConfig } from '~/stores/page-builder.store';

interface DraggableBlockProps {
  block: BlockConfig;
  children: React.ReactNode;
  onRemove: () => void;
  onToggleActive: () => void;
  isEditing: boolean;
}

export function DraggableBlock({ 
  block, 
  children, 
  onRemove, 
  onToggleActive,
  isEditing 
}: DraggableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const blockTypeLabels = {
    'hero': '히어로 섹션',
    'recent-posts': '최근 게시물',
    'category-grid': '카테고리 그리드',
    'popular-posts': '인기 게시물',
    'banner': '배너',
  };

  if (!isEditing) {
    return <div>{children}</div>;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative border-2 ${
        block.isActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
      } rounded-lg mb-4 ${!block.isActive ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center space-x-4">
          <button
            {...attributes}
            {...listeners}
            className="cursor-move p-2 hover:bg-gray-100 rounded"
            title="드래그하여 이동"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>
          
          <div>
            <h4 className="font-medium">{blockTypeLabels[block.type]}</h4>
            <p className="text-sm text-gray-500">ID: {block.id}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleActive}
            className={`px-3 py-1 text-sm rounded ${
              block.isActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {block.isActive ? '활성' : '비활성'}
          </button>
          
          <button
            onClick={onRemove}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
            title="블록 삭제"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}