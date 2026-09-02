"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { LOYALTY_REDEEM_RATE_CENTS } from "@/lib/loyalty-constants";
import { formatPrice } from "@/lib/format";

export type LoyaltyResult = { pointsRedeemed: number; discountCents: number } | null;

// CouponField ile ayni desen - burada gosterilen tutar ONIZLEME amaclidir,
// nihai/gecerli hesaplama siparis olusturulurken orders/route.ts icinde
// sunucuda (resolveLoyaltyRedemption ile) tekrar yapilir.
export function LoyaltyField({
  subtotalCents,
  onRedeemChange
}: {
  subtotalCents: number;
  onRedeemChange: (result: LoyaltyResult) => void;
}) {
  const { data: session, status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/hesap/puan-bakiyesi")
      .then((res) => res.json())
      .then((data) => setBalance(data.loyaltyPoints ?? 0))
      .catch(() => setBalance(0));
  }, [status]);

  if (status !== "authenticated" || !balance) return null;

  const maxAffordablePoints = Math.floor(subtotalCents / LOYALTY_REDEEM_RATE_CENTS);
  const maxPoints = Math.min(balance, maxAffordablePoints);

  function applyPoints(value: string) {
    setInput(value);
    const requested = Math.max(0, Math.floor(Number(value) || 0));
    const points = Math.min(requested, maxPoints);
    if (points <= 0) {
      onRedeemChange(null);
      return;
    }
    onRedeemChange({ pointsRedeemed: points, discountCents: points * LOYALTY_REDEEM_RATE_CENTS });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink/60">
        {balance} puanınız var ({session?.user?.name}). 1 puan = {formatPrice(LOYALTY_REDEEM_RATE_CENTS)} indirim.
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          max={maxPoints}
          value={input}
          onChange={(e) => applyPoints(e.target.value)}
          placeholder="Kullanılacak puan"
          className="w-full border border-line px-3 py-2 text-sm focus:border-ink focus:outline-none"
        />
        {Number(input) > 0 && (
          <button
            type="button"
            onClick={() => applyPoints("0")}
            className="shrink-0 border border-line px-4 py-2 text-sm uppercase tracking-wide hover:bg-ink hover:text-paper"
          >
            Temizle
          </button>
        )}
      </div>
    </div>
  );
}
