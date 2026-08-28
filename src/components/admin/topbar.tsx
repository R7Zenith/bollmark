"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Search, ChevronDown, Package, ShoppingBag } from "lucide-react";
import { SignOutButton } from "@/components/admin/sign-out-button";

interface SearchResults {
  products: { id: string; name: string }[];
  orders: { id: string; orderNumber: string; customerName: string }[];
}

export function Topbar() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: SearchResults) => {
          setResults(data);
          setOpen(true);
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const hasResults = results && (results.products.length > 0 || results.orders.length > 0);

  return (
    <header className="flex h-16 items-center justify-between border-b border-admin-border bg-admin-surface px-6">
      <div ref={containerRef} className="relative w-full max-w-sm">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-admin-text-muted"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Urun veya siparis ara..."
          className="w-full rounded-md border border-admin-border bg-admin-bg py-2 pl-9 pr-3 text-sm text-admin-text placeholder:text-admin-text-muted focus:border-admin-accent focus:bg-admin-surface focus:outline-none focus:ring-1 focus:ring-admin-accent"
        />
        {open && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-96 overflow-y-auto rounded-md border border-admin-border bg-admin-surface shadow-lg">
            {!results && <p className="px-4 py-3 text-sm text-admin-text-muted">Araniyor...</p>}
            {results && !hasResults && (
              <p className="px-4 py-3 text-sm text-admin-text-muted">Sonuc bulunamadi.</p>
            )}
            {results && results.products.length > 0 && (
              <div>
                <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-admin-text-muted">
                  Urunler
                </p>
                {results.products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/urunler/${p.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-admin-text hover:bg-admin-bg"
                  >
                    <ShoppingBag size={14} className="text-admin-text-muted" />
                    {p.name}
                  </Link>
                ))}
              </div>
            )}
            {results && results.orders.length > 0 && (
              <div>
                <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-admin-text-muted">
                  Siparisler
                </p>
                {results.orders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/admin/siparisler/${o.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-admin-text hover:bg-admin-bg"
                  >
                    <Package size={14} className="text-admin-text-muted" />
                    <span className="font-mono">{o.orderNumber}</span>
                    <span className="text-admin-text-muted">{o.customerName}</span>
                  </Link>
                ))}
              </div>
            )}
            <div className="h-2" />
          </div>
        )}
      </div>

      <div ref={userMenuRef} className="relative">
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-admin-text hover:bg-admin-bg"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-admin-accent">
            {session?.user?.email?.[0]?.toUpperCase() ?? "A"}
          </span>
          <ChevronDown size={14} className="text-admin-text-muted" />
        </button>
        {userMenuOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-md border border-admin-border bg-admin-surface shadow-lg">
            <p className="truncate px-4 py-3 text-xs text-admin-text-muted">{session?.user?.email}</p>
            <div className="border-t border-admin-border px-4 py-3">
              <SignOutButton />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
