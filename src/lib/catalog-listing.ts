import { getCatalogEntries } from "@/lib/catalog";
import type { CatalogEntry } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import {
  applyCatalogFilters,
  buildCatalogFacets,
  countActiveFilters,
  parseCatalogFilters
} from "@/lib/catalog-filters";
import { getActiveAutomaticPercentCampaigns, resolveProductDisplayPrice } from "@/lib/coupons";
import { getSearchIndex, matchProducts } from "@/lib/search";
import { SEARCH_MAX_LENGTH } from "@/lib/search-text";
import type { ProductCardData } from "@/components/product-card";

// Katalog sayfasinin (urunler/page.tsx) ve "Daha Fazla Goster" sunucu
// aksiyonunun (urunler/actions.ts) ortak listeleme hatti: ikisi ayni
// fonksiyonu kullandigi icin sonraki partiler ilk render'dan asla sapmaz.

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800";

// Ust cubuktaki siralama secimi. Stogu biten girisler her durumda listenin
// sonunda kalir (bkz. lib/catalog.ts) - siralama yalnizca stokta olanlar
// arasinda uygulanir, yoksa "fiyat: dusukten yuksege" secildiginde satilamayan
// urunler basa cikardi.
// Arama (?ara=) sonucu: header'daki canli aramayla (api/arama) ayni eslestirme
// kurali. Sorgudaki bir kelime urunun rengine uyuyorsa ("siyah gomlek")
// yalnizca o rengin girisi kalir. Siralama secili degilse en yakin sonuc ustte.
async function applySearch(entries: CatalogEntry[], ara: string, sort?: string): Promise<CatalogEntry[]> {
  const matches = matchProducts(await getSearchIndex(), ara);
  const byProduct = new Map(matches.map((m) => [m.item.id, m]));
  const filtered = entries.filter((entry) => {
    const match = byProduct.get(entry.productId);
    if (!match) return false;
    return match.matchedColors.length === 0 || !entry.colorName || match.matchedColors.includes(entry.colorName);
  });
  if (sort) return filtered;
  return filtered.sort(
    (a, b) =>
      Number(a.outOfStock) - Number(b.outOfStock) ||
      (byProduct.get(b.productId)?.score ?? 0) - (byProduct.get(a.productId)?.score ?? 0)
  );
}

export function parseSearchQuery(value: string | null | undefined): string | undefined {
  return value?.trim().slice(0, SEARCH_MAX_LENGTH) || undefined;
}

function sortEntries(entries: CatalogEntry[], sort?: string): CatalogEntry[] {
  if (!sort) return entries;
  const comparators: Record<string, (a: CatalogEntry, b: CatalogEntry) => number> = {
    "fiyat-artan": (a, b) => a.priceCents - b.priceCents,
    "fiyat-azalan": (a, b) => b.priceCents - a.priceCents,
    isim: (a, b) => a.name.localeCompare(b.name, "tr")
  };
  const compare = comparators[sort];
  if (!compare) return entries;
  return [...entries].sort(
    (a, b) => Number(a.outOfStock) - Number(b.outOfStock) || compare(a, b)
  );
}

export async function getCatalogListing(params: URLSearchParams) {
  const kategori = params.get("kategori") || undefined;
  const cinsiyet = params.get("cinsiyet") || undefined;
  const sirala = params.get("sirala") || undefined;
  const ara = parseSearchQuery(params.get("ara"));
  const filters = parseCatalogFilters(params);

  // Birden fazla rengi olan urunler burada renk basina ayri bir giris olarak
  // gelir (bkz. lib/catalog.ts getCatalogEntries) - musteri kataloga bakarken
  // her rengi urune tiklamadan ayri bir urunmus gibi gorur.
  const [scopedEntries, automaticCampaigns, filterCategories] = await Promise.all([
    getCatalogEntries(kategori, { genderLabel: cinsiyet }),
    getActiveAutomaticPercentCampaigns(prisma),
    // Ust cubuktaki "Filtrele" listesi - yalnizca su anki cinsiyet kapsaminda
    // gercekten yayinda urunu olan kategoriler (bos filtre secenegi gosterilmez).
    prisma.category.findMany({
      where: {
        isActive: true,
        products: { some: { status: "PUBLISHED", gender: cinsiyet ? cinsiyet : undefined } }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, slug: true, imageUrl: true }
    })
  ]);
  // Arama varsa facet'ler ve filtreler arama sonuclari uzerinden calisir.
  const rawEntries = ara ? await applySearch(scopedEntries, ara, sirala) : scopedEntries;
  // Cekmece secenekleri filtrelenmemis (kategori/cinsiyet kapsamindaki)
  // girislerden uretilir, yoksa bir renk secince diger renkler kaybolurdu.
  const facets = buildCatalogFacets(rawEntries);
  const entries = sortEntries(applyCatalogFilters(rawEntries, filters), sirala);
  // Kategori burada sayilmiyor: kategori+cinsiyet kombinasyonunun bos olmasi
  // icin zaten ozel bir ekran var (EmptyCategoryState).
  const hasActiveFilters = countActiveFilters(filters, false) > 0;

  return {
    entries,
    rawEntries,
    facets,
    filters,
    hasActiveFilters,
    kategori,
    cinsiyet,
    sirala,
    ara,
    automaticCampaigns,
    filterCategories
  };
}

type AutomaticCampaigns = Awaited<ReturnType<typeof getActiveAutomaticPercentCampaigns>>;

export function toCatalogCardProps(entry: CatalogEntry, automaticCampaigns: AutomaticCampaigns): ProductCardData {
  return {
    productId: entry.productId,
    slug: entry.slug,
    name: entry.name,
    priceCents: entry.priceCents,
    compareAtCents: entry.compareAtCents,
    image: entry.image ?? FALLBACK_IMAGE,
    secondImage: entry.secondImage,
    colorLabel: entry.colorLabel,
    priceResolution: resolveProductDisplayPrice(automaticCampaigns, entry),
    outOfStock: entry.outOfStock,
    lowStockCount: entry.lowStockCount,
    isNew: entry.isNew,
    quickAddVariants: entry.quickAddVariants,
    colors: entry.colors,
    greyBackdrop: entry.greyBackdrop
  };
}
