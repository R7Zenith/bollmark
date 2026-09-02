"use client";

import { useState } from "react";
import { SearchableMultiSelect } from "@/components/admin/searchable-multi-select";

const inputClass =
  "rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function NewBundleForm({
  allProducts,
  createAction
}: {
  allProducts: { id: string; name: string }[];
  createAction: (formData: FormData) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={createAction} className="space-y-3" onSubmit={() => setSelectedIds(new Set())}>
      <div className="grid grid-cols-2 gap-3">
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
        <SearchableMultiSelect
          options={allProducts.map((p) => ({ id: p.id, value: p.name }))}
          selectedIds={selectedIds}
          onToggle={toggle}
          placeholder="Ürün ara veya seç (en az 2)..."
        />
        <input type="hidden" name="productIds" value={JSON.stringify(Array.from(selectedIds))} />
      </div>
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
