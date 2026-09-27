"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  User,
  Plus,
  ChevronDown,
  UserPlus,
  MessageSquare,
  FileText,
  Briefcase,
  DollarSign,
  Settings,
  CreditCard,
  Users,
  LogOut,
} from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { useJobModal } from "@/components/JobModalContext";
import type { AppRole } from "@/lib/supabase/types";

interface TopBarProps {
  role: AppRole;
  userName: string;
  bizName: string;
  userInitials: string;
  onMenuClick: () => void;
  onSearch: (query: string) => void;
  searchValue: string;
  onSignOut: () => void;
}

const ADMIN_CREATE_ITEMS = [
  { key: "client", label: "New client", icon: UserPlus, href: "/clients/new" },
  { key: "request", label: "New request", icon: MessageSquare, href: "/requests" },
  { key: "quote", label: "New quote", icon: FileText, href: "/quotes/new" },
  { key: "job", label: "New job", icon: Briefcase },
  { key: "invoice", label: "New invoice", icon: DollarSign, href: "/invoices/new" },
] as const;

const PROFILE_ITEMS = [
  { key: "settings", label: "Account settings", icon: Settings, href: "/settings" },
  { key: "subscription", label: "Subscription", icon: CreditCard, href: "/subscription" },
  { key: "staff", label: "Crews & Staff", icon: Users, href: "/staff" },
] as const;

export function TopBar({
  role,
  userName,
  bizName,
  userInitials,
  onMenuClick,
  onSearch,
  searchValue,
  onSignOut,
}: TopBarProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const router = useRouter();
  const { openNewJob } = useJobModal();

  const runCreateItem = (item: (typeof ADMIN_CREATE_ITEMS)[number]) => {
    setShowCreate(false);
    if (item.key === "job") {
      openNewJob();
    } else {
      router.push(item.href);
    }
  };

  return (
    <header className="h-16 flex items-center gap-3 px-4 md:px-6 bg-card-bg border-b border-line sticky top-0 z-30 flex-wrap">
      {/* Menu toggle (mobile only) */}
      <button
        onClick={onMenuClick}
        className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg border border-line text-ink-primary hover:bg-page-bg transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Global search */}
      <div className="flex-1 max-w-96 min-w-0">
        <SearchInput
          value={searchValue}
          onChange={onSearch}
          onFocus={() => setShowSearch(true)}
          onBlur={() => setShowSearch(false)}
          placeholder="Search clients, jobs, quotes, invoices"
          showResults={showSearch}
          results={[]}
        />
      </div>

      <div className="flex-1" />

      {/* Create */}
      {role === "admin" && (
        <div className="relative">
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="h-10 px-4 rounded-lg bg-brand text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-brand-hover transition-colors"
            aria-haspopup="menu"
            aria-expanded={showCreate}
          >
            <Plus className="w-4 h-4" />
            Create
            <ChevronDown className="w-4 h-4" />
          </button>
          {showCreate && (
            <>
              <button
                type="button"
                aria-label="Close create menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowCreate(false)}
              />
              <div className="absolute right-0 top-12 z-50 w-56 bg-card-bg border border-line rounded-lg shadow-lg py-1.5">
                {ADMIN_CREATE_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => runCreateItem(item)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-ink-primary hover:bg-page-bg transition-colors"
                  >
                    <item.icon className="w-4 h-4 text-brand" />
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Notifications */}
      <button
        className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-line text-ink-secondary hover:text-ink-primary hover:bg-page-bg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
      </button>

      {/* Profile menu */}
      <div className="relative">
        <button
          onClick={() => setShowProfile((v) => !v)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-ok-bg text-ok-fg text-sm font-bold hover:opacity-90 transition-opacity"
          aria-label="Profile menu"
          aria-haspopup="menu"
          aria-expanded={showProfile}
        >
          {userInitials || <User className="w-5 h-5" />}
        </button>
        {showProfile && (
          <>
            <button
              type="button"
              aria-label="Close profile menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setShowProfile(false)}
            />
            <div className="absolute right-0 top-12 z-50 w-64 bg-card-bg border border-line rounded-lg shadow-lg py-1.5">
              <div className="px-3.5 py-2.5 border-b border-line-soft">
                <div className="text-sm font-semibold text-ink-primary">{userName}</div>
                <div className="text-xs text-ink-muted mt-0.5">{bizName}</div>
              </div>
              {PROFILE_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setShowProfile(false);
                    router.push(item.href);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-ink-primary hover:bg-page-bg transition-colors"
                >
                  <item.icon className="w-4 h-4 text-ink-muted" />
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setShowProfile(false);
                  onSignOut();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-ink-primary hover:bg-page-bg transition-colors border-t border-line-soft"
              >
                <LogOut className="w-4 h-4 text-ink-muted" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
