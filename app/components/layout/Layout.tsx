import { useState } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileMenu } from "./MobileMenu";

interface LayoutProps {
  children: React.ReactNode;
  user?: {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
    role?: string;
    avatar?: string | null;
  };
  menus?: {
    id: string;
    name: string;
    slug: string;
    order: number;
  }[];
  settings?: Record<string, string>;
}

export function Layout({ children, user, menus = [], settings }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        user={user}
        menus={menus}
        onMenuClick={() => setMobileMenuOpen(true)}
        siteName={settings?.site_name}
      />
      
      <MobileMenu
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        menus={menus}
        user={user}
      />

      <main className="flex-1">
        {children}
      </main>

      <Footer menus={menus} settings={settings} />
    </div>
  );
}