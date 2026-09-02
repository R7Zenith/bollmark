import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { getProductReviewSummary } from "@/lib/reviews";
import { ProductViewer } from "@/components/product-viewer";
import { ProductReviews, type ReviewView } from "@/components/product-reviews";
import { ProductCard } from "@/components/product-card";
import { optionValue, colorValueId } from "@/lib/variant-attributes";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.status !== "PUBLISHED") notFound();

  const colorGalleries: Record<string, string[]> = {};
  for (const img of product.optionImages) {
    (colorGalleries[img.valueId] ??= []).push(img.url);
  }

  const relatedProducts = await getRelatedProducts(product);
  const { avgRating, count, reviews } = await getProductReviewSummary(product.id);
  const reviewViews: ReviewView[] = reviews.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    rating: r.rating,
    comment: r.comment,
    imageUrls: r.imageUrls ? r.imageUrls.split("\n").filter(Boolean) : [],
    createdAtLabel: r.createdAt.toLocaleDateString("tr-TR")
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <ProductViewer
        productId={product.id}
        productName={product.name}
        categoryName={product.category?.name ?? null}
        brandName={product.brand?.name ?? null}
        description={product.description}
        material={product.material}
        origin={product.origin}
        careInstructions={product.careInstructions}
        sizeGuide={product.category?.sizeGuide ?? null}
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
      <ProductReviews productId={product.id} avgRating={avgRating} count={count} reviews={reviewViews} />

      {relatedProducts.length > 0 && (
        <div className="mt-20 border-t border-line pt-12">
          <h2 className="font-display text-2xl">Benzer Ürünler</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
            {relatedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={{
                  productId: p.id,
                  slug: p.slug,
                  name: p.name,
                  priceCents: p.priceCents,
                  compareAtCents: p.compareAtCents,
                  image: p.images[0]?.url ?? "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800"
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
