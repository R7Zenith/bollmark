import type { Metadata } from "next";
import { productMetadata, renderProductPage } from "./product-page";

// ISR: sayfa ilk ziyarette uretilir, sonra onbellekten sunulur. Urun/stok/
// kampanya yazan yerler revalidateCatalog() ile aninda tazeler; 1 saat yalnizca
// emniyet agi (bkz. CPU_KULLANIMI_AZALTMA_PLANI.md).
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderProductPage(slug);
}
