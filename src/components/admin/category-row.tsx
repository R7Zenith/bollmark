"use client";

import { useState } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2, GripVertical, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/admin/badge";
import { Button } from "@/components/admin/button";

export type ParentOption = { id: string; label: string };

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function CategoryRow({
  id,
  name,
  depth,
  productCount,
  imageUrl,
  sizeGuide,
  isActive,
  parentOptions,
  deleteAction,
  reassignAction,
  draggable,
  selected,
  onToggleSelect
}: {
  id: string;
  name: string;
  depth: number;
  productCount: number;
  parentId: string | null;
  sizeGuide: string | null;
  imageUrl: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  parentOptions: ParentOption[];
  deleteAction: (formData: FormData) => void;
  reassignAction: (formData: FormData) => void;
  draggable: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !draggable
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between px-4 py-3 text-sm text-admin-text ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3">
        {draggable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab rounded-md p-1 text-admin-text-muted hover:bg-admin-bg active:cursor-grabbing"
            title="Sürükleyerek sırala"
          >
            <GripVertical size={15} />
          </button>
        )}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(id)}
          className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
        />
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-8 w-8 shrink-0 rounded border border-admin-border object-cover" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-dashed border-admin-border text-admin-text-muted">
            <ImageIcon size={13} />
          </div>
        )}
        <span style={{ paddingLeft: `${depth * 1.25}rem` }}>{name}</span>
        {productCount > 0 ? (
          <Link href={`/admin/urunler?kategori=${id}`}>
            <Badge tone="gray">{productCount} ürün</Badge>
          </Link>
        ) : (
          <Badge tone="gray">{productCount} ürün</Badge>
        )}
        {sizeGuide && <Badge tone="blue">Beden tablosu var</Badge>}
        {!isActive && <Badge tone="gray-muted">Pasif</Badge>}
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={`/admin/kategoriler/${id}`}
          className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
          title="Düzenle"
        >
          <Pencil size={15} />
        </Link>
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
          <button
            type="submit"
            className="rounded-md p-1.5 text-admin-text-muted hover:bg-red-50 hover:text-red-600"
            title="Sil"
          >
            <Trash2 size={15} />
          </button>
        </form>
      </div>

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
    </li>
  );
}
