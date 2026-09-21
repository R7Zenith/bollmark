"use client";

import { useState } from "react";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";

export function AdminShell({
  role,
  unreadMessages,
  attentionOrders,
  children
}: {
  role?: string;
  unreadMessages?: number;
  attentionOrders?: number;
  children: React.ReactNode;
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-admin-bg">
      <Sidebar role={role} unreadMessages={unreadMessages} attentionOrders={attentionOrders} isMobileOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setIsMobileNavOpen((v) => !v)} />
        <main className="flex-1 px-4 py-4 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
