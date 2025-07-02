import { useEffect, useState } from "react";

interface MobileOnlyProps {
  children: React.ReactNode;
  breakpoint?: number;
  fallback?: React.ReactNode;
}

export function MobileOnly({ 
  children, 
  breakpoint = 768,
  fallback = null 
}: MobileOnlyProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Initial check
    checkIsMobile();

    // Add resize listener
    window.addEventListener("resize", checkIsMobile);

    return () => {
      window.removeEventListener("resize", checkIsMobile);
    };
  }, [breakpoint]);

  return isMobile ? <>{children}</> : <>{fallback}</>;
}

interface DesktopOnlyProps {
  children: React.ReactNode;
  breakpoint?: number;
  fallback?: React.ReactNode;
}

export function DesktopOnly({ 
  children, 
  breakpoint = 768,
  fallback = null 
}: DesktopOnlyProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= breakpoint);
    };

    // Initial check
    checkIsDesktop();

    // Add resize listener
    window.addEventListener("resize", checkIsDesktop);

    return () => {
      window.removeEventListener("resize", checkIsDesktop);
    };
  }, [breakpoint]);

  return isDesktop ? <>{children}</> : <>{fallback}</>;
}