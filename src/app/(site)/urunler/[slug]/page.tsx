import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, firstImageUrl, isNewProduct } from "@/lib/catalog";
import { getBundleForProduct } from "@/lib/bundles";
import { prisma } from "@/lib/prisma";
import { getActiveAutomaticPercentCampaigns, resolveProductDisplayPrice } from "@/lib/coupons";
import { ProductViewer } from "@/components/product-viewer";
import { ProductCard } from "@/components/product-card";
import { optionValue, optionPosition, colorValueId } from "@/lib/variant-attributes";
import { sanitizeDescriptionHtml, descriptionToPlainText } from "@/lib/description-html";

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

  const image = firstImageUrl(product) ?? FALLBACK_IMAGE;
  const plainDescription = descriptionToPlainText(product.description);
  return {
    title: `${product.name} | Bollmark`,
    description: plainDescription,
    alternates: { canonical: `${BASE_URL}/urunler/${product.slug}` },
    openGraph: {
      title: product.name,
      description: plainDescription,
      url: `${BASE_URL}/urunler/${product.slug}`,
      images: [{ url: image }]
    }
  };
}

export default async function ProductPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ renk?: string }>;
}) {
  const { slug: rawSlug } = await params;
  const { renk } = await searchParams;
  const product = await getProductBySlug(decodeSlug(rawSlug));
  if (!product || product.status !== "PUBLISHED") notFound();

  const colorGalleries: Record<string, string[]> = {};
  for (const img of product.optionImages) {
    (colorGalleries[img.valueId] ??= []).push(img.url);
  }

  const relatedProducts = await getRelatedProducts(product);
  const bundleInfo = await getBundleForProduct(product.id);
  const automaticCampaigns = await getActiveAutomaticPercentCampaigns(prisma);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: descriptionToPlainText(product.description),
    image: firstImageUrl(product) ?? FALLBACK_IMAGE,
    offers: {
      "@type": "Offer",
      priceCurrency: "TRY",
      price: (product.priceCents / 100).toFixed(2),
      availability: product.variants.some((v) => v.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${BASE_URL}/urunler/${product.slug}`
    }
  };

  return (
    // Release'de urun sayfasinin da max-width'i yok - galeri/bilgi orani
    // 1595px'lik bir konteynerde olculdu (bkz.
    // RELEASE_TEMA_BIREBIR_UYUM_PLANI.md 3), yani konteyner neredeyse tam
    // viewport. Katalog ve header ile ayni yan bosluk kullaniliyor.
    // Ust bosluk mobilde header ile breadcrumb arasinda gereksiz buyuk bir
    // bosluk birakiyordu, py-4'e dusuruldu (alt bosluk da mobilde ayni
    // deger). Masaustunde ise header zaten fixed oldugu icin
    // site-header.tsx'teki ayri bir spacer div (72px) sayfa akisinda zaten
    // yer aciyor, eski py-16'nin ustteki 64px'i bunun UZERINE ekleniyordu
    // (bkz. URUN_DETAY_HEADER_BOSLUGU_VE_ROZET_PLANI.md) - ust bosluk
    // md:pt-6'ya dusuruldu, alt bosluk (md:pb-16) degismedi.
    <div className="w-full px-4 py-4 md:px-6 md:pt-6 md:pb-16 xl:px-9">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <ProductViewer
        productId={product.id}
        productName={product.name}
        categoryName={product.category?.name ?? null}
        brandName={product.brand?.name ?? null}
        breadcrumb={[
          { label: "Anasayfa", href: "/" },
          ...(product.gender ? [{ label: product.gender, href: `/urunler?cinsiyet=${encodeURIComponent(product.gender)}` }] : []),
          ...(product.category
            ? [
                {
                  label: product.category.name,
                  href: `/urunler?kategori=${encodeURIComponent(product.category.slug)}${product.gender ? `&cinsiyet=${encodeURIComponent(product.gender)}` : ""}`
                }
              ]
            : [])
        ]}
        descriptionHtml={sanitizeDescriptionHtml(product.description)}
        material={product.material}
        origin={product.origin}
        careInstructions={product.careInstructions}
        sizeGuide={product.category?.sizeGuide ?? null}
        priceCents={product.priceCents}
        compareAtCents={product.compareAtCents}
        categoryId={product.categoryId}
        brandId={product.brandId}
        fallbackImages={product.images.map((img) => ({ url: img.url, alt: img.alt || product.name }))}
        colorGalleries={colorGalleries}
        initialColor={renk}
        variants={product.variants.map((v) => ({
          id: v.id,
          size: optionValue(v, "Beden"),
          sizePosition: optionPosition(v, "Beden"),
          color: optionValue(v, "Renk"),
          colorPosition: optionPosition(v, "Renk"),
          colorValueId: colorValueId(v),
          stock: v.stock,
          priceCents: v.priceCents
        }))}
        bundleInfo={bundleInfo}
        automaticCampaigns={automaticCampaigns}
        isNew={isNewProduct(product.createdAt)}
      />

      {relatedProducts.length > 0 && (
        <div className="mt-20 border-t border-line pt-12">
          <h2 className="font-display text-2xl">Bunlar da hoşunuza gidebilir</h2>
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
                  image: firstImageUrl(p) ?? "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800",
                  priceResolution: resolveProductDisplayPrice(automaticCampaigns, p),
                  quickAddVariant: p.quickAddVariant
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
