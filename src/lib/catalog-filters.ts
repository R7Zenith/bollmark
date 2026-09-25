import type { CatalogEntry } from "@/lib/catalog";

// Katalog filtre cekmecesinin (bkz. components/filter-drawer.tsx) URL query
// param'lari <-> filtre nesnesi donusumu ile filtreleme/facet hesabi. Prisma'ya
// bagimli degil: hem sunucuda (urunler/page.tsx) hem istemcide (cekmece)
// kullaniliyor. Kategori (`kategori`) burada degil - o zaten getCatalogEntries'e
// veritabani seviyesinde uygulaniyor.

export const STOCK_IN = "stokta";
export const STOCK_OUT = "stokta-yok";

export type CatalogFilters = {
  colors: string[];
  sizes: string[];
  // TL cinsinden (kurus degil) - kullanicinin girdigi deger.
  minPrice: number | null;
  maxPrice: number | null;
  stock: string[];
  onSale: boolean;
};

export const EMPTY_FILTERS: CatalogFilters = {
  colors: [],
  sizes: [],
  minPrice: null,
  maxPrice: null,
  stock: [],
  onSale: false
};

// Filtre cekmecesinin yonettigi tum query param anahtarlari - "Uygula"/
// "Temizle" bunlari sifirlayip yeniden yazar, cinsiyet/sirala gibi digerleri
// olduklari gibi kalir.
export const FILTER_PARAM_KEYS = ["renk", "beden", "fiyat-min", "fiyat-max", "stok", "indirimli"];

// Katalogda "Daha Fazla Goster" ile bir seferde eklenen kart sayisi ve kac
// kartin acik oldugunu tutan query param'i (bkz. components/catalog-grid.tsx).
// Filtre degildir: FILTER_PARAM_KEYS'te yok, filtre sayisina katilmaz; ama
// filtre/siralama degisince silinir ki liste bastan (24) baslasin.
export const CATALOG_PAGE_SIZE = 24;
export const CATALOG_SHOW_PARAM = "goster";

function parsePrice(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  return {
    colors: params.getAll("renk"),
    sizes: params.getAll("beden"),
    minPrice: parsePrice(params.get("fiyat-min")),
    maxPrice: parsePrice(params.get("fiyat-max")),
    stock: params.getAll("stok").filter((s) => s === STOCK_IN || s === STOCK_OUT),
    onSale: params.get("indirimli") === "1"
  };
}

// Next.js searchParams (Record<string, string | string[]>) -> URLSearchParams.
export function toURLSearchParams(record: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}

export function writeCatalogFilters(params: URLSearchParams, filters: CatalogFilters) {
  FILTER_PARAM_KEYS.forEach((key) => params.delete(key));
  filters.colors.forEach((c) => params.append("renk", c));
  filters.sizes.forEach((s) => params.append("beden", s));
  if (filters.minPrice !== null) params.set("fiyat-min", String(filters.minPrice));
  if (filters.maxPrice !== null) params.set("fiyat-max", String(filters.maxPrice));
  filters.stock.forEach((s) => params.append("stok", s));
  if (filters.onSale) params.set("indirimli", "1");
}

export function countActiveFilters(filters: CatalogFilters, hasCategory: boolean): number {
  return (
    filters.colors.length +
    filters.sizes.length +
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0) +
    (filters.stock.length === 1 ? 1 : 0) +
    (filters.onSale ? 1 : 0) +
    (hasCategory ? 1 : 0)
  );
}

function isOnSale(entry: CatalogEntry): boolean {
  return entry.compareAtCents !== null && entry.compareAtCents > entry.priceCents;
}

export function applyCatalogFilters(entries: CatalogEntry[], filters: CatalogFilters): CatalogEntry[] {
  // Iki stok secenegi birden secilmisse (Stokta + Stokta yok) her sey uyar,
  // yani filtre yok demektir.
  const stockFilter = filters.stock.length === 1 ? filters.stock[0] : null;
  return entries.filter((entry) => {
    if (filters.colors.length > 0 && !(entry.colorName && filters.colors.includes(entry.colorName))) {
      return false;
    }
    // Beden yalnizca stokta olan bedenlere bakar (quickAddVariants) - musteri
    // satin alamayacagi bir bedeni filtreleyip o urunu gormesin.
    if (filters.sizes.length > 0 && !entry.quickAddVariants.some((v) => filters.sizes.includes(v.size))) {
      return false;
    }
    if (filters.minPrice !== null && entry.priceCents < filters.minPrice * 100) return false;
    if (filters.maxPrice !== null && entry.priceCents > filters.maxPrice * 100) return false;
    if (stockFilter === STOCK_IN && entry.outOfStock) return false;
    if (stockFilter === STOCK_OUT && !entry.outOfStock) return false;
    if (filters.onSale && !isOnSale(entry)) return false;
    return true;
  });
}

export type CatalogFacets = {
  colors: { name: string; hex: string | null; count: number }[];
  sizes: { name: string; count: number }[];
  priceRange: { min: number; max: number } | null; // TL
  inStockCount: number;
  outOfStockCount: number;
  onSaleCount: number;
};

// Beden degeri serbest metin (XS/S/M/38/ONE SIZE...) ve pozisyon bilgisi
// katalog girislerinde yok - bilinen harf bedenleri once, sayisal bedenler
// sonra, kalanlar alfabetik.
const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

function compareSizes(a: string, b: string): number {
  const ia = LETTER_SIZES.indexOf(a.toUpperCase());
  const ib = LETTER_SIZES.indexOf(b.toUpperCase());
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b, "tr");
}

// Secenekler filtrelenmemis (yalnizca kategori/cinsiyet kapsamindaki) girislerden
// uretilir - aksi halde bir renk secince diger renkler listeden kaybolurdu.
export function buildCatalogFacets(entries: CatalogEntry[]): CatalogFacets {
  const colors = new Map<string, { hex: string | null; count: number }>();
  const sizes = new Map<string, number>();
  let inStockCount = 0;
  let onSaleCount = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const entry of entries) {
    if (entry.colorName) {
      const existing = colors.get(entry.colorName);
      if (existing) existing.count += 1;
      else {
        const hex = entry.colors.find((c) => c.name === entry.colorName)?.hex ?? null;
        colors.set(entry.colorName, { hex, count: 1 });
      }
    }
    for (const size of new Set(entry.quickAddVariants.map((v) => v.size).filter(Boolean))) {
      sizes.set(size, (sizes.get(size) ?? 0) + 1);
    }
    if (!entry.outOfStock) inStockCount += 1;
    if (isOnSale(entry)) onSaleCount += 1;
    min = Math.min(min, entry.priceCents);
    max = Math.max(max, entry.priceCents);
  }

  return {
    colors: [...colors.entries()]
      .map(([name, { hex, count }]) => ({ name, hex, count }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    sizes: [...sizes.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => compareSizes(a.name, b.name)),
    priceRange: entries.length > 0 ? { min: Math.floor(min / 100), max: Math.ceil(max / 100) } : null,
    inStockCount,
    outOfStockCount: entries.length - inStockCount,
    onSaleCount
  };
}
