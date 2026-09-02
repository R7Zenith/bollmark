"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ImageField } from "@/components/admin/image-field";
import { Button } from "@/components/admin/button";

export type ImageEntry = { url: string; alt?: string };

// Birden cok gorselden olusan bir listeyi yonetir: her satirda ImageField,
// yukari/asagi siralama, silme, "Gorsel Ekle" butonu.
export function MultiImageField({
  images,
  onChange,
  addLabel = "Görsel Ekle",
  uploadEndpoint
}: {
  images: ImageEntry[];
  onChange: (next: ImageEntry[]) => void;
  addLabel?: string;
  uploadEndpoint?: string;
}) {
  function updateAt(index: number, url: string) {
    onChange(images.map((img, i) => (i === index ? { ...img, url } : img)));
  }

  function updateAltAt(index: number, alt: string) {
    onChange(images.map((img, i) => (i === index ? { ...img, alt } : img)));
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    onChange([...images, { url: "", alt: "" }]);
  }

  return (
    <div className="space-y-2">
      {images.map((img, i) => (
        <div key={i} className="flex items-center gap-2 rounded border border-admin-border bg-admin-surface p-2">
          <ImageField
            value={img.url}
            onChange={(url) => updateAt(i, url)}
            altValue={img.alt ?? ""}
            onAltChange={(alt) => updateAltAt(i, alt)}
            uploadEndpoint={uploadEndpoint}
          />
          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="text-admin-text-muted hover:text-admin-accent disabled:opacity-30"
              aria-label="Yukarı taşı"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === images.length - 1}
              className="text-admin-text-muted hover:text-admin-accent disabled:opacity-30"
              aria-label="Aşağı taşı"
            >
              <ArrowDown size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="shrink-0 text-red-600 hover:text-red-700"
            aria-label="Görseli sil"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus size={14} /> {addLabel}
      </Button>
    </div>
  );
}
