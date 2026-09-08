"use client";

import { useState } from "react";
import { Button } from "@/components/admin/button";
import type { ParentOption } from "@/components/admin/category-row";

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function CategoryDeleteForm({
  name,
  productCount,
  parentOptions,
  deleteAction,
  reassignAction
}: {
  name: string;
  productCount: number;
  parentOptions: ParentOption[];
  deleteAction: (formData: FormData) => void;
  reassignAction: (formData: FormData) => void;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);

  return (
    <>
      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (productCount > 0) {
            e.preventDefault();
            setReassignOpen(true);
            return;
          }
          if (!window.confirm(`"${name}" kategorisini silmek istediğinize emin misiniz?`)) {
            e.preventDefault();
          }
        }}
      >
        <button className="rounded-md border border-red-600 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-600 hover:text-white">
          Kategoriyi Sil
        </button>
      </form>

      {reassignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-admin-surface p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-admin-text">Ürünleri taşı ve sil</h3>
            <p className="mt-1 text-sm text-admin-text-muted">
              Bu kategoriye bağlı {productCount} ürün var. Silmeden önce bu ürünleri başka bir kategoriye taşıyın.
            </p>
            <form action={reassignAction} className="mt-4 space-y-3">
              <select name="targetCategoryId" defaultValue="" className={inputClass}>
                <option value="">Kategorisiz bırak</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setReassignOpen(false)}>
                  Vazgeç
                </Button>
                <Button type="submit" variant="danger" size="sm">
                  Ürünleri taşı ve sil
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
