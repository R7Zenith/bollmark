import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage, catalogMetadata } from "@/components/catalog-page";
import { decodePathSegment, genderFromSlug } from "@/lib/catalog-url";
import { prisma } from "@/lib/prisma";

// Cinsiyet + kategori: /erkek/gomlek. Bilinmeyen cinsiyet ya da aktif
// olmayan kategori 404.
type Props = {
  params: Promise<{ cinsiyet: string; kategori: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolveScope(params: Props["params"]) {
  const { cinsiyet: rawGender, kategori: rawCategory } = await params;
  const cinsiyet = genderFromSlug(decodePathSegment(rawGender));
  const kategori = decodePathSegment(rawCategory);
  if (!cinsiyet) return null;
  const category = await prisma.category.findUnique({ where: { slug: kategori, isActive: true }, select: { id: true } });
  return category ? { cinsiyet, kategori } : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const scope = await resolveScope(params);
  if (!scope) return {};
  return catalogMetadata(await searchParams, scope);
}

export default async function GenderCategoryCatalogPage({ params, searchParams }: Props) {
  const scope = await resolveScope(params);
  if (!scope) notFound();
  return <CatalogPage query={await searchParams} scope={scope} />;
}
