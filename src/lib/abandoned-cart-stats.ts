import { prisma } from "@/lib/prisma";
import type { PeriodRange } from "@/lib/order-period";

// order-stats.ts ile ayni desen (gun bazli sparkline + onceki doneme kiyas) -
// terk edilmis sepetler icin ayri tutuldu, iki domain birbirine karismasin.

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

export interface AbandonedCartStats {
  totalCarts: StatWithSparkline;
  remindedCarts: StatWithSparkline;
  recoveredCarts: StatWithSparkline;
  recoveryRate: { value: string; trend?: StatTrend };
}

export async function getAbandonedCartStats(range: PeriodRange): Promise<AbandonedCartStats> {
  const { key, current, previous } = range;
  const hasPrevious = Boolean(previous.start && previous.end);
  const showSparkline = key !== "bugun" && key !== "dun" && Boolean(current.start && current.end);
  const dayKeys = showSparkline ? enumerateDayKeys(current.start!, current.end!) : [];

  const [cartsInPeriod, cartsPrevCount, remindedPrevCount, recoveredPrevCount] = await Promise.all([
    prisma.abandonedCart.findMany({
      where: { createdAt: { gte: current.start, lte: current.end } },
      select: { createdAt: true, remindedAt: true, recoveredAt: true }
    }),
    hasPrevious
      ? prisma.abandonedCart.count({ where: { createdAt: { gte: previous.start, lte: previous.end } } })
      : Promise.resolve(0),
    hasPrevious
      ? prisma.abandonedCart.count({
          where: { createdAt: { gte: previous.start, lte: previous.end }, remindedAt: { not: null } }
        })
      : Promise.resolve(0),
    hasPrevious
      ? prisma.abandonedCart.count({
          where: { createdAt: { gte: previous.start, lte: previous.end }, recoveredAt: { not: null } }
        })
      : Promise.resolve(0)
  ]);

  const totalCount = cartsInPeriod.length;
  const remindedCount = cartsInPeriod.filter((c) => c.remindedAt).length;
  const recoveredCount = cartsInPeriod.filter((c) => c.recoveredAt).length;

  let totalSparkline: number[] | undefined;
  let remindedSparkline: number[] | undefined;
  let recoveredSparkline: number[] | undefined;

  if (showSparkline) {
    const totalByDay = bucketCount(cartsInPeriod.map((c) => c.createdAt));
    const remindedByDay = bucketCount(cartsInPeriod.filter((c) => c.remindedAt).map((c) => c.createdAt));
    const recoveredByDay = bucketCount(cartsInPeriod.filter((c) => c.recoveredAt).map((c) => c.createdAt));
    totalSparkline = dayKeys.map((k) => totalByDay.get(k) ?? 0);
    remindedSparkline = dayKeys.map((k) => remindedByDay.get(k) ?? 0);
    recoveredSparkline = dayKeys.map((k) => recoveredByDay.get(k) ?? 0);
  }

  const recoveryRatePct = totalCount > 0 ? Math.round((recoveredCount / totalCount) * 100) : null;
  const recoveryRatePctPrev = cartsPrevCount > 0 ? Math.round((recoveredPrevCount / cartsPrevCount) * 100) : null;

  return {
    totalCarts: {
      value: totalCount,
      trend: hasPrevious ? computeTrend(totalCount, cartsPrevCount) : undefined,
      sparkline: totalSparkline
    },
    remindedCarts: {
      value: remindedCount,
      trend: hasPrevious ? computeTrend(remindedCount, remindedPrevCount) : undefined,
      sparkline: remindedSparkline
    },
    recoveredCarts: {
      value: recoveredCount,
      trend: hasPrevious ? computeTrend(recoveredCount, recoveredPrevCount) : undefined,
      sparkline: recoveredSparkline
    },
    recoveryRate: {
      value: recoveryRatePct === null ? "-" : `%${recoveryRatePct}`,
      trend:
        recoveryRatePct !== null && recoveryRatePctPrev !== null
          ? computeTrend(recoveryRatePct, recoveryRatePctPrev)
          : undefined
    }
  };
}
