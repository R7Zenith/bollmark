import type { Prisma, PrismaClient, Order } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { LOYALTY_REDEEM_RATE_CENTS, LOYALTY_EARN_RATE } from "@/lib/loyalty-constants";

type Tx = PrismaClient | Prisma.TransactionClient;

export { LOYALTY_EARN_RATE, LOYALTY_REDEEM_RATE_CENTS };

export class LoyaltyInvalidError extends Error {}

// coupons.ts'teki validateCoupon ile ayni desen - indirim tutari ASLA
// istemciden gelen degerle degil, HER ZAMAN burada sunucuda yeniden
// hesaplanir/dogrulanir. Bakiyeyi asan veya negatif istek reddedilir.
export async function resolveLoyaltyRedemption(
  tx: Tx,
  customerId: string | null,
  pointsToRedeem: number,
  subtotalCents: number
): Promise<{ pointsRedeemed: number; discountCents: number }> {
  if (!pointsToRedeem) return { pointsRedeemed: 0, discountCents: 0 };
  if (!Number.isInteger(pointsToRedeem) || pointsToRedeem < 0) {
    throw new LoyaltyInvalidError("Geçersiz puan miktarı.");
  }
  if (!customerId) {
    throw new LoyaltyInvalidError("Puan kullanmak için giriş yapmalısınız.");
  }

  const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { loyaltyPoints: true } });
  if (!customer) throw new LoyaltyInvalidError("Müşteri bulunamadı.");
  if (pointsToRedeem > customer.loyaltyPoints) {
    throw new LoyaltyInvalidError("Puan bakiyeniz yetersiz.");
  }

  const discountCents = Math.min(pointsToRedeem * LOYALTY_REDEEM_RATE_CENTS, subtotalCents);
  return { pointsRedeemed: pointsToRedeem, discountCents };
}

// order-notifications.ts'teki notifyCustomerStatusChange ile ayni desen -
// siparis DELIVERED oldugunda cagrilir, cagiran taraf best-effort (.catch)
// ile sarmalar ki hata durum guncellemesini engellemesin. Misafir siparişte
// (customerId null) veya zaten puan verilmisse (durum ileri geri oynatilirsa)
// tekrar puan verilmez.
export async function awardLoyaltyPoints(order: Order): Promise<void> {
  if (!order.customerId || order.pointsEarned > 0) return;

  const points = Math.floor((order.totalCents * LOYALTY_EARN_RATE) / 100);
  if (points <= 0) return;

  await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: { customerId: order.customerId, points, reason: "SIPARIS_KAZANC", orderId: order.id }
    }),
    prisma.customer.update({ where: { id: order.customerId }, data: { loyaltyPoints: { increment: points } } }),
    prisma.order.update({ where: { id: order.id }, data: { pointsEarned: points } })
  ]);
}
