import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { optionValue, variantOptionsInclude, type VariantOptionInclude } from "@/lib/variant-attributes";

// Katalog/kart gorunumunde "+" hizli sepete ekle butonu icin - stokta olan
// ilk varyanti (ilk beden, secili renk grubu icinde) doner. Stokta hicbir
// varyant yoksa null - kart zaten "Stokta Yok" gosterdigi icin buton
// gizlenir/devre disi kalir (bkz. product-card.tsx).
export type QuickAddVariant = { variantId: string; size: string; color: string } | null;

function pickQuickAddVariant(
  variants: (VariantOptionInclude & { id: string; stock: number })[]
): QuickAddVariant {
  const inStock = variants.find((v) => v.stock > 0);
  if (!inStock) return null;
  return {
    variantId: inStock.id,
    size: optionValue(inStock, "Beden"),
    color: optionValue(inStock, "Renk")
  };
}

// Genel urun gorseli (Product.images) yoksa - Excel/Koton aktariminda oldugu
// gibi sadece renk bazli galeri (ProductOptionImage) doldurulmus olabilir -
// oraya duser. Katalog/kart gorunumlerinde tek, temsili bir fotograf yeterli.
export function firstImageUrl(product: { images: { url: string }[]; optionImages: { url: string }[] }): string | null {
  return product.images[0]?.url ?? product.optionImages[0]?.url ?? null;
}

export function isOutOfStock(variants: { stock: number }[]): boolean {
  return variants.length > 0 && variants.every((v) => v.stock <= 0);
}

// Katalog kartinda "Son X Adet" rozeti icin esik - toplam stok bu sayinin
// altinda (ve stok tamamen bitmemisse) rozet gosterilir (bkz. product-card.tsx).
const LOW_STOCK_THRESHOLD = 3;

function totalStock(variants: { stock: number }[]): number {
  return variants.reduce((sum, v) => sum + Math.max(v.stock, 0), 0);
}

export async function getPublishedProducts(
  categorySlug?: string,
  options?: { featuredFirst?: boolean; genderLabel?: string }
) {
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
      images: { orderBy: { position: "asc" } },
      optionImages: { orderBy: { position: "asc" }, take: 1 },
      variants: { include: variantOptionsInclude }
    },
    orderBy: options?.featuredFirst
      ? [{ isFeatured: "desc" }, { createdAt: "desc" }]
      : { createdAt: "desc" }
  });

  // Stoğu tamamen bitmiş ürünler, mevcut sıralama korunarak listenin sonuna
  // atılır (Prisma tarafında hesaplanmış bir alan olmadığı için burada,
  // JS'in stabil sort'una güvenilerek yapılıyor).
  return products
    .sort((a, b) => Number(isOutOfStock(a.variants)) - Number(isOutOfStock(b.variants)))
    .map((p) => ({ ...p, quickAddVariant: pickQuickAddVariant(p.variants) }));
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
  // Doluysa toplam stok LOW_STOCK_THRESHOLD altinda (ama stok tamamen bitmemis)
  // - kartta "Son X Adet" rozeti icin (bkz. product-card.tsx).
  lowStockCount: number | null;
  // Doluysa hover'da ana gorselden buna capraz-solma yapilir (bkz.
  // product-card.tsx) - urunun/rengin galerisindeki 2. fotograf.
  secondImage: string | null;
  quickAddVariant: QuickAddVariant;
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
      // take:2 - ilk fotograf kart gorseli, 2.si hover'da capraz-solma icin
      // (bkz. secondImage / product-card.tsx).
      images: { orderBy: { position: "asc" }, take: 2 },
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
      const outOfStock = isOutOfStock(p.variants);
      const stock = totalStock(p.variants);
      entries.push({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents,
        image: p.images[0]?.url ?? p.optionImages[0]?.url ?? null,
        secondImage: p.images[1]?.url ?? p.optionImages[1]?.url ?? null,
        colorLabel: null,
        categoryId: p.categoryId,
        brandId: p.brandId,
        outOfStock,
        lowStockCount: !outOfStock && stock < LOW_STOCK_THRESHOLD ? stock : null,
        quickAddVariant: pickQuickAddVariant(p.variants)
      });
      continue;
    }

    for (const [valueId, label] of colorLabelByValueId) {
      const colorImages = p.optionImages.filter((img) => img.valueId === valueId);
      const colorVariants = p.variants.filter((v) => v.options.some((o) => o.valueId === valueId));
      const outOfStock = isOutOfStock(colorVariants);
      const stock = totalStock(colorVariants);
      entries.push({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents,
        image: colorImages[0]?.url ?? p.images[0]?.url ?? null,
        secondImage: colorImages[1]?.url ?? p.images[1]?.url ?? null,
        colorLabel: label,
        categoryId: p.categoryId,
        brandId: p.brandId,
        outOfStock,
        lowStockCount: !outOfStock && stock < LOW_STOCK_THRESHOLD ? stock : null,
        quickAddVariant: pickQuickAddVariant(colorVariants)
      });
    }
  }
  // Stoğu tamamen bitmiş renk/ürün girişleri, mevcut sıralama korunarak
  // listenin sonuna atılır (bkz. getPublishedProducts'taki ayni yorum).
  return entries.sort((a, b) => Number(a.outOfStock) - Number(b.outOfStock));
}

export async function getCategories() {
  return prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

// Urun sayfasindaki "Benzer Urunler" bolumu icin - v1'de otomatik kategori
// bazli oneri yeterli tutuluyor (elle eslestirme ayri, daha sonraki bir is).
export async function getRelatedProducts(product: { id: string; categoryId: string | null }) {
  if (!product.categoryId) return [];
  const products = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
      status: "PUBLISHED"
    },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      optionImages: { orderBy: { position: "asc" }, take: 1 },
      variants: { include: variantOptionsInclude }
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 4
  });
  return products.map((p) => ({ ...p, quickAddVariant: pickQuickAddVariant(p.variants) }));
}
