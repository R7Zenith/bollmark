"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { Badge } from "@/components/admin/badge";

export function CategoryRow({
  name,
  productCount,
  updateAction,
  deleteAction
}: {
  name: string;
  productCount: number;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="flex items-center gap-2 px-4 py-3">
        <form action={updateAction} className="flex flex-1 items-center gap-2">
          <input
            name="name"
            defaultValue={name}
            required
            autoFocus
            className="flex-1 rounded-md border border-admin-border px-3 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <button type="submit" className="rounded-md p-1.5 text-green-600 hover:bg-green-50" title="Kaydet">
            <Check size={16} />
          </button>
        </form>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
          title="Vazgeç"
        >
          <X size={16} />
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between px-4 py-3 text-sm text-admin-text">
      <div className="flex items-center gap-3">
        <span>{name}</span>
        <Badge tone="gray">{productCount} ürün</Badge>
      </div>
      <div className="flex items-center gap-1">
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
            if (productCount > 0) {
              e.preventDefault();
              window.alert(
                `Bu kategoriye bağlı ${productCount} ürün var. Önce bu ürünleri başka bir kategoriye taşıyın veya kategorisiz bırakın.`
              );
              return;
            }
            if (!window.confirm(`"${name}" kategorisini silmek istediğinize emin misiniz?`)) {
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
