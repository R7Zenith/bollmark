import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { formatDateTime } from "@/lib/format";
import { parseCouponExtension } from "./admin-rules";

type Actor = { actorEmail: string; actorRole: string };

// Musteri detayindan kupon islemleri (KALP_TOPLA_PLANI.md 6.11). Yalniz AVAILABLE
// kupona dokunulur: sepetteki (RESERVED) ve kullanilmis (USED) kupon degismez.

// CANCELLED: admin iptali. Sepet yalniz AVAILABLE okudugu icin kupon gecersiz olur.
export async function cancelCoupon(id: string, customerId: string, actor: Actor): Promise<boolean> {
  const coupon = await prisma.kalpCoupon.findFirst({ where: { id, customerId } });
  if (!coupon) return false;
  const done = await prisma.kalpCoupon.updateMany({ where: { id, status: "AVAILABLE" }, data: { status: "CANCELLED" } });
  if (done.count !== 1) return false;
  await logAudit({
    ...actor,
    action: "KALP_TOPLA_KUPON_IPTAL",
    targetType: "KalpCoupon",
    targetId: id,
    detail: `${coupon.code} iptal edildi`
  });
  return true;
}

export type ExtendResult = "uzatildi" | "degismis" | "gecersiz-tarih";

// expiringEmailAt sifirlanir: "son 6 saat" hatirlatmasi yeni sure icin yine gider.
export async function extendCoupon(id: string, customerId: string, value: string, actor: Actor): Promise<ExtendResult> {
  const coupon = await prisma.kalpCoupon.findFirst({ where: { id, customerId } });
  if (!coupon) return "degismis";
  const expiresAt = parseCouponExtension(value, coupon.expiresAt, new Date());
  if (!expiresAt) return "gecersiz-tarih";
  const done = await prisma.kalpCoupon.updateMany({
    where: { id, status: "AVAILABLE" },
    data: { expiresAt, expiringEmailAt: null }
  });
  if (done.count !== 1) return "degismis";
  await logAudit({
    ...actor,
    action: "KALP_TOPLA_KUPON_UZATILDI",
    targetType: "KalpCoupon",
    targetId: id,
    detail: `${coupon.code}: ${formatDateTime(coupon.expiresAt)} → ${formatDateTime(expiresAt)}`
  });
  return "uzatildi";
}
