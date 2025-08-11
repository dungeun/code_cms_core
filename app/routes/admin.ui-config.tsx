import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useFetcher } from "@remix-run/react";
import { requireAdmin } from "~/lib/auth.server";
import { AdminLayout } from "~/components/admin/AdminLayout";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useState } from "react";
import { ExternalLink, Eye, Settings, Globe, Layout, Palette } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  
  // TODO: 데이터베이스에서 UI 설정 가져오기
  const uiConfig = {
    header: {
      logo: "/logo.png",
      title: "Blee CMS",
      showSearch: true,
      ctaButton: {
        text: "시작하기",
        url: "/login",
        enabled: true,
      },
    },
    footer: {
      columns: [
        {
          title: "서비스",
          links: [
            { text: "홈", url: "/" },
            { text: "소개", url: "/about" },
            { text: "연락처", url: "/contact" },
          ],
        },
        {
          title: "지원",
          links: [
            { text: "도움말", url: "/help" },
            { text: "FAQ", url: "/faq" },
          ],
        },
      ],
    },
    sections: [
      {
        id: "hero",
        name: "히어로 섹션",
        enabled: true,
        order: 1,
        config: {
          title: "Blee CMS 커뮤니티",
          description: "다양한 주제로 자유롭게 소통하는 공간입니다",
          backgroundType: "gradient",
          backgroundColor: "from-blue-500 to-blue-600",
        },
      },
      {
        id: "categories",
        name: "카테고리 섹션",
        enabled: true,
        order: 2,
        config: {
          layout: "grid",
          columns: 2,
          showPostCount: true,
        },
      },
      {
        id: "popular",
        name: "인기 게시물",
        enabled: true,
        order: 3,
        config: {
          limit: 10,
          period: "week",
        },
      },
    ],
  };

  return json({ user, uiConfig });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  
  const formData = await request.formData();
  const action = formData.get("_action");
  
  // TODO: 데이터베이스 업데이트 로직 구현
  switch (action) {
    case "update-header":
      // 헤더 설정 업데이트
      break;
    case "update-footer":
      // 푸터 설정 업데이트
      break;
    case "update-sections":
      // 섹션 설정 업데이트
      break;
  }
  
  return json({ success: true });
}

export default function AdminUIConfig() {
  const { user, uiConfig } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState("header");
  const fetcher = useFetcher();
  
  return (
    <AdminLayout user={user}>
      <div className="space-y-6">
        {/* 페이지 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">UI 구성 관리</h1>
              <Button variant="ghost" size="icon" asChild>
                <a href="/" target="_blank" rel="noopener noreferrer" title="메인페이지 미리보기">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-gray-600 mt-1">메인 페이지의 UI 구성 요소를 관리합니다</p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            실시간 미리보기
          </Button>
        </div>

        {/* 탭 네비게이션 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="header" className="flex items-center gap-2">
              <Layout className="h-4 w-4" />
              헤더
            </TabsTrigger>
            <TabsTrigger value="sections" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              섹션 관리
            </TabsTrigger>
            <TabsTrigger value="footer" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              푸터
            </TabsTrigger>
            <TabsTrigger value="theme" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              테마
            </TabsTrigger>
          </TabsList>

          {/* 헤더 설정 */}
          <TabsContent value="header" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>헤더 커스터마이징</CardTitle>
                <CardDescription>로고, 메뉴, CTA 버튼을 설정합니다</CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="_action" value="update-header" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="logo">로고 URL</Label>
                      <Input
                        id="logo"
                        name="logo"
                        defaultValue={uiConfig.header.logo}
                        placeholder="/logo.png"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="title">사이트 제목</Label>
                      <Input
                        id="title"
                        name="title"
                        defaultValue={uiConfig.header.title}
                        placeholder="Blee CMS"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="showSearch"
                        name="showSearch"
                        defaultChecked={uiConfig.header.showSearch}
                      />
                      <Label htmlFor="showSearch">검색 기능 표시</Label>
                    </div>

                    <div className="space-y-2">
                      <Label>CTA 버튼 설정</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          name="ctaText"
                          placeholder="버튼 텍스트"
                          defaultValue={uiConfig.header.ctaButton.text}
                        />
                        <Input
                          name="ctaUrl"
                          placeholder="버튼 URL"
                          defaultValue={uiConfig.header.ctaButton.url}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="ctaEnabled"
                          name="ctaEnabled"
                          defaultChecked={uiConfig.header.ctaButton.enabled}
                        />
                        <Label htmlFor="ctaEnabled">CTA 버튼 표시</Label>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={fetcher.state === "submitting"}>
                    {fetcher.state === "submitting" ? "저장 중..." : "헤더 설정 저장"}
                  </Button>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 섹션 관리 */}
          <TabsContent value="sections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>메인 페이지 섹션 관리</CardTitle>
                <CardDescription>드래그 앤 드롭으로 섹션 순서를 변경하고 설정을 관리합니다</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {uiConfig.sections
                    .sort((a, b) => a.order - b.order)
                    .map((section) => (
                      <div
                        key={section.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{section.name}</span>
                            <span className="text-sm text-gray-500">순서: {section.order}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch checked={section.enabled} />
                          <Button variant="outline" size="sm">
                            설정
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 푸터 설정 */}
          <TabsContent value="footer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>푸터 커스터마이징</CardTitle>
                <CardDescription>푸터의 컬럼과 링크를 관리합니다</CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="_action" value="update-footer" />
                  
                  {uiConfig.footer.columns.map((column, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <Input
                        name={`column-${index}-title`}
                        placeholder="컬럼 제목"
                        defaultValue={column.title}
                      />
                      <div className="space-y-2">
                        {column.links.map((link, linkIndex) => (
                          <div key={linkIndex} className="flex gap-2">
                            <Input
                              name={`column-${index}-link-${linkIndex}-text`}
                              placeholder="링크 텍스트"
                              defaultValue={link.text}
                            />
                            <Input
                              name={`column-${index}-link-${linkIndex}-url`}
                              placeholder="링크 URL"
                              defaultValue={link.url}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <Button type="submit" disabled={fetcher.state === "submitting"}>
                    {fetcher.state === "submitting" ? "저장 중..." : "푸터 설정 저장"}
                  </Button>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 테마 설정 */}
          <TabsContent value="theme" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>테마 및 스타일 설정</CardTitle>
                <CardDescription>색상, 폰트, 레이아웃 스타일을 설정합니다</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>기본 색상</Label>
                      <div className="flex gap-2">
                        <div className="w-10 h-10 bg-blue-500 rounded cursor-pointer"></div>
                        <div className="w-10 h-10 bg-green-500 rounded cursor-pointer"></div>
                        <div className="w-10 h-10 bg-purple-500 rounded cursor-pointer"></div>
                        <div className="w-10 h-10 bg-red-500 rounded cursor-pointer"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>폰트 설정</Label>
                      <select className="w-full p-2 border rounded">
                        <option>기본 폰트</option>
                        <option>Noto Sans Korean</option>
                        <option>Malgun Gothic</option>
                      </select>
                    </div>
                  </div>
                  
                  <Button>테마 설정 저장</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}