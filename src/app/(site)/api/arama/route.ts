import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveAutomaticPercentCampaigns, resolveProductDisplayPrice } from "@/lib/coupons";
import { getSearchIndex, matchProducts } from "@/lib/search";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH } from "@/lib/search-text";

// Coklu renkli urunler katalogdaki gibi renk basina ayri sonuc oldugu icin
// tek bir urun birden fazla yer kaplayabilir - bu yuzden 4 degil 8.
const LIMIT = 8;

export type SearchResult = {
  slug: string;
  href: string;
  name: string;
  brand: string | null;
  image: string | null;
  // Katalog kartiyla ayni fiyat (otomatik kampanya/manuel indirim cozulmus):
  // priceCents gosterilecek fiyat, compareAtCents ustu cizili eski fiyat.
  priceCents: number;
  compareAtCents: number | null;
  outOfStock: boolean;
  colorLabel: string | null;
  greyBackdrop: boolean;
};

const HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, SEARCH_MAX_LENGTH);
  if (q.length < SEARCH_MIN_LENGTH) {
    return NextResponse.json({ results: [], total: 0 }, { headers: HEADERS });
  }

  const [index, campaigns] = await Promise.all([getSearchIndex(), getActiveAutomaticPercentCampaigns(prisma)]);
  const matches = matchProducts(index, q);

  // Katalogla (lib/catalog.ts productToCatalogEntries) ayni mantik: birden fazla
  // rengi olan urun renk basina ayri sonuc olur. Sorgudaki bir kelime renge
  // uyuyorsa ("siyah gomlek") yalnizca o renk(ler) kalir. Esit puanda stokta
  // olmayan renkler sona gider (sort stabil, urun sirasi korunur).
  const expanded = matches
    .flatMap(({ item, score, matchedColors }): { score: number; result: SearchResult }[] => {
      const price = resolveProductDisplayPrice(campaigns, item);
      const base = {
        slug: item.slug,
        name: item.name,
        brand: item.brand,
        priceCents: price.finalPriceCents,
        compareAtCents: price.originalPriceCents,
        greyBackdrop: item.greyBackdrop
      };
      const colors =
        matchedColors.length > 0
          ? item.colors.filter((c) => matchedColors.includes(c.label))
          : item.colors.length > 1
            ? item.colors
            : [];
      if (colors.length === 0) {
        return [{ score, result: { ...base, href: `/urunler/${item.slug}`, image: item.image, outOfStock: item.outOfStock, colorLabel: null } }];
      }
      return colors.map((c) => ({
        score,
        result: {
          ...base,
          href: `/urunler/${item.slug}?renk=${encodeURIComponent(c.label)}`,
          image: c.image ?? item.image,
          outOfStock: c.outOfStock,
          colorLabel: c.label
        }
      }));
    })
    .sort((a, b) => b.score - a.score || Number(a.result.outOfStock) - Number(b.result.outOfStock));

  const results: SearchResult[] = expanded.slice(0, LIMIT).map((e) => e.result);

  return NextResponse.json({ results, total: expanded.length }, { headers: HEADERS });
}
