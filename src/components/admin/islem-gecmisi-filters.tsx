"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/admin/filter-bar";
import { auditActions, auditActionLabel } from "@/lib/audit-actions";

const inputClass =
  "rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function IslemGecmisiFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <FilterBar>
      <select
        defaultValue={searchParams.get("aksiyon") ?? ""}
        onChange={(e) => updateParam("aksiyon", e.target.value)}
        className={inputClass}
      >
        <option value="">Tüm aksiyonlar</option>
        {auditActions.map((a) => (
          <option key={a} value={a}>
            {auditActionLabel[a]}
          </option>
        ))}
      </select>
      <input
        type="date"
        defaultValue={searchParams.get("baslangic") ?? ""}
        onChange={(e) => updateParam("baslangic", e.target.value)}
        className={inputClass}
      />
      <input
        type="date"
        defaultValue={searchParams.get("bitis") ?? ""}
        onChange={(e) => updateParam("bitis", e.target.value)}
        className={inputClass}
      />
    </FilterBar>
  );
}
