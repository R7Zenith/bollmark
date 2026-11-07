import { emailImageUrl } from "./layout";

// Siparis kalemi / stok bildirimi icin urun ve varyant bilgisini e-postaya cevirir.

export type EmailVariant = {
  options: { valueId: string; value: { value: string; attribute: { isColor: boolean } } }[];
};

export type EmailProductImages = {
  images: { url: string }[];
  optionImages: { url: string; valueId: string; isCover: boolean }[];
};

// Prisma include/select'leri: siparis, iade ve stok bildirimi ayni veriyi okur.
export const emailVariantSelect = {
  options: { select: { valueId: true, value: { select: { value: true, attribute: { select: { isColor: true } } } } } }
} as const;

export const emailProductImagesSelect = {
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
  optionImages: { orderBy: { position: "asc" }, select: { url: true, valueId: true, isCover: true } }
} as const;

// "Bej · M" - renk once, sonra diger ozellikler.
export function variantValues(variant: EmailVariant | null | undefined): string {
  if (!variant) return "";
  return [...variant.options]
    .sort((a, b) => Number(b.value.attribute.isColor) - Number(a.value.attribute.isColor))
    .map((o) => o.value.value)
    .join(" · ");
}

// Varyantin rengine ait galerinin vitrin gorseli (lib/catalog.ts pickCoverImage
// ile ayni kural; o dosya prisma yukledigi icin buradan import edilmez), yoksa
// urunun ilk gorseli.
export function variantImageUrl(product: EmailProductImages, variant: EmailVariant | null | undefined): string | null {
  const colorId = variant?.options.find((o) => o.value.attribute.isColor)?.valueId;
  const gallery = colorId ? product.optionImages.filter((img) => img.valueId === colorId) : [];
  const colorImage = gallery.find((img) => img.isCover) ?? gallery[0] ?? null;
  return emailImageUrl(colorImage?.url ?? product.images[0]?.url ?? product.optionImages[0]?.url ?? null);
}
