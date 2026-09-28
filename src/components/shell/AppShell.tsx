"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  role: "admin" | "staff";
  children: React.ReactNode;
  userName: string;
  bizName: string;
  roleLabel: string;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

export function AppShell({ role, children, userName, bizName, roleLabel }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = initialsOf(userName);

  return (
    <div className="flex h-screen bg-page-bg overflow-hidden">
      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={mobileNavOpen}
        isCollapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        role={role}
        userInitials={initials}
        userName={userName}
        bizName={bizName}
        roleLabel={roleLabel}
        onSignOut={handleSignOut}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top bar */}
        <TopBar
          role={role}
          userName={userName}
          bizName={bizName}
          userInitials={initials}
          onMenuClick={() => setMobileNavOpen(true)}
          onSearch={setSearchQuery}
          searchValue={searchQuery}
          onSignOut={handleSignOut}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
