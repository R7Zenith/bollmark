"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

// "Yeni Kupon" formunda Kod / Ad alanlarini "Kampanya Türü" secimine gore
// gosterir - Kupon Kodlu'da kod zorunlu, Otomatik'te (kod gerekmez) kod
// gizlenip disable edilir, yerine gorunen ad zorunlu olur. Server component
// olan formun geri kalani etkilenmez, input name'leri (code/name) sabit
// kaldigi icin FormData okumasi (readCouponFields) degismeden calisir.
export function CouponIdentityField({
  defaultMode = "CODED"
}: {
  defaultMode?: "CODED" | "AUTOMATIC";
}) {
  const [mode, setMode] = useState<"CODED" | "AUTOMATIC">(defaultMode);
  const isAutomatic = mode === "AUTOMATIC";

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Kampanya Türü</label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("CODED")}
            className={`rounded-md border px-3 py-2 text-sm ${
              !isAutomatic
                ? "border-admin-accent bg-admin-accent/10 font-medium text-admin-accent"
                : "border-admin-border text-admin-text-muted"
            }`}
          >
            Kupon Kodlu
          </button>
          <button
            type="button"
            onClick={() => setMode("AUTOMATIC")}
            className={`rounded-md border px-3 py-2 text-sm ${
              isAutomatic
                ? "border-admin-accent bg-admin-accent/10 font-medium text-admin-accent"
                : "border-admin-border text-admin-text-muted"
            }`}
          >
            Otomatik (kod gerekmez)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={isAutomatic ? "opacity-40" : ""}>
          <label className={labelClass}>Kod</label>
          <input
            name="code"
            required={!isAutomatic}
            disabled={isAutomatic}
            placeholder="HOSGELDIN10"
            className={`mt-1 ${inputClass} font-mono uppercase disabled:cursor-not-allowed`}
          />
        </div>
        <div>
          <label className={labelClass}>{isAutomatic ? "Görünen Ad" : "Görünen Ad (opsiyonel)"}</label>
          <input
            name="name"
            required={isAutomatic}
            placeholder="Ayakkabılarda %20 İndirim"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      {isAutomatic && (
        <p className="text-xs text-admin-text-muted">
          Bu kampanya kod girilmeden sepete/ürüne otomatik uygulanır. Aşağıdan bir kategori veya marka
          seçmezseniz kampanya <span className="font-medium text-amber-600">tüm sitede</span> geçerli olur.
        </p>
      )}
    </div>
  );
}
