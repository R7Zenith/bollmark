import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit-log";
import { getKalpSettings } from "@/lib/kalp-topla/settings";
import { couponRestoreExpiry, isLineFullyRefunded, wasShipped } from "@/lib/kalp-topla/return-rules";

type Tx = PrismaClient | Prisma.TransactionClient;

export type RestoreResult = { kind: "RESTORED" | "EXPIRED"; couponId: string; orderItemId: string };

export function logRestoreResults(actor: { email: string; role: string }, results: RestoreResult[]) {
  for (const result of results) {
    logAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: result.kind === "RESTORED" ? "KALP_TOPLA_KUPON_GERI_YUKLENDI" : "KALP_TOPLA_KUPON_GERI_YUKLENMEDI",
      targetType: "KalpCoupon",
      targetId: result.couponId,
      detail: result.kind === "RESTORED" ? `Sipariş satırı ${result.orderItemId}` : `Süresi dolmuştu, sipariş satırı ${result.orderItemId}`
    });
  }
}

async function orderCouponIds(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({
    where: { orderId, kalpCouponId: { not: null } },
    select: { kalpCouponId: true }
  });
  return items.flatMap((item) => (item.kalpCouponId ? [item.kalpCouponId] : []));
}

// PAID'de kullanilmis olur (plan 5.6). Gec odemede siparis iptaliyle kupon AVAILABLE'a
// donmus olabilir; para alindigi icin yine kullanilmis sayilir. Odeme alinmis oldugundan
// siparis durdurulamaz: kupon bu arada baska yerde kullanildiysa dikkat notu doner.
export async function markOrderCouponsUsed(tx: Tx, orderId: string): Promise<string | null> {
  const ids = await orderCouponIds(tx, orderId);
  if (ids.length === 0) return null;
  const used = await tx.kalpCoupon.updateMany({
    where: { id: { in: ids }, status: { in: ["RESERVED", "AVAILABLE"] } },
    data: { status: "USED", usedAt: new Date() }
  });
  return used.count === ids.length ? null : "Kalp Topla kuponu bu ödemeden önce başka bir siparişte kullanılmış; siparişi kontrol edin";
}

// Odenmeyen siparis iptal edilince kupon hesaba doner; suresi gectiyse okumada gecersizdir.
export async function releaseOrderCoupons(tx: Tx, orderId: string) {
  const ids = await orderCouponIds(tx, orderId);
  if (ids.length === 0) return;
  await tx.kalpCoupon.updateMany({ where: { id: { in: ids }, status: "RESERVED" }, data: { status: "AVAILABLE" } });
}

// Satir basina bir kez calisir: kalpRestoredAt doluysa iddia basarisiz olur.
async function restoreLine(
  tx: Tx,
  item: { id: string; kalpCouponId: string },
  input: { afterShipping: boolean; extraHours: number; skipTest: boolean }
): Promise<RestoreResult | null> {
  const coupon = await tx.kalpCoupon.findUnique({ where: { id: item.kalpCouponId } });
  if (!coupon || coupon.status !== "USED" || (coupon.isTest && input.skipTest)) return null;

  const now = new Date();
  const expiresAt = couponRestoreExpiry({
    expiresAt: coupon.expiresAt,
    usedAt: coupon.usedAt,
    now,
    extraHours: input.extraHours,
    afterShipping: input.afterShipping
  });
  if (!expiresAt) return { kind: "EXPIRED", couponId: coupon.id, orderItemId: item.id };

  const claimed = await tx.orderItem.updateMany({ where: { id: item.id, kalpRestoredAt: null }, data: { kalpRestoredAt: now } });
  if (claimed.count !== 1) return null;
  const restored = await tx.kalpCoupon.updateMany({
    where: { id: coupon.id, status: "USED" },
    data: { status: "AVAILABLE", usedAt: null, expiresAt, restoredAt: now }
  });
  if (restored.count !== 1) throw new Error(`Kalp kuponu geri yüklenemedi: ${coupon.id}`);

  await tx.notification.create({
    data: {
      customerId: coupon.customerId,
      type: "COUPON_RESTORED",
      eventKey: `coupon-restored:${item.id}`,
      title: "Kuponun hesabına geri döndü",
      body: "İade edilen ürününün Kalp Topla kuponu yeniden kullanılabilir.",
      link: "/hesap/kalplerim",
      emailStatus: "NOT_APPLICABLE",
      pushStatus: "NOT_APPLICABLE"
    }
  });
  return { kind: "RESTORED", couponId: coupon.id, orderItemId: item.id };
}

// Ucret iadesi basarili olunca ve iade talebi tamamlaninca cagrilir (plan 5.8). Tam iade
// edilmis kuponlu satir: kargodan onceyse yeter, kargolanmissa tamamlanmis IADE talebi de ister.
export async function restoreOrderCoupons(tx: Tx, orderId: string): Promise<RestoreResult[]> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, shipment: true, returnRequests: { where: { type: "IADE", status: "TAMAMLANDI" } } }
  });
  const lines = order.items.filter((item) => item.kalpCouponId && !item.kalpRestoredAt && isLineFullyRefunded(item));
  if (lines.length === 0) return [];

  const afterShipping = wasShipped(order);
  const { refundExtraHours } = await getKalpSettings();
  const results: RestoreResult[] = [];
  for (const item of lines) {
    if (afterShipping && !order.returnRequests.some((rr) => rr.itemsJson.includes(`"${item.id}"`))) continue;
    const result = await restoreLine(tx, { id: item.id, kalpCouponId: item.kalpCouponId! }, {
      afterShipping,
      extraHours: refundExtraHours,
      skipTest: order.kalpTestAt !== null
    });
    if (result) results.push(result);
  }
  return results;
}

// Kampanya disi urunle degisim: ucret iadesi olmadan kupon kalan suresiyle doner (T6).
export async function restoreExchangeCoupon(tx: Tx, item: { id: string; kalpCouponId: string }): Promise<RestoreResult | null> {
  const { refundExtraHours } = await getKalpSettings();
  return restoreLine(tx, item, { afterShipping: true, extraHours: refundExtraHours, skipTest: true });
}
