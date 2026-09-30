import type { Metadata } from "next";
import { CatalogPage, catalogMetadata } from "@/components/catalog-page";

// Tum urunler ve arama (?ara=). Eski ?kategori= / ?cinsiyet= adresleri
// (arama yoksa) proxy.ts'te temiz yollara 301 ile yonlenir.
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return catalogMetadata(await searchParams, {});
}

export default async function ProductsPage({ searchParams }: Props) {
  return <CatalogPage query={await searchParams} scope={{}} />;
}
