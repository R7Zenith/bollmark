import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { getActiveAutomaticPercentCampaigns, resolveProductDisplayPrice } from "@/lib/coupons";
import { descriptionToPlainText } from "@/lib/description-html";
import { DEFAULT_GOOGLE_CATEGORY_ID } from "@/lib/google-categories";
import { GENDER_TO_SCHEMA, isValidGtin13, productTitle } from "@/lib/seo";
import { SHIPPING_THRESHOLD_CENTS } from "@/lib/shipping";
import { effectivePrice } from "@/lib/variant";
import { optionValue, variantOptionsInclude } from "@/lib/variant-attributes";

// Google Merchant Center urun feed'i (RSS 2.0 + g: alanlari, bkz.
// SEO_TEKNIK_DENETIM_VE_PLAN.md 2.9). Her varyant ayri item; fiyatlar urun
// sayfasi ve JSON-LD ile ayni hesaplanir (resolveProductDisplayPrice).
// Gorseli olmayan urunler atlanir (Google gorselsiz urunu reddeder).

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;
const ADDITIONAL_IMAGES_MAX = 10;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tag(name: string, value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "" : `<${name}>${escapeXml(String(value))}</${name}>`;
}

function money(cents: number): string {
  return `${(cents / 100).toFixed(2)} TRY`;
}

export async function buildGoogleMerchantFeed(): Promise<string> {
  const siteUrl = getSiteUrl();
  const [products, automaticCampaigns, storeSettings] = await Promise.all([
    prisma.product.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      include: {
        images: { orderBy: { position: "asc" } },
        optionImages: { include: { value: true }, orderBy: { position: "asc" } },
        variants: { include: variantOptionsInclude },
        brand: true,
        category: { include: { parent: true } }
      }
    }),
    getActiveAutomaticPercentCampaigns(prisma),
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { defaultShippingCents: true } })
  ]);
  const defaultShippingCents = storeSettings?.defaultShippingCents ?? 0;

  const items: string[] = [];
  for (const product of products) {
    const allImages = [...new Set([...product.images.map((i) => i.url), ...product.optionImages.map((i) => i.url)])];
    if (allImages.length === 0 || product.variants.length === 0) continue;

    const colorGalleries = new Map<string, string[]>();
    for (const img of product.optionImages) {
      const gallery = colorGalleries.get(img.value.value) ?? [];
      gallery.push(img.url);
      colorGalleries.set(img.value.value, gallery);
    }
    const colorCount = new Set(product.variants.map((v) => optionValue(v, "Renk")).filter(Boolean)).size;
    const baseTitle = productTitle(product);
    const description = descriptionToPlainText(product.description).slice(0, DESCRIPTION_MAX);
    const googleCategory =
      product.category?.googleCategoryId ?? product.category?.parent?.googleCategoryId ?? DEFAULT_GOOGLE_CATEGORY_ID;
    const productType = [product.gender, product.category?.parent?.name, product.category?.name].filter(Boolean).join(" > ");
    const gender = product.gender ? GENDER_TO_SCHEMA[product.gender] : undefined;
    const ageGroup = product.gender === "Çocuk" ? "kids" : "adult";

    for (const variant of product.variants) {
      const color = optionValue(variant, "Renk");
      const size = optionValue(variant, "Beden");
      const images = (color && colorGalleries.get(color)) || allImages;
      const link = `${siteUrl}/urunler/${encodeURIComponent(product.slug)}${
        color && colorCount > 1 ? `?renk=${encodeURIComponent(color)}` : ""
      }`;
      const price = resolveProductDisplayPrice(automaticCampaigns, {
        priceCents: effectivePrice(product, variant),
        compareAtCents: product.compareAtCents,
        categoryId: product.categoryId,
        brandId: product.brandId,
        gender: product.gender
      });
      const shippingCents = price.finalPriceCents >= SHIPPING_THRESHOLD_CENTS ? 0 : defaultShippingCents;
      const title = [baseTitle, color, size].filter(Boolean).join(" ").slice(0, TITLE_MAX);
      const gtin = isValidGtin13(variant.barcode) ? variant.barcode : null;

      items.push(
        [
          "<item>",
          tag("g:id", variant.sku),
          tag("g:item_group_id", product.code ?? product.id),
          tag("title", title),
          tag("description", description || title),
          tag("link", link),
          tag("g:image_link", images[0]),
          ...images.slice(1, ADDITIONAL_IMAGES_MAX + 1).map((url) => tag("g:additional_image_link", url)),
          tag("g:availability", variant.stock > 0 ? "in_stock" : "out_of_stock"),
          price.originalPriceCents != null
            ? tag("g:price", money(price.originalPriceCents)) + tag("g:sale_price", money(price.finalPriceCents))
            : tag("g:price", money(price.finalPriceCents)),
          tag("g:brand", product.brand?.name),
          gtin ? tag("g:gtin", gtin) : tag("g:identifier_exists", "no"),
          tag("g:condition", "new"),
          tag("g:google_product_category", googleCategory),
          tag("g:product_type", productType),
          tag("g:color", color),
          tag("g:size", size),
          tag("g:gender", gender),
          tag("g:age_group", ageGroup),
          `<g:shipping>${tag("g:country", "TR")}${tag("g:price", money(shippingCents))}</g:shipping>`,
          "</item>"
        ].join("")
      );
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    tag("title", "Bollmark"),
    tag("link", siteUrl),
    tag("description", "Bollmark ürün kataloğu"),
    ...items,
    "</channel>",
    "</rss>"
  ].join("\n");
}
