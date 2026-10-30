import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

async function orderCouponIds(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({
    where: { orderId, kalpCouponId: { not: null } },
    select: { kalpCouponId: true }
  });
  return items.flatMap((item) => (item.kalpCouponId ? [item.kalpCouponId] : []));
}

// PAID'de kullanilmis olur (plan 5.6). Gec odemede siparis iptaliyle kupon AVAILABLE'a
// donmus olabilir; para alindigi icin yine kullanilmis sayilir.
export async function markOrderCouponsUsed(tx: Tx, orderId: string) {
  const ids = await orderCouponIds(tx, orderId);
  if (ids.length === 0) return;
  await tx.kalpCoupon.updateMany({
    where: { id: { in: ids }, status: { in: ["RESERVED", "AVAILABLE"] } },
    data: { status: "USED", usedAt: new Date() }
  });
}

// Odenmeyen siparis iptal edilince kupon hesaba doner; suresi gectiyse okumada gecersizdir.
export async function releaseOrderCoupons(tx: Tx, orderId: string) {
  const ids = await orderCouponIds(tx, orderId);
  if (ids.length === 0) return;
  await tx.kalpCoupon.updateMany({ where: { id: { in: ids }, status: "RESERVED" }, data: { status: "AVAILABLE" } });
}
