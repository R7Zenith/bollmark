import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/catalog";
import { ProductViewer } from "@/components/product-viewer";
import { optionValue, colorValueId } from "@/lib/variant-attributes";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.status !== "PUBLISHED") notFound();

  const colorGalleries: Record<string, string[]> = {};
  for (const img of product.optionImages) {
    (colorGalleries[img.valueId] ??= []).push(img.url);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <ProductViewer
        productId={product.id}
        productName={product.name}
        categoryName={product.category?.name ?? null}
        description={product.description}
        priceCents={product.priceCents}
        compareAtCents={product.compareAtCents}
        fallbackImages={product.images.map((img) => ({ url: img.url, alt: img.alt || product.name }))}
        colorGalleries={colorGalleries}
        variants={product.variants.map((v) => ({
          id: v.id,
          size: optionValue(v, "Beden"),
          color: optionValue(v, "Renk"),
          colorValueId: colorValueId(v),
          stock: v.stock,
          priceCents: v.priceCents
        }))}
      />
    </div>
  );
}
