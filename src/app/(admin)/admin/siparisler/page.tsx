import { Package, ShoppingCart, RotateCcw, Truck, Clock, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/admin/empty-state";
import { OrdersFilters } from "@/components/admin/orders-filters";
import { OrdersTable, type OrderRow } from "@/components/admin/orders-table";
import { OrdersPeriodSelect } from "@/components/admin/orders-period-select";
import { OrdersTabs } from "@/components/admin/orders-tabs";
import { StatCard } from "@/components/admin/stat-card";
import { Pagination } from "@/components/admin/pagination";
import { resolvePeriodRange } from "@/lib/order-period";
import { buildOrdersWhere, resolveTab, broadTabForStatus, type OrderTabKey } from "@/lib/order-query";
import { getOrdersSummaryStats } from "@/lib/order-stats";

type SortKey = "orderNumber" | "customerName" | "total" | "createdAt";
const sortKeys: SortKey[] = ["orderNumber", "customerName", "total", "createdAt"];

const PAGE_SIZE = 20;

interface SearchParams {
  q?: string;
  durum?: string;
  kargoDurum?: string;
  baslangic?: string;
  bitis?: string;
  sort?: string;
  dir?: string;
  donem?: string;
  sekme?: string;
  sayfa?: string;
}

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, durum, kargoDurum, baslangic, bitis, sort, dir, donem, sekme, sayfa } = await searchParams;

  const totalCount = await prisma.order.count();

  if (totalCount === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Siparişler</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={Package} title="Henüz sipariş yok" description="Mağazandan ilk sipariş geldiğinde burada görünecek." />
        </div>
      </div>
    );
  }

  const sortKey: SortKey = sortKeys.includes(sort as SortKey) ? (sort as SortKey) : "createdAt";
  const sortDir: "asc" | "desc" = dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(sayfa) || 1);
  const activeTab: OrderTabKey = resolveTab(sekme);

  const periodRange = resolvePeriodRange(donem, baslangic, bitis);
  const listWhere = buildOrdersWhere({ q, durum, kargoDurum, dateRange: periodRange.current, sekme: activeTab });
  const badgeWhere = buildOrdersWhere({ q, durum, kargoDurum, dateRange: periodRange.current });

  const [filteredCount, orders, statusGroups, summaryStats] = await Promise.all([
    prisma.order.count({ where: listWhere }),
    prisma.order.findMany({
      where: listWhere,
      include: { shipment: true },
      orderBy:
        sortKey === "orderNumber"
          ? { orderNumber: sortDir }
          : sortKey === "customerName"
            ? { customerName: sortDir }
            : sortKey === "total"
              ? { totalCents: sortDir }
              : { createdAt: sortDir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    prisma.order.groupBy({ by: ["status"], _count: true, where: badgeWhere }),
    getOrdersSummaryStats(periodRange)
  ]);

  const tabCounts: Record<OrderTabKey, number> = { tumu: 0, odenmedi: 0, acik: 0, kapatildi: 0 };
  for (const group of statusGroups) {
    tabCounts.tumu += group._count;
    const broadTab = broadTabForStatus(group.status);
    if (broadTab) tabCounts[broadTab] += group._count;
  }

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    status: o.status,
    shipmentStatus: o.shipment?.status ?? null,
    totalCents: o.totalCents,
    createdAt: o.createdAt.toISOString(),
    viewedAt: o.viewedAt ? o.viewedAt.toISOString() : null
  }));

  const sharedParams = new URLSearchParams();
  if (q) sharedParams.set("q", q);
  if (durum) sharedParams.set("durum", durum);
  if (kargoDurum) sharedParams.set("kargoDurum", kargoDurum);
  if (donem) sharedParams.set("donem", donem);
  if (donem === "ozel") {
    if (baslangic) sharedParams.set("baslangic", baslangic);
    if (bitis) sharedParams.set("bitis", bitis);
  }
  if (sekme) sharedParams.set("sekme", sekme);

  const paginationBaseParams = new URLSearchParams(sharedParams);
  if (sort) paginationBaseParams.set("sort", sort);
  if (dir) paginationBaseParams.set("dir", dir);
  const paginationBaseUrl = `/admin/siparisler${paginationBaseParams.toString() ? `?${paginationBaseParams.toString()}` : ""}`;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  const exportUrl = `/api/admin/siparisler/disa-aktar${sharedParams.toString() ? `?${sharedParams.toString()}` : ""}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-admin-text">Siparişler</h1>
        <div className="flex items-center gap-3">
          <OrdersPeriodSelect />
          <a
            href={exportUrl}
            className="flex items-center gap-2 rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg"
          >
            <Download size={16} />
            Dışa Aktar
          </a>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={ShoppingCart}
          label="Siparişler"
          value={summaryStats.orderCount.value}
          trend={summaryStats.orderCount.trend}
          sparkline={summaryStats.orderCount.sparkline}
        />
        <StatCard
          icon={Package}
          label="Sipariş Edilen Ürünler"
          value={summaryStats.orderedQuantity.value}
          trend={summaryStats.orderedQuantity.trend}
          sparkline={summaryStats.orderedQuantity.sparkline}
        />
        <StatCard
          icon={RotateCcw}
          label="İade Edilen Ürünler"
          value={summaryStats.returnedQuantity.value}
          trend={summaryStats.returnedQuantity.trend}
          sparkline={summaryStats.returnedQuantity.sparkline}
        />
        <StatCard
          icon={Truck}
          label="Gönderilen Ürünler"
          value={summaryStats.shippedQuantity.value}
          trend={summaryStats.shippedQuantity.trend}
          sparkline={summaryStats.shippedQuantity.sparkline}
        />
        <StatCard
          icon={Clock}
          label="Gönderim Süresi"
          value={summaryStats.avgShippingDuration.value}
          trend={summaryStats.avgShippingDuration.trend}
          sparkline={summaryStats.avgShippingDuration.sparkline}
        />
      </div>

      <div className="mt-6">
        <OrdersTabs counts={tabCounts} />
      </div>

      <div className="mt-4">
        <OrdersFilters />
      </div>

      <div className="mt-4">
        <OrdersTable orders={rows} initialSort={{ key: sortKey, direction: sortDir }} />
      </div>

      {totalPages > 1 && (
        <div className="mt-3 rounded-lg border border-admin-border bg-admin-surface">
          <Pagination page={page} totalPages={totalPages} baseUrl={paginationBaseUrl} />
        </div>
      )}
    </div>
  );
}
