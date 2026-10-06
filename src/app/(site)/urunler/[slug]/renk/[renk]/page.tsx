import type { Metadata } from "next";
import { decodeSlug, productMetadata, renderProductPage } from "../../product-page";

// Ic rota: proxy.ts /urunler/<slug>?renk=X istegini buraya rewrite eder (adres
// cubugu degismez), boylece her renk kendi onbellekli sayfasina sahip olur.
// Canonical renksiz /urunler/<slug> olarak kalir; sitemap'e/linklere eklenmez.
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ slug: string; renk: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug);
}

export default async function ProductColorPage({ params }: { params: Params }) {
  const { slug, renk } = await params;
  return renderProductPage(slug, decodeSlug(renk));
}
