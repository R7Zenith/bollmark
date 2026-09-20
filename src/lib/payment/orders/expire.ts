import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { logPayment } from "@/lib/payment/log";
import { reconcileToken } from "@/lib/payment/orders/reconcile";

// Sure dolumu ve mutabakat (bkz. plan 5.E). Terk edilen odemeler sonsuza kadar beklemesin,
// kupon hakki/sadakat puani bagli kalmasin diye. Tetikleyiciler: gunluk cron, baslatma
// ve admin siparis listesi acilisinda kucuk parti (lazy), admin "iyzico'dan sorgula" butonu.

const STALE_ATTEMPT_MS = 2 * 60 * 1000;
// Sorgu API hatasi veriyorsa (ag sorunu / iyzico kesintisi ile "token yok" ayirt edilemez) bir
// deneme bu kadar yasa gelmeden EXPIRED sayilmaz: parasi alinmis bir siparis yanlislikla
// iptal edilmesin.
const ERROR_GRACE_MS = 6 * 60 * 60 * 1000;

async function expireAttemptsIfDead(orderId: string) {
  const attempts = await prisma.paymentAttempt.findMany({ where: { orderId, status: "INITIATED" } });
  let allowCancel = true;
  for (const attempt of attempts) {
    const result = await reconcileToken(attempt.token, "cron");
    if (result.kind === "paid" || result.kind === "double" || result.kind === "late" || result.kind === "review" || result.kind === "invalid") {
      allowCancel = false;
    } else if (result.kind === "pending") {
      // Odeme suruyor gibi gorunuyor; siparis suresi zaten dolmus, token 30 dk sonra olur.
      allowCancel = allowCancel && Date.now() - attempt.createdAt.getTime() > 35 * 60 * 1000;
    } else if (result.kind === "error") {
      allowCancel = allowCancel && Date.now() - attempt.createdAt.getTime() > ERROR_GRACE_MS;
    }
  }
  return allowCancel;
}

// Kupon hakki ve puani geri verir, denemeleri EXPIRED yapar. Tek kazanan: kosullu updateMany.
export async function cancelExpiredOrder(orderId: string): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT", paymentStatus: { in: ["UNPAID", "FAILED"] } },
      data: { status: "CANCELLED", paymentExpiresAt: null }
    });
    if (claimed.count !== 1) return null;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

    if (order.couponId) {
      await tx.coupon.updateMany({ where: { id: order.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    }
    if (order.pointsRedeemed > 0 && order.customerId) {
      await tx.loyaltyTransaction.create({
        data: { customerId: order.customerId, points: order.pointsRedeemed, reason: "SIPARIS_IADE", orderId: order.id }
      });
      await tx.customer.update({ where: { id: order.customerId }, data: { loyaltyPoints: { increment: order.pointsRedeemed } } });
    }
    await tx.paymentAttempt.updateMany({
      where: { orderId, status: "INITIATED" },
      data: { status: "EXPIRED", completedAt: new Date() }
    });
    return order;
  });
  if (!result) return false;

  await logPayment({
    kind: "EXPIRE",
    ok: true,
    orderId,
    summary: `Ödeme süresi doldu, sipariş iptal edildi${result.couponId ? "; kupon hakkı geri verildi" : ""}${
      result.pointsRedeemed > 0 ? `; ${result.pointsRedeemed} puan iade edildi` : ""
    }`
  });
  await logAudit({
    actorEmail: "sistem",
    actorRole: "SISTEM",
    action: "ORDER_STATUS_CHANGED",
    targetType: "Order",
    targetId: orderId,
    detail: "PENDING_PAYMENT -> CANCELLED (ödeme süresi doldu)"
  });
  return true;
}

// Suresi dolan, hala odenmemis siparisler: once son bir sorgu (odemis olabilir), sonra iptal.
export async function expirePendingOrders(batch = 20): Promise<{ checked: number; cancelled: number }> {
  const orders = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      paymentStatus: { in: ["UNPAID", "FAILED"] },
      deletedAt: null,
      paymentExpiresAt: { lt: new Date() }
    },
    select: { id: true },
    orderBy: { paymentExpiresAt: "asc" },
    take: batch
  });
  let cancelled = 0;
  for (const { id } of orders) {
    try {
      if (!(await expireAttemptsIfDead(id))) continue;
      if (await cancelExpiredOrder(id)) cancelled += 1;
    } catch (error) {
      console.error("Sipariş süre dolumu işlenemedi (sonraki turda denenecek):", error);
    }
  }
  return { checked: orders.length, cancelled };
}

// Callback/webhook hic ulasmadiysa (tarayici kapandi vb.) odenmis olabilecek denemeleri sorgular.
export async function reconcileStaleAttempts(batch = 20): Promise<{ checked: number }> {
  const attempts = await prisma.paymentAttempt.findMany({
    where: {
      status: "INITIATED",
      createdAt: { lt: new Date(Date.now() - STALE_ATTEMPT_MS), gt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
    },
    orderBy: { createdAt: "asc" },
    take: batch
  });
  for (const attempt of attempts) {
    try {
      await reconcileToken(attempt.token, "cron");
    } catch (error) {
      console.error("Ödeme mutabakatı başarısız (sonraki turda denenecek):", error);
    }
  }
  return { checked: attempts.length };
}

export async function sweepPayments(batch = 20) {
  const reconciled = await reconcileStaleAttempts(batch);
  const expired = await expirePendingOrders(batch);
  return { reconciled: reconciled.checked, ...expired };
}
