"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SearchInput } from "@/components/admin/search-input";
import { CategoryRow, type ParentOption } from "@/components/admin/category-row";
import { BulkActionBar, type BulkAction } from "@/components/admin/bulk-action-bar";
import { useToast } from "@/components/admin/toast";

export type CategoryRowData = {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  sizeGuide: string | null;
  imageUrl: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  productCount: number;
  parentOptions: ParentOption[];
  deleteAction: (formData: FormData) => void;
  reassignAction: (formData: FormData) => void;
};

async function bulkRequest(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/kategoriler/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data?.error as string | undefined, deleted: data?.deleted as number | undefined, skipped: data?.skipped as number | undefined };
}

// Kategori listesini yonetir: arama (ata baglami korunarak filtreleme), ayni
// ust kategori altindaki kardesler arasinda surukle-birak siralama ve coklu
// secimle toplu aktif/pasif/sil islemleri.
export function CategoryManager({ items }: { items: CategoryRowData[] }) {
  const [rows, setRows] = useState(items);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const visibleIds = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return null;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const matched = rows.filter((r) => r.name.toLocaleLowerCase("tr").includes(q));
    const visible = new Set<string>();
    for (const match of matched) {
      let current: CategoryRowData | undefined = match;
      while (current) {
        visible.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    }
    return visible;
  }, [rows, query]);

  const draggable = visibleIds === null;
  const displayRows = visibleIds ? rows.filter((r) => visibleIds.has(r.id)) : rows;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const clearSelection = () => setSelected(new Set());

  async function handleSetActive(ids: string[], isActive: boolean) {
    const { ok, error } = await bulkRequest({ ids, action: isActive ? "SET_ACTIVE" : "SET_INACTIVE" });
    if (ok) {
      showToast(isActive ? "Kategoriler aktif yapıldı." : "Kategoriler pasif yapıldı.", "success");
      clearSelection();
      router.refresh();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  async function handleDelete(ids: string[]) {
    if (!window.confirm(`${ids.length} kategoriyi silmek istediğinize emin misiniz?`)) return;
    const { ok, error, deleted, skipped } = await bulkRequest({ ids, action: "DELETE" });
    if (ok) {
      if (skipped) {
        showToast(`${deleted ?? 0} kategori silindi, ${skipped} kategori ürün/alt kategori içerdiği için atlandı.`, "success");
      } else {
        showToast(`${deleted ?? 0} kategori silindi.`, "success");
      }
      clearSelection();
      router.refresh();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  const bulkActions: BulkAction[] = [
    { label: "Aktif Yap", variant: "secondary", onClick: () => handleSetActive(Array.from(selected), true) },
    { label: "Pasif Yap", variant: "secondary", onClick: () => handleSetActive(Array.from(selected), false) },
    { label: "Sil", variant: "danger", onClick: () => handleDelete(Array.from(selected)) }
  ];

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeRow = rows.find((r) => r.id === active.id);
    const overRow = rows.find((r) => r.id === over.id);
    if (!activeRow || !overRow) return;
    if (activeRow.parentId !== overRow.parentId) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(rows, oldIndex, newIndex);
    const previous = rows;
    setRows(reordered);

    const siblingIds = reordered.filter((r) => r.parentId === activeRow.parentId).map((r) => r.id);
    try {
      const res = await fetch("/api/admin/kategoriler/sirala", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: siblingIds })
      });
      if (!res.ok) throw new Error();
    } catch {
      setRows(previous);
      showToast("Sıralama kaydedilemedi.", "error");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <SearchInput
          placeholder="Kategori ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {selected.size > 0 && (
        <div className="mb-4">
          <BulkActionBar count={selected.size} actions={bulkActions} />
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
            {displayRows.map((row) => (
              <CategoryRow
                key={row.id}
                {...row}
                draggable={draggable}
                selected={selected.has(row.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
            {displayRows.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-admin-text-muted">
                {query ? "Eşleşen kategori bulunamadı." : "Henüz kategori yok."}
              </li>
            )}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
