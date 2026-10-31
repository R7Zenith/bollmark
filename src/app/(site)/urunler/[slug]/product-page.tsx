import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getProductBySlug, getRelatedProducts, firstImageUrl, isNewProduct } from "@/lib/catalog";
import { catalogEntryToCardData } from "@/lib/home-products";
import { getBundleForProduct } from "@/lib/bundles";
import { prisma } from "@/lib/prisma";
import { getActiveAutomaticPercentCampaigns, resolveProductDisplayPrice } from "@/lib/coupons";
import { ProductViewer } from "@/components/product-viewer";
import { ProductCard } from "@/components/product-card";
import { optionValue, optionPosition, colorValueId } from "@/lib/variant-attributes";
import { sanitizeDescriptionHtml, descriptionToPlainText } from "@/lib/description-html";
import { baseOpenGraph } from "@/lib/site-metadata";
import { breadcrumbJsonLd, buildProductJsonLd, productTitle, truncateDescription } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { catalogHref } from "@/lib/catalog-url";
import { productCategoryPath } from "@/lib/product-redirects";

// Urun sayfasinin ortak govdesi ve metadata'si: hem /urunler/[slug] hem de
// renk secili ic rota (/urunler/[slug]/renk/[renk], proxy.ts ?renk= istegini
// buraya rewrite eder) ayni ciktiyi uretir (bkz. CPU_KULLANIMI_AZALTMA_PLANI.md).

// Bu Next.js sürümünde dinamik rota segmentleri (params.slug), tarayıcının
// gönderdiği %XX kaçış dizileriyle olduğu gibi geliyor - standart Next.js'in
// aksine otomatik çözülmüyor. Türkçe karakterli slug'lar (ı, ğ, ü, ş, ö, ç)
// bu yüzden veritabanında bulunamıyordu (notFound()'a düşüyordu) - burada
// elle çözüyoruz.
export function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function productMetadata(rawSlug: string): Promise<Metadata> {
  const product = await getProductBySlug(decodeSlug(rawSlug));
  if (!product || product.status !== "PUBLISHED") return {};

  // Gorsel yoksa layout'taki varsayilan paylasim gorseli (baseOpenGraph) kalir.
  const image = firstImageUrl(product);
  const title = productTitle(product);
  const description = truncateDescription(descriptionToPlainText(product.description));
  const price = resolveProductDisplayPrice(await getActiveAutomaticPercentCampaigns(prisma), product);
  return {
    title,
    description,
    alternates: { canonical: `/urunler/${product.slug}` },
    openGraph: {
      ...baseOpenGraph,
      title,
      description,
      url: `/urunler/${product.slug}`,
      ...(image && { images: [{ url: image }] })
    },
    other: {
      "product:price:amount": (price.finalPriceCents / 100).toFixed(2),
      "product:price:currency": "TRY",
      "product:availability": product.variants.some((v) => v.stock > 0) ? "in stock" : "out of stock"
    }
  };
}

export async function renderProductPage(rawSlug: string, renk?: string) {
  const slug = decodeSlug(rawSlug);
  const product = await getProductBySlug(slug);
  // Urun yoksa (slug degisti ya da urun silindi) eski adres kaydina bakilir.
  // Arsivlenen urun kategorisine yonlenir, tekrar yayina alininca sayfa geri
  // gelir; hic yayinlanmamis (DRAFT) urun 404 kalir (bkz. lib/product-redirects.ts).
  if (!product) {
    const redirectTo = await prisma.productRedirect.findUnique({ where: { fromSlug: slug }, select: { toPath: true } });
    if (redirectTo) permanentRedirect(redirectTo.toPath);
    notFound();
  }
  if (product.status === "ARCHIVED") permanentRedirect(productCategoryPath(product));
  if (product.status !== "PUBLISHED") notFound();

  const colorGalleries: Record<string, string[]> = {};
  for (const img of product.optionImages) {
    (colorGalleries[img.valueId] ??= []).push(img.url);
  }

  const relatedProducts = await getRelatedProducts(product);
  const bundleInfo = await getBundleForProduct(product.id);
  const automaticCampaigns = await getActiveAutomaticPercentCampaigns(prisma);
  const storeSettings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { defaultShippingCents: true }
  });

  const productJsonLd = buildProductJsonLd(product, automaticCampaigns, storeSettings?.defaultShippingCents ?? 0);

  const breadcrumb = [
    { label: "Anasayfa", href: "/" },
    ...(product.gender ? [{ label: product.gender, href: catalogHref({ gender: product.gender }) }] : []),
    ...(product.category
      ? [{ label: product.category.name, href: catalogHref({ gender: product.gender, category: product.category.slug }) }]
      : [])
  ];

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
    // Kalp Topla seridi icerigi itmez (kalp-vitrin.tsx); serit varken ust
    // bosluga 32px eklenir ki urun bilgisi seridin altinda kalmasin.
    <div className="w-full px-4 py-4 md:px-6 md:pt-6 md:pb-16 xl:px-9 md:[body:has([data-kalp-serit])_&]:pt-14">
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd([...breadcrumb, { label: product.name, href: `/urunler/${product.slug}` }])} />
      <ProductViewer
        productId={product.id}
        productName={product.name}
        productCode={product.code}
        categoryName={product.category?.name ?? null}
        brandName={product.brand?.name ?? null}
        breadcrumb={breadcrumb}
        descriptionHtml={sanitizeDescriptionHtml(product.description)}
        material={product.material}
        origin={product.origin}
        careInstructions={product.careInstructions}
        defaultShippingCents={storeSettings?.defaultShippingCents ?? 0}
        priceCents={product.priceCents}
        compareAtCents={product.compareAtCents}
        categoryId={product.categoryId}
        brandId={product.brandId}
        gender={product.gender}
        fallbackImages={product.images.map((img) => ({ url: img.url, alt: img.alt || product.name }))}
        colorGalleries={colorGalleries}
        initialColor={renk}
        variants={product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
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
            {relatedProducts.map((entry) => (
              <ProductCard
                key={`${entry.productId}-${entry.colorLabel ?? "tek"}`}
                product={catalogEntryToCardData(entry, automaticCampaigns)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
