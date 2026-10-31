import { prisma } from "@/lib/prisma";
import { REVENUE_STATUSES } from "@/lib/orders";
import { summarizeCouponSales, summarizeDemand, type ReportScope } from "./admin-rules";

// Admin Kalp Topla raporu (KALP_TOPLA_PLANI.md 6.11). Gercek ve test verisi hic
// karismaz (Y12). since null: tum zamanlar. Aktif barlar ve bekleyen bonus anliktir.
export async function getKalpReport(scope: ReportScope, since: Date | null) {
  const isTest = scope === "test";
  const now = new Date();
  const period = since ? { gte: since } : undefined;

  const [testRounds, testCoupons] = await Promise.all([
    prisma.kalpRound.findMany({ where: { isTest: true }, select: { id: true } }),
    prisma.kalpCoupon.findMany({ where: { isTest: true }, select: { id: true } })
  ]);
  const testRoundIds = testRounds.map((r) => r.id);

  const [
    couponsGiven,
    couponsUsed,
    couponsExpired,
    saleItems,
    validInvites,
    reviewInvites,
    waitingBonuses,
    expiredBonuses,
    openRounds,
    closedRounds,
    hearts
  ] = await Promise.all([
    prisma.kalpCoupon.count({ where: { isTest, status: { not: "TEST_CANCELLED" }, createdAt: period } }),
    prisma.kalpCoupon.count({ where: { isTest, status: "USED", usedAt: period } }),
    prisma.kalpCoupon.count({ where: { isTest, status: "AVAILABLE", expiresAt: { lt: now, ...period } } }),
    prisma.orderItem.findMany({
      where: { kalpCouponId: { not: null }, order: { status: { in: REVENUE_STATUSES }, deletedAt: null, createdAt: period } },
      select: { orderId: true, kalpCouponId: true, totalCents: true, order: { select: { kalpTestAt: true, kalpDiscountCents: true } } }
    }),
    prisma.kalpInvite.count({ where: { isTest, status: "CREDITED", createdAt: period } }),
    prisma.kalpInvite.count({ where: { isTest, status: "UNDER_REVIEW", createdAt: period } }),
    prisma.kalpBonusCredit.count({ where: { isTest, status: "WAITING" } }),
    prisma.kalpBonusCredit.count({ where: { isTest, status: "EXPIRED", expiresAt: period } }),
    prisma.kalpRound.findMany({ where: { isTest, status: "OPEN" }, select: { id: true, productId: true, roundNo: true, threshold: true } }),
    prisma.kalpRound.findMany({
      where: { isTest, status: "CLOSED", closedAt: period },
      orderBy: { closedAt: "desc" },
      select: { id: true, productId: true, roundNo: true, threshold: true, closedAt: true }
    }),
    // KalpHeart'ta isTest yok, testligi turundan gelir.
    prisma.kalpHeart.findMany({
      where: { roundId: isTest ? { in: testRoundIds } : { notIn: testRoundIds }, createdAt: period },
      select: { productId: true, customerId: true, status: true }
    })
  ]);

  const [bars, roundCoupons] = await Promise.all([
    prisma.kalpBar.findMany({ where: { currentRoundId: { in: openRounds.map((r) => r.id) }, points: { gt: 0 } }, orderBy: { points: "desc" } }),
    prisma.kalpCoupon.groupBy({ by: ["roundId"], where: { roundId: { in: closedRounds.map((r) => r.id) } }, _count: { _all: true } })
  ]);
  const roundById = new Map(openRounds.map((r) => [r.id, r]));
  const couponsByRound = new Map(roundCoupons.map((r) => [r.roundId, r._count._all]));

  const filled = new Map<string, number>();
  for (const round of closedRounds) filled.set(round.productId, (filled.get(round.productId) ?? 0) + 1);

  const demand = summarizeDemand(hearts);
  const activeBars = bars.map((bar) => {
    const round = roundById.get(bar.currentRoundId)!;
    return { productId: bar.productId, points: bar.points, threshold: round.threshold, roundNo: round.roundNo };
  });

  const productIds = [...new Set([...closedRounds.map((r) => r.productId), ...activeBars.map((b) => b.productId), ...demand.map((d) => d.productId)])];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } });

  return {
    coupons: { given: couponsGiven, used: couponsUsed, expired: couponsExpired },
    sales: summarizeCouponSales(saleItems, new Set(testCoupons.map((c) => c.id)), scope),
    invites: { valid: validInvites, underReview: reviewInvites },
    bonuses: { waiting: waitingBonuses, expired: expiredBonuses },
    topProducts: [...filled].map(([productId, rounds]) => ({ productId, rounds })).sort((a, b) => b.rounds - a.rounds),
    activeBars,
    closedRounds: closedRounds.map((r) => ({ ...r, coupons: couponsByRound.get(r.id) ?? 0 })),
    demand,
    productNames: new Map(products.map((p) => [p.id, p.name]))
  };
}
