import {
  isOutOfStock,
  pickCoverImage,
  productToCatalogEntries,
  type CatalogEntry,
  type getPublishedProducts
} from "@/lib/catalog";
import { applyCatalogFilters, buildCatalogFacets, EMPTY_FILTERS } from "@/lib/catalog-filters";
import { resolveProductDisplayPrice, type AutomaticPercentCampaign } from "@/lib/coupons";
import { usesGreyBackdrop } from "@/lib/image-backdrop";
import type { ProductCardData } from "@/components/product-card";
import type { CompleteLookBundle } from "@/components/home/complete-the-look";
import { parseHotspots, parseProductOrder } from "@/lib/bundles";

type PublishedProduct = Awaited<ReturnType<typeof getPublishedProducts>>[number];

const FALLBACK_IMAGE = "/gorsel-yakinda.svg";

// Ana sayfadaki iki urun bolumu (Yeni Gelenler + Cok Satanlar) ayni kart
// verisini kullanir; donusum iki yerde ayri yazilip sapmasin diye burada tek.
// productToCatalogEntries ile uretilen girisleri (renk basina ayri kart -
// katalog sayfasindaki gibi) ProductCard'in bekledigi sekle cevirir.
export function catalogEntryToCardData(entry: CatalogEntry, campaigns: AutomaticPercentCampaign[]): ProductCardData {
  return {
    productId: entry.productId,
    itemGroupId: entry.itemGroupId,
    slug: entry.slug,
    name: entry.name,
    priceCents: entry.priceCents,
    compareAtCents: entry.compareAtCents,
    image: entry.image ?? FALLBACK_IMAGE,
    secondImage: entry.secondImage,
    colorLabel: entry.colorLabel,
    priceResolution: resolveProductDisplayPrice(campaigns, entry),
    outOfStock: entry.outOfStock,
    lowStockCount: entry.lowStockCount,
    isNew: entry.isNew,
    quickAddVariants: entry.quickAddVariants,
    colors: entry.colors,
    greyBackdrop: entry.greyBackdrop
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
// Ayni sayi, sekme basina PRODUCT secimini (pickBestsellers) hem de sonradan
// renklere bolununce gosterilecek toplam KART sayisini sinirlamak icin
// disariya (page.tsx) da aciliyor.
export const BESTSELLER_TAB_LIMIT = 8;
// Satisi olan urun bu sayidan azsa sekme yedekle (one cikan, sonra en yeni)
// tamamlanir - bolum hic bos/tek kartlik gorunmesin.
const BESTSELLER_MIN_SOLD = 4;

// "Yeni Gelenler": admin'in guncel (isCurrent) isaretledigi sezonun urunleri
// once, gerisi katalog sirasiyla (sezon rank DESC, sonra en yeni) - guncel
// sezonda yeterli urun yoksa bolum bir onceki sezondan tamamlanir. Guncel
// sezon isaretli degilse zaten en yuksek rank'li sezon basta. Stogu bitenler
// yine en sonda (getPublishedProducts ile ayni kural).
export function pickNewArrivals(products: PublishedProduct[]): PublishedProduct[] {
  return [...products].sort(
    (a, b) =>
      Number(isOutOfStock(a.variants)) - Number(isOutOfStock(b.variants)) ||
      Number(!!b.season?.isCurrent) - Number(!!a.season?.isCurrent)
  );
}

// `products` katalog sirasiyla gelir (getPublishedProducts: sezon, sonra en
// yeni); yedek sirasi bu sayede "one cikanlar, sonra en yeniler" olur. Stokta olmayanlar hep disarida.
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

// --- Anasayfa alt bolumleri (bkz. docs/planlar/ANASAYFA_ALT_BOLUM_YENILEME_PLANI.md) ---

// Kategori/cinsiyet kartlarinin gorseli: stok fotograf yok, gruptaki gercek bir
// urunun fotografi. greyBackdrop: beyaz zeminli marka fotograflari kartta da
// katalogdaki gibi gri zeminde gosterilsin (bkz. lib/image-backdrop.ts).
export type HomeImage = { url: string; greyBackdrop: boolean };

// Anasayfa kutularinda daha once kullanilan urunler/gorseller: ayni urun
// birden fazla gruba dustugunde (or. canta hem Kadin hem Aksesuar) kutular
// ayni fotografi gostermesin diye sonraki secimler bunlari atlar.
export type ImageExclusions = { productIds: Set<string>; urls: Set<string> };

// Gruptaki en yeni, gorselli urunun ilk gorseli; featuredFirst ile once one
// cikan (isFeatured) urunlere bakilir. Hic gorsel yoksa null (kart yazili kalir).
// exclude verilirse haric tutulmayan ilk aday secilir; hepsi haric ise kart
// gorselsiz kalmasin diye yine en yeni (tekrar eden) gorsele dusulur.
export function newestProductImage(
  products: PublishedProduct[],
  featuredFirst = false,
  exclude?: ImageExclusions
): (HomeImage & { productId: string }) | null {
  const sorted = [...products].sort(
    (a, b) =>
      (featuredFirst ? Number(b.isFeatured) - Number(a.isFeatured) : 0) || b.createdAt.getTime() - a.createdAt.getTime()
  );
  let repeated: (HomeImage & { productId: string }) | null = null;
  for (const p of sorted) {
    const url = p.images[0]?.url ?? pickCoverImage(p.optionImages)?.url;
    if (!url) continue;
    const image = { url, greyBackdrop: usesGreyBackdrop(p.brand?.name), productId: p.id };
    if (!exclude || (!exclude.productIds.has(p.id) && !exclude.urls.has(url))) return image;
    repeated ??= image;
  }
  return repeated;
}

type StripCategory = { id: string; name: string; slug: string; sortOrder: number; imageUrl: string | null };

// "Ne arıyorsun?" yuvarlak seridi: yayinda urunu olan (urunler yaprak
// kategorilere bagli) kategorilerden en cok urunlu STRIP_LIMIT tanesi, ekranda
// admin'in sortOrder sirasiyla. Gorsel: kategorinin imageUrl'i, yoksa
// kategorideki en yeni urunun fotografi.
const STRIP_LIMIT = 8;

export function pickCategoryStrip(categories: StripCategory[], products: PublishedProduct[]) {
  return categories
    .map((c) => ({ ...c, products: products.filter((p) => p.categoryId === c.id) }))
    .filter((c) => c.products.length > 0)
    .sort((a, b) => b.products.length - a.products.length)
    .slice(0, STRIP_LIMIT)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"))
    .map((c) => ({
      name: c.name,
      slug: c.slug,
      image: c.imageUrl ? { url: c.imageUrl, greyBackdrop: false } : newestProductImage(c.products)
    }));
}

// "Bütçene göre" esikleri (TL). Linkler katalogdaki ?fiyat-max= filtresine
// gider; filtre fiyati DAHIL eder (priceCents > max ise eler, bkz.
// catalog-filters.ts applyCatalogFilters), 490 TL'lik urun "490 ve alti"nda.
export const BUDGET_TIERS_TL = [490, 990, 1490];

// Kutulardaki sayilar katalogla ayni kural: renk basina kart (CatalogEntry) ve
// ayni applyCatalogFilters - tiklaninca acilan listeyle birebir ayni sayi.
// "İndirimdekiler" elle indirimli + kampanyali urunlerin hepsi.
export function countBudgetTiers(entries: CatalogEntry[], campaigns: AutomaticPercentCampaign[]) {
  return {
    tiers: BUDGET_TIERS_TL.map((maxTl) => ({
      maxTl,
      count: applyCatalogFilters(entries, { ...EMPTY_FILTERS, maxPrice: maxTl }, campaigns).length
    })),
    onSaleCount: applyCatalogFilters(entries, { ...EMPTY_FILTERS, onSale: true }, campaigns).length
  };
}

// "Sezonun renkleri": guncel (isCurrent) sezon kartlarinda en cok gecen renkler,
// katalogdaki renk filtresinin sayimiyla (buildCatalogFacets). Hex'i olmayan
// renk atlanir. Guncel sezon isaretli degilse tum yayindaki kartlara bakilir.
const SEASON_COLOR_LIMIT = 6;

export function pickSeasonColors(products: PublishedProduct[]) {
  const current = products.filter((p) => p.season?.isCurrent);
  const entries = (current.length > 0 ? current : products).flatMap(productToCatalogEntries);
  // Kampanya bilgisi yalniz indirim sayimini etkiler, renkleri degil.
  return buildCatalogFacets(entries, [])
    .colors.filter((c): c is { name: string; hex: string; count: number } => !!c.hex)
    .sort((a, b) => b.count - a.count)
    .slice(0, SEASON_COLOR_LIMIT);
}

// "Kombini Tamamla": admin'in anasayfada gostermek icin isaretledigi (sirali
// gelen) aktif kombinler. Urunlerinden biri yayinda degilse ya da hic stoklu
// rengi kalmadiysa kombin atlanir - eksik kombin sepete eklenemez, indirim de
// tetiklenmez. Her urun renk basina kart verisine (catalogEntryToCardData)
// bolunur; stoksuz renkler secenek olarak cikmaz. Urunler admin'de oklarla
// belirlenen sirada (productOrderJson; admin'deki nokta numaralariyla ayni).
type HomeBundleRow = {
  id: string;
  name: string;
  discountPercent: number;
  imageUrl: string | null;
  hotspotsJson: string;
  productOrderJson: string;
  products: { id: string }[];
};

// requireImage: anasayfada fotografsiz kombin gosterilmez; /kombin/[id]
// sayfasi fotografsiz kombini de yalniz listeyle gosterir.
export function pickHomeBundles(
  bundles: HomeBundleRow[],
  products: PublishedProduct[],
  campaigns: AutomaticPercentCampaign[],
  { requireImage = true }: { requireImage?: boolean } = {}
): CompleteLookBundle[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const result: CompleteLookBundle[] = [];
  for (const bundle of bundles) {
    if ((requireImage && !bundle.imageUrl) || bundle.products.length < 2) continue;
    const productIds = bundle.products.map((p) => p.id);
    const hotspots = parseHotspots(bundle.hotspotsJson, productIds);
    const items = parseProductOrder(bundle.productOrderJson, productIds).map((id) => {
      const product = byId.get(id);
      if (!product) return null;
      const options = productToCatalogEntries(product)
        .map((entry) => catalogEntryToCardData(entry, campaigns))
        .filter((card) => !card.outOfStock && (card.quickAddVariants?.length ?? 0) > 0);
      if (options.length === 0) return null;
      const spot = hotspots.find((h) => h.productId === id);
      return { productId: id, name: product.name, hotspot: spot ? { x: spot.x, y: spot.y } : null, options };
    });
    if (items.some((item) => item === null)) continue;
    result.push({
      id: bundle.id,
      name: bundle.name,
      discountPercent: bundle.discountPercent,
      imageUrl: bundle.imageUrl,
      items: items.filter((item): item is NonNullable<typeof item> => item !== null)
    });
  }
  return result;
}
