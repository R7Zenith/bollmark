"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { Badge } from "@/components/admin/badge";
import { formatPrice } from "@/lib/format";

export type CouponData = {
  id: string;
  code: string;
  type: string;
  value: number;
  minOrderCents: number;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null; // yyyy-mm-dd (input[type=date] icin)
  expiresAt: string | null;
  isActive: boolean;
};

const typeLabels: Record<string, string> = {
  PERCENT: "Yüzde İndirim",
  FIXED: "Sabit Tutar",
  FREE_SHIPPING: "Ücretsiz Kargo"
};

function valueLabel(coupon: CouponData): string {
  if (coupon.type === "PERCENT") return `%${coupon.value}`;
  if (coupon.type === "FIXED") return formatPrice(coupon.value);
  return "—";
}

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function CouponRow({
  coupon,
  updateAction,
  deleteAction
}: {
  coupon: CouponData;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="px-4 py-4">
        <form action={updateAction} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-admin-text-muted">Kod</label>
              <input name="code" defaultValue={coupon.code} required autoFocus className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-admin-text-muted">Tip</label>
              <select name="type" defaultValue={coupon.type} className={inputClass}>
                <option value="PERCENT">Yüzde İndirim</option>
                <option value="FIXED">Sabit Tutar (TL)</option>
                <option value="FREE_SHIPPING">Ücretsiz Kargo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-admin-text-muted">Değer (% veya TL)</label>
              <input
                name="value"
                type="number"
                step="0.01"
                min={0}
                defaultValue={coupon.type === "FIXED" ? (coupon.value / 100).toFixed(2) : coupon.value}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-admin-text-muted">Min. Sepet (TL)</label>
              <input
                name="minOrderCents"
                type="number"
                step="0.01"
                min={0}
                defaultValue={(coupon.minOrderCents / 100).toFixed(2)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-admin-text-muted">Kullanım Limiti</label>
              <input
                name="usageLimit"
                type="number"
                min={1}
                defaultValue={coupon.usageLimit ?? ""}
                placeholder="Sınırsız"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-admin-text-muted">Başlangıç</label>
              <input name="startsAt" type="date" defaultValue={coupon.startsAt ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-admin-text-muted">Bitiş</label>
              <input name="expiresAt" type="date" defaultValue={coupon.expiresAt ?? ""} className={inputClass} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-sm text-admin-text">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={coupon.isActive}
                className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
              />
              Aktif
            </label>
            <div className="flex items-center gap-1">
              <button type="submit" className="rounded-md p-1.5 text-green-600 hover:bg-green-50" title="Kaydet">
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
                title="Vazgeç"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-admin-text">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-medium">{coupon.code}</span>
        <Badge tone="blue">{typeLabels[coupon.type] ?? coupon.type}</Badge>
        <Badge tone="gray">{valueLabel(coupon)}</Badge>
        {coupon.minOrderCents > 0 && (
          <Badge tone="gray-muted">Min. {formatPrice(coupon.minOrderCents)}</Badge>
        )}
        <Badge tone="gray-muted">
          {coupon.usedCount}
          {coupon.usageLimit != null ? ` / ${coupon.usageLimit}` : ""} kullanım
        </Badge>
        {!coupon.isActive && <Badge tone="red">Pasif</Badge>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
          title="Düzenle"
        >
          <Pencil size={15} />
        </button>
        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!window.confirm(`"${coupon.code}" kuponunu silmek istediğinize emin misiniz?`)) {
              e.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            className="rounded-md p-1.5 text-admin-text-muted hover:bg-red-50 hover:text-red-600"
            title="Sil"
          >
            <Trash2 size={15} />
          </button>
        </form>
      </div>
    </li>
  );
}
