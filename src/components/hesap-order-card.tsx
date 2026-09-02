"use client";

import { useState } from "react";
import { returnReasons, returnTypeLabel, returnStatusLabel, type ReturnType } from "@/lib/status";

export interface HesapOrderItemView {
  id: string;
  productName: string;
  quantity: number;
  totalLabel: string;
  hasOpenReturn: boolean;
}

export interface HesapReturnRequestView {
  id: string;
  type: string;
  reason: string;
  status: string;
  createdAtLabel: string;
  adminNote: string | null;
}

export interface HesapOrderView {
  id: string;
  orderNumber: string;
  statusLabel: string;
  createdAtLabel: string;
  totalLabel: string;
  shipment: { carrier: string; trackingCode: string | null } | null;
  items: HesapOrderItemView[];
  returnRequests: HesapReturnRequestView[];
  eligibleForReturn: boolean;
  customerEmail: string;
}

export function HesapOrderCard({ order }: { order: HesapOrderView }) {
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<ReturnType>("IADE");
  const [reason, setReason] = useState<(typeof returnReasons)[number]>(returnReasons[0]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const selectableItems = order.items.filter((item) => !item.hasOpenReturn);

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
          orderNumber: order.orderNumber,
          email: order.customerEmail,
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
    } catch {
      setFormError("Bir sorun oluştu, lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-line bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{order.orderNumber}</p>
          <p className="text-xs text-ink/50">{order.createdAtLabel}</p>
        </div>
        <div className="text-right text-sm">
          <p>{order.totalLabel}</p>
          <p className="text-ink/50">{order.statusLabel}</p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-line text-sm">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-2">
            <span>
              {item.productName} × {item.quantity}
              {item.hasOpenReturn && <span className="ml-2 text-xs text-ink/50">(açık talep var)</span>}
            </span>
            <span>{item.totalLabel}</span>
          </div>
        ))}
      </div>

      {order.shipment && (
        <p className="mt-3 text-xs text-ink/50">
          Kargo: {order.shipment.carrier || "Belirtilmedi"}
          {order.shipment.trackingCode ? ` · Takip: ${order.shipment.trackingCode}` : ""}
        </p>
      )}

      {order.returnRequests.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {order.returnRequests.map((rr) => (
            <div key={rr.id} className="text-xs text-ink/70">
              {returnTypeLabel[rr.type as ReturnType] ?? rr.type} · {rr.reason} ·{" "}
              {returnStatusLabel[rr.status as keyof typeof returnStatusLabel] ?? rr.status} ({rr.createdAtLabel})
            </div>
          ))}
        </div>
      )}

      {order.eligibleForReturn && selectableItems.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          {!formOpen ? (
            <button type="button" onClick={() => setFormOpen(true)} className="text-sm underline hover:text-accent">
              İade/Değişim Talebi Oluştur
            </button>
          ) : (
            <form onSubmit={submitReturn} className="space-y-3">
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={type === "IADE"} onChange={() => setType("IADE")} />
                  İade
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={type === "DEGISIM"} onChange={() => setType("DEGISIM")} />
                  Değişim
                </label>
              </div>
              <div className="space-y-1">
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
                className="w-full border border-line px-3 py-2 text-sm"
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
                rows={2}
                className="w-full border border-line px-3 py-2 text-sm"
              />
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              {formSuccess && <p className="text-sm text-ink/70">Talebiniz alındı.</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-ink px-5 py-2 text-sm uppercase tracking-wide text-paper hover:bg-accent disabled:opacity-50"
                >
                  {submitting ? "Gönderiliyor..." : "Talebi Gönder"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="border border-line px-5 py-2 text-sm uppercase tracking-wide hover:bg-ink hover:text-paper"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
