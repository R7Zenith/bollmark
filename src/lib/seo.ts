import { getSiteUrl } from "@/lib/site-url";
import { STORE_INFO } from "@/lib/store-info";

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
