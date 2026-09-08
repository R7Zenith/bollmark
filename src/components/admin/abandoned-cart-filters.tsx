"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/admin/search-input";
import { FilterBar } from "@/components/admin/filter-bar";
import { abandonedCartStatuses, abandonedCartStatusLabel } from "@/lib/status";

const selectClass =
  "rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function AbandonedCartFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
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
      <SearchInput
        placeholder="E-postaya göre ara..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-64"
      />
      <select
        defaultValue={searchParams.get("durum") ?? ""}
        onChange={(e) => updateParam("durum", e.target.value)}
        className={selectClass}
      >
        <option value="">Tüm durumlar</option>
        {abandonedCartStatuses.map((s) => (
          <option key={s} value={s}>
            {abandonedCartStatusLabel[s]}
          </option>
        ))}
      </select>
    </FilterBar>
  );
}
