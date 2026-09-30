"use client";

import { useState } from "react";
import { ImageField } from "@/components/admin/image-field";
import { GOOGLE_CATEGORIES } from "@/lib/google-categories";

// Kategori olustur/duzenle formlarinda ortak kullanilan gorsel + aciklama +
// SEO + aktif/pasif alanlari. ImageField client bilesen oldugu icin gorsel
// URL'i burada local state'te tutulup gizli input ile form submit'ine dahil
// edilir.
export function CategoryFormFields({
  imageUrl: initialImageUrl,
  description,
  metaTitle,
  metaDescription,
  googleCategoryId,
  isActive,
  inputClassName
}: {
  imageUrl?: string | null;
  description?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  googleCategoryId?: number | null;
  isActive?: boolean;
  inputClassName: string;
}) {
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");

  return (
    <>
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <ImageField value={imageUrl} onChange={setImageUrl} placeholder="https://... (kategori görseli)" />
      <textarea
        name="description"
        defaultValue={description ?? ""}
        rows={2}
        placeholder="Açıklama (opsiyonel, kategori sayfasında gösterilir)"
        className={inputClassName}
      />
      <label className="flex items-center gap-2 text-sm text-admin-text">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={isActive ?? true}
          className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
        />
        Bu kategori mağazada gösterilsin
      </label>
      <details>
        <summary className="cursor-pointer select-none text-sm text-admin-text-muted hover:text-admin-text">
          SEO ayarları
        </summary>
        <div className="mt-2 space-y-2">
          <input
            name="metaTitle"
            defaultValue={metaTitle ?? ""}
            placeholder="SEO başlığı (opsiyonel, boşsa kategori adı kullanılır)"
            className={inputClassName}
          />
          <textarea
            name="metaDescription"
            defaultValue={metaDescription ?? ""}
            rows={2}
            placeholder="SEO açıklaması (opsiyonel, boşsa kategori açıklaması kullanılır)"
            className={inputClassName}
          />
          <label className="block text-sm text-admin-text-muted">
            Google ürün kategorisi (Google Alışveriş feed&apos;i için)
            <select name="googleCategoryId" defaultValue={googleCategoryId ?? ""} className={`mt-1 ${inputClassName}`}>
              <option value="">Üst kategoriden al (yoksa genel: Kıyafet ve Aksesuarlar)</option>
              {GOOGLE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </>
  );
}
