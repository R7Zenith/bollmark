import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { effectivePrice, effectiveCompareAt } from "@/lib/variant";
import { getActiveAutomaticPercentCampaigns, resolveBestDiscount, resolveProductDisplayPrice } from "@/lib/coupons";
import { resolveBundleDiscount } from "@/lib/bundles";
import { LOYALTY_REDEEM_RATE_CENTS, resolveLoyaltyRedemption } from "@/lib/loyalty";
import { calculateShippingCents } from "@/lib/shipping";
import { lockCustomer } from "@/lib/kalp-topla/bar";
import { campaignStateFor } from "@/lib/kalp-topla/settings";
import { assignKalpCoupons, couponGain, type KalpAssignment, type KalpPriceLine, type KalpSelection } from "@/lib/kalp-topla/pricing";

type Tx = PrismaClient | Prisma.TransactionClient;

export class KalpCouponInvalidError extends Error {}

export type CartInputLine = { productId: string; variantId: string; quantity: number };

export type PriceLine = CartInputLine & {
  priceCents: number;
  compareAtCents: number | null;
  categoryId: string | null;
  brandId: string | null;
  gender: string | null;
  excluded: boolean;
};

// Fiyat hicbir zaman istemciden gelmez: satirlar DB'den yeniden okunur.
// Silinmis urun/varyant varsa null.
export async function loadPriceLines(db: Tx, lines: CartInputLine[]): Promise<PriceLine[] | null> {
  const products = await db.product.findMany({
    where: { id: { in: [...new Set(lines.map((l) => l.productId))] } },
    include: { variants: true }
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const resolved: PriceLine[] = [];
  for (const line of lines) {
    const product = productById.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) return null;
    resolved.push({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      priceCents: effectivePrice(product, variant),
      compareAtCents: effectiveCompareAt(product, variant),
      categoryId: product.categoryId,
      brandId: product.brandId,
      gender: product.gender,
      excluded: product.kalpToplaExcluded
    });
  }
  return resolved;
}

const noSelection: KalpSelection = { manual: [], removed: [] };

// Uye icin gecerli kuponlar. Kod, kullanilabilir bir Kalp Topla kuponuysa zorunlu
// atanir; baska birinin ya da gecersiz kodun mesaji doner (plan 5.6 madde 3).
async function loadKalp(db: Tx, customerId: string | null, code: string | null) {
  const row = code ? await db.kalpCoupon.findUnique({ where: { code } }) : null;
  const state = customerId ? await campaignStateFor(customerId) : "INVISIBLE";
  const visible = state !== "INVISIBLE";
  const coupons = visible
    ? await db.kalpCoupon.findMany({ where: { customerId: customerId!, status: "AVAILABLE", expiresAt: { gt: new Date() } } })
    : [];
  if (!row) return { coupons, normalCode: code, forcedCouponId: null, codeMessage: null };

  if (!customerId) return { coupons, normalCode: null, forcedCouponId: null, codeMessage: "Kalp Topla kuponu için giriş yapmalısın." };
  if (!visible) return { coupons, normalCode: null, forcedCouponId: null, codeMessage: "Kupon kodu bulunamadı." };
  const usable = coupons.some((c) => c.id === row.id);
  return {
    coupons,
    normalCode: null,
    forcedCouponId: usable ? row.id : null,
    codeMessage: usable ? null : "Bu Kalp Topla kuponu sana ait değil ya da artık geçerli değil."
  };
}

export async function withCurrentBest(db: Tx, lines: PriceLine[]): Promise<KalpPriceLine[]> {
  const campaigns = await getActiveAutomaticPercentCampaigns(db);
  return lines.map((line) => ({
    variantId: line.variantId,
    priceCents: line.priceCents,
    compareAtCents: line.compareAtCents,
    currentBestCents: resolveProductDisplayPrice(campaigns, line).finalPriceCents,
    excluded: line.excluded
  }));
}

async function reserveCoupons(tx: Tx, customerId: string, assignments: KalpAssignment[]) {
  const reserved = await tx.kalpCoupon.updateMany({
    where: {
      id: { in: assignments.map((a) => a.couponId) },
      customerId,
      status: "AVAILABLE",
      expiresAt: { gt: new Date() }
    },
    data: { status: "RESERVED" }
  });
  if (reserved.count !== assignments.length) {
    throw new KalpCouponInvalidError("Kalp Topla kuponun artık geçerli değil. Lütfen sepetini kontrol et.");
  }
}

// Sepet ve siparisin TEK fiyat hesabi (KALP_TOPLA_PLANI.md 5.6, T17). Sira: kalp
// atamasi, kuponlu adetler cikarilmis satirlarla bundle ve kupon, puan, kargo.
// ORDER modu transaction icinde cagrilir: uye kilitlenir, kuponlar RESERVED olur.
export async function priceCart(
  db: Tx,
  input: {
    customerId: string | null;
    lines: PriceLine[];
    couponCode: string | null;
    kalpSelection?: KalpSelection;
    pointsToRedeem?: number;
    defaultShippingCents: number;
    mode: "PREVIEW" | "ORDER";
  }
) {
  const { customerId, lines, defaultShippingCents, mode } = input;
  if (mode === "ORDER" && customerId) await lockCustomer(db as Prisma.TransactionClient, customerId);

  const code = input.couponCode?.trim().toUpperCase() || null;
  const kalp = await loadKalp(db, customerId, code);
  const selection = input.kalpSelection ?? noSelection;
  const percent = kalp.coupons[0]?.discountPercent ?? 0;
  const priceLines = kalp.coupons.length > 0 ? await withCurrentBest(db, lines) : [];
  const assignments = assignKalpCoupons(priceLines, kalp.coupons, selection, kalp.forcedCouponId);
  const assignmentOf = new Map(assignments.map((a) => [a.variantId, a]));
  const forcedApplied = assignments.some((a) => a.couponId === kalp.forcedCouponId);
  const kalpCodeMessage =
    kalp.codeMessage ?? (kalp.forcedCouponId && !forcedApplied ? "Bu kupon sepetindeki ürünlere uygulanamadı." : null);

  if (mode === "ORDER") {
    if (kalpCodeMessage) throw new KalpCouponInvalidError(kalpCodeMessage);
    if (assignments.length > 0) await reserveCoupons(db, customerId!, assignments);
  }

  const remaining = lines
    .map((line) => ({ ...line, quantity: line.quantity - (assignmentOf.has(line.variantId) ? 1 : 0) }))
    .filter((line) => line.quantity > 0);
  const remainingCents = remaining.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const couponUnitsCents = assignments.reduce((sum, a) => sum + a.unitCents, 0);
  const fullSubtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);

  const { discountCents: bundleDiscountCents } = await resolveBundleDiscount(db, remaining);
  const best = await resolveBestDiscount(db, kalp.normalCode, remaining);

  // T7: puan yalniz kuponsuz satirlara harcanir. Tavani asan puan bakiyeden dusmez.
  const pointsCapCents = Math.max(0, remainingCents - bundleDiscountCents - best.discountCents);
  const requestedPoints = Math.min(input.pointsToRedeem ?? 0, Math.floor(pointsCapCents / LOYALTY_REDEEM_RATE_CENTS));
  const loyalty = await resolveLoyaltyRedemption(db, customerId, requestedPoints, pointsCapCents);

  const netSubtotalCents = remainingCents + couponUnitsCents;
  const totalDiscountCents = Math.min(remainingCents, bundleDiscountCents + best.discountCents + loyalty.discountCents);
  const shippingCents = calculateShippingCents(netSubtotalCents - totalDiscountCents, best.freeShipping, defaultShippingCents);

  return {
    fullSubtotalCents,
    // Kuponlu birimler net fiyatiyla dahildir: OrderItem toplamlari buna esittir.
    subtotalCents: netSubtotalCents,
    kalpDiscountCents: fullSubtotalCents - netSubtotalCents,
    bundleDiscountCents,
    best,
    pointsRedeemed: loyalty.pointsRedeemed,
    loyaltyDiscountCents: loyalty.discountCents,
    pointsCapCents,
    shippingCents,
    totalCents: netSubtotalCents - totalDiscountCents + shippingCents,
    assignments,
    kalpCodeMessage,
    kalpCodeApplied: forcedApplied,
    kalp: {
      couponCount: kalp.coupons.length,
      lines: assignments.map((a) => ({ variantId: a.variantId, unitCents: a.unitCents, originalUnitCents: a.originalUnitCents })),
      // [Kupon uygula]: bosta kupon varken kazanc saglayan kuponsuz satirlar.
      applicable:
        assignments.length < kalp.coupons.length
          ? priceLines.filter((l) => couponGain(l, percent) > 0 && !assignmentOf.has(l.variantId)).map((l) => l.variantId)
          : []
    }
  };
}
