import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { variantOptionsInclude } from "@/lib/variant-attributes";

// Genel urun gorseli (Product.images) yoksa - Excel/Koton aktariminda oldugu
// gibi sadece renk bazli galeri (ProductOptionImage) doldurulmus olabilir -
// oraya duser. Katalog/kart gorunumlerinde tek, temsili bir fotograf yeterli.
export function firstImageUrl(product: { images: { url: string }[]; optionImages: { url: string }[] }): string | null {
  return product.images[0]?.url ?? product.optionImages[0]?.url ?? null;
}

export function isOutOfStock(variants: { stock: number }[]): boolean {
  return variants.length > 0 && variants.every((v) => v.stock <= 0);
}

export async function getPublishedProducts(
  categorySlug?: string,
  options?: { featuredFirst?: boolean; genderLabel?: string }
) {
  return prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      // slug ile birebir eslesen kategori VEYA o kategoriyi parent olarak
      // gosteren bir alt kategori (Aksesuar gibi ust seviye kategorilerin
      // kendisine hic urun baglanmiyor, hepsi alt kategorilerde duruyor -
      // aksi halde "Aksesuar" filtresi hep 0 sonuc donerdi).
      category: categorySlug
        ? { isActive: true, OR: [{ slug: categorySlug }, { parent: { slug: categorySlug } }] }
        : undefined,
      gender: options?.genderLabel ? options.genderLabel : undefined
    },
    include: {
      images: { orderBy: { position: "asc" } },
      optionImages: { orderBy: { position: "asc" }, take: 1 },
      variants: { select: { stock: true } }
    },
    orderBy: options?.featuredFirst
      ? [{ isFeatured: "desc" }, { createdAt: "desc" }]
      : { createdAt: "desc" }
  });
}

// React.cache ile sarmalanir - ayni istek icinde hem generateMetadata hem
// sayfa bileseni cagirdiginda ayni sorgu iki kez calismaz (Next.js'in
// generateMetadata + sayfa arasinda veri paylasimi icin onerdigi desen).
export const getProductBySlug = cache(async (slug: string) => {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { include: variantOptionsInclude },
      optionImages: { include: { value: true }, orderBy: { position: "asc" } },
      category: true,
      brand: true
    }
  });
});

// Katalog gorunumu icin tek bir "giris" - birden fazla rengi olan bir urun
// burada rengi kadar ayri giris olarak doner (her biri kendi renk galerisinin
// ilk fotografiyla), tek rengi/varyantsiz urunler tek giris olarak kalir.
// Hepsi ayni urun sayfasina baglanir - renkli olanlar ?renk=<etiket> ile,
// sayfa acilinca ProductViewer o rengi onceden secili gosterir (bkz.
// urunler/[slug]/page.tsx + product-viewer.tsx).
export type CatalogEntry = {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  compareAtCents: number | null;
  image: string | null;
  colorLabel: string | null; // yalnizca birden fazla rengi olan urunlerde dolu
  categoryId: string | null;
  brandId: string | null;
  outOfStock: boolean;
};

export async function getCatalogEntries(
  categorySlug?: string,
  options?: { featuredFirst?: boolean; genderLabel?: string }
): Promise<CatalogEntry[]> {
  const products = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      // slug ile birebir eslesen kategori VEYA o kategoriyi parent olarak
      // gosteren bir alt kategori (Aksesuar gibi ust seviye kategorilerin
      // kendisine hic urun baglanmiyor, hepsi alt kategorilerde duruyor -
      // aksi halde "Aksesuar" filtresi hep 0 sonuc donerdi).
      category: categorySlug
        ? { isActive: true, OR: [{ slug: categorySlug }, { parent: { slug: categorySlug } }] }
        : undefined,
      gender: options?.genderLabel ? options.genderLabel : undefined
    },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      optionImages: { orderBy: { position: "asc" } },
      variants: { include: variantOptionsInclude }
    },
    orderBy: options?.featuredFirst
      ? [{ isFeatured: "desc" }, { createdAt: "desc" }]
      : { createdAt: "desc" }
  });

  const entries: CatalogEntry[] = [];
  for (const p of products) {
    // Urunun varyantlarinda gercekten var olan renkler (Renk ekseni, isColor:true).
    const colorLabelByValueId = new Map<string, string>();
    for (const v of p.variants) {
      for (const o of v.options) {
        if (o.value.attribute.isColor) colorLabelByValueId.set(o.valueId, o.value.value);
      }
    }

    if (colorLabelByValueId.size <= 1) {
      entries.push({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents,
        image: p.images[0]?.url ?? p.optionImages[0]?.url ?? null,
        colorLabel: null,
        categoryId: p.categoryId,
        brandId: p.brandId,
        outOfStock: isOutOfStock(p.variants)
      });
      continue;
    }

    for (const [valueId, label] of colorLabelByValueId) {
      const colorImage = p.optionImages.find((img) => img.valueId === valueId)?.url;
      const colorVariants = p.variants.filter((v) => v.options.some((o) => o.valueId === valueId));
      entries.push({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents,
        image: colorImage ?? p.images[0]?.url ?? null,
        colorLabel: label,
        categoryId: p.categoryId,
        brandId: p.brandId,
        outOfStock: isOutOfStock(colorVariants)
      });
    }
  }
  return entries;
}

export async function getCategories() {
  return prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

// Urun sayfasindaki "Benzer Urunler" bolumu icin - v1'de otomatik kategori
// bazli oneri yeterli tutuluyor (elle eslestirme ayri, daha sonraki bir is).
export async function getRelatedProducts(product: { id: string; categoryId: string | null }) {
  if (!product.categoryId) return [];
  return prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
      status: "PUBLISHED"
    },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      optionImages: { orderBy: { position: "asc" }, take: 1 }
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 4
  });
}
