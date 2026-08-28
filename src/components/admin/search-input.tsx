"use client";

import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

export function SearchInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-admin-text-muted"
      />
      <input
        type="text"
        className="w-full rounded-md border border-admin-border bg-admin-surface py-2 pl-9 pr-3 text-sm text-admin-text placeholder:text-admin-text-muted focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        {...props}
      />
    </div>
  );
}
