import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { catalogHref } from "@/lib/catalog-url";

// Yeni urun/kategori eklendiginde yeni bir deploy beklemeden sitemap'in
// makul surede guncellenmesi icin - build-time'da tek seferlik uretilip
// donmus kalmasin.
export const revalidate = 3600;

// Urun basina gorsel sitemap'e giren en fazla fotograf.
const SITEMAP_IMAGES_PER_PRODUCT = 5;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, legalPages] = await Promise.all([
    prisma.product.findMany({
      where: { status: "PUBLISHED" },
      select: {
        slug: true,
        updatedAt: true,
        gender: true,
        category: { select: { slug: true, isActive: true, parent: { select: { slug: true, isActive: true } } } },
        images: { orderBy: { position: "asc" }, take: SITEMAP_IMAGES_PER_PRODUCT, select: { url: true } },
        optionImages: { orderBy: { position: "asc" }, take: SITEMAP_IMAGES_PER_PRODUCT, select: { url: true } }
      }
    }),
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true } }),
    prisma.legalPage.findMany({ select: { slug: true, updatedAt: true } })
  ]);

  // Katalog sayfalari yalniz yayinda urunu olan kapsamlar icin: cinsiyet,
  // cinsiyet + kategori ve cinsiyetsiz kategori (ust kategori alt
  // kategorilerinin urunlerini de kapsar - katalog filtresiyle ayni kural).
  const catalogPaths = new Set<string>();
  for (const p of products) {
    if (p.gender) catalogPaths.add(catalogHref({ gender: p.gender }));
    if (!p.category?.isActive) continue;
    catalogPaths.add(catalogHref({ category: p.category.slug }));
    if (p.category.parent?.isActive) catalogPaths.add(catalogHref({ category: p.category.parent.slug }));
    if (p.gender) catalogPaths.add(catalogHref({ gender: p.gender, category: p.category.slug }));
  }
  const activeCategoryPaths = new Set(categories.map((c) => catalogHref({ category: c.slug })));

  const BASE_URL = getSiteUrl();
  return [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/urunler`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/iletisim`, changeFrequency: "yearly", priority: 0.4 },
    ...[...catalogPaths]
      .filter((path) => !path.startsWith("/kategori/") || activeCategoryPaths.has(path))
      .map((path) => ({
        url: `${BASE_URL}${path}`,
        changeFrequency: "daily" as const,
        priority: 0.7
      })),
    ...products.map((p) => ({
      url: `${BASE_URL}/urunler/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: [...new Set([...p.images, ...p.optionImages].map((img) => img.url))].slice(0, SITEMAP_IMAGES_PER_PRODUCT)
    })),
    ...legalPages.map((p) => ({
      url: `${BASE_URL}/sayfa/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.3
    }))
  ];
}
