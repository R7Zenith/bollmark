import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isOutOfStock, pickCoverImage } from "@/lib/catalog";
import { usesGreyBackdrop } from "@/lib/image-backdrop";
import { normalizeTr, tokenize } from "@/lib/search-text";

export const SEARCH_INDEX_TAG = "search-index";

// Arama indeksindeki tek urun - her tus vurusunda veritabanina gidilmesin diye
// yayindaki tum urunlerin hafif bir kopyasi onbellekte tutulur (bkz.
// getSearchIndex). unstable_cache JSON'a cevirdigi icin tarih sayi olarak.
export type SearchIndexItem = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  categoryId: string | null;
  brandId: string | null;
  gender: string | null;
  priceCents: number;
  compareAtCents: number | null;
  image: string | null;
  colors: { label: string; norm: string; image: string | null; outOfStock: boolean }[];
  outOfStock: boolean;
  isFeatured: boolean;
  createdAt: number;
  greyBackdrop: boolean;
  nameNorm: string;
  // Urun kodu + varyant SKU/barkodlari, normalize ve bosluksuz.
  codes: string[];
  haystack: string;
};

async function buildSearchIndex(): Promise<SearchIndexItem[]> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      code: true,
      priceCents: true,
      compareAtCents: true,
      categoryId: true,
      brandId: true,
      gender: true,
      isFeatured: true,
      createdAt: true,
      brand: { select: { name: true } },
      category: { select: { name: true, parent: { select: { name: true } } } },
      tags: { select: { name: true } },
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      optionImages: { orderBy: { position: "asc" }, select: { url: true, valueId: true, isCover: true } },
      variants: {
        select: {
          sku: true,
          barcode: true,
          stock: true,
          options: { select: { valueId: true, value: { select: { value: true, attribute: { select: { isColor: true } } } } } }
        }
      }
    }
  });

  return products.map((p) => {
    const colorByValueId = new Map<string, string>();
    for (const v of p.variants) {
      for (const o of v.options) {
        if (o.value.attribute.isColor) colorByValueId.set(o.valueId, o.value.value);
      }
    }
    const colors = [...colorByValueId].map(([valueId, label]) => ({
      label,
      norm: normalizeTr(label),
      image: pickCoverImage(p.optionImages.filter((img) => img.valueId === valueId))?.url ?? null,
      outOfStock: isOutOfStock(p.variants.filter((v) => v.options.some((o) => o.valueId === valueId)))
    }));
    const codes = [p.code, ...p.variants.flatMap((v) => [v.sku, v.barcode])]
      .filter((c): c is string => Boolean(c))
      .map((c) => normalizeTr(c).replace(/ /g, ""));
    const haystack = normalizeTr(
      [
        p.name,
        p.code,
        p.brand?.name,
        p.category?.name,
        p.category?.parent?.name,
        p.gender,
        ...p.tags.map((t) => t.name),
        ...colors.map((c) => c.label),
        ...codes
      ]
        .filter(Boolean)
        .join(" ")
    );
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand?.name ?? null,
      categoryId: p.categoryId,
      brandId: p.brandId,
      gender: p.gender,
      priceCents: p.priceCents,
      compareAtCents: p.compareAtCents,
      image: p.images[0]?.url ?? pickCoverImage(p.optionImages)?.url ?? null,
      colors,
      outOfStock: isOutOfStock(p.variants),
      isFeatured: p.isFeatured,
      createdAt: p.createdAt.getTime(),
      greyBackdrop: usesGreyBackdrop(p.brand?.name),
      nameNorm: normalizeTr(p.name),
      codes,
      haystack
    };
  });
}

// Urun degisince lib/revalidate-catalog.ts SEARCH_INDEX_TAG'i gecersiz kilar;
// revalidate 3600 sadece bir emniyet agi.
export const getSearchIndex = unstable_cache(buildSearchIndex, ["search-index"], {
  tags: [SEARCH_INDEX_TAG],
  revalidate: 3600
});

export type SearchMatch = {
  item: SearchIndexItem;
  score: number;
  // Sorgudaki bir kelime urunun renklerinden birine uyuyorsa o renk(ler).
  matchedColors: string[];
};

function matchesColorWord(colorNorm: string, word: string): boolean {
  return colorNorm.split(/[^a-z0-9]+/).some((part) => part === word || (word.length >= 3 && part.startsWith(word)));
}

// Her sorgu kelimesi urunun arama metninde gecmeli (VE mantigi) - kelime
// ekledikce sonuclar daralir. Puan: kod/SKU/barkod birebir > kod ile baslar >
// ad sorguyla baslar > addaki kelime sorgu kelimesiyle baslar > ad icinde
// gecer > yalnizca marka/kategori/renk eslesmesi.
export function matchProducts(index: SearchIndexItem[], query: string): SearchMatch[] {
  const words = tokenize(query);
  if (words.length === 0) return [];
  const full = words.join(" ");
  const compact = words.join("");
  const matches: SearchMatch[] = [];

  for (const item of index) {
    if (!words.every((w) => item.haystack.includes(w))) continue;
    let score = 0;
    if (item.codes.includes(compact)) score += 1000;
    else if (compact.length >= 3 && item.codes.some((c) => c.startsWith(compact))) score += 300;
    if (item.nameNorm.startsWith(full)) score += 500;
    const nameWords = item.nameNorm.split(" ");
    for (const w of words) {
      if (nameWords.some((nw) => nw.startsWith(w))) score += 200;
    }
    if (item.nameNorm.includes(full)) score += 100;
    if (score === 0) score = 20;
    const matchedColors = item.colors
      .filter((c) => words.some((w) => matchesColorWord(c.norm, w)))
      .map((c) => c.label);
    matches.push({ item, score, matchedColors });
  }

  return matches.sort(
    (a, b) =>
      b.score - a.score ||
      Number(a.item.outOfStock) - Number(b.item.outOfStock) ||
      Number(b.item.isFeatured) - Number(a.item.isFeatured) ||
      b.item.createdAt - a.item.createdAt
  );
}
