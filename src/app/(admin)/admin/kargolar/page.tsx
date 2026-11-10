import { Truck } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyShipmentUpdate } from "@/lib/shipment";
import { EmptyState } from "@/components/admin/empty-state";
import { KargolarFilters } from "@/components/admin/kargolar-filters";
import { ShipmentsTable, type ShipmentRow, type YurticiBulkResult } from "@/components/admin/shipments-table";
import { getYurticiMode } from "@/lib/yurtici/config";
import { isYurticiActive, ykOperationStatusLabel } from "@/lib/yurtici/map";
import { sendOrdersToYurtici } from "@/lib/yurtici/shipments";
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

// Secilen kargolari tek Yurtici cagrisiyla gonderir (koli adedi 1; farkliysa
// siparis detayindan tek tek gonderilir).
async function yurticiBulkSendAction(shipmentIds: string[]): Promise<YurticiBulkResult> {
  "use server";
  const session = await getServerSession(authOptions);
  const shipments = await prisma.shipment.findMany({ where: { id: { in: shipmentIds } }, select: { orderId: true } });
  const results = await sendOrdersToYurtici(
    shipments.map((s) => ({ orderId: s.orderId })),
    { email: session?.user?.email ?? "bilinmiyor", role: session?.user?.role ?? "ADMIN" }
  );
  return {
    sent: results.filter((r) => r.ok).map((r) => r.orderNumber),
    failed: results.filter((r) => !r.ok).map((r) => ({ orderNumber: r.orderNumber, message: r.message }))
  };
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
    status: s.status,
    yurticiLabel: s.provider === "YURTICI" && s.ykOperationStatus
      ? (ykOperationStatusLabel[s.ykOperationStatus] ?? s.ykOperationStatus)
      : null,
    yurticiActive: isYurticiActive(s)
  }));
  const yurticiMode = getYurticiMode();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Kargolar</h1>

      <ShipmentFeedback basarili={basarili} hata={hata} />

      {(yurticiMode === "mock" || yurticiMode === "test") && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
          TEST MODU – gerçek gönderi oluşmaz
          <span className="ml-2 font-normal">Yalnız alıcı adı &quot;TEST ALICI&quot; ile başlayan siparişler gönderilebilir.</span>
        </p>
      )}

      <div className="mt-6">
        <KargolarFilters />
      </div>

      <div className="mt-4">
        <ShipmentsTable
          shipments={rows}
          updateAction={updateShipmentAction}
          yurticiSendAction={yurticiMode === "off" ? undefined : yurticiBulkSendAction}
        />
      </div>
    </div>
  );
}
