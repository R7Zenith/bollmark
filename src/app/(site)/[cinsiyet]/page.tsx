import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage, catalogMetadata } from "@/components/catalog-page";
import { decodePathSegment, genderFromSlug } from "@/lib/catalog-url";

// Cinsiyet koleksiyonu: /kadin, /erkek, /unisex, /cocuk. Yalniz bilinen
// cinsiyet slug'lari kabul edilir; statik rotalar (hesap, sepet, ...) Next.js'te
// bu dinamik rotadan once eslesir.
type Props = {
  params: Promise<{ cinsiyet: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const cinsiyet = genderFromSlug(decodePathSegment((await params).cinsiyet));
  if (!cinsiyet) return {};
  return catalogMetadata(await searchParams, { cinsiyet });
}

export default async function GenderCatalogPage({ params, searchParams }: Props) {
  const cinsiyet = genderFromSlug(decodePathSegment((await params).cinsiyet));
  if (!cinsiyet) notFound();
  return <CatalogPage query={await searchParams} scope={{ cinsiyet }} />;
}
