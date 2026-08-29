import { prisma } from "@/lib/prisma";
import { shipmentStatuses, type ShipmentStatus } from "@/lib/status";

// Kargolar sayfası ve sipariş detay sayfası aynı güncelleme mantığını
// paylaşır - ikisi de kendi "use server" sarmalayıcısı içinden bu fonksiyonu
// çağırıp kendi redirect hedefine yönlendirir (kod tekrarını önlemek için
// mantık burada tutuluyor).
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
