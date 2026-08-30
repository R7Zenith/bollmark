"use client";

import { useState } from "react";
import { MultiImageField, type ImageEntry } from "@/components/admin/multi-image-field";

// Urun genel gorselleri karti - MultiImageField'i sarmalayip, server action
// tarafinda degisiklik gerektirmemesi icin ayni `images` formatinda (her
// satira bir URL) gizli bir input'a yaziyor.
export function ProductImagesField({ name, initialImages }: { name: string; initialImages: string[] }) {
  const [images, setImages] = useState<ImageEntry[]>(initialImages.map((url) => ({ url })));

  const value = images
    .map((i) => i.url.trim())
    .filter(Boolean)
    .join("\n");

  return (
    <div>
      <MultiImageField images={images} onChange={setImages} addLabel="Görsel Ekle" />
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
