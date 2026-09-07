"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { periodOptions, defaultPeriod } from "@/lib/order-period";

export function OrdersPeriodSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("donem") ?? defaultPeriod;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("donem", value);
    params.delete("sayfa");
    if (value !== "ozel") {
      params.delete("baslangic");
      params.delete("bitis");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
    >
      {periodOptions.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
