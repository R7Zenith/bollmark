"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
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

const inputClass = "w-full rounded-xl border border-line px-4 py-3.5 text-sm focus:border-ink focus:outline-none";
const inputReadOnlyClass = `${inputClass} bg-ink/5`;

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
  // Mobilde kapali baslayan "Siparis Ozeti" seridi - masaustune gecince
  // (lg: 1024px+) JS ile acik zorlanir, ayni <details> tek DOM agaci olarak
  // hem mobil accordion hem masaustu sabit panel gorevini gorur (CouponField/
  // LoyaltyField'in iki kere mount olup cift API cagrisi yapmasini onler).
  const summaryRef = useRef<HTMLDetailsElement>(null);
  // Bu projede Tailwind'in bazi "ilk kez kullanilan" responsive class
  // kombinasyonlari (orn. lg:items-stretch, lg:rounded-none) gelistirme
  // ortaminda guvenilir sekilde derlenmiyor (birden fazla sunucu yeniden
  // baslatma/cache temizlemeyle dogrulandi). Sag ozet panelinin arka plan
  // genisligi/koseleri/ayrac cizgisi gibi KRITIK gorsel dogrulugu Tailwind
  // class derlemesine guvenmek yerine burada JS ile olculup inline style
  // olarak veriliyor - garanti calisir.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setIsDesktop(mq.matches);
      if (mq.matches && summaryRef.current) summaryRef.current.open = true;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  const radioCardClass = (selected: boolean) =>
    `group relative cursor-pointer rounded-xl border p-4 pr-10 text-sm transition-all duration-200 ${
      selected ? "border-ink bg-ink/[0.03] shadow-sm" : "border-line hover:border-ink/40"
    }`;

  const radioDotClass = (selected: boolean) =>
    `absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-200 ${
      selected ? "border-ink bg-ink" : "border-line group-hover:border-ink/50"
    }`;

  const summaryPanel = (
    <div className="space-y-4 px-4 pb-4 lg:px-0 lg:pb-0 lg:pt-8">
      <div className="space-y-4">
        {lines.map((l) => (
          <div key={l.variantId} className="flex items-center gap-4">
            <div className="relative shrink-0" style={{ height: 96, width: 72 }}>
              <div className="h-full w-full overflow-hidden rounded-lg bg-line shadow-[0_0_0_2px_#ffffff,0_8px_16px_rgba(0,0,0,0.18)]">
                <Image src={l.image} alt={l.name} fill className="object-cover" sizes="72px" />
              </div>
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-cream">
                {l.quantity}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{l.name}</p>
              <p className="text-xs text-ink/60">
                {l.color} · {l.size}
              </p>
            </div>
            <p className="text-sm font-semibold">{formatPrice(l.priceCents * l.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t border-line/60 pt-4">
        <CouponField variant="segmented" onDiscountChange={setCoupon} />
        <LoyaltyField subtotalCents={totalCents - bundleDiscountCents - discountCents} onRedeemChange={setLoyalty} />
      </div>

      <div className="space-y-2 border-t border-line/60 pt-4 text-sm">
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
        <div className="flex justify-between text-lg font-semibold">
          <span>Toplam</span>
          <span>{formatPrice(grandTotalCents)}</span>
        </div>
      </div>
    </div>
  );

  // Tailwind'in lg:items-stretch/lg:rounded-none/lg:border-l gibi bu projede
  // ilk kez kullanilan responsive kombinasyonlari dev ortaminda guvenilir
  // derlenmedigi defalarca dogrulandigi icin (bkz. yukaridaki isDesktop
  // efekti), sag ozet kolonunun KRITIK gorsel dogrulugu (tam yukseklik,
  // kose yuvarlakligi, ayrac cizgisi) burada JS ile inline style olarak
  // veriliyor - Tailwind derlemesinden bagimsiz, garanti calisir.
  const summaryColumnStyle: React.CSSProperties = isDesktop
    ? {
        borderRadius: 0,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 0,
        borderLeft: "1px solid rgba(17,17,17,0.15)",
        paddingLeft: 32
      }
    : {};
  return (
    // -mt-px: header'in border-b'si (1px) ile sabit h-[72px] spacer'i tam
    // ortusmuyor, bu da /odeme'de (gri ozet panelinin arka planiyla) belli
    // olan 1px'lik bir bosluk birakiyor - sadece bu sayfada kapatiliyor,
    // paylasilan site-header.tsx/layout.tsx'e dokunulmuyor.
    <div className="-mt-px py-10 lg:grid lg:grid-cols-2 lg:py-0">
      <h1 className="sr-only">Ödeme</h1>

      {/* Sag ozet kolonu: mobilde mx-6 ile ortalanmis yuvarlak kutu, lg'de
          grid hucresi olarak (grid'in varsayilan davranisi geregi) satirin
          tam yuksekligine uzanan, sayfayi tam ortadan ikiye bolen gri arka
          plan - Release'in checkout'undaki gorunum. Icerik ESKISI KADAR DAR
          kaliyor (lg:max-w-[480px]) - sadece arka plan genisliyor. */}
      <div
        className="mx-6 mb-6 rounded-2xl bg-ink/5 lg:order-2 lg:flex lg:justify-start"
        style={summaryColumnStyle}
      >
        <details ref={summaryRef} className="group w-full lg:sticky lg:top-24 lg:h-fit lg:max-w-[480px] lg:pb-16 lg:pt-8">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 text-sm [&::-webkit-details-marker]:hidden lg:cursor-default lg:px-0 lg:py-0 lg:text-xl lg:font-semibold">
            <span>Sipariş Özeti</span>
            <span className="flex items-center gap-2 lg:hidden">
              {formatPrice(grandTotalCents)}
              <ChevronDown size={16} className="transition-transform duration-200 group-open:rotate-180" />
            </span>
          </summary>
          {summaryPanel}
        </details>
      </div>

      <div className="lg:order-1 lg:flex lg:justify-end lg:py-16 lg:pl-6 lg:pr-8 xl:pl-9">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[580px] space-y-10 px-6 lg:mx-0 lg:px-0">
          <CartNotices />

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Teslimat</h2>

            {savedAddresses.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {savedAddresses.map((a) => {
                  const selected = addressChoice === a.id;
                  return (
                    <label key={a.id} className={radioCardClass(selected)}>
                      <input
                        type="radio"
                        name="addressChoice"
                        className="sr-only"
                        checked={selected}
                        onChange={() => setAddressChoice(a.id)}
                      />
                      <span className={radioDotClass(selected)}>
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
                <label className={`${radioCardClass(addressChoice === "new")} flex items-center`}>
                  <input
                    type="radio"
                    name="addressChoice"
                    className="sr-only"
                    checked={addressChoice === "new"}
                    onChange={() => setAddressChoice("new")}
                  />
                  <span className={radioDotClass(addressChoice === "new")}>
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

            <input
              name="customerEmail"
              required
              type="email"
              placeholder="E-posta"
              defaultValue={customerEmail ?? ""}
              onBlur={handleEmailBlur}
              className={inputClass}
            />
            <p className="text-xs text-ink/50">
              Ödemenizi tamamlamazsanız sepetinizi hatırlatmak için size e-posta gönderebiliriz.
            </p>
            <input
              key={`name-${addressChoice}`}
              name="customerName"
              required
              placeholder="Ad Soyad"
              defaultValue={selectedAddress?.name ?? ""}
              readOnly={!!selectedAddress}
              className={selectedAddress ? inputReadOnlyClass : inputClass}
            />
            <input
              key={`phone-${addressChoice}`}
              name="customerPhone"
              required
              placeholder="Telefon"
              defaultValue={selectedAddress?.phone ?? ""}
              readOnly={!!selectedAddress}
              className={selectedAddress ? inputReadOnlyClass : inputClass}
            />
            <input
              key={`address-${addressChoice}`}
              name="shippingAddress"
              required
              placeholder="Adres"
              defaultValue={selectedAddress?.address ?? ""}
              readOnly={!!selectedAddress}
              className={selectedAddress ? inputReadOnlyClass : inputClass}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <input
                key={`city-${addressChoice}`}
                name="city"
                required
                placeholder="İl"
                defaultValue={selectedAddress?.city ?? ""}
                readOnly={!!selectedAddress}
                className={selectedAddress ? inputReadOnlyClass : inputClass}
              />
              <input
                key={`district-${addressChoice}`}
                name="district"
                required
                placeholder="İlçe"
                defaultValue={selectedAddress?.district ?? ""}
                readOnly={!!selectedAddress}
                className={selectedAddress ? inputReadOnlyClass : inputClass}
              />
              <input
                key={`postal-${addressChoice}`}
                name="postalCode"
                placeholder="Posta Kodu"
                defaultValue={selectedAddress?.postalCode ?? ""}
                readOnly={!!selectedAddress}
                className={selectedAddress ? inputReadOnlyClass : inputClass}
              />
            </div>
            <textarea name="note" placeholder="Sipariş notu (opsiyonel)" className={inputClass} rows={3} />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Kargo</h2>
            <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3.5 text-sm">
              <span>Standart Kargo</span>
              <span className="font-medium">{shippingCents === 0 ? "Ücretsiz" : formatPrice(shippingCents)}</span>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Ödeme</h2>

            {paymentMode === "SANDBOX" && (
              <div className="rounded-xl border border-dashed border-line bg-white p-4 text-sm text-ink/60">
                Test ödeme modu: gerçek kart çekilmez.
              </div>
            )}
            {paymentMode === null && (
              <div className="rounded-xl border border-dashed border-red-300 bg-white p-4 text-sm text-red-600">
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
          </section>
        </form>
      </div>
    </div>
  );
}
