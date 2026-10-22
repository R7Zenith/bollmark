"use client";

import { useState } from "react";
import { BundleProductPicker, type BundleProductOption } from "@/components/admin/bundle-product-picker";
import { BundleHomeFields } from "@/components/admin/bundle-home-fields";

const inputClass =
  "rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function NewBundleForm({
  allProducts,
  createAction
}: {
  allProducts: BundleProductOption[];
  createAction: (formData: FormData) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Gonderimden sonra anasayfa alanlarini (fotograf/noktalar) sifirlamak icin.
  const [homeFieldsKey, setHomeFieldsKey] = useState(0);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={createAction} className="space-y-3" onSubmit={() => {
        setSelectedIds(new Set());
        setHomeFieldsKey((k) => k + 1);
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Bundle Adı" className={inputClass} />
        <input
          name="discountPercent"
          type="number"
          min={1}
          max={90}
          required
          placeholder="İndirim (%)"
          defaultValue={10}
          className={inputClass}
        />
      </div>
      <div>
        <BundleProductPicker allProducts={allProducts} selectedIds={selectedIds} onToggle={toggle} />
        <input type="hidden" name="productIds" value={JSON.stringify(Array.from(selectedIds))} />
      </div>
      <BundleHomeFields key={homeFieldsKey} products={allProducts.filter((p) => selectedIds.has(p.id))} />
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-sm text-admin-text">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked
            className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
          />
          Aktif
        </label>
        <button type="submit" className="rounded-md bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Ekle
        </button>
      </div>
    </form>
  );
}
