"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-admin-text hover:bg-admin-bg focus-visible:bg-admin-bg focus-visible:outline-none"
    >
      <LogOut size={16} className="text-admin-text-muted" />
      Çıkış
    </button>
  );
}
