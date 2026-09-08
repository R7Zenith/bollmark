"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/admin/badge";
import { CouponValueField } from "@/components/admin/coupon-value-field";
import { formatPrice } from "@/lib/format";
import { couponStatusLabel, couponStatusTone, type CouponStatus } from "@/lib/status";

export type CategoryOption = { id: string; label: string };
export type BrandOption = { id: string; name: string };

export type CouponUsageOrder = {
  orderNumber: string;
  createdAtLabel: string;
  discountCents: number;
};

export type CouponData = {
  id: string;
  code: string | null;
  name: string | null;
  type: string;
  value: number;
  minOrderCents: number;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null; // yyyy-mm-dd (input[type=date] icin)
  expiresAt: string | null;
  isActive: boolean;
  categoryId: string | null;
  categoryLabel: string | null;
  brandId: string | null;
  brandName: string | null;
  status: CouponStatus;
  usageOrders: CouponUsageOrder[];
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
  categories,
  brands,
  updateAction,
  deleteAction
}: {
  coupon: CouponData;
  categories: CategoryOption[];
  brands: BrandOption[];
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showUsage, setShowUsage] = useState(false);

  if (editing) {
    return (
      <li className="px-4 py-4">
        <form action={updateAction} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-admin-text-muted">Kod (boşsa otomatik uygulanır)</label>
              <input
                name="code"
                defaultValue={coupon.code ?? ""}
                autoFocus
                placeholder="Kod yok = otomatik"
                className={`${inputClass} font-mono uppercase`}
              />
            </div>
            <div>
              <label className="text-xs text-admin-text-muted">Görünen Ad {coupon.code ? "(opsiyonel)" : ""}</label>
              <input name="name" defaultValue={coupon.name ?? ""} className={inputClass} />
            </div>
          </div>
          <CouponValueField
            defaultType={coupon.type}
            defaultValue={coupon.type === "FIXED" ? Number((coupon.value / 100).toFixed(2)) : coupon.value}
            inputClassName={inputClass}
            labelClassName="text-xs text-admin-text-muted"
          />
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-admin-text-muted">Kategori</label>
              <select name="categoryId" defaultValue={coupon.categoryId ?? ""} className={inputClass}>
                <option value="">Tüm kategoriler</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-admin-text-muted">Marka</label>
              <select name="brandId" defaultValue={coupon.brandId ?? ""} className={inputClass}>
                <option value="">Tüm markalar</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
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
    <li className="px-4 py-3 text-sm text-admin-text">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {coupon.code ? (
            <span className="font-mono font-medium">{coupon.code}</span>
          ) : (
            <>
              <span className="font-medium">{coupon.name ?? "(adsız)"}</span>
              <Badge tone="green">Otomatik</Badge>
            </>
          )}
          <Badge tone="blue">{typeLabels[coupon.type] ?? coupon.type}</Badge>
          <Badge tone="gray">{valueLabel(coupon)}</Badge>
          {coupon.minOrderCents > 0 && (
            <Badge tone="gray-muted">Min. {formatPrice(coupon.minOrderCents)}</Badge>
          )}
          {coupon.categoryLabel && <Badge tone="gray-muted">Kategori: {coupon.categoryLabel}</Badge>}
          {coupon.brandName && <Badge tone="gray-muted">Marka: {coupon.brandName}</Badge>}
          <Badge tone="gray-muted">
            {coupon.usedCount}
            {coupon.usageLimit != null ? ` / ${coupon.usageLimit}` : ""} kullanım
          </Badge>
          <Badge tone={couponStatusTone[coupon.status]}>{couponStatusLabel[coupon.status]}</Badge>
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
              if (!window.confirm(`"${coupon.code ?? coupon.name}" kuponunu silmek istediğinize emin misiniz?`)) {
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
      </div>

      {coupon.usedCount > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowUsage((v) => !v)}
            className="flex items-center gap-1 text-xs text-admin-accent hover:underline"
          >
            Kullanımlar ({coupon.usedCount})
            {showUsage ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showUsage && (
            <ul className="mt-2 space-y-1 rounded-md border border-admin-border bg-admin-bg p-2 text-xs">
              {coupon.usageOrders.map((o) => (
                <li key={o.orderNumber} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/siparisler?q=${o.orderNumber}`}
                    className="font-mono text-admin-accent hover:underline"
                  >
                    {o.orderNumber}
                  </Link>
                  <span className="text-admin-text-muted">{o.createdAtLabel}</span>
                  <span>-{formatPrice(o.discountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
