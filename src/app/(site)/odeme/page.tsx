"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

export default function CheckoutPage() {
  const { lines, totalCents, clear } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shippingCents = totalCents >= 100000 ? 0 : 4900;

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
      if (!res.ok) throw new Error("Sipariş oluşturulamadı");
      const data = await res.json();
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
          <input name="customerEmail" required type="email" placeholder="E-posta" className="border border-line px-4 py-3" />
        </div>
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
        <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <span>Ara Toplam</span>
            <span>{formatPrice(totalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span>Kargo</span>
            <span>{shippingCents === 0 ? "Ücretsiz" : formatPrice(shippingCents)}</span>
          </div>
          <div className="flex justify-between text-base font-medium">
            <span>Toplam</span>
            <span>{formatPrice(totalCents + shippingCents)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
