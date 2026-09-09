import { prisma } from "@/lib/prisma";
import { formatDuration, type PeriodRange } from "@/lib/order-period";

interface ReturnItemSnapshot {
  orderItemId: string;
  quantity: number;
}

function parseItemsJson(raw: string): ReturnItemSnapshot[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
      .map((v) => ({ orderItemId: String(v.orderItemId ?? ""), quantity: Number(v.quantity) || 0 }))
      .filter((v) => v.orderItemId);
  } catch {
    return [];
  }
}

function sumReturnedQuantity(rows: { itemsJson: string }[]): number {
  return rows.reduce((sum, r) => sum + parseItemsJson(r.itemsJson).reduce((s, line) => s + line.quantity, 0), 0);
}

function averageShippingMs(rows: { shippedAt: Date | null; order: { createdAt: Date } }[]): number | null {
  const durations = rows.filter((r) => r.shippedAt).map((r) => r.shippedAt!.getTime() - r.order.createdAt.getTime());
  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

// Yerel (tarayıcı/sunucu saat dilimi) güne göre gruplama anahtarı - dönem
// sınırları da (order-period.ts) yerel gün başlangıcına göre hesaplandığı
// için tutarlı kalır.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function enumerateDayKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function bucketCount(dates: Date[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of dates) map.set(dayKey(d), (map.get(dayKey(d)) ?? 0) + 1);
  return map;
}

function bucketSum(items: { date: Date; qty: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const { date, qty } of items) map.set(dayKey(date), (map.get(dayKey(date)) ?? 0) + qty);
  return map;
}

function bucketReturnedQuantity(rows: { itemsJson: string; createdAt: Date }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const qty = parseItemsJson(r.itemsJson).reduce((s, line) => s + line.quantity, 0);
    const key = dayKey(r.createdAt);
    map.set(key, (map.get(key) ?? 0) + qty);
  }
  return map;
}

function bucketAvgDuration(rows: { shippedAt: Date | null; order: { createdAt: Date } }[]): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    if (!r.shippedAt) continue;
    const key = dayKey(r.shippedAt);
    const duration = r.shippedAt.getTime() - r.order.createdAt.getTime();
    const entry = sums.get(key) ?? { total: 0, count: 0 };
    entry.total += duration;
    entry.count += 1;
    sums.set(key, entry);
  }
  const result = new Map<string, number>();
  for (const [key, { total, count }] of sums) result.set(key, total / count);
  return result;
}

export interface StatTrend {
  direction: "up" | "down";
  label: string;
}

function computeTrend(current: number, previous: number): StatTrend | undefined {
  if (previous === 0) return undefined;
  const diff = current - previous;
  const pct = Math.round((Math.abs(diff) / previous) * 100);
  return { direction: diff >= 0 ? "up" : "down", label: `%${pct}` };
}

interface StatWithSparkline {
  value: number;
  trend?: StatTrend;
  sparkline?: number[];
}

export interface OrdersSummaryStats {
  orderCount: StatWithSparkline;
  orderedQuantity: StatWithSparkline;
  returnedQuantity: StatWithSparkline;
  shippedQuantity: StatWithSparkline;
  avgShippingDuration: { value: string; trend?: StatTrend; sparkline?: number[] };
}

export async function getOrdersSummaryStats(range: PeriodRange): Promise<OrdersSummaryStats> {
  const { key, current, previous } = range;
  const hasPrevious = Boolean(previous.start && previous.end);
  // Tek günlük dönemlerde (Bugün/Dün) veya eksik özel aralıkta günlük seri
  // anlamsız olur - sparkline'ı tamamen boş bırakıyoruz.
  const showSparkline = key !== "bugun" && key !== "dun" && Boolean(current.start && current.end);
  const dayKeys = showSparkline ? enumerateDayKeys(current.start!, current.end!) : [];

  const [
    ordersInPeriod,
    orderCountPrev,
    orderItemsInPeriod,
    orderedAggPrev,
    shippedItemsInPeriod,
    shippedAggPrev,
    returnRequestsInPeriod,
    returnRequestsPrev,
    shipmentsInPeriod,
    shipmentsPrev
  ] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: current.start, lte: current.end }, deletedAt: null },
      select: { createdAt: true }
    }),
    hasPrevious
      ? prisma.order.count({ where: { createdAt: { gte: previous.start, lte: previous.end }, deletedAt: null } })
      : Promise.resolve(0),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: current.start, lte: current.end }, deletedAt: null } },
      select: { quantity: true, order: { select: { createdAt: true } } }
    }),
    hasPrevious
      ? prisma.orderItem.aggregate({
          _sum: { quantity: true },
          where: { order: { createdAt: { gte: previous.start, lte: previous.end }, deletedAt: null } }
        })
      : Promise.resolve({ _sum: { quantity: 0 } }),
    prisma.orderItem.findMany({
      where: { order: { shipment: { shippedAt: { gte: current.start, lte: current.end } }, deletedAt: null } },
      select: { quantity: true, order: { select: { shipment: { select: { shippedAt: true } } } } }
    }),
    hasPrevious
      ? prisma.orderItem.aggregate({
          _sum: { quantity: true },
          where: { order: { shipment: { shippedAt: { gte: previous.start, lte: previous.end } }, deletedAt: null } }
        })
      : Promise.resolve({ _sum: { quantity: 0 } }),
    prisma.returnRequest.findMany({
      where: { createdAt: { gte: current.start, lte: current.end }, order: { deletedAt: null } },
      select: { itemsJson: true, createdAt: true }
    }),
    hasPrevious
      ? prisma.returnRequest.findMany({
          where: { createdAt: { gte: previous.start, lte: previous.end }, order: { deletedAt: null } },
          select: { itemsJson: true }
        })
      : Promise.resolve([]),
    prisma.shipment.findMany({
      where: { shippedAt: { gte: current.start, lte: current.end }, order: { deletedAt: null } },
      select: { shippedAt: true, order: { select: { createdAt: true } } }
    }),
    hasPrevious
      ? prisma.shipment.findMany({
          where: { shippedAt: { gte: previous.start, lte: previous.end }, order: { deletedAt: null } },
          select: { shippedAt: true, order: { select: { createdAt: true } } }
        })
      : Promise.resolve([])
  ]);

  const orderCount = ordersInPeriod.length;
  const orderedQty = orderItemsInPeriod.reduce((sum, item) => sum + item.quantity, 0);
  const shippedQty = shippedItemsInPeriod.reduce((sum, item) => sum + item.quantity, 0);
  const returnedQty = sumReturnedQuantity(returnRequestsInPeriod);
  const returnedQtyPrev = sumReturnedQuantity(returnRequestsPrev);
  const avgMs = averageShippingMs(shipmentsInPeriod);
  const avgMsPrev = averageShippingMs(shipmentsPrev);

  let orderCountSparkline: number[] | undefined;
  let orderedQtySparkline: number[] | undefined;
  let returnedQtySparkline: number[] | undefined;
  let shippedQtySparkline: number[] | undefined;
  let avgDurationSparkline: number[] | undefined;

  if (showSparkline) {
    const orderCountByDay = bucketCount(ordersInPeriod.map((o) => o.createdAt));
    const orderedQtyByDay = bucketSum(orderItemsInPeriod.map((i) => ({ date: i.order.createdAt, qty: i.quantity })));
    const returnedQtyByDay = bucketReturnedQuantity(returnRequestsInPeriod);
    const shippedQtyByDay = bucketSum(
      shippedItemsInPeriod
        .filter((i) => i.order.shipment?.shippedAt)
        .map((i) => ({ date: i.order.shipment!.shippedAt!, qty: i.quantity }))
    );
    const durationByDay = bucketAvgDuration(shipmentsInPeriod);

    orderCountSparkline = dayKeys.map((k) => orderCountByDay.get(k) ?? 0);
    orderedQtySparkline = dayKeys.map((k) => orderedQtyByDay.get(k) ?? 0);
    returnedQtySparkline = dayKeys.map((k) => returnedQtyByDay.get(k) ?? 0);
    shippedQtySparkline = dayKeys.map((k) => shippedQtyByDay.get(k) ?? 0);
    avgDurationSparkline = dayKeys.map((k) => durationByDay.get(k) ?? 0);
  }

  return {
    orderCount: {
      value: orderCount,
      trend: hasPrevious ? computeTrend(orderCount, orderCountPrev) : undefined,
      sparkline: orderCountSparkline
    },
    orderedQuantity: {
      value: orderedQty,
      trend: hasPrevious ? computeTrend(orderedQty, orderedAggPrev._sum.quantity ?? 0) : undefined,
      sparkline: orderedQtySparkline
    },
    returnedQuantity: {
      value: returnedQty,
      trend: hasPrevious ? computeTrend(returnedQty, returnedQtyPrev) : undefined,
      sparkline: returnedQtySparkline
    },
    shippedQuantity: {
      value: shippedQty,
      trend: hasPrevious ? computeTrend(shippedQty, shippedAggPrev._sum.quantity ?? 0) : undefined,
      sparkline: shippedQtySparkline
    },
    avgShippingDuration: {
      value: avgMs === null ? "-" : formatDuration(avgMs),
      trend: avgMs !== null && avgMsPrev !== null ? computeTrend(avgMs, avgMsPrev) : undefined,
      sparkline: avgDurationSparkline
    }
  };
}
