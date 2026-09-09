import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { EmptyState } from "@/components/admin/empty-state";
import { DeletedOrdersFilters } from "@/components/admin/deleted-orders-filters";
import { DeletedOrdersTable, type DeletedOrderRow } from "@/components/admin/deleted-orders-table";

export default async function DeletedOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // Silme hassas bir işlem oldugu icin bu sayfa sadece ADMIN'e acik -
  // PERSONEL /admin/siparisler'e erisebilir ama silinenleri goremez.
  await requireAdmin();
  const { q } = await searchParams;

  const totalDeleted = await prisma.order.count({ where: { deletedAt: { not: null } } });

  if (totalDeleted === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Silinen Siparişler</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={Trash2} title="Silinmiş sipariş yok" description="Sipariş silindiğinde burada listelenecek." />
        </div>
      </div>
    );
  }

  const orders = await prisma.order.findMany({
    where: {
      deletedAt: { not: null },
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q, mode: "insensitive" as const } },
              { customerName: { contains: q, mode: "insensitive" as const } }
            ]
          }
        : {})
    },
    orderBy: { deletedAt: "desc" }
  });

  const rows: DeletedOrderRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    totalCents: o.totalCents,
    deletedAt: o.deletedAt!.toISOString(),
    deletedByEmail: o.deletedByEmail
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Silinen Siparişler</h1>

      <div className="mt-6">
        <DeletedOrdersFilters />
      </div>

      <div className="mt-4">
        <DeletedOrdersTable orders={rows} />
      </div>
    </div>
  );
}
