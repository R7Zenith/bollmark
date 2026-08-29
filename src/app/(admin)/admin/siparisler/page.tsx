import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/admin/empty-state";
import { OrdersFilters } from "@/components/admin/orders-filters";
import { OrdersTable, type OrderRow } from "@/components/admin/orders-table";

type SortKey = "orderNumber" | "customerName" | "total" | "createdAt";
const sortKeys: SortKey[] = ["orderNumber", "customerName", "total", "createdAt"];

interface SearchParams {
  q?: string;
  durum?: string;
  kargoDurum?: string;
  baslangic?: string;
  bitis?: string;
  sort?: string;
  dir?: string;
}

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, durum, kargoDurum, baslangic, bitis, sort, dir } = await searchParams;

  const totalCount = await prisma.order.count();

  if (totalCount === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Siparisler</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={Package} title="Henuz siparis yok" description="Magazandan ilk siparis geldiginde burada gorunecek." />
        </div>
      </div>
    );
  }

  const sortKey: SortKey = sortKeys.includes(sort as SortKey) ? (sort as SortKey) : "createdAt";
  const sortDir: "asc" | "desc" = dir === "asc" ? "asc" : "desc";

  const bitisEnd = bitis ? new Date(`${bitis}T23:59:59.999`) : undefined;
  const baslangicStart = baslangic ? new Date(`${baslangic}T00:00:00.000`) : undefined;

  const orders = await prisma.order.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q, mode: "insensitive" as const } },
              { customerName: { contains: q, mode: "insensitive" as const } },
              { customerEmail: { contains: q, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(durum ? { status: durum } : {}),
      ...(kargoDurum === "YOK" ? { shipment: null } : kargoDurum ? { shipment: { status: kargoDurum } } : {}),
      ...(baslangicStart || bitisEnd
        ? { createdAt: { gte: baslangicStart, lte: bitisEnd } }
        : {})
    },
    include: { shipment: true },
    orderBy:
      sortKey === "orderNumber"
        ? { orderNumber: sortDir }
        : sortKey === "customerName"
          ? { customerName: sortDir }
          : sortKey === "total"
            ? { totalCents: sortDir }
            : { createdAt: sortDir }
  });

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    status: o.status,
    shipmentStatus: o.shipment?.status ?? null,
    totalCents: o.totalCents,
    createdAt: o.createdAt.toISOString()
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Siparisler</h1>

      <div className="mt-6">
        <OrdersFilters />
      </div>

      <div className="mt-4">
        <OrdersTable orders={rows} initialSort={{ key: sortKey, direction: sortDir }} />
      </div>
    </div>
  );
}
