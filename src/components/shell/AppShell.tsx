"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  role: "admin" | "staff";
  children: React.ReactNode;
  viewerLabel: string;
}

export function AppShell({ role, children, viewerLabel }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Extract initials and name from viewerLabel
  const isOwner = viewerLabel.includes("Owner");
  const initials = isOwner ? "CG" : viewerLabel.split(" ")[0].charAt(0);
  const userName = isOwner ? "Owner" : viewerLabel.split(" ")[0];
  const bizName = isOwner ? "Crew & Grounds" : "Staff";

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
        onSignOut={handleSignOut}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top bar */}
        <TopBar
          onMenuClick={() => setMobileNavOpen(true)}
          onSearch={setSearchQuery}
          searchValue={searchQuery}
          onProfileClick={() => {
            // TODO: Open profile menu
          }}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
