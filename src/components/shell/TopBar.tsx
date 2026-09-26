"use client";

import React, { useState } from "react";
import { Menu, Search, Bell } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";

interface TopBarProps {
  onMenuClick: () => void;
  onSearch: (query: string) => void;
  searchValue: string;
  onProfileClick: () => void;
}

export function TopBar({
  onMenuClick,
  onSearch,
  searchValue,
  onProfileClick,
}: TopBarProps) {
  const [showSearch, setShowSearch] = useState(false);

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

      {/* Notifications */}
      <button
        className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-line text-ink-secondary hover:text-ink-primary hover:bg-page-bg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        <span className="absolute top-1 right-1 w-3 h-3 bg-danger-red rounded-full" />
      </button>

      {/* Profile menu */}
      <button
        onClick={onProfileClick}
        className="w-10 h-10 flex items-center justify-center rounded-lg border border-line text-ink-primary hover:bg-page-bg transition-colors"
        aria-label="Profile menu"
      >
        <Search className="w-5 h-5" />
      </button>
    </header>
  );
}
