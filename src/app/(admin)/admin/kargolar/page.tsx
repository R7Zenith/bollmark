import { Truck } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { applyShipmentUpdate } from "@/lib/shipment";
import { EmptyState } from "@/components/admin/empty-state";
import { KargolarFilters } from "@/components/admin/kargolar-filters";
import { ShipmentsTable, type ShipmentRow } from "@/components/admin/shipments-table";
import { ShipmentFeedback } from "@/components/admin/shipment-feedback";

async function updateShipmentAction(formData: FormData) {
  "use server";
  try {
    await applyShipmentUpdate(formData);
  } catch {
    redirect("/admin/kargolar?hata=guncellenemedi");
  }
  redirect("/admin/kargolar?basarili=guncellendi");
}

interface SearchParams {
  q?: string;
  durum?: string;
  basarili?: string;
  hata?: string;
}

export default async function AdminShipmentsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, durum, basarili, hata } = await searchParams;

  const totalCount = await prisma.shipment.count();

  if (totalCount === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Kargolar</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={Truck} title="Henüz kargo kaydı yok" description="Bir sipariş oluştuğunda kargo kaydı burada görünecek." />
        </div>
      </div>
    );
  }

  const shipments = await prisma.shipment.findMany({
    where: {
      ...(durum ? { status: durum } : {}),
      ...(q ? { order: { orderNumber: { contains: q, mode: "insensitive" as const } } } : {})
    },
    include: { order: true },
    orderBy: { createdAt: "desc" }
  });

  const rows: ShipmentRow[] = shipments.map((s) => ({
    id: s.id,
    orderId: s.orderId,
    orderNumber: s.order.orderNumber,
    customerName: s.order.customerName,
    carrier: s.carrier,
    trackingCode: s.trackingCode,
    status: s.status
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Kargolar</h1>

      <ShipmentFeedback basarili={basarili} hata={hata} />

      <div className="mt-6">
        <KargolarFilters />
      </div>

      <div className="mt-4">
        <ShipmentsTable shipments={rows} updateAction={updateShipmentAction} />
      </div>
    </div>
  );
}
