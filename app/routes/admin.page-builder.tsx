import { useEffect, useState } from 'react';
import { json } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { PageBuilder } from '~/components/page-builder/PageBuilder';
import { usePageBuilderStore } from '~/stores/page-builder.store';
import { prisma } from '~/lib/db.server';
import { requireAdmin } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  // 블록 설정 가져오기
  const pageConfig = await prisma.pageConfig.findFirst({
    where: { name: 'homepage' },
  });

  // 샘플 데이터 (실제로는 DB에서 가져옴)
  const posts = await prisma.post.findMany({
    take: 10,
    orderBy: { publishedAt: 'desc' },
    where: { isPublished: true },
    include: {
      author: true,
      menu: true,
    },
  });

  const categories = await prisma.menu.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { posts: true },
      },
    },
  });

  const popularPosts = await prisma.post.findMany({
    take: 10,
    orderBy: { views: 'desc' },
    where: { isPublished: true },
    include: {
      author: true,
    },
  });

  return json({
    blocks: pageConfig?.config || [],
    data: {
      posts: posts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        thumbnail: undefined, // thumbnail 필드가 없으므로
        publishedAt: post.publishedAt?.toISOString(),
        viewCount: post.views,
        author: {
          name: post.author.name || post.author.email,
        },
        category: post.menu ? {
          name: post.menu.name,
          slug: post.menu.slug,
        } : undefined,
      })),
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        postCount: cat._count.posts,
      })),
      popularPosts: popularPosts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        thumbnail: undefined,
        viewCount: post.views,
        publishedAt: post.publishedAt?.toISOString(),
      })),
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  
  const formData = await request.formData();
  const blocks = JSON.parse(formData.get('blocks') as string);

  await prisma.pageConfig.upsert({
    where: { name: 'homepage' },
    update: { config: blocks },
    create: {
      name: 'homepage',
      config: blocks,
    },
  });

  return json({ success: true });
}

export default function AdminPageBuilder() {
  const { blocks: initialBlocks, data } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const { blocks, setBlocks } = usePageBuilderStore();
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setBlocks(initialBlocks);
  }, [initialBlocks, setBlocks]);

  useEffect(() => {
    setHasChanges(JSON.stringify(blocks) !== JSON.stringify(initialBlocks));
  }, [blocks, initialBlocks]);

  const handleSave = async () => {
    setIsSaving(true);
    
    const formData = new FormData();
    formData.append('blocks', JSON.stringify(blocks));
    
    fetcher.submit(formData, {
      method: 'post',
    });
    
    // 저장 후 상태 업데이트
    setTimeout(() => {
      setIsSaving(false);
      setHasChanges(false);
    }, 1000);
  };

  const handlePreview = () => {
    window.open('/', '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 툴바 */}
      <div className="sticky top-0 z-50 bg-white shadow-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold">홈페이지 빌더</h1>
            
            <div className="flex items-center space-x-4">
              {hasChanges && (
                <span className="text-sm text-orange-600">
                  저장되지 않은 변경사항이 있습니다
                </span>
              )}
              
              <button
                onClick={handlePreview}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                미리보기
              </button>
              
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={`px-4 py-2 rounded ${
                  hasChanges && !isSaving
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 페이지 빌더 */}
      <PageBuilder isEditing={true} data={data} />
      
      {/* 하단 정보 */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">사용 방법</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 상단 버튼을 클릭하여 새 블록을 추가하세요</li>
            <li>• 블록을 드래그하여 순서를 변경할 수 있습니다</li>
            <li>• 각 블록의 설정을 수정하여 내용을 커스터마이징하세요</li>
            <li>• 블록을 활성/비활성화하여 표시 여부를 제어할 수 있습니다</li>
            <li>• 변경사항은 저장 버튼을 클릭해야 적용됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}