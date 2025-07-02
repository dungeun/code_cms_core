import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Eye, Edit, Trash2 } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUser } from "~/lib/auth.server";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useState } from "react";
import { z } from "zod";

const actionSchema = z.object({
  intent: z.enum(['delete', 'publish', 'unpublish', 'bulkDelete', 'bulkPublish', 'bulkUnpublish']),
  postId: z.string().optional(),
  postIds: z.array(z.string()).optional(),
});

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);

  const posts = await db.post.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      isPublished: true,
      views: true,
      createdAt: true,
      author: {
        select: { name: true, email: true },
      },
      menu: {
        select: { name: true },
      },
      _count: {
        select: { comments: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return json({ posts });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);

  const formData = await request.formData();
  const intent = formData.get('intent');
  
  try {
    if (intent === 'delete') {
      const postId = formData.get('postId') as string;
      await db.post.delete({ where: { id: postId } });
    } else if (intent === 'publish') {
      const postId = formData.get('postId') as string;
      await db.post.update({
        where: { id: postId },
        data: { isPublished: true },
      });
    } else if (intent === 'unpublish') {
      const postId = formData.get('postId') as string;
      await db.post.update({
        where: { id: postId },
        data: { isPublished: false },
      });
    } else if (intent === 'bulkDelete') {
      const postIds = formData.getAll('postIds') as string[];
      await db.post.deleteMany({
        where: { id: { in: postIds } },
      });
    } else if (intent === 'bulkPublish') {
      const postIds = formData.getAll('postIds') as string[];
      await db.post.updateMany({
        where: { id: { in: postIds } },
        data: { isPublished: true },
      });
    } else if (intent === 'bulkUnpublish') {
      const postIds = formData.getAll('postIds') as string[];
      await db.post.updateMany({
        where: { id: { in: postIds } },
        data: { isPublished: false },
      });
    }

    return json({ success: true });
  } catch (error) {
    return json({ error: '작업 중 오류가 발생했습니다.' }, { status: 400 });
  }
}

export default function AdminPosts() {
  const { posts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPosts(posts.map(post => post.id));
    } else {
      setSelectedPosts([]);
    }
  };

  const handleSelectPost = (postId: string, checked: boolean) => {
    if (checked) {
      setSelectedPosts([...selectedPosts, postId]);
    } else {
      setSelectedPosts(selectedPosts.filter(id => id !== postId));
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedPosts.length === 0) return;

    const formData = new FormData();
    formData.set('intent', action);
    selectedPosts.forEach(id => formData.append('postIds', id));
    
    fetcher.submit(formData, { method: 'post' });
    setSelectedPosts([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">게시글 관리</h2>
          <p className="text-muted-foreground">모든 게시글을 관리합니다.</p>
        </div>
        <Button asChild>
          <Link to="/posts/new">새 게시글 작성</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>게시글 목록</CardTitle>
          <CardDescription>총 {posts.length}개의 게시글</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedPosts.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedPosts.length}개 선택됨
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('bulkPublish')}
              >
                일괄 공개
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('bulkUnpublish')}
              >
                일괄 비공개
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm('선택한 게시글을 모두 삭제하시겠습니까?')) {
                    handleBulkAction('bulkDelete');
                  }
                }}
              >
                일괄 삭제
              </Button>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedPosts.length === posts.length && posts.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead>작성자</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>조회수</TableHead>
                  <TableHead>댓글</TableHead>
                  <TableHead>작성일</TableHead>
                  <TableHead className="w-[100px]">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPosts.includes(post.id)}
                        onCheckedChange={(checked) => handleSelectPost(post.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/posts/${post.slug}`}
                        className="font-medium hover:underline"
                      >
                        {post.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{post.author.name || '이름 없음'}</p>
                        <p className="text-muted-foreground">{post.author.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {post.menu ? (
                        <Badge variant="secondary">{post.menu.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={post.isPublished ? 'default' : 'secondary'}>
                        {post.isPublished ? '공개' : '비공개'}
                      </Badge>
                    </TableCell>
                    <TableCell>{post.views}</TableCell>
                    <TableCell>{post._count.comments}</TableCell>
                    <TableCell>
                      {format(new Date(post.createdAt), 'yyyy-MM-dd', { locale: ko })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" asChild>
                          <Link to={`/posts/${post.slug}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button size="icon" variant="ghost" asChild>
                          <Link to={`/posts/${post.slug}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <fetcher.Form method="post" className="inline">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="postId" value={post.id} />
                          <Button
                            size="icon"
                            variant="ghost"
                            type="submit"
                            onClick={(e) => {
                              if (!confirm('이 게시글을 삭제하시겠습니까?')) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </fetcher.Form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}