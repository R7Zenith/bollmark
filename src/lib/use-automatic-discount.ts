"use client";

import { useEffect, useState } from "react";
import { useCart, type CartLine } from "@/lib/cart";

// cart-drawer.tsx ve sepet/page.tsx'in (CouponField uzerinden) kullandigi
// otomatik kampanya indirimi onizlemesi - sepet icerigi degistikce kod
// girilmeden /api/sepet/fiyat'i sorgular (bkz. coupon-field.tsx'teki ayni
// gerekce: kod olmasa da sepete uyan aktif bir otomatik kampanya varsa
// yakalanmasi icin). Baglayici degildir, nihai tutar siparis olusturulurken
// sunucuda priceCart ile tekrar hesaplanir.
export function useAutomaticDiscount(lines: CartLine[]): { discountCents: number; appliedName: string | null } {
  const { kalpSelection } = useCart();
  const [result, setResult] = useState({ discountCents: 0, appliedName: null as string | null });

  useEffect(() => {
    if (lines.length === 0) {
      setResult({ discountCents: 0, appliedName: null });
      return;
    }
    let cancelled = false;
    fetch("/api/sepet/fiyat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "",
        lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
        kalpSelection
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const kalpCents = data.kalpDiscountCents ?? 0;
        setResult({
          discountCents: (data.discountCents ?? 0) + kalpCents,
          appliedName: kalpCents > 0 ? "Kalp Topla" : (data.appliedName ?? null)
        });
      })
      .catch(() => {
        if (!cancelled) setResult({ discountCents: 0, appliedName: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([lines.map((l) => [l.productId, l.variantId, l.priceCents, l.quantity]), kalpSelection])]);

  return result;
}
