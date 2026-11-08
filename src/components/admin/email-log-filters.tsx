"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/admin/search-input";
import { FilterBar } from "@/components/admin/filter-bar";
import { EMAIL_KINDS, emailKindLabel } from "@/lib/email/log";

const selectClass =
  "rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

// Giden Mailler: aliciya gore arama, tur ve gonderim durumu (abandoned-cart-filters.tsx ile ayni desen).
export function EmailLogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q !== (searchParams.get("q") ?? "")) updateParam("q", q);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <FilterBar>
      <SearchInput placeholder="Alıcı e-postasına göre ara..." value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      <select defaultValue={searchParams.get("tur") ?? ""} onChange={(e) => updateParam("tur", e.target.value)} className={selectClass}>
        <option value="">Tüm mail türleri</option>
        {EMAIL_KINDS.map((k) => (
          <option key={k} value={k}>
            {emailKindLabel[k]}
          </option>
        ))}
      </select>
      <select defaultValue={searchParams.get("durum") ?? ""} onChange={(e) => updateParam("durum", e.target.value)} className={selectClass}>
        <option value="">Tüm durumlar</option>
        <option value="gonderildi">Gönderildi</option>
        <option value="hata">Gönderilemedi</option>
      </select>
    </FilterBar>
  );
}
