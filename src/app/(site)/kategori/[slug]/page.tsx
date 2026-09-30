import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage, catalogMetadata } from "@/components/catalog-page";
import { decodePathSegment } from "@/lib/catalog-url";
import { prisma } from "@/lib/prisma";

// Cinsiyetsiz kategori: /kategori/ayakkabi. Aktif olmayan kategori 404.
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolveScope(params: Props["params"]) {
  const kategori = decodePathSegment((await params).slug);
  const category = await prisma.category.findUnique({ where: { slug: kategori, isActive: true }, select: { id: true } });
  return category ? { kategori } : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const scope = await resolveScope(params);
  if (!scope) return {};
  return catalogMetadata(await searchParams, scope);
}

export default async function CategoryCatalogPage({ params, searchParams }: Props) {
  const scope = await resolveScope(params);
  if (!scope) notFound();
  return <CatalogPage query={await searchParams} scope={scope} />;
}
