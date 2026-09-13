"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useJobModal } from "@/components/JobModalContext";
import type { AppRole } from "@/lib/supabase/types";

const NAV_ITEMS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/jobs", label: "Jobs", adminOnly: true },
  { href: "/staff", label: "Staff", adminOnly: true },
  { href: "/clients", label: "Clients", adminOnly: true },
  { href: "/reports", label: "Reports", adminOnly: true },
];

export function AppShell({
  role,
  viewerLabel,
  children,
}: {
  role: AppRole;
  viewerLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openNewJob } = useJobModal();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");

  const items = NAV_ITEMS.filter((item) => role === "admin" || !item.adminOnly);
  const current = items.find((item) => pathname.startsWith(item.href));
  const pageTitle = current?.label ?? "Dashboard";

  return (
    <div className="flex min-h-screen">
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 bg-black/45 z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-[280px] shrink-0 bg-surface-alt border-r border-border flex flex-col gap-0.5 px-5 py-6 transition-transform md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 pb-5 mb-4 border-b border-border">
          <div className="w-9 h-9 rounded-[10px] bg-accent text-white flex items-center justify-center font-serif font-bold text-[15px] shrink-0">
            CG
          </div>
          <div className="font-serif font-semibold text-lg leading-tight">Crew &amp; Grounds</div>
        </div>

        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNavOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-[15px] mb-0.5 ${
                active ? "font-semibold bg-accent-tint text-accent-strong" : "font-medium text-ink-faint hover:bg-white/60"
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        <div className="flex-1" />
        <div className="text-xs text-ink-faintest px-1 py-2">{viewerLabel}</div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <div className="flex items-center gap-3.5 px-5 py-3.5 border-b border-border bg-header sticky top-0 z-20 flex-wrap">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="w-9 h-9 rounded-lg border border-border bg-white flex flex-col items-center justify-center gap-1 md:hidden shrink-0"
            aria-label="Open navigation"
          >
            <span className="w-4 h-0.5 bg-ink" />
            <span className="w-4 h-0.5 bg-ink" />
            <span className="w-4 h-0.5 bg-ink" />
          </button>
          <div className="font-serif text-xl font-semibold shrink-0">{pageTitle}</div>

          {role === "admin" && (
            <>
              <input
                type="text"
                placeholder="Search clients or addresses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    router.push(`/jobs?search=${encodeURIComponent(search.trim())}`);
                  }
                }}
                className="flex-1 min-w-[160px] max-w-[360px] px-3.5 py-2.5 rounded-lg border border-border text-sm bg-bg"
              />
              <button
                onClick={() => openNewJob()}
                className="px-4 py-2.5 rounded-lg bg-accent text-white font-semibold text-sm whitespace-nowrap shrink-0"
              >
                + New Job
              </button>
            </>
          )}
        </div>

        <div className="flex-1 p-4 md:p-7 md:px-8 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
