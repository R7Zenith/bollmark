import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { cancelExpiredOrder, expireAttemptsIfDead } from "@/lib/payment/orders/expire";

// Acik'a geciste test verisi sifirlamasi (KALP_TOPLA_PLANI.md 5.0, Y12, Y15).
// Test verisi varken HERHANGI bir moddan LIVE'a geciste calisir.

export type UnpaidTestOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  totalCents: number;
  createdAt: Date;
  status: string;
  paymentStatus: string;
};

export type TestResetSummary = {
  rounds: number;
  hearts: number;
  invites: number;
  waitingBonuses: number;
  unusedCoupons: number;
  paidOrders: number;
  unpaidOrders: UnpaidTestOrder[];
};

async function testCouponOrders(status: "RESERVED" | "USED") {
  const coupons = await prisma.kalpCoupon.findMany({ where: { isTest: true, status }, select: { id: true } });
  if (coupons.length === 0) return [];
  const items = await prisma.orderItem.findMany({
    where: { kalpCouponId: { in: coupons.map((c) => c.id) } },
    select: { orderId: true }
  });
  return [...new Set(items.map((i) => i.orderId))];
}

// Test verisi yoksa null: gecis onay penceresi gerekmez.
export async function getTestResetSummary(): Promise<TestResetSummary | null> {
  const testRounds = await prisma.kalpRound.findMany({ where: { isTest: true }, select: { id: true } });
  const [hearts, invites, credits, waitingBonuses, unusedCoupons, reservedOrderIds, usedOrderIds] = await Promise.all([
    prisma.kalpHeart.count({ where: { roundId: { in: testRounds.map((r) => r.id) } } }),
    prisma.kalpInvite.count({ where: { isTest: true } }),
    prisma.kalpBonusCredit.count({ where: { isTest: true } }),
    prisma.kalpBonusCredit.count({ where: { isTest: true, status: "WAITING" } }),
    prisma.kalpCoupon.count({ where: { isTest: true, status: "AVAILABLE" } }),
    testCouponOrders("RESERVED"),
    testCouponOrders("USED")
  ]);
  const [unpaidOrders, paidOrders] = await Promise.all([
    prisma.order.findMany({
      where: { id: { in: reservedOrderIds } },
      select: { id: true, orderNumber: true, customerName: true, totalCents: true, createdAt: true, status: true, paymentStatus: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.order.count({ where: { id: { in: usedOrderIds }, kalpTestAt: null } })
  ]);

  const hasData =
    testRounds.length > 0 || invites > 0 || credits > 0 || unusedCoupons > 0 || unpaidOrders.length > 0 || paidOrders > 0;
  if (!hasData) return null;
  return { rounds: testRounds.length, hearts, invites, waitingBonuses, unusedCoupons, paidOrders, unpaidOrders };
}

export type TestResetResult =
  | { ok: true; summary: TestResetSummary | null; cancelledOrders: string[] }
  | { ok: false; reason: "ORDERS_NOT_CONFIRMED" | "PAYMENT_IN_PROGRESS"; orderNumber?: string };

function isCancellable(order: UnpaidTestOrder) {
  return order.status === "PENDING_PAYMENT" && (order.paymentStatus === "UNPAID" || order.paymentStatus === "FAILED");
}

// cancelOrders: admin "Siparisleri iptal et ve devam et" dedi. Odenmemis test
// siparisi varken bu onay yoksa hicbir sey degismez.
export async function switchToLiveWithReset(params: {
  cancelOrders: boolean;
  actorEmail: string;
  actorRole: string;
  previousModeLabel: string;
}): Promise<TestResetResult> {
  const summary = await getTestResetSummary();
  const cancelledOrders: string[] = [];

  if (summary && summary.unpaidOrders.length > 0) {
    if (!params.cancelOrders) return { ok: false, reason: "ORDERS_NOT_CONFIRMED" };
    // Once hepsi kontrol edilir: odeme denemesi hala canliysa (expire.ts
    // kurali) hicbir siparis iptal edilmez, gecis durur.
    for (const order of summary.unpaidOrders) {
      if (order.status === "CANCELLED") continue;
      if (!isCancellable(order)) return { ok: false, reason: "PAYMENT_IN_PROGRESS", orderNumber: order.orderNumber };
      const { allowCancel } = await expireAttemptsIfDead(order.id);
      if (!allowCancel) return { ok: false, reason: "PAYMENT_IN_PROGRESS", orderNumber: order.orderNumber };
    }
    for (const order of summary.unpaidOrders) {
      if (order.status === "CANCELLED") continue;
      if (!(await cancelExpiredOrder(order.id))) {
        return { ok: false, reason: "PAYMENT_IN_PROGRESS", orderNumber: order.orderNumber };
      }
      cancelledOrders.push(order.orderNumber);
    }
  }

  const usedOrderIds = await testCouponOrders("USED");
  await prisma.$transaction(async (tx) => {
    const testRounds = await tx.kalpRound.findMany({ where: { isTest: true }, select: { id: true, productId: true } });
    const roundIds = testRounds.map((r) => r.id);
    await tx.kalpHeart.deleteMany({ where: { roundId: { in: roundIds } } });
    await tx.kalpBonusCredit.deleteMany({ where: { isTest: true } });
    await tx.kalpInvite.deleteMany({ where: { isTest: true } });
    // Test turu olan urunlerin barlari silinir; ilk kalpte normal esikle acilir.
    await tx.kalpBar.deleteMany({ where: { productId: { in: [...new Set(testRounds.map((r) => r.productId))] } } });
    await tx.kalpRound.deleteMany({ where: { id: { in: roundIds } } });
    // Kullanilmamis (ve iptal edilen siparislerde ayrilmis) test kuponlari silinmez (Y15).
    await tx.kalpCoupon.updateMany({
      where: { isTest: true, status: { in: ["AVAILABLE", "RESERVED"] } },
      data: { status: "TEST_CANCELLED" }
    });
    // Odenmis test siparisleri silinmez, raporlardan haric tutulmak icin isaretlenir.
    await tx.order.updateMany({ where: { id: { in: usedOrderIds }, kalpTestAt: null }, data: { kalpTestAt: new Date() } });
    await tx.kalpToplaSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", mode: "LIVE" },
      update: { mode: "LIVE" }
    });
  });

  const actor = { actorEmail: params.actorEmail, actorRole: params.actorRole };
  if (summary) {
    await logAudit({
      ...actor,
      action: "KALP_TOPLA_TEST_SIFIRLANDI",
      targetType: "KalpToplaSettings",
      targetId: "singleton",
      detail:
        `${summary.rounds} test turu, ${summary.hearts} kalp, ${summary.invites} davet, ${summary.waitingBonuses} bekleyen bonus, ` +
        `${summary.unusedCoupons} kullanılmamış test kuponu iptal, ${summary.paidOrders} ödenmiş test siparişi işaretlendi` +
        (cancelledOrders.length > 0 ? `; iptal edilen siparişler: ${cancelledOrders.join(", ")}` : "")
    });
  }
  await logAudit({
    ...actor,
    action: "KALP_TOPLA_MOD_DEGISTI",
    targetType: "KalpToplaSettings",
    targetId: "singleton",
    detail: `${params.previousModeLabel} → Açık`
  });
  return { ok: true, summary, cancelledOrders };
}
