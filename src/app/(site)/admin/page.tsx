import Link from "next/link";
import { Package, ShoppingCart, Clock, Wallet, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { StatCard } from "@/components/admin/stat-card";
import { Card } from "@/components/admin/card";
import { Badge } from "@/components/admin/badge";
import { EmptyState } from "@/components/admin/empty-state";
import { OrdersChart, type DailyOrdersPoint } from "@/components/admin/orders-chart";
import { orderStatusLabel, orderStatusTone } from "@/lib/status";

const REVENUE_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"];

function trendFrom(current: number, previous: number, formatValue: (n: number) => string) {
  if (previous === 0) return undefined;
  const diff = current - previous;
  const direction: "up" | "down" = diff >= 0 ? "up" : "down";
  const sign = diff >= 0 ? "+" : "-";
  return { direction, label: `bu ay ${sign}${formatValue(Math.abs(diff))}` };
}

export default async function AdminDashboard() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayOfMonth = now.getDate();
  const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const endDay = Math.min(dayOfMonth, prevMonthDays);
  const startOfPrevPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevPeriod = new Date(now.getFullYear(), now.getMonth() - 1, endDay, 23, 59, 59, 999);

  const todayUtcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const thirtyDaysAgo = new Date(todayUtcStart);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);

  const [
    productCount,
    orderCount,
    pendingOrders,
    revenue,
    thisMonthOrders,
    thisMonthRevenue,
    prevPeriodOrders,
    prevPeriodRevenue,
    last30DaysOrders,
    recentOrders,
    lowStockVariants
  ] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { status: { in: REVENUE_STATUSES } }
    }),
    prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { createdAt: { gte: startOfMonth }, status: { in: REVENUE_STATUSES } }
    }),
    prisma.order.count({ where: { createdAt: { gte: startOfPrevPeriod, lte: endOfPrevPeriod } } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { createdAt: { gte: startOfPrevPeriod, lte: endOfPrevPeriod }, status: { in: REVENUE_STATUSES } }
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, status: true, totalCents: true }
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, orderNumber: true, customerName: true, status: true, totalCents: true }
    }),
    prisma.productVariant.findMany({
      where: { stock: { lt: 5 } },
      orderBy: { stock: "asc" },
      take: 8,
      select: { id: true, size: true, color: true, stock: true, productId: true, product: { select: { name: true } } }
    })
  ]);

  const orderTrend = trendFrom(thisMonthOrders, prevPeriodOrders, (n) => String(n));
  const revenueTrend = trendFrom(
    thisMonthRevenue._sum.totalCents ?? 0,
    prevPeriodRevenue._sum.totalCents ?? 0,
    (n) => formatPrice(n)
  );

  const chartData: DailyOrdersPoint[] = [];
  const dayIndex = new Map<string, DailyOrdersPoint>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const point: DailyOrdersPoint = { date: key, orders: 0, revenueCents: 0 };
    chartData.push(point);
    dayIndex.set(key, point);
  }
  for (const order of last30DaysOrders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const point = dayIndex.get(key);
    if (!point) continue;
    point.orders += 1;
    if (REVENUE_STATUSES.includes(order.status)) point.revenueCents += order.totalCents;
  }

  const stats = [
    { label: "Toplam Urun", value: productCount, icon: Package, trend: undefined },
    { label: "Toplam Siparis", value: orderCount, icon: ShoppingCart, trend: orderTrend },
    { label: "Odeme Bekleyen", value: pendingOrders, icon: Clock, trend: undefined },
    { label: "Ciro", value: formatPrice(revenue._sum.totalCents ?? 0), icon: Wallet, trend: revenueTrend }
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Genel Bakis</h1>

      <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} trend={s.trend} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Son 30 Gun" className="lg:col-span-2">
          {orderCount === 0 ? (
            <EmptyState title="Henuz siparis yok" description="Siparisler geldikce burada gunluk grafik gorunecek." />
          ) : (
            <OrdersChart data={chartData} />
          )}
        </Card>

        <Card title="Son Siparisler">
          {recentOrders.length === 0 ? (
            <EmptyState title="Henuz siparis yok" />
          ) : (
            <ul className="divide-y divide-admin-border">
              {recentOrders.map((order) => (
                <li key={order.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={`/admin/siparisler/${order.id}`} className="flex items-center justify-between gap-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-admin-text">{order.orderNumber}</p>
                      <p className="truncate text-xs text-admin-text-muted">{order.customerName}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium text-admin-text">{formatPrice(order.totalCents)}</span>
                      <Badge tone={orderStatusTone[order.status as keyof typeof orderStatusTone]}>
                        {orderStatusLabel[order.status as keyof typeof orderStatusLabel] ?? order.status}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Stogu Azalan Urunler">
          {lowStockVariants.length === 0 ? (
            <p className="text-sm text-admin-text-muted">Stok seviyeleri iyi gorunuyor, dusuk stoklu varyant yok.</p>
          ) : (
            <ul className="divide-y divide-admin-border">
              {lowStockVariants.map((variant) => (
                <li key={variant.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/admin/urunler/${variant.productId}`}
                    className="flex items-center justify-between gap-3 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-admin-text">{variant.product.name}</p>
                      <p className="text-xs text-admin-text-muted">
                        {variant.size} / {variant.color}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-red-600">
                      <AlertTriangle size={14} />
                      {variant.stock} adet
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
