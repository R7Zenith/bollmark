"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
      className="text-sm text-admin-text-muted hover:text-admin-accent"
    >
      Cikis Yap
    </button>
  );
}
