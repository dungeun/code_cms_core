import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Layout as AppLayout } from "~/components/layout/Layout";
import { db } from "~/utils/db.server";
import { getUser } from "~/lib/auth.server";
import { getThemeConfig, generateCSSVariables } from "~/lib/theme.server";

import "./tailwind.css";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100..900&display=swap",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const menus = await db.menu.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      order: true,
    },
    orderBy: { order: 'asc' },
  });

  const theme = await getThemeConfig();
  const themeCSS = generateCSSVariables(theme);
  
  // 사이트 설정 가져오기
  const settings = await db.setting.findMany({
    select: {
      key: true,
      value: true,
    }
  });
  
  const settingsMap = settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, string>);

  return json({ user, menus, theme, themeCSS, settings: settingsMap });
}


export default function App() {
  const { user, menus, theme, themeCSS, settings } = useLoaderData<typeof loader>();
  
  return (
    <Document theme={theme} themeCSS={themeCSS} settings={settings}>
      <AppLayout user={user} menus={menus} settings={settings}>
        <Outlet />
      </AppLayout>
    </Document>
  );
}

function Document({ children, theme, themeCSS, settings }: { children: React.ReactNode; theme?: any; themeCSS?: string; settings?: Record<string, string> }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {settings?.site_name && <title>{settings.site_name}</title>}
        {settings?.site_description && <meta name="description" content={settings.site_description} />}
        <Meta />
        <Links />
        {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}
      </head>
      <body 
        className="font-[var(--font-family)] text-[var(--font-size-base)] bg-[var(--color-background)] text-[var(--color-text)] min-h-screen"
        suppressHydrationWarning
      >
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
