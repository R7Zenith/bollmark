import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE_URL = "https://bollmark.com";

// Yeni urun/kategori eklendiginde yeni bir deploy beklemeden sitemap'in
// makul surede guncellenmesi icin - build-time'da tek seferlik uretilip
// donmus kalmasin.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, legalPages] = await Promise.all([
    prisma.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ select: { slug: true } }),
    prisma.legalPage.findMany({ select: { slug: true, updatedAt: true } })
  ]);

  return [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/urunler`, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({
      url: `${BASE_URL}/urunler?kategori=${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7
    })),
    ...products.map((p) => ({
      url: `${BASE_URL}/urunler/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8
    })),
    ...legalPages.map((p) => ({
      url: `${BASE_URL}/sayfa/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.3
    }))
  ];
}
