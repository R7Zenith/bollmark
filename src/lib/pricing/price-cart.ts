import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { effectivePrice, effectiveCompareAt } from "@/lib/variant";
import { getActiveAutomaticPercentCampaigns, resolveBestDiscount, resolveProductDisplayPrice } from "@/lib/coupons";
import { resolveBundleDiscount } from "@/lib/bundles";
import { LOYALTY_REDEEM_RATE_CENTS, resolveLoyaltyRedemption } from "@/lib/loyalty";
import { calculateShippingCents } from "@/lib/shipping";
import { lockCustomer } from "@/lib/kalp-topla/bar";
import { campaignStateFor } from "@/lib/kalp-topla/settings";
import { assignKalpCoupons, couponGain, type KalpAssignment, type KalpPriceLine, type KalpSelection } from "@/lib/kalp-topla/pricing";
import { assignEfsane, efsaneActiveAt, efsaneDiscountOf, EFSANE_CODE_NOTE, EFSANE_COMBINE_NOTE, type EfsaneAssignment } from "@/lib/efsane-cuma";
import { getEfsaneWindow } from "@/lib/efsane-cuma-server";

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

type DiscountedUnits = { variantId: string; count: number; unitCents: number }[];

function withoutUnits<T extends { variantId: string; quantity: number }>(lines: T[], units: DiscountedUnits): T[] {
  const taken = new Map(units.map((u) => [u.variantId, u.count]));
  return lines
    .map((line) => ({ ...line, quantity: line.quantity - (taken.get(line.variantId) ?? 0) }))
    .filter((line) => line.quantity > 0);
}

// Efsane Cuma suresince (kod, bundle ve puan kapali) urunler icin odenecek tutar:
// indirimli adetler + kalan adetlere otomatik kampanya. Kalp ile Efsane'yi karsilastirir.
async function efsanePeriodItemsCents(db: Tx, lines: PriceLine[], units: DiscountedUnits): Promise<number> {
  const remaining = withoutUnits(lines, units);
  const best = await resolveBestDiscount(db, null, remaining);
  return (
    remaining.reduce((sum, l) => sum + l.priceCents * l.quantity, 0) +
    units.reduce((sum, u) => sum + u.unitCents * u.count, 0) -
    best.discountCents
  );
}

// Sepet ve siparisin TEK fiyat hesabi (KALP_TOPLA_PLANI.md 5.6, T17). Sira: kalp
// atamasi, kuponlu adetler cikarilmis satirlarla bundle ve kupon, puan, kargo.
// ORDER modu transaction icinde cagrilir: uye kilitlenir, kuponlar RESERVED olur.
// Efsane Cuma acikken (docs/reklam/efsane-cuma-2026.md): kupon kodu, bundle ve puan
// kapali; Kalp kuponu ile Efsane'den musteriye avantajli olan uygulanir.
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
    // Yalniz test: Efsane Cuma penceresini bu ana gore degerlendirir.
    now?: Date;
  }
) {
  const { customerId, lines, defaultShippingCents, mode } = input;
  if (mode === "ORDER" && customerId) await lockCustomer(db as Prisma.TransactionClient, customerId);

  const efsaneOn = efsaneActiveAt(await getEfsaneWindow(), input.now ?? new Date());
  const code = input.couponCode?.trim().toUpperCase() || null;
  const kalp = await loadKalp(db, customerId, code);
  const selection = input.kalpSelection ?? noSelection;
  const percent = kalp.coupons[0]?.discountPercent ?? 0;
  const priceLines = kalp.coupons.length > 0 || efsaneOn ? await withCurrentBest(db, lines) : [];
  let assignments = assignKalpCoupons(priceLines, kalp.coupons, selection, kalp.forcedCouponId);
  let efsane: EfsaneAssignment[] = efsaneOn
    ? assignEfsane(priceLines.map((l, i) => ({ variantId: l.variantId, unitCents: l.currentBestCents, quantity: lines[i].quantity })))
    : [];
  // Kalp kuponu ile Efsane birlesmez: odenecek urun tutari dusuk olan kalir (esitlikte Efsane).
  let combineNote: string | null = null;
  if (assignments.length > 0 && efsane.length > 0) {
    combineNote = EFSANE_COMBINE_NOTE;
    const kalpItems = await efsanePeriodItemsCents(db, lines, assignments.map((a) => ({ ...a, count: 1 })));
    const efsaneItems = await efsanePeriodItemsCents(db, lines, efsane);
    if (efsaneItems <= kalpItems) assignments = [];
    else efsane = [];
  }
  const efsaneWon = combineNote !== null && efsane.length > 0;
  const assignmentOf = new Map(assignments.map((a) => [a.variantId, a]));
  const forcedApplied = assignments.some((a) => a.couponId === kalp.forcedCouponId);
  const kalpCodeMessage =
    kalp.codeMessage ?? (kalp.forcedCouponId && !forcedApplied && !efsaneWon ? "Bu kupon sepetindeki ürünlere uygulanamadı." : null);

  if (mode === "ORDER") {
    if (kalpCodeMessage) throw new KalpCouponInvalidError(kalpCodeMessage);
    if (assignments.length > 0) await reserveCoupons(db, customerId!, assignments);
  }

  const discountedUnits: DiscountedUnits = [...assignments.map((a) => ({ ...a, count: 1 })), ...efsane];
  const remaining = withoutUnits(lines, discountedUnits);
  const remainingCents = remaining.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const couponUnitsCents = discountedUnits.reduce((sum, u) => sum + u.unitCents * u.count, 0);
  const fullSubtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const rawPriceOf = new Map(lines.map((l) => [l.variantId, l.priceCents]));
  const kalpUnitsCents = assignments.reduce((sum, a) => sum + a.unitCents, 0);
  // Efsane adetlerindeki otomatik kampanya payi (liste fiyati - guncel satis fiyati):
  // ekranda "Indirim" satirina eklenir, Efsane satiri yalniz %50'yi gosterir.
  const efsaneAutoShareCents = efsane.reduce((sum, a) => sum + (rawPriceOf.get(a.variantId)! - a.originalUnitCents) * a.count, 0);

  const { discountCents: bundleDiscountCents } = efsaneOn ? { discountCents: 0 } : await resolveBundleDiscount(db, remaining);
  const resolved = await resolveBestDiscount(db, efsaneOn ? null : kalp.normalCode, remaining);
  const best = efsaneOn && kalp.normalCode ? { ...resolved, codeMessage: EFSANE_CODE_NOTE } : resolved;

  // T7: puan yalniz kuponsuz satirlara harcanir. Tavani asan puan bakiyeden dusmez.
  // Efsane Cuma suresince puan kullanilmaz.
  const pointsCapCents = efsaneOn ? 0 : Math.max(0, remainingCents - bundleDiscountCents - best.discountCents);
  const requestedPoints = Math.min(input.pointsToRedeem ?? 0, Math.floor(pointsCapCents / LOYALTY_REDEEM_RATE_CENTS));
  const loyalty = await resolveLoyaltyRedemption(db, customerId, requestedPoints, pointsCapCents);

  const netSubtotalCents = remainingCents + couponUnitsCents;
  const totalDiscountCents = Math.min(remainingCents, bundleDiscountCents + best.discountCents + loyalty.discountCents);
  const shippingCents = calculateShippingCents(netSubtotalCents - totalDiscountCents, best.freeShipping, defaultShippingCents);

  return {
    fullSubtotalCents,
    // Kuponlu birimler net fiyatiyla dahildir: OrderItem toplamlari buna esittir.
    subtotalCents: netSubtotalCents,
    kalpDiscountCents: assignments.reduce((sum, a) => sum + rawPriceOf.get(a.variantId)!, 0) - kalpUnitsCents,
    // Efsane Cuma: indirimli adetler de net fiyatiyla subtotal'a dahildir (Kalp ile ayni desen).
    efsaneActive: efsaneOn,
    efsane,
    efsaneDiscountCents: efsaneDiscountOf(efsane),
    efsaneAutoShareCents,
    combineNote,
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
      // Efsane uygulanmissa Kalp kuponu zaten kaybeder; dugme gosterilmez.
      applicable:
        assignments.length < kalp.coupons.length && efsane.length === 0
          ? priceLines.filter((l) => couponGain(l, percent) > 0 && !assignmentOf.has(l.variantId)).map((l) => l.variantId)
          : []
    }
  };
}
