"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { MultiImageField, type ImageEntry } from "@/components/admin/multi-image-field";
import { useDirtySignal } from "@/components/admin/use-dirty-signal";

export type InitialProductImage = { url: string; alt: string };

// Urun genel gorselleri karti - MultiImageField'i sarmalayip, url+alt
// ciftlerini JSON olarak gizli bir input'a yaziyor.
// Kart varsayilan kapali gelir; kapaliyken icerik sadece gorsel olarak gizlenir
// (DOM'da kalir, `inert`), boylece gizli input ve state kaydette korunur.
export function ProductImagesField({
  name,
  initialImages
}: {
  name: string;
  initialImages: InitialProductImage[];
}) {
  const [images, setImages] = useState<ImageEntry[]>(
    initialImages.map((img) => ({ url: img.url, alt: img.alt }))
  );
  const [open, setOpen] = useState(false);
  const contentId = `${name}-ana-gorseller-icerik`;

  const savedImages = images
    .map((i) => ({ url: i.url.trim(), alt: (i.alt ?? "").trim() }))
    .filter((i) => i.url);
  const value = JSON.stringify(savedImages);
  const dirtyRef = useDirtySignal(value);

  return (
    <div className="rounded-lg border border-admin-border bg-admin-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className={`flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition-colors ${
          open ? "border-b border-admin-border" : ""
        }`}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-admin-text">
            Ana Görseller <span className="font-normal text-admin-text-muted">({savedImages.length})</span>
          </span>
          <span className="mt-0.5 block text-xs text-admin-text-muted">
            Renk görselleri renk galerilerine yüklenmeli. Burası sadece renkten bağımsız genel görseller için.
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`mt-0.5 shrink-0 text-admin-text-muted transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        id={contentId}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="p-5">
            <MultiImageField images={images} onChange={setImages} addLabel="Görsel Ekle" />
          </div>
        </div>
      </div>
      <input ref={dirtyRef} type="hidden" name={name} value={value} />
    </div>
  );
}
