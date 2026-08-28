import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

type ShipmentStatus = "HAZIRLANIYOR" | "KARGOYA_VERILDI" | "DAGITIMDA" | "TESLIM_EDILDI" | "IADE";

const statuses: ShipmentStatus[] = ["HAZIRLANIYOR", "KARGOYA_VERILDI", "DAGITIMDA", "TESLIM_EDILDI", "IADE"];

const statusLabel: Record<string, string> = {
  HAZIRLANIYOR: "Hazirlaniyor",
  KARGOYA_VERILDI: "Kargoya Verildi",
  DAGITIMDA: "Dagitimda",
  TESLIM_EDILDI: "Teslim Edildi",
  IADE: "Iade"
};

async function updateShipment(id: string, formData: FormData) {
  "use server";
  const status = String(formData.get("status")) as ShipmentStatus;
  const carrier = String(formData.get("carrier") || "");
  const trackingCode = String(formData.get("trackingCode") || "");
  await prisma.shipment.update({
    where: { id },
    data: {
      status,
      carrier,
      trackingCode,
      shippedAt: status === "KARGOYA_VERILDI" ? new Date() : undefined,
      deliveredAt: status === "TESLIM_EDILDI" ? new Date() : undefined
    }
  });
  redirect("/admin/kargolar");
}

export default async function AdminShipmentsPage() {
  const shipments = await prisma.shipment.findMany({
    include: { order: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Kargolar</h1>

      <div className="mt-8 space-y-4">
        {shipments.map((s) => {
          const updateWithId = updateShipment.bind(null, s.id);
          return (
            <form
              key={s.id}
              action={updateWithId}
              className="grid items-center gap-4 rounded-lg border border-admin-border bg-admin-surface p-4 md:grid-cols-6"
            >
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-admin-text">{s.order.orderNumber}</p>
                <p className="text-xs text-admin-text-muted">{s.order.customerName}</p>
              </div>
              <input
                name="carrier"
                defaultValue={s.carrier}
                placeholder="Kargo Firmasi"
                className="rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
              />
              <input
                name="trackingCode"
                defaultValue={s.trackingCode ?? ""}
                placeholder="Takip Kodu"
                className="rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
              />
              <select
                name="status"
                defaultValue={s.status}
                className="rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
              >
                {statuses.map((st) => (
                  <option key={st} value={st}>
                    {statusLabel[st]}
                  </option>
                ))}
              </select>
              <button className="rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Guncelle
              </button>
            </form>
          );
        })}
        {shipments.length === 0 && <p className="text-admin-text-muted">Henuz kargo kaydi yok.</p>}
      </div>
    </div>
  );
}
