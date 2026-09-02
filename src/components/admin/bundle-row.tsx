"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { Badge } from "@/components/admin/badge";
import { SearchableMultiSelect } from "@/components/admin/searchable-multi-select";

export type BundleProductOption = { id: string; name: string };

export type BundleData = {
  id: string;
  name: string;
  discountPercent: number;
  isActive: boolean;
  productIds: string[];
  productNames: string[];
};

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function BundleRow({
  bundle,
  allProducts,
  updateAction,
  deleteAction
}: {
  bundle: BundleData;
  allProducts: BundleProductOption[];
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(bundle.productIds));

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (editing) {
    return (
      <li className="px-4 py-4">
        <form action={updateAction} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-admin-text-muted">Ad</label>
              <input name="name" defaultValue={bundle.name} required autoFocus className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-admin-text-muted">İndirim (%)</label>
              <input
                name="discountPercent"
                type="number"
                min={1}
                max={90}
                defaultValue={bundle.discountPercent}
                required
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-admin-text-muted">Ürünler (en az 2)</label>
            <SearchableMultiSelect
              options={allProducts.map((p) => ({ id: p.id, value: p.name }))}
              selectedIds={selectedIds}
              onToggle={toggle}
              placeholder="Ürün ara veya seç..."
            />
            <input type="hidden" name="productIds" value={JSON.stringify(Array.from(selectedIds))} />
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-sm text-admin-text">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={bundle.isActive}
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
        <span className="font-medium">{bundle.name}</span>
        <Badge tone="blue">%{bundle.discountPercent}</Badge>
        <Badge tone="gray-muted">{bundle.productNames.join(", ")}</Badge>
        {!bundle.isActive && <Badge tone="red">Pasif</Badge>}
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
            if (!window.confirm(`"${bundle.name}" bundle'ını silmek istediğinize emin misiniz?`)) {
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
