import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export class CouponInvalidError extends Error {}

export interface CouponLine {
  productId: string;
  priceCents: number;
  quantity: number;
  categoryId: string | null;
  brandId: string | null;
}

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
//
// Kupon bir kategori/marka ile kisitlanmissa (categoryId/brandId doluysa),
// min. sepet tutari kontrolu yine sepetin TAM ara toplami uzerinden yapilir,
// ama indirim tutari sadece kisitlamaya uyan satirlarin toplami uzerinden
// hesaplanir (bkz. resolveBundleDiscount, lib/bundles.ts - benzer satir
// bazli pattern).
export async function validateCoupon(tx: Tx, rawCode: string, lines: CouponLine[]): Promise<CouponValidation> {
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

  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  if (subtotalCents < coupon.minOrderCents) {
    return {
      valid: false,
      message: `Bu kupon en az ${(coupon.minOrderCents / 100).toFixed(2)} TL'lik sepetlerde geçerli.`
    };
  }

  const hasRestriction = coupon.categoryId != null || coupon.brandId != null;
  const matchingLines = hasRestriction
    ? lines.filter(
        (l) =>
          (coupon.categoryId == null || l.categoryId === coupon.categoryId) &&
          (coupon.brandId == null || l.brandId === coupon.brandId)
      )
    : lines;

  if (hasRestriction && matchingLines.length === 0) {
    return { valid: false, message: "Bu kupon sepetinizdeki ürünler için geçerli değil." };
  }

  if (coupon.type === "FREE_SHIPPING") {
    return {
      valid: true,
      couponId: coupon.id,
      discountCents: 0,
      freeShipping: !hasRestriction || matchingLines.length === lines.length
    };
  }

  const matchingCents = matchingLines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const discountCents =
    coupon.type === "PERCENT" ? Math.round((matchingCents * coupon.value) / 100) : Math.min(coupon.value, matchingCents);

  return { valid: true, couponId: coupon.id, discountCents, freeShipping: false };
}
