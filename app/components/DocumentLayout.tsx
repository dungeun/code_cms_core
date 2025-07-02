import { useEffect } from "react";
import type { ThemeConfig } from "~/lib/theme.server";

interface DocumentLayoutProps {
  children: React.ReactNode;
  theme?: ThemeConfig;
  themeCSS?: string;
}

export function DocumentLayout({ children, theme, themeCSS }: DocumentLayoutProps) {
  useEffect(() => {
    // Apply theme CSS variables
    if (themeCSS) {
      const styleElement = document.createElement('style');
      styleElement.innerHTML = themeCSS;
      styleElement.id = 'theme-styles';
      
      // Remove existing theme styles
      const existingStyle = document.getElementById('theme-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
      
      document.head.appendChild(styleElement);
    }
  }, [themeCSS]);
  
  return (
    <div className="font-[var(--font-family)] text-[var(--font-size-base)] bg-[var(--color-background)] text-[var(--color-text)] min-h-screen">
      {children}
    </div>
  );
}