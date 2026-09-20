"use client";

import { useState } from "react";

// Ayni (henuz suresi dolmamis) siparis icin yeni bir odeme denemesi baslatir.
export function RetryPaymentButton({ orderNumber, label = "Tekrar Dene" }: { orderNumber: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/odeme/baslat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.paymentPageUrl) {
        window.location.href = data.paymentPageUrl;
        return;
      }
      setError(typeof data.error === "string" ? data.error : "Ödeme başlatılamadı, lütfen tekrar deneyin.");
    } catch {
      setError("Bir sorun oluştu, lütfen tekrar deneyin.");
    }
    setBusy(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="bg-ink px-8 py-3 text-sm uppercase tracking-wide text-cream hover:bg-clay disabled:opacity-50"
      >
        {busy ? "İşleniyor..." : label}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
