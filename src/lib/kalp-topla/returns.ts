import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { loadPriceLines, withCurrentBest } from "@/lib/pricing/price-cart";
import { lockOrder } from "@/lib/payment/orders/refund";
import { exchangeQuote } from "@/lib/kalp-topla/return-rules";
import { logRestoreResults, restoreExchangeCoupon, restoreOrderCoupons } from "@/lib/kalp-topla/order-coupons";

// Iade/degisim ekraninin Kalp Topla islemleri (KALP_TOPLA_PLANI.md 5.8, T6, Y6).

type Actor = { email: string; role: string };

export function parseReturnItemIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((v) => (typeof v?.orderItemId === "string" ? [v.orderItemId] : []));
  } catch {
    return [];
  }
}

// Bir talepte tek degisim urunu tutulur, bu yuzden yalniz tek kuponlu satir desteklenir.
async function couponLineOf(returnId: string) {
  const request = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    include: { order: { include: { items: true } } }
  });
  if (!request) return null;
  const ids = parseReturnItemIds(request.itemsJson);
  const lines = request.order.items.filter((item) => item.kalpCouponId && ids.includes(item.id));
  return { request, lines };
}

export type ExchangeError = "bulunamadi" | "varyant-yok" | "coklu-kupon" | "kapandi";

export async function saveExchange(returnId: string, sku: string): Promise<ExchangeError | null> {
  const found = await couponLineOf(returnId);
  if (!found || found.request.type !== "DEGISIM" || found.lines.length === 0) return "bulunamadi";
  if (found.lines.length > 1) return "coklu-kupon";
  if (found.request.kalpHandledAt) return "kapandi";

  const variant = await prisma.productVariant.findUnique({ where: { sku }, select: { id: true, productId: true } });
  if (!variant) return "varyant-yok";
  const item = found.lines[0];
  const coupon = await prisma.kalpCoupon.findUnique({ where: { id: item.kalpCouponId! } });
  const lines = await loadPriceLines(prisma, [{ productId: variant.productId, variantId: variant.id, quantity: 1 }]);
  if (!coupon || !lines) return "bulunamadi";

  const [line] = await withCurrentBest(prisma, lines);
  const quote = exchangeQuote({
    paidUnitCents: item.paidCents ?? item.unitPriceCents,
    sameProduct: variant.productId === item.productId,
    discountPercent: coupon.discountPercent,
    line
  });
  await prisma.returnRequest.update({
    where: { id: returnId },
    data: { exchangeVariantId: variant.id, exchangeUnitCents: quote.unitCents, exchangeDiffCents: quote.diffCents }
  });
  return null;
}

export async function settleExchangeDiff(returnId: string, actor: Actor): Promise<boolean> {
  const settled = await prisma.returnRequest.updateMany({
    where: { id: returnId, exchangeDiffCents: { not: null }, exchangeDiffSettledAt: null },
    data: { exchangeDiffSettledAt: new Date(), exchangeDiffSettledBy: actor.email }
  });
  if (settled.count !== 1) return false;
  const request = await prisma.returnRequest.findUniqueOrThrow({ where: { id: returnId }, select: { exchangeDiffCents: true } });
  logAudit({
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "KALP_TOPLA_DEGISIM_FARK_KAPANDI",
    targetType: "ReturnRequest",
    targetId: returnId,
    detail: `Fark ${request.exchangeDiffCents} kuruş`
  });
  return true;
}

// Talep TAMAMLANDI olunca: iade kuponu geri yukler, degisim kuponu tasir ya da geri yukler.
// Donen deger: fark kapanmadiysa ekranda gosterilecek uyari (engellemez).
export async function handleReturnCompleted(returnId: string, actor: Actor): Promise<"fark-acik" | null> {
  const found = await couponLineOf(returnId);
  if (!found || found.lines.length === 0) return null;
  const { request, lines } = found;

  if (request.type === "IADE") {
    const results = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, request.orderId);
      return restoreOrderCoupons(tx, request.orderId);
    });
    logRestoreResults(actor, results);
    return null;
  }

  const diffOpen = request.exchangeDiffCents !== null && request.exchangeDiffCents !== 0 && !request.exchangeDiffSettledAt;
  const warning = diffOpen ? "fark-acik" : null;
  if (lines.length > 1 || !request.exchangeVariantId) return warning;

  const item = lines[0];
  const variant = await prisma.productVariant.findUnique({
    where: { id: request.exchangeVariantId },
    select: { productId: true, product: { select: { kalpToplaExcluded: true } } }
  });
  const restoreCoupon = variant !== null && variant.productId !== item.productId && variant.product.kalpToplaExcluded;

  const result = await prisma.$transaction(async (tx) => {
    await lockOrder(tx, request.orderId);
    const claimed = await tx.returnRequest.updateMany({
      where: { id: returnId, kalpHandledAt: null },
      data: { kalpHandledAt: new Date() }
    });
    if (claimed.count !== 1 || !restoreCoupon) return null;
    return restoreExchangeCoupon(tx, { id: item.id, kalpCouponId: item.kalpCouponId! });
  });
  if (result) logRestoreResults(actor, [result]);
  return warning;
}
