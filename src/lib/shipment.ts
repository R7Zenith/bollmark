import { prisma } from "@/lib/prisma";
import { shipmentStatuses, type ShipmentStatus } from "@/lib/status";

// Kargolar sayfasi ve siparis detay sayfasi ayni guncelleme mantigini
// paylasir - ikisi de kendi "use server" sarmalayicisi icinden bu fonksiyonu
// cagirip kendi redirect hedefine yonlendirir (kod tekrarini onlemek icin
// mantik burada tutuluyor).
export async function applyShipmentUpdate(formData: FormData) {
  const shipmentId = String(formData.get("shipmentId") || "");
  const statusRaw = String(formData.get("status") || "");
  const status = (shipmentStatuses as readonly string[]).includes(statusRaw)
    ? (statusRaw as ShipmentStatus)
    : "HAZIRLANIYOR";
  const carrier = String(formData.get("carrier") || "").trim();
  const trackingCode = String(formData.get("trackingCode") || "").trim() || null;

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status,
      carrier,
      trackingCode,
      shippedAt: status === "KARGOYA_VERILDI" ? new Date() : undefined,
      deliveredAt: status === "TESLIM_EDILDI" ? new Date() : undefined
    }
  });
}
