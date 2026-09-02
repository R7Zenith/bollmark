import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { variantOptionsInclude } from "@/lib/variant-attributes";

export async function getPublishedProducts(
  categorySlug?: string,
  options?: { featuredFirst?: boolean }
) {
  return prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      category: categorySlug ? { slug: categorySlug } : undefined
    },
    include: { images: { orderBy: { position: "asc" } } },
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

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
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
    include: { images: { orderBy: { position: "asc" }, take: 1 } },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 4
  });
}
