"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, Truck } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { SHIPPING_THRESHOLD_CENTS } from "@/lib/shipping";
import { CouponField, type CouponResult } from "@/components/coupon-field";
import { useBundleDiscount } from "@/lib/use-bundle-discount";
import { CartNotices } from "@/components/cart-notices";

export default function CartPage() {
  const { lines, removeLine, updateQuantity, totalCents, totalCount, hasBlockingIssues } = useCart();
  const [coupon, setCoupon] = useState<CouponResult>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const discountCents = coupon?.discountCents ?? 0;
  const bundleDiscountCents = useBundleDiscount(lines);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-[48px] font-normal leading-[48px] sm:text-[61px] sm:leading-[61px]">
          Biraz <em className="font-accent text-[58px] italic font-normal sm:text-[73.2px]">boş</em> görünüyor
        </p>
        <p className="mt-3 text-sm text-ink/60">Sepetiniz şu anda boş.</p>
        <Link
          href="/urunler"
          className="mt-8 inline-flex h-[44px] items-center justify-center rounded-[50px] border border-ink px-8 text-[10px] uppercase tracking-[1px] text-ink transition duration-300 hover:bg-ink hover:text-cream"
        >
          Alışverişe Başla
        </Link>
      </div>
    );
  }

  const remainingForFreeShippingCents = Math.max(0, SHIPPING_THRESHOLD_CENTS - totalCents);
  const shippingProgressPercent = Math.min(100, (totalCents / SHIPPING_THRESHOLD_CENTS) * 100);
  const checkoutDisabled = hasBlockingIssues || !termsAccepted;

  return (
    <div className="mx-auto max-w-[1680px] px-6 py-12 lg:px-9">
      <p className="text-center text-[10px] uppercase tracking-[1px] text-ink">
        <Link href="/" className="hover:text-clay">
          Ana Sayfa
        </Link>{" "}
        / Sepetim
      </p>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-[36px] font-normal leading-[36px] tracking-[-1.44px]">
          Sepetim <span className="align-top text-[21px] leading-[21px] tracking-[-0.84px]">{totalCount}</span>
        </h1>
        <Link href="/urunler" className="hidden text-[10px] uppercase tracking-[1px] text-ink hover:text-clay lg:block">
          Alışverişe Devam Et
        </Link>
      </div>

      <div className="mt-6 empty:hidden">
        <CartNotices />
      </div>

      <div className="mt-8 lg:flex lg:items-start lg:gap-16">
        <div className="lg:min-w-0 lg:flex-1">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-b border-line pb-2.5 text-[10px] uppercase tracking-[1px] text-ink lg:grid">
            <span>Ürün</span>
            <span>Fiyat</span>
            <span>Adet</span>
            <span className="text-right">Toplam</span>
          </div>

          <div>
            {lines.map((line) => {
              const quantityControl = (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded border border-line px-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.variantId, line.quantity - 1)}
                      disabled={line.quantity <= 1}
                      aria-label="Adedi azalt"
                      className="flex h-5 w-5 items-center justify-center disabled:opacity-30"
                    >
                      <Minus size={12} strokeWidth={1} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateQuantity(line.variantId, Number(e.target.value))}
                      className="w-5 border-none bg-transparent text-center text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.variantId, line.quantity + 1)}
                      aria-label="Adedi artır"
                      className="flex h-5 w-5 items-center justify-center"
                    >
                      <Plus size={12} strokeWidth={1} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.variantId)}
                    aria-label="Kaldır"
                    className="p-1 text-ink/50 hover:text-clay"
                  >
                    <Trash2 size={18} strokeWidth={1.5} />
                  </button>
                </div>
              );

              return (
                <div key={line.variantId} className="border-b border-line last:border-b-0">
                  {/* Mobil kart */}
                  <div className="flex gap-4 py-6 lg:hidden">
                    <div className="relative h-28 w-24 flex-shrink-0 overflow-hidden bg-line">
                      <Image src={line.image} alt={line.name} fill className="object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24px]">{line.name}</p>
                          <p className="mt-1 text-xs text-ink/75">
                            {line.color} · {line.size}
                          </p>
                        </div>
                        <p className={`shrink-0 text-sm font-medium ${line.compareAtCents ? "text-sale" : ""}`}>
                          {formatPrice(line.priceCents * line.quantity)}
                        </p>
                      </div>
                      <div className="mt-3">{quantityControl}</div>
                    </div>
                  </div>

                  {/* Masaüstü satırı */}
                  <div className="hidden py-6 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr] lg:items-center lg:gap-4">
                    <div className="flex gap-4">
                      <div className="relative h-28 w-24 flex-shrink-0 overflow-hidden bg-line">
                        <Image src={line.image} alt={line.name} fill className="object-cover" />
                      </div>
                      <div className="flex flex-col justify-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.24px]">{line.name}</p>
                        <p className="mt-1 text-xs text-ink/75">
                          {line.color} · {line.size}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm ${line.compareAtCents ? "text-sale" : ""}`}>{formatPrice(line.priceCents)}</p>
                    {quantityControl}
                    <div className="text-right">
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
                </div>
              );
            })}
          </div>

          <div className="mt-8 border-t border-line pt-6 lg:hidden">
            <Link href="/urunler" className="text-[10px] uppercase tracking-[1px] text-ink hover:text-clay">
              Alışverişe Devam Et
            </Link>
          </div>
        </div>

        <div className="mt-10 bg-ink/5 p-8 lg:mt-0 lg:w-[432px] lg:shrink-0">
          <div className="mb-8">
            <p className="flex items-center gap-2 text-xs text-ink">
              <Truck size={14} strokeWidth={1.5} />
              {remainingForFreeShippingCents > 0
                ? `Ücretsiz kargo için ${formatPrice(remainingForFreeShippingCents)} daha harcayın`
                : "Ücretsiz kargo kazandınız"}
            </p>
            <div className="mt-2 h-[2px] w-full bg-transparent">
              <div className="h-full bg-stone transition-all" style={{ width: `${shippingProgressPercent}%` }} />
            </div>
          </div>

          <CouponField onDiscountChange={setCoupon} />

          <div className="mt-6 space-y-2 border-t border-line pt-6">
            <div className="flex items-center justify-between text-base">
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
            <p className="pt-1 text-xs text-ink/60">Vergiler dahildir. Kargo ödeme adımında hesaplanır.</p>
            <div className="flex items-center justify-between border-t border-line pt-4">
              <span className="text-lg">Toplam</span>
              <span className="text-lg font-medium">{formatPrice(totalCents - bundleDiscountCents - discountCents)}</span>
            </div>
          </div>

          <label className="mt-6 flex items-start gap-2 text-xs text-ink/70">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <Link
                href="/sayfa/mesafeli-satis-sozlesmesi"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-clay"
              >
                Mesafeli Satış Sözleşmesi
              </Link>
              &apos;ni okudum, kabul ediyorum.
            </span>
          </label>

          {checkoutDisabled ? (
            <span
              aria-disabled="true"
              className="mt-6 flex h-11 w-full cursor-not-allowed items-center justify-center rounded-full bg-ink text-[10px] uppercase tracking-[1px] text-cream opacity-50"
            >
              Ödemeye Geç
            </span>
          ) : (
            <Link
              href="/odeme"
              className="mt-6 flex h-11 w-full items-center justify-center rounded-full bg-ink text-[10px] uppercase tracking-[1px] text-cream transition duration-300 hover:bg-clay"
            >
              Ödemeye Geç
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
