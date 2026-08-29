"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/admin/search-input";
import { FilterBar } from "@/components/admin/filter-bar";
import { orderStatuses, orderStatusLabel, shipmentStatuses, shipmentStatusLabel } from "@/lib/status";

const selectClass =
  "rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const dateInputClass =
  "rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function OrdersFilters() {
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
        placeholder="Siparis no, musteri adi veya e-postaya gore ara..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-64"
      />
      <select
        defaultValue={searchParams.get("durum") ?? ""}
        onChange={(e) => updateParam("durum", e.target.value)}
        className={selectClass}
      >
        <option value="">Tum odeme durumlari</option>
        {orderStatuses.map((s) => (
          <option key={s} value={s}>
            {orderStatusLabel[s]}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("kargoDurum") ?? ""}
        onChange={(e) => updateParam("kargoDurum", e.target.value)}
        className={selectClass}
      >
        <option value="">Tum kargo durumlari</option>
        {shipmentStatuses.map((s) => (
          <option key={s} value={s}>
            {shipmentStatusLabel[s]}
          </option>
        ))}
        <option value="YOK">Kargo Yok</option>
      </select>
      <div className="flex items-center gap-2">
        <input
          type="date"
          defaultValue={searchParams.get("baslangic") ?? ""}
          onChange={(e) => updateParam("baslangic", e.target.value)}
          className={dateInputClass}
        />
        <span className="text-sm text-admin-text-muted">-</span>
        <input
          type="date"
          defaultValue={searchParams.get("bitis") ?? ""}
          onChange={(e) => updateParam("bitis", e.target.value)}
          className={dateInputClass}
        />
      </div>
    </FilterBar>
  );
}
