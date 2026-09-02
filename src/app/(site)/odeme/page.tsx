"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { CouponField, type CouponResult } from "@/components/coupon-field";
import { LoyaltyField, type LoyaltyResult } from "@/components/loyalty-field";
import { useBundleDiscount } from "@/lib/use-bundle-discount";
import { calculateShippingCents } from "@/lib/shipping";

export default function CheckoutPage() {
  const { lines, totalCents, couponCode, clear } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<CouponResult>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyResult>(null);

  // Sunucudaki (orders/route.ts) ile ayni sirali hesaplama: once bundle,
  // sonra kupon, sonra puan - boylece onizleme nihai tutarla tutarli kalir.
  const bundleDiscountCents = useBundleDiscount(lines);
  const discountCents = coupon?.discountCents ?? 0;
  const loyaltyDiscountCents = loyalty?.discountCents ?? 0;
  const totalDiscountCents = bundleDiscountCents + discountCents + loyaltyDiscountCents;
  const shippingCents = calculateShippingCents(totalCents - totalDiscountCents, coupon?.freeShipping ?? false);
  const grandTotalCents = totalCents - totalDiscountCents + shippingCents;

  // Kullanici e-posta alanina yazip baska bir alana gectiginde (odeme
  // tamamlanmadan once) sepeti arka planda kaydeder - terk edilmis sepet
  // hatirlatmasinin yakalama adimi. Fire-and-forget: kullanici akisini
  // hicbir sekilde yavaslatmaz/engellemez, hata sessizce yutulur.
  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const email = e.target.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || lines.length === 0) return;
    fetch("/api/sepet-kaydet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        totalCents,
        lines: lines.map((l) => ({
          name: l.name,
          size: l.size,
          color: l.color,
          quantity: l.quantity,
          priceCents: l.priceCents
        }))
      })
    }).catch(() => {
      // sepet kaydedilemedi, sessizce yoksay
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      customerName: String(form.get("customerName") || ""),
      customerEmail: String(form.get("customerEmail") || ""),
      customerPhone: String(form.get("customerPhone") || ""),
      shippingAddress: String(form.get("shippingAddress") || ""),
      city: String(form.get("city") || ""),
      district: String(form.get("district") || ""),
      postalCode: String(form.get("postalCode") || ""),
      note: String(form.get("note") || ""),
      couponCode: couponCode || undefined,
      pointsToRedeem: loyalty?.pointsRedeemed || undefined,
      termsAccepted: form.get("termsAccepted") === "on",
      lines: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity
      }))
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Sipariş oluşturulamadı, lütfen tekrar deneyin.");
        return;
      }
      clear();
      router.push(`/odeme/tesekkurler?siparis=${data.orderNumber}`);
    } catch {
      setError("Bir sorun oluştu, lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-ink/60">Sepetiniz boş olduğu için ödeme adımına geçemezsiniz.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.4fr,1fr]">
      <form onSubmit={handleSubmit} className="space-y-6">
        <h1 className="font-display text-3xl">Teslimat Bilgileri</h1>

        <div className="grid gap-4 md:grid-cols-2">
          <input name="customerName" required placeholder="Ad Soyad" className="border border-line px-4 py-3" />
          <input
            name="customerEmail"
            required
            type="email"
            placeholder="E-posta"
            onBlur={handleEmailBlur}
            className="border border-line px-4 py-3"
          />
        </div>
        <p className="text-xs text-ink/50">
          Ödemenizi tamamlamazsanız sepetinizi hatırlatmak için size e-posta gönderebiliriz.
        </p>
        <input name="customerPhone" required placeholder="Telefon" className="w-full border border-line px-4 py-3" />
        <input name="shippingAddress" required placeholder="Adres" className="w-full border border-line px-4 py-3" />
        <div className="grid gap-4 md:grid-cols-3">
          <input name="city" required placeholder="İl" className="border border-line px-4 py-3" />
          <input name="district" required placeholder="İlçe" className="border border-line px-4 py-3" />
          <input name="postalCode" placeholder="Posta Kodu" className="border border-line px-4 py-3" />
        </div>
        <textarea name="note" placeholder="Sipariş notu (opsiyonel)" className="w-full border border-line px-4 py-3" rows={3} />

        <div className="border border-dashed border-line bg-white p-4 text-sm text-ink/60">
          Ödeme adımı henüz test modundadır; gerçek kart tahsilatı yapılmaz. Bir ödeme sağlayıcısı
          (örn. iyzico) bağlandığında bu alan otomatik olarak değişecektir.
        </div>

        <label className="flex items-start gap-2 text-sm text-ink/70">
          <input type="checkbox" name="termsAccepted" required className="mt-0.5" />
          <span>
            <Link
              href="/sayfa/mesafeli-satis-sozlesmesi"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-accent"
            >
              Mesafeli Satış Sözleşmesi
            </Link>
            &apos;ni okudum, kabul ediyorum.
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ink py-4 text-sm uppercase tracking-widest2 text-paper hover:bg-accent disabled:opacity-50"
        >
          {submitting ? "İşleniyor..." : "Siparişi Tamamla"}
        </button>
      </form>

      <aside className="h-fit border border-line bg-white p-6">
        <h2 className="font-display text-xl">Sipariş Özeti</h2>
        <div className="mt-4 space-y-3 text-sm">
          {lines.map((l) => (
            <div key={l.variantId} className="flex justify-between">
              <span>
                {l.name} ({l.color}, {l.size}) × {l.quantity}
              </span>
              <span>{formatPrice(l.priceCents * l.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <CouponField subtotalCents={totalCents - bundleDiscountCents} onDiscountChange={setCoupon} />
          <LoyaltyField subtotalCents={totalCents - bundleDiscountCents - discountCents} onRedeemChange={setLoyalty} />
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <span>Ara Toplam</span>
            <span>{formatPrice(totalCents)}</span>
          </div>
          {bundleDiscountCents > 0 && (
            <div className="flex justify-between text-accent">
              <span>Bundle İndirimi</span>
              <span>-{formatPrice(bundleDiscountCents)}</span>
            </div>
          )}
          {discountCents > 0 && (
            <div className="flex justify-between text-accent">
              <span>İndirim</span>
              <span>-{formatPrice(discountCents)}</span>
            </div>
          )}
          {loyaltyDiscountCents > 0 && (
            <div className="flex justify-between text-accent">
              <span>Puan İndirimi</span>
              <span>-{formatPrice(loyaltyDiscountCents)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Kargo</span>
            <span>{shippingCents === 0 ? "Ücretsiz" : formatPrice(shippingCents)}</span>
          </div>
          <div className="flex justify-between text-base font-medium">
            <span>Toplam</span>
            <span>{formatPrice(grandTotalCents)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
