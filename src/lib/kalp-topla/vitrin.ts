import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { firstImageUrl } from "@/lib/catalog";

// /kalp-topla listeleri (KALP_TOPLA_PLANI.md 6.8): dolmak uzere olanlar ve en
// cok dolanlar. Reklam trafigi tek sayfaya gelecegi icin 60 sn onbelleklenir;
// mod anahtara girer, test turlari acik yayin listesine karismaz.
const NEAR_LIMIT = 4;
const TOP_LIMIT = 6;
const CANDIDATES = 200;
// Trend: son 7 gunde en cok kalp alanlar. 3'ten az urun varsa liste bos doner
// (bolum gizlenir, yarim gorunmesin).
const TREND_LIMIT = 8;
const TREND_MIN = 3;
const TREND_CANDIDATES = 30;
const TREND_DAYS = 7;

export type VitrinProduct = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  points: number;
  threshold: number;
  closedRounds: number;
};

export type TrendProduct = VitrinProduct & { weekHearts: number };

type TrendSource = Pick<VitrinProduct, "productId" | "slug" | "name" | "image">;

// Yayinda olmayan / kampanya disi urunler (sources'ta yok) atlanir. Bari
// adaylarda olmayan urunde ilerleme 0.
export function buildTrend(
  counts: { productId: string; count: number }[],
  sources: Map<string, TrendSource>,
  rows: Map<string, VitrinProduct>
): TrendProduct[] {
  const trend = counts.flatMap(({ productId, count }) => {
    const source = sources.get(productId);
    if (!source) return [];
    const row = rows.get(productId);
    return [{ ...source, points: row?.points ?? 0, threshold: row?.threshold ?? 0, closedRounds: row?.closedRounds ?? 0, weekHearts: count }];
  });
  trend.sort((a, b) => b.weekHearts - a.weekHearts);
  return trend.length < TREND_MIN ? [] : trend.slice(0, TREND_LIMIT);
}

// Onbelleksiz okuma: dogrulama e-postasi yedek urun secimi de kullanir.
export async function loadVitrin() {
  const [bars, trendGroups] = await Promise.all([
    prisma.kalpBar.findMany({
      where: { OR: [{ points: { gt: 0 } }, { closedRounds: { gt: 0 } }] },
      orderBy: { updatedAt: "desc" },
      take: CANDIDATES,
      select: { productId: true, points: true, closedRounds: true, currentRoundId: true }
    }),
    prisma.kalpHeart.groupBy({
      by: ["productId"],
      where: { createdAt: { gte: new Date(Date.now() - TREND_DAYS * 24 * 60 * 60 * 1000) }, status: { in: ["ACTIVE", "WON"] } },
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
      take: TREND_CANDIDATES
    })
  ]);
  if (bars.length === 0 && trendGroups.length === 0) return { near: [], top: [], trend: [] };

  // Trend urunleri ayni urun sorgusuna girer: ek tur yok.
  const productIds = [...new Set([...bars.map((b) => b.productId), ...trendGroups.map((g) => g.productId)])];
  const [rounds, products] = await Promise.all([
    prisma.kalpRound.findMany({ where: { id: { in: bars.map((b) => b.currentRoundId) } }, select: { id: true, threshold: true } }),
    prisma.product.findMany({
      where: { id: { in: productIds }, status: "PUBLISHED", kalpToplaExcluded: false },
      select: {
        id: true,
        slug: true,
        name: true,
        images: { orderBy: { position: "asc" }, take: 1 },
        optionImages: { orderBy: { position: "asc" }, take: 1 }
      }
    })
  ]);
  const thresholds = new Map(rounds.map((r) => [r.id, r.threshold]));
  const byId = new Map(products.map((p) => [p.id, p]));

  const rows: VitrinProduct[] = bars.flatMap((bar) => {
    const product = byId.get(bar.productId);
    const threshold = thresholds.get(bar.currentRoundId);
    if (!product || !threshold) return [];
    return [
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: firstImageUrl(product),
        points: bar.points,
        threshold,
        closedRounds: bar.closedRounds
      }
    ];
  });

  const trend = buildTrend(
    trendGroups.map((g) => ({ productId: g.productId, count: g._count._all })),
    new Map(products.map((p) => [p.id, { productId: p.id, slug: p.slug, name: p.name, image: firstImageUrl(p) }])),
    new Map(rows.map((r) => [r.productId, r]))
  );

  return {
    trend,
    near: rows
      .filter((r) => r.points > 0)
      .sort((a, b) => b.points / b.threshold - a.points / a.threshold)
      .slice(0, NEAR_LIMIT),
    top: rows
      .filter((r) => r.closedRounds > 0)
      .sort((a, b) => b.closedRounds - a.closedRounds)
      .slice(0, TOP_LIMIT)
  };
}

export function getVitrin(mode: string) {
  return unstable_cache(loadVitrin, ["kalp-vitrin", mode], { revalidate: 60 })();
}
