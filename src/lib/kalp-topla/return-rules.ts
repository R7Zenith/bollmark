import { couponPriceFor, type KalpPriceLine } from "@/lib/kalp-topla/pricing";

// Iade ve degisim kurallari (KALP_TOPLA_PLANI.md 5.8, T6, Y6). Saf fonksiyonlar, DB'ye dokunmaz.

const HOUR_MS = 60 * 60 * 1000;

export function isLineFullyRefunded(line: { paidCents: number | null; unitPriceCents: number; refundedCents: number }): boolean {
  const due = line.paidCents ?? line.unitPriceCents;
  return due > 0 && line.refundedCents >= due;
}

export function wasShipped(order: { status: string; shipment: { shippedAt: Date | null } | null }): boolean {
  return order.status === "SHIPPED" || order.status === "DELIVERED" || Boolean(order.shipment?.shippedAt);
}

// Suresi bitmemis kupon kullanildigi andaki kalan suresiyle doner. Suresi bitmisse
// kargolanmis iadede ek sure verilir, kargodan once iptalde geri yuklenmez (null).
export function couponRestoreExpiry(input: {
  expiresAt: Date;
  usedAt: Date | null;
  now: Date;
  extraHours: number;
  afterShipping: boolean;
}): Date | null {
  const { expiresAt, usedAt, now, extraHours, afterShipping } = input;
  if (expiresAt > now) return new Date(now.getTime() + expiresAt.getTime() - (usedAt ?? now).getTime());
  return afterShipping ? new Date(now.getTime() + extraHours * HOUR_MS) : null;
}

export type ExchangeQuote = { unitCents: number; diffCents: number; couponAction: "KEEP" | "RESTORE" };

// Fark: + musteriden alinacak, - musteriye odenecek.
export function exchangeQuote(input: {
  paidUnitCents: number;
  sameProduct: boolean;
  discountPercent: number;
  line: KalpPriceLine;
}): ExchangeQuote {
  const { paidUnitCents, sameProduct, discountPercent, line } = input;
  if (sameProduct) return { unitCents: paidUnitCents, diffCents: 0, couponAction: "KEEP" };
  if (line.excluded) {
    return { unitCents: line.currentBestCents, diffCents: line.currentBestCents - paidUnitCents, couponAction: "RESTORE" };
  }
  const unitCents = Math.min(couponPriceFor(line, discountPercent), line.currentBestCents);
  return { unitCents, diffCents: unitCents - paidUnitCents, couponAction: "KEEP" };
}
