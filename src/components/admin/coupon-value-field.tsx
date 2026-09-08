"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

// Tip (PERCENT/FIXED/FREE_SHIPPING) secimine gore Deger inputunun birimini
// (% veya TL) canli gosterir, FREE_SHIPPING'de inputu disable eder. "Yeni
// Kupon" formu server component oldugu icin sadece bu iki alan client alt
// bilesene alinir - input name'leri degismedigi icin form FormData okumasi
// (readCouponFields) etkilenmez.
export function CouponValueField({
  defaultType = "PERCENT",
  defaultValue = 10,
  inputClassName = inputClass,
  labelClassName = labelClass
}: {
  defaultType?: string;
  defaultValue?: number | string;
  inputClassName?: string;
  labelClassName?: string;
}) {
  const [type, setType] = useState(defaultType);
  const isFreeShipping = type === "FREE_SHIPPING";
  const unit = type === "FIXED" ? "₺" : "%";

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelClassName}>Tip</label>
        <select
          name="type"
          defaultValue={defaultType}
          onChange={(e) => setType(e.target.value)}
          className={`mt-1 ${inputClassName}`}
        >
          <option value="PERCENT">Yüzde İndirim</option>
          <option value="FIXED">Sabit Tutar (TL)</option>
          <option value="FREE_SHIPPING">Ücretsiz Kargo</option>
        </select>
      </div>
      <div>
        <label className={labelClassName}>Değer</label>
        <div className="relative mt-1">
          <input
            name="value"
            type="number"
            step="0.01"
            min={0}
            defaultValue={defaultValue}
            disabled={isFreeShipping}
            placeholder={isFreeShipping ? "—" : undefined}
            className={`${inputClassName} pr-8 disabled:opacity-50`}
          />
          {!isFreeShipping && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-admin-text-muted">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
