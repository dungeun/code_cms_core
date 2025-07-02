import { cn } from "~/lib/utils";

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: "none" | "small" | "medium" | "large";
}

export function ResponsiveContainer({
  children,
  className,
  maxWidth = "xl",
  padding = "medium",
}: ResponsiveContainerProps) {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    full: "max-w-full",
  };

  const paddingClasses = {
    none: "",
    small: "px-4 sm:px-6",
    medium: "px-4 sm:px-6 lg:px-8",
    large: "px-6 sm:px-8 lg:px-12",
  };

  return (
    <div
      className={cn(
        "mx-auto w-full",
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

interface GridContainerProps {
  children: React.ReactNode;
  className?: string;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: "small" | "medium" | "large";
}

export function GridContainer({
  children,
  className,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = "medium",
}: GridContainerProps) {
  const gapClasses = {
    small: "gap-3 sm:gap-4",
    medium: "gap-4 sm:gap-6",
    large: "gap-6 sm:gap-8",
  };

  const getGridCols = () => {
    const { mobile = 1, tablet = 2, desktop = 3 } = columns;
    const cols = [];
    
    if (mobile === 1) cols.push("grid-cols-1");
    else cols.push(`grid-cols-${mobile}`);
    
    if (tablet === 1) cols.push("sm:grid-cols-1");
    else if (tablet === 2) cols.push("sm:grid-cols-2");
    else cols.push(`sm:grid-cols-${tablet}`);
    
    if (desktop === 1) cols.push("lg:grid-cols-1");
    else if (desktop === 2) cols.push("lg:grid-cols-2");
    else if (desktop === 3) cols.push("lg:grid-cols-3");
    else if (desktop === 4) cols.push("lg:grid-cols-4");
    else cols.push(`lg:grid-cols-${desktop}`);
    
    return cols.join(" ");
  };

  return (
    <div
      className={cn(
        "grid",
        getGridCols(),
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}