"use client";

import { useEffect, useState } from "react";
import type { CartLine } from "@/lib/cart";

// sepet/page.tsx ve odeme/page.tsx'in ikisinde de kullanilan "Bundle Indirimi"
// onizlemesi - sepet icerigi degistikce /api/bundle-onizleme'yi sorgular.
export function useBundleDiscount(lines: CartLine[]): number {
  const [discountCents, setDiscountCents] = useState(0);

  useEffect(() => {
    if (lines.length === 0) {
      setDiscountCents(0);
      return;
    }
    let cancelled = false;
    fetch("/api/bundle-onizleme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: lines.map((l) => ({ productId: l.productId, priceCents: l.priceCents, quantity: l.quantity }))
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setDiscountCents(data.discountCents ?? 0);
      })
      .catch(() => {
        if (!cancelled) setDiscountCents(0);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines.map((l) => [l.productId, l.quantity]))]);

  return discountCents;
}
