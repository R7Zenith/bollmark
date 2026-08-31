"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { SearchableMultiSelect } from "@/components/admin/searchable-multi-select";

export type TagOption = { id: string; name: string };

// Urune etiket atamak icin: mevcut Tag listesinden ara-sec (SearchableMultiSelect)
// + yeni bir etiket lazimsa "Yeni Etiket Ekle" ile /api/admin/etiketler'e POST
// atip listeye ekleyip otomatik secen kucuk bir form.
export function TagsField({
  fieldName,
  allTags,
  initialSelectedIds
}: {
  fieldName: string;
  allTags: TagOption[];
  initialSelectedIds: string[];
}) {
  const [tags, setTags] = useState<TagOption[]>(allTags);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const [newTagName, setNewTagName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addTag() {
    const name = newTagName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/etiketler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Etiket eklenemedi.");
        return;
      }
      const tag: TagOption = data.tag;
      setTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
      setSelectedIds((prev) => new Set(prev).add(tag.id));
      setNewTagName("");
    } catch {
      setError("Etiket eklenemedi.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-2">
      <SearchableMultiSelect
        options={tags.map((t) => ({ id: t.id, value: t.name }))}
        selectedIds={selectedIds}
        onToggle={toggle}
        placeholder="Etiket ara veya seç..."
      />
      <div className="flex items-center gap-2">
        <input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Yeni etiket adı"
          className="flex-1 rounded border border-admin-border px-2 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={adding || !newTagName.trim()}
          className="flex items-center gap-1 rounded-md border border-admin-border px-3 py-1.5 text-xs font-medium text-admin-text hover:bg-admin-bg disabled:opacity-50"
        >
          {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Ekle
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input type="hidden" name={fieldName} value={JSON.stringify(Array.from(selectedIds))} />
    </div>
  );
}
