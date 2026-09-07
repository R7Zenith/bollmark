"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { orderTabs, resolveTab, type OrderTabKey } from "@/lib/order-query";

export function OrdersTabs({ counts }: { counts: Record<OrderTabKey, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = resolveTab(searchParams.get("sekme") ?? undefined);

  function handleClick(value: OrderTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "tumu") params.delete("sekme");
    else params.set("sekme", value);
    params.delete("sayfa");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex items-center gap-1 border-b border-admin-border">
      {orderTabs.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => handleClick(tab.value)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-admin-accent text-admin-text"
                : "border-transparent text-admin-text-muted hover:text-admin-text"
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                isActive ? "bg-admin-accent/10 text-admin-accent" : "bg-admin-bg text-admin-text-muted"
              }`}
            >
              {counts[tab.value] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
