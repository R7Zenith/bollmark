import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { firstImageUrl } from "@/lib/catalog";

// /kalp-topla listeleri (KALP_TOPLA_PLANI.md 6.8): dolmak uzere olanlar ve en
// cok dolanlar. Reklam trafigi tek sayfaya gelecegi icin 60 sn onbelleklenir;
// mod anahtara girer, test turlari acik yayin listesine karismaz.
const NEAR_LIMIT = 4;
const TOP_LIMIT = 6;
const CANDIDATES = 200;

export type VitrinProduct = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  points: number;
  threshold: number;
  closedRounds: number;
};

async function loadVitrin() {
  const bars = await prisma.kalpBar.findMany({
    where: { OR: [{ points: { gt: 0 } }, { closedRounds: { gt: 0 } }] },
    orderBy: { updatedAt: "desc" },
    take: CANDIDATES,
    select: { productId: true, points: true, closedRounds: true, currentRoundId: true }
  });
  if (bars.length === 0) return { near: [], top: [] };

  const [rounds, products] = await Promise.all([
    prisma.kalpRound.findMany({ where: { id: { in: bars.map((b) => b.currentRoundId) } }, select: { id: true, threshold: true } }),
    prisma.product.findMany({
      where: { id: { in: bars.map((b) => b.productId) }, status: "PUBLISHED", kalpToplaExcluded: false },
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

  return {
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
