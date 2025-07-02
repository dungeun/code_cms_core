import { AdminSidebar } from "./AdminSidebar";
import { Button } from "~/components/ui/button";
import { Link } from "@remix-run/react";
import { Home, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";

interface AdminLayoutProps {
  children: React.ReactNode;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export function AdminLayout({ children, user }: AdminLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>
      
      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <div className="h-full bg-gray-50">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <h2 className="text-lg font-semibold">관리자 패널</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <AdminSidebar />
          </div>
        </SheetContent>
      </Sheet>
      
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 sm:h-16 items-center justify-between border-b bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Blee CMS Admin</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden sm:inline text-sm text-gray-600">
              {user.name || user.email}
            </span>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="icon" asChild className="h-8 w-8 sm:h-9 sm:w-9">
                <Link to="/">
                  <Home className="h-4 w-4" />
                </Link>
              </Button>
              
              <form action="/logout" method="post">
                <Button variant="ghost" size="icon" type="submit" className="h-8 w-8 sm:h-9 sm:w-9">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}