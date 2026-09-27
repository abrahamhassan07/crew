import Link from "next/link";
import React from "react";

interface PageHeaderProps {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  maxWidth?: "wide" | "5xl";
  sticky?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Standard page header used across every route: a bordered bar with a
 * max-width inner wrapper, title/subtitle on the left and actions on the
 * right. `maxWidth` should match the page's content wrapper below it —
 * "7xl" for list/index pages, "5xl" for detail/editor/form pages.
 */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
  back,
  maxWidth = "wide",
  sticky = false,
  className = "",
  children,
}: PageHeaderProps) {
  return (
    <div
      className={`px-6 py-8 border-b border-line bg-card-bg ${sticky ? "sticky top-0 z-10" : ""} ${className}`}
    >
      <div className={`${maxWidth === "5xl" ? "max-w-5xl" : "max-w-[1600px]"} mx-auto`}>
        {back && (
          <Link href={back.href} className="text-sm font-semibold text-brand mb-3 inline-block hover:text-brand-hover">
            ← {back.label}
          </Link>
        )}
        <div className={`flex flex-wrap items-end justify-between gap-4 ${children ? "mb-6" : ""}`}>
          <div>
            {eyebrow && <p className="text-xs font-semibold text-ink-muted mb-2">{eyebrow}</p>}
            <h1 className="text-3xl font-bold text-ink-primary">{title}</h1>
            {subtitle && <p className="text-sm text-ink-secondary mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
