"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { CouponField, type CouponResult } from "@/components/coupon-field";
import { LoyaltyField, type LoyaltyResult } from "@/components/loyalty-field";
import { useBundleDiscount } from "@/lib/use-bundle-discount";
import { calculateShippingCents } from "@/lib/shipping";
import { CartNotices } from "@/components/cart-notices";

export interface SavedAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  district: string;
  postalCode: string | null;
  isDefault: boolean;
}

export default function CheckoutForm({
  defaultShippingCents,
  paymentMode,
  savedAddresses = [],
  customerEmail
}: {
  defaultShippingCents: number;
  /** Sanal POS hazir degilse null (odeme alinamaz) */
  paymentMode: "SANDBOX" | "LIVE" | null;
  savedAddresses?: SavedAddress[];
  customerEmail?: string;
}) {
  const { lines, totalCents, couponCode, refreshPrices, hasBlockingIssues } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<CouponResult>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyResult>(null);
  const [addressChoice, setAddressChoice] = useState<string>(savedAddresses[0]?.id ?? "new");
  const selectedAddress = savedAddresses.find((a) => a.id === addressChoice) ?? null;
  // Siparis olustu ama odeme baslatilamadiysa (ag hatasi vb.) tekrar denemede ayni siparis
  // kullanilir - ikinci bir siparis olusturulmaz.
  const createdOrderNumber = useRef<string | null>(null);

  // Sunucudaki (orders/route.ts) ile ayni sirali hesaplama: once bundle,
  // sonra kupon, sonra puan - boylece onizleme nihai tutarla tutarli kalir.
  const bundleDiscountCents = useBundleDiscount(lines);
  const discountCents = coupon?.discountCents ?? 0;
  const loyaltyDiscountCents = loyalty?.discountCents ?? 0;
  const totalDiscountCents = bundleDiscountCents + discountCents + loyaltyDiscountCents;
  const shippingCents = calculateShippingCents(
    totalCents - totalDiscountCents,
    coupon?.freeShipping ?? false,
    defaultShippingCents
  );
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
      // Sozlesme onayi artik sepet adiminda (/sepet) aliniyor - odeme
      // adimina buradan gecebilmis olmak onayin verildigi anlamina gelir.
      termsAccepted: true,
      lines: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
        expectedPriceCents: l.priceCents
      }))
    };

    try {
      if (!createdOrderNumber.current) {
        // Gondermeden hemen once fiyatlari tazele: degistiyse (veya urun
        // satistan kalktiysa) siparis olusturmadan kullaniciya goster.
        const refreshed = await refreshPrices();
        if (refreshed.blocked) {
          setError("Sepetinizde satın alınamayan ürünler var. Lütfen sepetinizi kontrol edin.");
          return;
        }
        if (refreshed.priceChanged) {
          setError("Fiyatlar güncellendi, lütfen tekrar kontrol edin.");
          return;
        }

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.status === 409 && data.code === "PRICE_CHANGED") {
          await refreshPrices();
          setError("Fiyatlar güncellendi, lütfen tekrar kontrol edin.");
          return;
        }
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Sipariş oluşturulamadı, lütfen tekrar deneyin.");
          return;
        }
        createdOrderNumber.current = data.orderNumber;
      }

      const payRes = await fetch("/api/odeme/baslat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: createdOrderNumber.current })
      });
      const payData = await payRes.json().catch(() => ({}));
      if (!payRes.ok) {
        setError(typeof payData.error === "string" ? payData.error : "Ödeme başlatılamadı, lütfen tekrar deneyin.");
        return;
      }
      // Sepet burada temizlenmez: odeme dogrulaninca /odeme/tesekkurler temizler.
      if (payData.free) {
        router.push(`/odeme/tesekkurler?siparis=${createdOrderNumber.current}`);
      } else {
        window.location.href = payData.paymentPageUrl;
      }
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

        <CartNotices />

        {savedAddresses.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {savedAddresses.map((a) => {
              const selected = addressChoice === a.id;
              return (
                <label
                  key={a.id}
                  className={`group relative cursor-pointer border p-4 pr-10 text-sm transition-all duration-200 ${
                    selected ? "border-ink bg-ink/[0.03] shadow-sm" : "border-line hover:border-ink/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="addressChoice"
                    className="sr-only"
                    checked={selected}
                    onChange={() => setAddressChoice(a.id)}
                  />
                  <span
                    className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-200 ${
                      selected ? "border-ink bg-ink" : "border-line group-hover:border-ink/50"
                    }`}
                  >
                    <svg
                      viewBox="0 0 12 10"
                      fill="none"
                      className={`h-2.5 w-2.5 transition-transform duration-200 ${selected ? "scale-100" : "scale-0"}`}
                    >
                      <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="font-medium">
                    {a.label} {a.isDefault && <span className="ml-2 text-xs text-clay">(Varsayılan)</span>}
                  </p>
                  <p className="mt-1 text-ink/60">
                    {a.address}, {a.district} / {a.city}
                  </p>
                </label>
              );
            })}
            <label
              className={`group relative cursor-pointer border p-4 pr-10 text-sm transition-all duration-200 flex items-center ${
                addressChoice === "new" ? "border-ink bg-ink/[0.03] shadow-sm" : "border-line hover:border-ink/40"
              }`}
            >
              <input
                type="radio"
                name="addressChoice"
                className="sr-only"
                checked={addressChoice === "new"}
                onChange={() => setAddressChoice("new")}
              />
              <span
                className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-200 ${
                  addressChoice === "new" ? "border-ink bg-ink" : "border-line group-hover:border-ink/50"
                }`}
              >
                <svg
                  viewBox="0 0 12 10"
                  fill="none"
                  className={`h-2.5 w-2.5 transition-transform duration-200 ${addressChoice === "new" ? "scale-100" : "scale-0"}`}
                >
                  <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="font-medium">Yeni adres kullan</span>
            </label>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <input
            key={`name-${addressChoice}`}
            name="customerName"
            required
            placeholder="Ad Soyad"
            defaultValue={selectedAddress?.name ?? ""}
            readOnly={!!selectedAddress}
            className={`border border-line px-4 py-3 ${selectedAddress ? "bg-ink/5" : ""}`}
          />
          <input
            name="customerEmail"
            required
            type="email"
            placeholder="E-posta"
            defaultValue={customerEmail ?? ""}
            onBlur={handleEmailBlur}
            className="border border-line px-4 py-3"
          />
        </div>
        <p className="text-xs text-ink/50">
          Ödemenizi tamamlamazsanız sepetinizi hatırlatmak için size e-posta gönderebiliriz.
        </p>
        <input
          key={`phone-${addressChoice}`}
          name="customerPhone"
          required
          placeholder="Telefon"
          defaultValue={selectedAddress?.phone ?? ""}
          readOnly={!!selectedAddress}
          className={`w-full border border-line px-4 py-3 ${selectedAddress ? "bg-ink/5" : ""}`}
        />
        <input
          key={`address-${addressChoice}`}
          name="shippingAddress"
          required
          placeholder="Adres"
          defaultValue={selectedAddress?.address ?? ""}
          readOnly={!!selectedAddress}
          className={`w-full border border-line px-4 py-3 ${selectedAddress ? "bg-ink/5" : ""}`}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <input
            key={`city-${addressChoice}`}
            name="city"
            required
            placeholder="İl"
            defaultValue={selectedAddress?.city ?? ""}
            readOnly={!!selectedAddress}
            className={`border border-line px-4 py-3 ${selectedAddress ? "bg-ink/5" : ""}`}
          />
          <input
            key={`district-${addressChoice}`}
            name="district"
            required
            placeholder="İlçe"
            defaultValue={selectedAddress?.district ?? ""}
            readOnly={!!selectedAddress}
            className={`border border-line px-4 py-3 ${selectedAddress ? "bg-ink/5" : ""}`}
          />
          <input
            key={`postal-${addressChoice}`}
            name="postalCode"
            placeholder="Posta Kodu"
            defaultValue={selectedAddress?.postalCode ?? ""}
            readOnly={!!selectedAddress}
            className={`border border-line px-4 py-3 ${selectedAddress ? "bg-ink/5" : ""}`}
          />
        </div>
        <textarea name="note" placeholder="Sipariş notu (opsiyonel)" className="w-full border border-line px-4 py-3" rows={3} />

        {paymentMode === "SANDBOX" && (
          <div className="border border-dashed border-line bg-white p-4 text-sm text-ink/60">
            Test ödeme modu: gerçek kart çekilmez.
          </div>
        )}
        {paymentMode === null && (
          <div className="border border-dashed border-red-300 bg-white p-4 text-sm text-red-600">
            Ödeme sistemi şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.
          </div>
        )}
        {paymentMode === "LIVE" && (
          <p className="text-xs text-ink/50">
            Ödemeniz iyzico güvencesiyle, 3D Secure doğrulamasıyla alınır. Kart bilgileriniz sitemizde saklanmaz.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || paymentMode === null || hasBlockingIssues}
          className="w-full bg-ink py-4 text-sm uppercase tracking-widest2 text-cream hover:bg-clay disabled:opacity-50"
        >
          {submitting ? "İşleniyor..." : "Ödemeye Geç"}
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
          <CouponField onDiscountChange={setCoupon} />
          <LoyaltyField subtotalCents={totalCents - bundleDiscountCents - discountCents} onRedeemChange={setLoyalty} />
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <span>Ara Toplam</span>
            <span>{formatPrice(totalCents)}</span>
          </div>
          {bundleDiscountCents > 0 && (
            <div className="flex justify-between text-clay">
              <span>Bundle İndirimi</span>
              <span>-{formatPrice(bundleDiscountCents)}</span>
            </div>
          )}
          {discountCents > 0 && (
            <div className="flex justify-between text-clay">
              <span>{coupon?.appliedName ? `İndirim (${coupon.appliedName})` : "İndirim"}</span>
              <span>-{formatPrice(discountCents)}</span>
            </div>
          )}
          {loyaltyDiscountCents > 0 && (
            <div className="flex justify-between text-clay">
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
