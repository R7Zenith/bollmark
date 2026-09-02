"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";

const returnReasons = ["Beden uymadı", "Ürün hasarlı geldi", "Farklı ürün istiyorum", "Diğer"] as const;

const orderStatusLabelTr: Record<string, string> = {
  PENDING_PAYMENT: "Ödeme Bekliyor",
  PAID: "Ödendi",
  PREPARING: "Hazırlanıyor",
  SHIPPED: "Kargolandı",
  DELIVERED: "Teslim Edildi",
  CANCELLED: "İptal",
  REFUNDED: "İade Edildi"
};

const returnStatusLabelTr: Record<string, string> = {
  TALEP_EDILDI: "Talep Edildi",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
  KARGODA: "Kargoda",
  TAMAMLANDI: "Tamamlandı"
};

const returnTypeLabelTr: Record<string, string> = { IADE: "İade", DEGISIM: "Değişim" };

interface OrderItemView {
  id: string;
  productName: string;
  quantity: number;
  totalLabel: string;
  hasOpenReturn: boolean;
}

interface ReturnRequestView {
  id: string;
  type: string;
  reason: string;
  status: string;
  createdAt: string;
  customerNote: string | null;
  adminNote: string | null;
  items: { orderItemId: string; quantity: number }[];
}

interface OrderView {
  orderNumber: string;
  status: string;
  createdAt: string;
  totalLabel: string;
  shipment: { carrier: string; trackingCode: string | null; status: string } | null;
  items: OrderItemView[];
}

interface LookupResult {
  order: OrderView;
  eligibleForReturn: boolean;
  returnRequests: ReturnRequestView[];
}

export default function SiparisDurumuPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const [type, setType] = useState<"IADE" | "DEGISIM">("IADE");
  const [reason, setReason] = useState<(typeof returnReasons)[number]>(returnReasons[0]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setFormSuccess(false);
    try {
      const res = await fetch("/api/siparis-sorgula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: orderNumber.trim(), email: email.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sipariş bulunamadı.");
        return;
      }
      setResult(data);
      setSelectedItems({});
    } catch {
      setError("Bir sorun oluştu, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(itemId: string, checked: boolean, maxQuantity: number) {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (checked) next[itemId] = maxQuantity;
      else delete next[itemId];
      return next;
    });
  }

  async function submitReturn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!result) return;
    const items = Object.entries(selectedItems).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (items.length === 0) {
      setFormError("En az bir ürün seçmelisiniz.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/iade-talebi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: result.order.orderNumber,
          email: email.trim(),
          type,
          reason,
          items,
          customerNote: note.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Talep oluşturulamadı.");
        return;
      }
      setFormSuccess(true);
      setSelectedItems({});
      setNote("");
      // Talep listesini guncel gostermek icin sorguyu tekrarla.
      const refreshed = await fetch("/api/siparis-sorgula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: result.order.orderNumber, email: email.trim() })
      });
      const refreshedData = await refreshed.json();
      if (refreshed.ok) setResult(refreshedData);
    } catch {
      setFormError("Bir sorun oluştu, lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectableItems = result?.order.items.filter((item) => !item.hasOpenReturn) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-3xl">Sipariş Durumu</h1>
      <p className="mt-2 text-sm text-ink/60">
        Siparişinizi görüntülemek ve iade/değişim talebi oluşturmak için sipariş numaranızı ve e-posta
        adresinizi girin.
      </p>

      <form onSubmit={lookup} className="mt-8 flex flex-col gap-4 sm:flex-row">
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          required
          placeholder="Sipariş No (örn. BLM260829-1234)"
          className="w-full border border-line px-4 py-3 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          placeholder="E-posta"
          className="w-full border border-line px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 bg-ink px-8 py-3 text-sm uppercase tracking-wide text-paper hover:bg-accent disabled:opacity-50"
        >
          {loading ? "Aranıyor..." : "Sorgula"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-10 space-y-8">
          <div className="border border-line bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">{result.order.orderNumber}</h2>
              <span className="text-sm text-ink/70">
                {orderStatusLabelTr[result.order.status] ?? result.order.status}
              </span>
            </div>
            <div className="mt-4 divide-y divide-line">
              {result.order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {item.productName} × {item.quantity}
                    {item.hasOpenReturn && (
                      <span className="ml-2 text-xs text-ink/50">(açık talep var)</span>
                    )}
                  </span>
                  <span>{item.totalLabel}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 text-sm font-medium">
                <span>Toplam</span>
                <span>{result.order.totalLabel}</span>
              </div>
            </div>
            {result.order.shipment && (
              <p className="mt-4 text-sm text-ink/60">
                Kargo: {result.order.shipment.carrier || "Belirtilmedi"}
                {result.order.shipment.trackingCode ? ` · Takip: ${result.order.shipment.trackingCode}` : ""}
              </p>
            )}
          </div>

          {result.returnRequests.length > 0 && (
            <div className="border border-line bg-white p-6">
              <h2 className="font-display text-xl">İade/Değişim Geçmişi</h2>
              <div className="mt-4 space-y-4">
                {result.returnRequests.map((rr) => (
                  <div key={rr.id} className="border-t border-line pt-4 first:border-0 first:pt-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {returnTypeLabelTr[rr.type] ?? rr.type} · {rr.reason}
                      </span>
                      <span className="text-ink/70">{returnStatusLabelTr[rr.status] ?? rr.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink/50">
                      {new Date(rr.createdAt).toLocaleDateString("tr-TR")}
                    </p>
                    {rr.adminNote && <p className="mt-2 text-sm text-ink/70">Not: {rr.adminNote}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.eligibleForReturn && selectableItems.length > 0 && (
            <div className="border border-line bg-white p-6">
              <h2 className="font-display text-xl">İade/Değişim Talebi Oluştur</h2>
              <form onSubmit={submitReturn} className="mt-4 space-y-4">
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      checked={type === "IADE"}
                      onChange={() => setType("IADE")}
                    />
                    İade
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      checked={type === "DEGISIM"}
                      onChange={() => setType("DEGISIM")}
                    />
                    Değişim
                  </label>
                </div>

                <div className="space-y-2">
                  {selectableItems.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.id in selectedItems}
                        onChange={(e) => toggleItem(item.id, e.target.checked, item.quantity)}
                      />
                      {item.productName} × {item.quantity}
                    </label>
                  ))}
                </div>

                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as (typeof returnReasons)[number])}
                  className="w-full border border-line px-4 py-3 text-sm"
                >
                  {returnReasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ek not (opsiyonel)"
                  rows={3}
                  className="w-full border border-line px-4 py-3 text-sm"
                />

                {formError && <p className="text-sm text-red-600">{formError}</p>}
                {formSuccess && <p className="text-sm text-ink/70">Talebiniz alındı.</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-ink py-3 text-sm uppercase tracking-wide text-paper hover:bg-accent disabled:opacity-50"
                >
                  {submitting ? "Gönderiliyor..." : "Talebi Gönder"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
