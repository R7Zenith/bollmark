"use client";

import { useState } from "react";
import { MultiImageField, type ImageEntry } from "@/components/admin/multi-image-field";
import { useDirtySignal } from "@/components/admin/use-dirty-signal";

export type InitialProductImage = { url: string; alt: string };

// Urun genel gorselleri karti - MultiImageField'i sarmalayip, url+alt
// ciftlerini JSON olarak gizli bir input'a yaziyor.
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

  const value = JSON.stringify(
    images
      .map((i) => ({ url: i.url.trim(), alt: (i.alt ?? "").trim() }))
      .filter((i) => i.url)
  );
  const dirtyRef = useDirtySignal(value);

  return (
    <div>
      <MultiImageField images={images} onChange={setImages} addLabel="Görsel Ekle" />
      <input ref={dirtyRef} type="hidden" name={name} value={value} />
    </div>
  );
}
