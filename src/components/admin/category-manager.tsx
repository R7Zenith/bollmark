"use client";

import { useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SearchInput } from "@/components/admin/search-input";
import { CategoryRow, type ParentOption } from "@/components/admin/category-row";
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
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  reassignAction: (formData: FormData) => void;
};

// Kategori listesini yonetir: arama (ata baglami korunarak filtreleme) ve
// ayni ust kategori altindaki kardesler arasinda surukle-birak siralama.
export function CategoryManager({ items }: { items: CategoryRowData[] }) {
  const [rows, setRows] = useState(items);
  const [query, setQuery] = useState("");
  const { showToast } = useToast();
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
      <div className="mb-4">
        <SearchInput
          placeholder="Kategori ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
            {displayRows.map((row) => (
              <CategoryRow key={row.id} {...row} draggable={draggable} />
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
