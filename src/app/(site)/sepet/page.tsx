"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { CouponField, type CouponResult } from "@/components/coupon-field";
import { useBundleDiscount } from "@/lib/use-bundle-discount";
import { CartNotices } from "@/components/cart-notices";

export default function CartPage() {
  const { lines, removeLine, updateQuantity, totalCents, hasBlockingIssues } = useCart();
  const [coupon, setCoupon] = useState<CouponResult>(null);
  const discountCents = coupon?.discountCents ?? 0;
  const bundleDiscountCents = useBundleDiscount(lines);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl">Sepetiniz Boş</h1>
        <p className="mt-3 text-ink/60">Alışverişe başlamak için ürünlerimize göz atın.</p>
        <Link
          href="/urunler"
          className="mt-8 inline-block border border-ink px-8 py-3 text-sm uppercase tracking-wide hover:bg-ink hover:text-cream"
        >
          Ürünleri Keşfet
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-display text-3xl">Sepetim</h1>

      <div className="mt-6 empty:hidden">
        <CartNotices />
      </div>

      <div className="mt-10 divide-y divide-line">
        {lines.map((line) => (
          <div key={line.variantId} className="flex items-center gap-6 py-6">
            <div className="relative h-28 w-24 flex-shrink-0 overflow-hidden bg-line">
              <Image src={line.image} alt={line.name} fill className="object-cover" />
            </div>
            <div className="flex-1">
              <p className="text-sm uppercase tracking-wide">{line.name}</p>
              <p className="mt-1 text-xs text-ink/60">
                {line.color} · {line.size}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateQuantity(line.variantId, Number(e.target.value))}
                  className="w-16 border border-line px-2 py-1 text-sm"
                />
                <button
                  onClick={() => removeLine(line.variantId)}
                  className="text-xs uppercase text-ink/50 hover:text-clay"
                >
                  Kaldır
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <p className={`text-sm font-medium ${line.compareAtCents ? "text-sale" : ""}`}>
                {formatPrice(line.priceCents * line.quantity)}
              </p>
              {line.compareAtCents && (
                <p className="text-xs text-ink/40 line-through">
                  {formatPrice(line.compareAtCents * line.quantity)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 border-t border-line pt-6">
        <CouponField onDiscountChange={setCoupon} />
      </div>

      <div className="mt-6 space-y-2 border-t border-line pt-6">
        <div className="flex items-center justify-between text-sm text-ink/70">
          <span>Ara Toplam</span>
          <span>{formatPrice(totalCents)}</span>
        </div>
        {bundleDiscountCents > 0 && (
          <div className="flex items-center justify-between text-sm text-clay">
            <span>Bundle İndirimi</span>
            <span>-{formatPrice(bundleDiscountCents)}</span>
          </div>
        )}
        {discountCents > 0 && (
          <div className="flex items-center justify-between text-sm text-clay">
            <span>{coupon?.appliedName ? `İndirim (${coupon.appliedName})` : "İndirim"}</span>
            <span>-{formatPrice(discountCents)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <span className="text-lg">Toplam</span>
          <span className="text-lg font-medium">{formatPrice(totalCents - bundleDiscountCents - discountCents)}</span>
        </div>
      </div>

      {hasBlockingIssues ? (
        <span
          aria-disabled="true"
          className="mt-8 block w-full cursor-not-allowed bg-ink py-4 text-center text-sm uppercase tracking-widest2 text-cream opacity-50"
        >
          Ödemeye Geç
        </span>
      ) : (
        <Link
          href="/odeme"
          className="mt-8 block w-full bg-ink py-4 text-center text-sm uppercase tracking-widest2 text-cream hover:bg-clay"
        >
          Ödemeye Geç
        </Link>
      )}
    </div>
  );
}
