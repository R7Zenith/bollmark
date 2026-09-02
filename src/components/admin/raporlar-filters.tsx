"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const dayOptions = [
  { value: "7", label: "Son 7 gün" },
  { value: "30", label: "Son 30 gün" },
  { value: "90", label: "Son 90 gün" }
];

const selectClass =
  "rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function RaporlarFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("gun") ?? "30";

  function updateGun(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "30") params.delete("gun");
    else params.set("gun", value);
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <select value={current} onChange={(e) => updateGun(e.target.value)} className={selectClass}>
      {dayOptions.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
