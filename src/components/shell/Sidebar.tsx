"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Briefcase,
  MessageSquare,
  FileText,
  DollarSign,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Sprout,
  Wrench,
  Megaphone,
  CreditCard,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  count?: number;
}

const NAV_GROUPS = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/schedule", label: "Schedule", icon: Calendar },
      { href: "/clients", label: "Clients", icon: Users, adminOnly: true },
      { href: "/requests", label: "Requests", icon: MessageSquare, adminOnly: true },
      { href: "/quotes", label: "Quotes", icon: FileText, adminOnly: true },
      { href: "/jobs", label: "Jobs", icon: Briefcase, adminOnly: true },
      { href: "/invoices", label: "Invoices", icon: DollarSign, adminOnly: true },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/staff", label: "Crews & Staff", icon: Users, adminOnly: true },
      { href: "/services", label: "Services", icon: Briefcase, adminOnly: true },
      { href: "/equipment", label: "Equipment", icon: Wrench, adminOnly: true },
      { href: "/marketing", label: "Marketing", icon: Megaphone, adminOnly: true },
      { href: "/reports", label: "Reports", icon: FileText, adminOnly: true },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
      { href: "/subscription", label: "Subscription", icon: CreditCard, adminOnly: true },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onCollapse: () => void;
  role: "admin" | "staff";
  userInitials: string;
  userName: string;
  bizName: string;
  onSignOut: () => void;
}

export function Sidebar({
  isOpen,
  isCollapsed,
  onCollapse,
  role,
  userInitials,
  userName,
  bizName,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-50 w-72 shrink-0 bg-card-bg border-r border-line flex flex-col transition-transform duration-200 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } ${isCollapsed ? "md:w-20" : ""}`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 py-3.5 border-b border-line-soft flex-shrink-0 ${isCollapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-md bg-forest flex items-center justify-center flex-shrink-0">
          <Sprout className="w-5 h-5 text-white" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm text-ink-primary leading-tight truncate">Crew & Grounds</div>
            <div className="text-xs text-ink-muted leading-tight truncate">{bizName}</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-3.5">
            {!isCollapsed && (
              <div className="text-xs font-bold text-ink-muted uppercase tracking-wider px-2.5 py-1.5 mb-2">
                {group.title}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items
                .filter((item) => role === "admin" || !item.adminOnly)
                .map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-ok-bg text-brand font-semibold"
                          : "text-[#0d0d0d] hover:bg-page-bg"
                      }`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <span className="w-5 h-5 flex-shrink-0">
                        <item.icon className="w-full h-full" />
                      </span>
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {"count" in item && item.count !== undefined && (
                            <span className="bg-brand text-white text-xs font-bold px-2 py-1 rounded-full">
                              {(item as NavItem & { count: number }).count}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: User info and actions */}
      <div className={`border-t border-line-soft p-3 flex-shrink-0 ${isCollapsed ? "flex flex-col items-center gap-2" : ""}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-ok-bg text-ok-fg font-bold text-xs flex items-center justify-center flex-shrink-0">
            {userInitials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink-primary truncate">{userName}</div>
              <div className="text-xs text-ink-muted truncate">{bizName}</div>
            </div>
          )}
        </div>

        <div className={`flex gap-2 ${isCollapsed ? "flex-col w-full" : ""}`}>
          <button
            onClick={onSignOut}
            className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-line-soft text-ink-secondary hover:bg-page-bg transition-colors flex-1 ${
              isCollapsed ? "px-2" : ""
            }`}
            title={isCollapsed ? "Sign out" : undefined}
          >
            <LogOut className="w-4 h-4" />
            {!isCollapsed && "Sign out"}
          </button>
        </div>

        {/* Collapse button (desktop only) */}
        {!isCollapsed && (
          <button
            onClick={onCollapse}
            className="hidden md:flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium text-ink-muted hover:bg-page-bg rounded-lg transition-colors mt-2"
          >
            <ChevronsLeft className="w-4 h-4" />
            Collapse
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={onCollapse}
            className="hidden md:flex items-center justify-center w-full px-2 py-2 text-ink-muted hover:bg-page-bg rounded-lg transition-colors"
            title="Expand"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
