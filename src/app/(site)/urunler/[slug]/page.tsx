import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { getProductReviewSummary } from "@/lib/reviews";
import { getBundleForProduct } from "@/lib/bundles";
import { ProductViewer } from "@/components/product-viewer";
import { ProductReviews, type ReviewView } from "@/components/product-reviews";
import { ProductCard } from "@/components/product-card";
import { optionValue, colorValueId } from "@/lib/variant-attributes";

const BASE_URL = "https://bollmark.com";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200";

// Bu Next.js sürümünde dinamik rota segmentleri (params.slug), tarayıcının
// gönderdiği %XX kaçış dizileriyle olduğu gibi geliyor - standart Next.js'in
// aksine otomatik çözülmüyor. Türkçe karakterli slug'lar (ı, ğ, ü, ş, ö, ç)
// bu yüzden veritabanında bulunamıyordu (notFound()'a düşüyordu) - burada
// elle çözüyoruz.
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const product = await getProductBySlug(decodeSlug(rawSlug));
  if (!product || product.status !== "PUBLISHED") return {};

  const image = product.images[0]?.url ?? FALLBACK_IMAGE;
  return {
    title: `${product.name} | Bollmark`,
    description: product.description,
    alternates: { canonical: `${BASE_URL}/urunler/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.description,
      url: `${BASE_URL}/urunler/${product.slug}`,
      images: [{ url: image }]
    }
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const product = await getProductBySlug(decodeSlug(rawSlug));
  if (!product || product.status !== "PUBLISHED") notFound();

  const colorGalleries: Record<string, string[]> = {};
  for (const img of product.optionImages) {
    (colorGalleries[img.valueId] ??= []).push(img.url);
  }

  const relatedProducts = await getRelatedProducts(product);
  const bundleInfo = await getBundleForProduct(product.id);
  const { avgRating, count, reviews } = await getProductReviewSummary(product.id);
  const reviewViews: ReviewView[] = reviews.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    rating: r.rating,
    comment: r.comment,
    imageUrls: r.imageUrls ? r.imageUrls.split("\n").filter(Boolean) : [],
    createdAtLabel: r.createdAt.toLocaleDateString("tr-TR")
  }));

  // Boş/sıfır rating göstermek yanıltıcı olur - yorum yoksa aggregateRating
  // alanı hiç eklenmez.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images[0]?.url ?? FALLBACK_IMAGE,
    offers: {
      "@type": "Offer",
      priceCurrency: "TRY",
      price: (product.priceCents / 100).toFixed(2),
      availability: product.variants.some((v) => v.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${BASE_URL}/urunler/${product.slug}`
    },
    ...(count > 0 && avgRating != null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: avgRating.toFixed(1), reviewCount: count } }
      : {})
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
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
        bundleInfo={bundleInfo}
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
