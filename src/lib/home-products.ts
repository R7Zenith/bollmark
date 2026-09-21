import { firstImageUrl, isOutOfStock, type getPublishedProducts } from "@/lib/catalog";
import { resolveProductDisplayPrice, type AutomaticPercentCampaign } from "@/lib/coupons";
import type { ProductCardData } from "@/components/product-card";

type PublishedProduct = Awaited<ReturnType<typeof getPublishedProducts>>[number];

// Ana sayfadaki iki urun bolumu (Yeni Gelenler + Cok Satanlar) ayni kart
// verisini kullanir; donusum iki yerde ayri yazilip sapmasin diye burada tek.
// Yeni Gelenler'in ciktisi bu fonksiyona tasinmadan onceki haliyle birebir ayni.
export function toProductCardData(p: PublishedProduct, campaigns: AutomaticPercentCampaign[]): ProductCardData {
  return {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    priceCents: p.priceCents,
    compareAtCents: p.compareAtCents,
    image: firstImageUrl(p) ?? "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800",
    priceResolution: resolveProductDisplayPrice(campaigns, p),
    outOfStock: isOutOfStock(p.variants),
    quickAddVariants: p.quickAddVariants
  };
}

// "%20'ye varan indirim" gibi ifadelerde -e hali eki, sayinin OKUNUSUNUN son
// sesine gore degisir (yirmi -> 'ye, otuz -> 'a, yetmis -> 'e). Yuzde 1-100 icin
// tablo: birler basamagi doluysa ona, yuvarlaksa (10, 20 ...) onlar/yuz adina gore.
const DATIVE_BY_LAST_DIGIT = ["", "e", "ye", "e", "e", "e", "ya", "ye", "e", "a"];
const DATIVE_BY_TENS: Record<number, string> = {
  10: "a", 20: "ye", 30: "a", 40: "a", 50: "ye", 60: "a", 70: "e", 80: "e", 90: "a", 100: "e"
};

export function percentWithDative(n: number): string {
  const suffix = n % 10 === 0 ? DATIVE_BY_TENS[n] : DATIVE_BY_LAST_DIGIT[n % 10];
  return `%${n}'${suffix}`;
}

// Cok satanlar: son 90 gunun (yalniz gecerli/odenmis siparisler) satis adedi.
const BESTSELLER_DAYS = 90;

// Satis penceresinin baslangici. Sayfa bileseni (sunucu) icinde dogrudan
// Date.now() cagrilamaz (react-hooks/purity), bu yuzden burada.
export function bestsellerSince(): Date {
  return new Date(Date.now() - BESTSELLER_DAYS * 24 * 60 * 60 * 1000);
}
const BESTSELLER_TAB_LIMIT = 8;
// Satisi olan urun bu sayidan azsa sekme yedekle (one cikan, sonra en yeni)
// tamamlanir - bolum hic bos/tek kartlik gorunmesin.
const BESTSELLER_MIN_SOLD = 4;

// `products` createdAt DESC gelir (getPublishedProducts); yedek sirasi bu
// sayede "one cikanlar, sonra en yeniler" olur. Stokta olmayanlar hep disarida.
export function pickBestsellers(products: PublishedProduct[], soldByProductId: Map<string, number>): PublishedProduct[] {
  const inStock = products.filter((p) => !isOutOfStock(p.variants));
  const sold = inStock
    .filter((p) => (soldByProductId.get(p.id) ?? 0) > 0)
    .sort((a, b) => (soldByProductId.get(b.id) ?? 0) - (soldByProductId.get(a.id) ?? 0))
    .slice(0, BESTSELLER_TAB_LIMIT);
  if (sold.length >= BESTSELLER_MIN_SOLD) return sold;

  const soldIds = new Set(sold.map((p) => p.id));
  const rest = inStock.filter((p) => !soldIds.has(p.id));
  return [...sold, ...rest.filter((p) => p.isFeatured), ...rest.filter((p) => !p.isFeatured)].slice(0, BESTSELLER_TAB_LIMIT);
}
