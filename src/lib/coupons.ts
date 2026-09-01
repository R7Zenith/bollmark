import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export class CouponInvalidError extends Error {}

export type CouponValidation =
  | { valid: true; couponId: string; discountCents: number; freeShipping: boolean }
  | { valid: false; message: string };

// Kupon dogrulama mantigi hem onizleme endpoint'i (/api/kuponlar/dogrula,
// baglayici olmayan anlik geri bildirim icin) hem de nihai siparis olusturma
// (orders/route.ts, $transaction icinde) tarafindan kullanilir - indirim
// tutari ASLA istemciden gelen degerle degil, HER ZAMAN burada sunucuda
// yeniden hesaplanir. orders/route.ts tarafinda tx (Prisma.TransactionClient)
// gecirilir ki usedCount artisiyla ayni transaction icinde atomik calissin
// ve yaris durumunda (iki musterinin son kullanim hakkini ayni anda
// tuketmesi) limit asilmasin.
export async function validateCoupon(tx: Tx, rawCode: string, subtotalCents: number): Promise<CouponValidation> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, message: "Kod girilmedi." };

  const coupon = await tx.coupon.findUnique({ where: { code } });
  if (!coupon) return { valid: false, message: "Kupon kodu bulunamadı." };
  if (!coupon.isActive) return { valid: false, message: "Bu kupon artık aktif değil." };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { valid: false, message: "Bu kupon henüz başlamadı." };
  if (coupon.expiresAt && coupon.expiresAt < now) return { valid: false, message: "Bu kuponun süresi doldu." };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: "Bu kuponun kullanım limiti doldu." };
  }
  if (subtotalCents < coupon.minOrderCents) {
    return {
      valid: false,
      message: `Bu kupon en az ${(coupon.minOrderCents / 100).toFixed(2)} TL'lik sepetlerde geçerli.`
    };
  }

  const discountCents =
    coupon.type === "PERCENT"
      ? Math.round((subtotalCents * coupon.value) / 100)
      : coupon.type === "FIXED"
        ? Math.min(coupon.value, subtotalCents)
        : 0;

  return { valid: true, couponId: coupon.id, discountCents, freeShipping: coupon.type === "FREE_SHIPPING" };
}
