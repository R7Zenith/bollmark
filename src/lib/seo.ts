import { getSiteUrl } from "@/lib/site-url";
import { STORE_INFO } from "@/lib/store-info";
import type { getProductBySlug } from "@/lib/catalog";
import { resolveProductDisplayPrice, matchAutomaticDiscount, type AutomaticPercentCampaign } from "@/lib/coupons";
import { descriptionToPlainText } from "@/lib/description-html";
import { istanbulDateKey } from "@/lib/format";
import { SHIPPING_THRESHOLD_CENTS } from "@/lib/shipping";
import { effectivePrice } from "@/lib/variant";
import { optionValue } from "@/lib/variant-attributes";

const DESCRIPTION_MAX_LENGTH = 160;

// Meta description: bosluklar tek bosluga indirilir, 160 karakteri asan metin
// kelime sinirinda kesilip "…" eklenir (Google uzun aciklamayi rastgele keser).
export function truncateDescription(text: string, maxLength = DESCRIPTION_MAX_LENGTH): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

// Gorsel breadcrumb ile ayni veri. href'i olmayan (sayfanin kendisi olan) son
// oge "item" alani olmadan yazilir - Google son oge icin buna izin veriyor.
export function breadcrumbJsonLd(items: { label: string; href?: string }[]) {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href && { item: new URL(item.href, siteUrl).toString() })
    }))
  };
}

// Anasayfa: marka (Organization), site (WebSite + arama kutusu) ve fiziksel
// magaza (ClothingStore) tek @graph icinde.
export function homeJsonLd() {
  const siteUrl = getSiteUrl();
  const organizationId = `${siteUrl}/#organization`;
  const { address, openingHours } = STORE_INFO;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: STORE_INFO.brandName,
        url: siteUrl,
        logo: `${siteUrl}/logo.png`,
        email: STORE_INFO.email,
        sameAs: [STORE_INFO.instagramUrl]
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: STORE_INFO.brandName,
        url: siteUrl,
        inLanguage: "tr-TR",
        publisher: { "@id": organizationId },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/urunler?ara={search_term_string}` },
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "ClothingStore",
        "@id": `${siteUrl}/#store`,
        name: STORE_INFO.brandName,
        url: siteUrl,
        image: `${siteUrl}/og-default.jpg`,
        email: STORE_INFO.email,
        ...(STORE_INFO.phone && { telephone: STORE_INFO.phone }),
        parentOrganization: { "@id": organizationId },
        address: { "@type": "PostalAddress", ...address },
        openingHoursSpecification: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: openingHours.days,
          opens: openingHours.opens,
          closes: openingHours.closes
        }
      }
    ]
  };
}

type ProductForJsonLd = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export const GENDER_TO_SCHEMA: Record<string, string> = { Erkek: "male", Kadın: "female", Unisex: "unisex" };

// Sayfa basligi "{Marka} {Urun adi}" - marka adi zaten urun adinda geciyorsa
// tekrar edilmez.
export function productTitle(product: { name: string; brand: { name: string } | null }): string {
  const brand = product.brand?.name;
  if (!brand || product.name.toLocaleLowerCase("tr").includes(brand.toLocaleLowerCase("tr"))) return product.name;
  return `${brand} ${product.name}`;
}

// EAN-13 kontrol hanesi dogru mu - Google gecersiz GTIN'i reddeder.
export function isValidGtin13(code: string | null): code is string {
  if (!code || !/^\d{13}$/.test(code)) return false;
  const sum = code
    .slice(0, 12)
    .split("")
    .reduce((acc, digit, i) => acc + Number(digit) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

function formatPriceValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Google Merchant standardinda urun semasi (bkz. SEO_TEKNIK_DENETIM_VE_PLAN.md
// 2.5). Fiyat ekrandakiyle birebir ayni hesaplanir (product-viewer.tsx ile ayni
// resolveProductDisplayPrice). Birden fazla varyant varsa ProductGroup +
// hasVariant, tek varyantta duz Product. Yorum altyapisi olmadigi icin
// aggregateRating/review yok.
export function buildProductJsonLd(
  product: ProductForJsonLd,
  automaticCampaigns: AutomaticPercentCampaign[],
  defaultShippingCents: number
) {
  const siteUrl = getSiteUrl();
  const productUrl = `${siteUrl}/urunler/${product.slug}`;
  const description = descriptionToPlainText(product.description);

  const colorGalleries = new Map<string, string[]>();
  for (const img of product.optionImages) {
    const gallery = colorGalleries.get(img.value.value) ?? [];
    gallery.push(img.url);
    colorGalleries.set(img.value.value, gallery);
  }
  const allImages = [...new Set([...product.images.map((i) => i.url), ...product.optionImages.map((i) => i.url)])];

  // Kampanya fiyati gosteriliyorsa priceValidUntil = kampanyanin bitis gunu.
  const campaign = matchAutomaticDiscount(automaticCampaigns, product);
  const campaignEnd = automaticCampaigns.find(
    (c) => c.value === campaign?.percent && c.expiresAt && matchAutomaticDiscount([c], product)
  )?.expiresAt;

  const brand = product.brand ? { "@type": "Brand", name: product.brand.name } : undefined;
  const audience = product.gender && GENDER_TO_SCHEMA[product.gender]
    ? { "@type": "PeopleAudience", suggestedGender: GENDER_TO_SCHEMA[product.gender] }
    : undefined;

  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "TR",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: STORE_INFO.returnDays,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility"
  };

  function buildOffer(variant: ProductForJsonLd["variants"][number] | null, url: string, inStock: boolean) {
    const price = resolveProductDisplayPrice(automaticCampaigns, {
      priceCents: effectivePrice(product, variant),
      compareAtCents: product.compareAtCents,
      categoryId: product.categoryId,
      brandId: product.brandId,
      gender: product.gender
    });
    const shippingCents = price.finalPriceCents >= SHIPPING_THRESHOLD_CENTS ? 0 : defaultShippingCents;
    return {
      "@type": "Offer",
      url,
      priceCurrency: "TRY",
      price: formatPriceValue(price.finalPriceCents),
      ...(price.source === "KAMPANYA" && campaignEnd && { priceValidUntil: istanbulDateKey(campaignEnd) }),
      ...(price.originalPriceCents != null && {
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          priceType: "https://schema.org/StrikethroughPrice",
          price: formatPriceValue(price.originalPriceCents),
          priceCurrency: "TRY"
        }
      }),
      itemCondition: "https://schema.org/NewCondition",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@id": `${siteUrl}/#organization` },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "TR" },
        shippingRate: { "@type": "MonetaryAmount", value: formatPriceValue(shippingCents), currency: "TRY" }
      },
      hasMerchantReturnPolicy: returnPolicy
    };
  }

  const common = {
    description,
    ...(brand && { brand }),
    ...(product.material && { material: product.material }),
    ...(audience && { audience })
  };

  if (product.variants.length <= 1) {
    const variant = product.variants[0] ?? null;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      ...common,
      ...(allImages.length > 0 && { image: allImages }),
      ...(product.code && { productID: product.code }),
      ...(variant && { sku: variant.sku }),
      ...(variant && isValidGtin13(variant.barcode) && { gtin13: variant.barcode }),
      ...(variant && optionValue(variant, "Renk") && { color: optionValue(variant, "Renk") }),
      ...(variant && optionValue(variant, "Beden") && { size: optionValue(variant, "Beden") }),
      offers: buildOffer(variant, productUrl, variant ? variant.stock > 0 : false)
    };
  }

  const colors = new Set(product.variants.map((v) => optionValue(v, "Renk")).filter(Boolean));
  const sizes = new Set(product.variants.map((v) => optionValue(v, "Beden")).filter(Boolean));
  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    name: product.name,
    url: productUrl,
    productGroupID: product.code ?? product.id,
    ...common,
    ...(allImages.length > 0 && { image: allImages }),
    variesBy: [
      ...(colors.size > 1 ? ["https://schema.org/color"] : []),
      ...(sizes.size > 1 ? ["https://schema.org/size"] : [])
    ],
    hasVariant: product.variants.map((variant) => {
      const color = optionValue(variant, "Renk");
      const size = optionValue(variant, "Beden");
      const images = (color && colorGalleries.get(color)) || allImages;
      const url = color && colors.size > 1 ? `${productUrl}?renk=${encodeURIComponent(color)}` : productUrl;
      return {
        "@type": "Product",
        name: [product.name, color, size].filter(Boolean).join(" - "),
        sku: variant.sku,
        ...(isValidGtin13(variant.barcode) && { gtin13: variant.barcode }),
        ...(color && { color }),
        ...(size && { size }),
        ...(images.length > 0 && { image: images }),
        offers: buildOffer(variant, url, variant.stock > 0)
      };
    })
  };
}
