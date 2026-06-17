import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import UserMenu from "@/app/_components/layout/user-menu";
import ThemeToggle from "@/app/_components/layout/theme-toggle";
import NarvalLogo from "@/app/_components/layout/narval-logo";

interface PageHeaderProps {
  breadcrumbs: Array<{
    label: string;
    href?: string;
  }>;
  actions?: React.ReactNode;
  showLogo?: boolean;
}

/**
 * Reusable page header component with breadcrumb navigation and user menu.
 * Provides consistent styling across all pages.
 */
export default function PageHeader({
  breadcrumbs,
  actions,
  showLogo = true,
}: PageHeaderProps) {
  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-6">
      <nav className="flex items-center gap-3">
        {showLogo && (
          <>
            <Link
              href="/"
              aria-label="Home"
              className="text-text transition-opacity hover:opacity-80"
            >
              <NarvalLogo className="h-9 w-9 rounded-sm" />
            </Link>
            <div className="h-4 w-px bg-border" />
          </>
        )}

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && (
                <ChevronLeft
                  size={14}
                  className="text-text-subtle rotate-180"
                />
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-text-muted transition hover:bg-bg-subtle hover:text-text"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="rounded-md px-3 py-1.5 text-sm font-medium text-text bg-bg-subtle">
                  {crumb.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </nav>

      <div className="flex items-center gap-3">
        {actions}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
