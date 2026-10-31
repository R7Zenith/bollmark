// Rapor ve musteri detayi icin saf kurallar (KALP_TOPLA_PLANI.md 6.11).

export type ReportScope = "real" | "test";

type SaleItem = {
  orderId: string;
  kalpCouponId: string | null;
  totalCents: number;
  order: { kalpTestAt: Date | null; kalpDiscountCents: number };
};

// kalpTestAt yalniz Acik'a geciste yazilir; o zamana kadar test siparisi kuponun
// isTest'inden anlasilir. Tek bir test kuponu butun siparisi test yapar (Y12).
export function summarizeCouponSales(items: SaleItem[], testCouponIds: Set<string>, scope: ReportScope) {
  const testOrders = new Set(
    items.filter((i) => i.order.kalpTestAt || (i.kalpCouponId && testCouponIds.has(i.kalpCouponId))).map((i) => i.orderId)
  );
  const inScope = items.filter((i) => testOrders.has(i.orderId) === (scope === "test"));
  const discounts = new Map(inScope.map((i) => [i.orderId, i.order.kalpDiscountCents]));
  return {
    orders: discounts.size,
    revenueCents: inScope.reduce((sum, i) => sum + i.totalCents, 0),
    discountCents: [...discounts.values()].reduce((sum, cents) => sum + cents, 0)
  };
}

export type DemandRow = { productId: string; given: number; open: number; withdrawn: number; customers: number };

// Talep: donemde verilen tum kalpler, geri cekilenler dahil. Bonus puani talep degildir.
export function summarizeDemand(hearts: { productId: string; customerId: string; status: string }[]): DemandRow[] {
  const rows = new Map<string, DemandRow & { ids: Set<string> }>();
  for (const heart of hearts) {
    const row = rows.get(heart.productId) ?? { productId: heart.productId, given: 0, open: 0, withdrawn: 0, customers: 0, ids: new Set() };
    row.given += 1;
    if (heart.status === "PENDING" || heart.status === "ACTIVE") row.open += 1;
    if (heart.status === "WITHDRAWN") row.withdrawn += 1;
    row.ids.add(heart.customerId);
    rows.set(heart.productId, row);
  }
  return [...rows.values()]
    .map(({ ids, ...row }) => ({ ...row, customers: ids.size }))
    .sort((a, b) => b.given - a.given);
}

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

// datetime-local alaninin Istanbul saatiyle degeri.
export function istanbulInputValue(date: Date): string {
  return new Date(date.getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 16);
}

// Yeni bitis hem simdiden hem mevcut bitisten sonra olmali; yoksa uzatma degildir.
export function parseCouponExtension(value: string, currentExpiry: Date, now: Date): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}:00+03:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed > now && parsed > currentExpiry ? parsed : null;
}
