import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

interface MobileTableProps {
  children: ReactNode;
  className?: string;
}

interface MobileTableRowProps {
  children: ReactNode;
  className?: string;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

interface MobileTableCellProps {
  label?: string;
  children: ReactNode;
  className?: string;
  primary?: boolean;
}

export function MobileTable({ children, className }: MobileTableProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  );
}

export function MobileTableRow({
  children,
  className,
  expandable = false,
  expanded = false,
  onToggle,
}: MobileTableRowProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-gray-200 shadow-sm",
        "transition-all duration-200",
        expandable && "cursor-pointer",
        className
      )}
      onClick={expandable ? onToggle : undefined}
    >
      <div className="p-4">
        {children}
        {expandable && (
          <div className="flex justify-center mt-2">
            <ChevronDown
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileTableCell({
  label,
  children,
  className,
  primary = false,
}: MobileTableCellProps) {
  return (
    <div className={cn("flex items-start", className)}>
      {label && (
        <span className="text-sm text-gray-500 min-w-[80px] mr-2">
          {label}:
        </span>
      )}
      <div
        className={cn(
          "flex-1",
          primary ? "font-medium text-base" : "text-sm text-gray-700"
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Responsive Table Wrapper that switches between desktop and mobile views
interface ResponsiveTableProps {
  children: ReactNode;
  mobileBreakpoint?: "sm" | "md" | "lg";
  mobileContent?: ReactNode;
}

export function ResponsiveTable({
  children,
  mobileBreakpoint = "md",
  mobileContent,
}: ResponsiveTableProps) {
  const hiddenClass = {
    sm: "sm:hidden",
    md: "md:hidden",
    lg: "lg:hidden",
  }[mobileBreakpoint];

  const visibleClass = {
    sm: "hidden sm:block",
    md: "hidden md:block",
    lg: "hidden lg:block",
  }[mobileBreakpoint];

  return (
    <>
      {/* Mobile View */}
      <div className={hiddenClass}>
        {mobileContent || children}
      </div>
      
      {/* Desktop View */}
      <div className={visibleClass}>
        {children}
      </div>
    </>
  );
}