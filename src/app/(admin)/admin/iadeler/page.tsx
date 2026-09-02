import { RotateCcw } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { notifyReturnStatusChange } from "@/lib/order-notifications";
import { returnStatuses, type ReturnStatus } from "@/lib/status";
import { EmptyState } from "@/components/admin/empty-state";
import { IadelerFilters } from "@/components/admin/iadeler-filters";
import { ReturnsTable, type ReturnRow } from "@/components/admin/returns-table";
import { ReturnFeedback } from "@/components/admin/return-feedback";

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

async function updateReturnAction(formData: FormData) {
  "use server";
  const returnId = String(formData.get("returnId") || "");
  const statusRaw = String(formData.get("status") || "");
  const status = (returnStatuses as readonly string[]).includes(statusRaw)
    ? (statusRaw as ReturnStatus)
    : "TALEP_EDILDI";
  const adminNote = String(formData.get("adminNote") || "").trim() || null;

  try {
    const updated = await prisma.returnRequest.update({
      where: { id: returnId },
      data: { status, adminNote },
      include: { order: true }
    });
    notifyReturnStatusChange(updated.order, status).catch((error) =>
      console.error("İade durum bildirimi maili başarısız:", error)
    );
  } catch {
    redirect("/admin/iadeler?hata=guncellenemedi");
  }
  redirect("/admin/iadeler?basarili=guncellendi");
}

interface SearchParams {
  q?: string;
  durum?: string;
  basarili?: string;
  hata?: string;
}

export default async function AdminReturnsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { q, durum, basarili, hata } = await searchParams;

  const totalCount = await prisma.returnRequest.count();
  if (totalCount === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">İadeler</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={RotateCcw} title="Henüz iade/değişim talebi yok" description="Bir talep oluştuğunda burada görünecek." />
        </div>
      </div>
    );
  }

  const returnRequests = await prisma.returnRequest.findMany({
    where: {
      ...(durum ? { status: durum } : {}),
      ...(q ? { order: { orderNumber: { contains: q, mode: "insensitive" as const } } } : {})
    },
    include: { order: { include: { items: { include: { product: { select: { name: true } } } } } } },
    orderBy: { createdAt: "desc" }
  });

  const rows: ReturnRow[] = returnRequests.map((rr) => {
    const itemsById = new Map(rr.order.items.map((item) => [item.id, item]));
    const itemsSummary = parseItemsJson(rr.itemsJson)
      .map((line) => {
        const item = itemsById.get(line.orderItemId);
        return item ? `${item.product.name} ×${line.quantity}` : null;
      })
      .filter((v): v is string => v !== null)
      .join(", ");

    return {
      id: rr.id,
      orderId: rr.order.id,
      orderNumber: rr.order.orderNumber,
      customerName: rr.order.customerName,
      type: rr.type,
      reason: rr.reason,
      itemsSummary: itemsSummary || "-",
      status: rr.status,
      adminNote: rr.adminNote,
      createdAtLabel: rr.createdAt.toLocaleDateString("tr-TR")
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">İadeler</h1>

      <ReturnFeedback basarili={basarili} hata={hata} />

      <div className="mt-6">
        <IadelerFilters />
      </div>

      <div className="mt-4">
        <ReturnsTable returns={rows} updateAction={updateReturnAction} />
      </div>
    </div>
  );
}
