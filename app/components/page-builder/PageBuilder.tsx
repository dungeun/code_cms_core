import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { usePageBuilderStore } from '~/stores/page-builder.store';
import { DraggableBlock } from './DraggableBlock';
import { HeroBlock } from './BlockTypes/HeroBlock';
import { RecentPostsBlock } from './BlockTypes/RecentPostsBlock';
import { CategoryGridBlock } from './BlockTypes/CategoryGridBlock';
import { PopularPostsBlock } from './BlockTypes/PopularPostsBlock';
import { BannerBlock } from './BlockTypes/BannerBlock';
import type { BlockConfig } from '~/stores/page-builder.store';

interface PageBuilderProps {
  isEditing?: boolean;
  data?: {
    posts?: any[];
    categories?: any[];
    popularPosts?: any[];
  };
}

export function PageBuilder({ isEditing = false, data }: PageBuilderProps) {
  const {
    blocks,
    addBlock,
    removeBlock,
    updateBlock,
    reorderBlocks,
    toggleBlockActive,
    setIsDragging,
  } = usePageBuilderStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setIsDragging(false);

    if (active.id !== over.id) {
      reorderBlocks(active.id, over.id);
    }
  };

  const renderBlock = (block: BlockConfig) => {
    const blockProps = {
      block,
      isEditing,
      onSettingsChange: (settings: Record<string, any>) => {
        updateBlock(block.id, { settings });
      },
    };

    switch (block.type) {
      case 'hero':
        return <HeroBlock {...blockProps} />;
      case 'recent-posts':
        return <RecentPostsBlock {...blockProps} posts={data?.posts} />;
      case 'category-grid':
        return <CategoryGridBlock {...blockProps} categories={data?.categories} />;
      case 'popular-posts':
        return <PopularPostsBlock {...blockProps} posts={data?.popularPosts} />;
      case 'banner':
        return <BannerBlock {...blockProps} />;
      default:
        return null;
    }
  };

  if (isEditing) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">페이지 빌더</h2>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => addBlock('hero')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + 히어로 섹션
              </button>
              <button
                onClick={() => addBlock('recent-posts')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + 최근 게시물
              </button>
              <button
                onClick={() => addBlock('category-grid')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + 카테고리 그리드
              </button>
              <button
                onClick={() => addBlock('popular-posts')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + 인기 게시물
              </button>
              <button
                onClick={() => addBlock('banner')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + 배너
              </button>
            </div>
            
            <p className="text-sm text-gray-600">
              블록을 드래그하여 순서를 변경하거나, 설정을 수정할 수 있습니다.
            </p>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {blocks.map((block) => (
                <DraggableBlock
                  key={block.id}
                  block={block}
                  onRemove={() => removeBlock(block.id)}
                  onToggleActive={() => toggleBlockActive(block.id)}
                  isEditing={isEditing}
                >
                  {renderBlock(block)}
                </DraggableBlock>
              ))}
            </SortableContext>
          </DndContext>

          {blocks.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500 mb-4">아직 블록이 없습니다.</p>
              <p className="text-sm text-gray-400">위의 버튼을 클릭하여 블록을 추가하세요.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 일반 렌더링 모드 (방문자용)
  const activeBlocks = blocks.filter(b => b.isActive).sort((a, b) => a.order - b.order);
  
  return (
    <div>
      {activeBlocks.map((block) => (
        <div key={block.id}>
          {renderBlock(block)}
        </div>
      ))}
    </div>
  );
}