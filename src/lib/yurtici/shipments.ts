import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { getYurticiMode } from "./config";
import { cancelShipments, createShipments, queryShipments, YurticiConnectionError, YurticiFault } from "./client";
import {
  buildShippingOrder,
  errorWithCode,
  isYurticiActive,
  mapYkStatus,
  nextCargoKey,
  sendBlockReason,
  syncLockRemainingMs,
  type ShippingOrderVO
} from "./map";

// Yurtici islemlerinin DB tarafi (admin sipariş karti ve kargolar sayfasi).
// Her islem tek Yurtici cagrisi yapar (Fixie istek butcesi).

export const YURTICI_CARRIER = "Yurtiçi Kargo";

export type Actor = { email: string; role: string };
export type OrderResult = { orderId: string; orderNumber: string; ok: boolean; message: string };

function friendly(error: unknown): string {
  if (error instanceof YurticiConnectionError || error instanceof YurticiFault) return error.message;
  console.error("Yurtiçi işlemi beklenmeyen hata:", error);
  return "Yurtiçi işlemi beklenmeyen bir hatayla durdu.";
}

// Secilen siparisleri tek createShipment cagrisiyla gonderir.
export async function sendOrdersToYurtici(
  items: { orderId: string; cargoCount?: number }[],
  actor: Actor
): Promise<OrderResult[]> {
  const mode = getYurticiMode();
  const orders = await prisma.order.findMany({
    where: { id: { in: items.map((i) => i.orderId) } },
    include: { shipment: true }
  });
  const results: OrderResult[] = [];
  const toSend: { order: (typeof orders)[number]; vo: ShippingOrderVO }[] = [];

  for (const item of items) {
    const order = orders.find((o) => o.id === item.orderId);
    if (!order) continue;
    const blocked = sendBlockReason(order, order.shipment, mode);
    if (blocked) {
      results.push({ orderId: order.id, orderNumber: order.orderNumber, ok: false, message: blocked });
      continue;
    }
    const cargoKey = nextCargoKey(order.orderNumber, order.shipment!);
    const built = buildShippingOrder(order, { cargoKey, cargoCount: item.cargoCount });
    if (!built.ok) {
      results.push({ orderId: order.id, orderNumber: order.orderNumber, ok: false, message: built.errors.join(" ") });
      continue;
    }
    toSend.push({ order, vo: built.vo });
  }
  if (toSend.length === 0) return results;

  let response: Awaited<ReturnType<typeof createShipments>> | null = null;
  let callError = "";
  try {
    response = await createShipments(toSend.map((t) => t.vo));
  } catch (error) {
    callError = friendly(error);
  }

  const now = new Date();
  for (const { order, vo } of toSend) {
    const row = response?.rows.find((r) => r.cargoKey === vo.cargoKey);
    const shipmentId = order.shipment!.id;
    if (row?.ok) {
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          provider: "YURTICI",
          cargoKey: vo.cargoKey,
          ykJobId: response!.jobId || null,
          ykDocId: null,
          ykOperationStatus: "NOP",
          ykOperationMessage: null,
          ykRejectStatus: null,
          trackingUrl: null,
          cargoCount: vo.cargoCount,
          ykSentAt: now,
          ykCancelledAt: null,
          ykLastSyncAt: null,
          ykLastError: null,
          carrier: YURTICI_CARRIER,
          trackingCode: vo.cargoKey
        }
      });
      results.push({ orderId: order.id, orderNumber: order.orderNumber, ok: true, message: `Kargo anahtarı ${vo.cargoKey}` });
      await logAudit({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "YURTICI_GONDERILDI",
        targetType: "Order",
        targetId: order.id,
        detail: `${vo.cargoKey} · ${vo.cargoCount} koli · ${response!.mode}`
      });
    } else {
      const message = callError || row?.message || "Yurtiçi bu kaydı döndürmedi.";
      // Anahtar saklanir: 60020'de bir sonraki deneme yeni ek alir.
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          cargoKey: callError ? undefined : vo.cargoKey,
          ykLastError: errorWithCode(row && !callError ? row.errCode : "", message)
        }
      });
      results.push({ orderId: order.id, orderNumber: order.orderNumber, ok: false, message });
      await logAudit({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "YURTICI_GONDERIM_HATASI",
        targetType: "Order",
        targetId: order.id,
        detail: `${vo.cargoKey}: ${message}`
      });
    }
  }
  return results;
}

// "Durumu Simdi Sorgula" (tek gonderi). 60 sn kilidi sunucuda da uygulanir.
// Faz 3: Yurtici alanlari ve Shipment.status guncellenir; siparis durumu,
// tarihler ve mailler Faz 4'te (durum gecisleri).
export async function syncYurticiShipment(shipmentId: string, actor: Actor): Promise<{ ok: boolean; message: string }> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment?.cargoKey || !isYurticiActive(shipment)) return { ok: false, message: "Yurtiçi'de aktif gönderi yok." };
  const wait = syncLockRemainingMs(shipment.ykLastSyncAt);
  if (wait > 0) return { ok: false, message: `Yurtiçi aynı sorguyu 1 dakikada bir kabul ediyor; ${Math.ceil(wait / 1000)} sn sonra tekrar deneyin.` };

  try {
    const { rows } = await queryShipments([shipment.cargoKey]);
    const row = rows.find((r) => r.cargoKey === shipment.cargoKey);
    if (!row) throw new YurticiFault("Yurtiçi bu kargo anahtarı için kayıt döndürmedi.");
    if (row.errCode !== "0") {
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: { ykLastSyncAt: new Date(), ykLastError: errorWithCode(row.errCode, row.errMessage) }
      });
      return { ok: false, message: row.errMessage || `Yurtiçi hata kodu ${row.errCode}.` };
    }
    const mapped = mapYkStatus(row.operationStatus, row.rejectStatus);
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        ykOperationStatus: row.operationStatus || null,
        ykOperationMessage: row.operationMessage || null,
        ykRejectStatus: row.rejectStatus || null,
        ykDocId: row.docId || shipment.ykDocId,
        trackingUrl: row.trackingUrl || shipment.trackingUrl,
        trackingCode: row.docId || shipment.trackingCode,
        ykLastSyncAt: new Date(),
        ykLastError: null,
        ...(mapped.shipmentStatus ? { status: mapped.shipmentStatus } : {}),
        ...(mapped.cancelled ? { ykCancelledAt: new Date(), status: "HAZIRLANIYOR", carrier: "", trackingCode: null } : {})
      }
    });
    await logAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "YURTICI_SORGULANDI",
      targetType: "Order",
      targetId: shipment.orderId,
      detail: `${shipment.cargoKey}: ${row.operationStatus}`
    });
    return { ok: true, message: row.operationStatus };
  } catch (error) {
    const message = friendly(error);
    await prisma.shipment.update({ where: { id: shipmentId }, data: { ykLastSyncAt: new Date(), ykLastError: message } });
    return { ok: false, message };
  }
}

// Yalniz NOP (sube henuz islem yapmamis) iken.
export async function cancelYurticiShipment(shipmentId: string, actor: Actor): Promise<{ ok: boolean; message: string }> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment?.cargoKey || !isYurticiActive(shipment)) return { ok: false, message: "Yurtiçi'de aktif gönderi yok." };
  if (shipment.ykOperationStatus !== "NOP") {
    return { ok: false, message: "Şube gönderiyi işleme aldı; iptal yerine iade süreci gerekir." };
  }
  try {
    const { rows } = await cancelShipments([shipment.cargoKey]);
    const row = rows.find((r) => r.cargoKey === shipment.cargoKey);
    if (!row) throw new YurticiFault("Yurtiçi bu kargo anahtarı için kayıt döndürmedi.");
    if (row.ok) {
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          ykOperationStatus: "CNL",
          ykOperationMessage: row.operationMessage || null,
          ykCancelledAt: new Date(),
          ykLastError: null,
          status: "HAZIRLANIYOR",
          carrier: "",
          trackingCode: null
        }
      });
    } else if (row.operationStatus === "IND") {
      // Sube arada islem yapmis: Yurtici iade istegi olusturdu.
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: { ykOperationStatus: "IND", ykOperationMessage: row.operationMessage || null, ykLastError: row.message }
      });
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: { needsAttention: true, attentionNote: "Yurtiçi: iptal istendi ama gönderi düzenlenmişti; iade isteği oluştu." }
      });
    } else {
      await prisma.shipment.update({ where: { id: shipmentId }, data: { ykLastError: row.message } });
    }
    await logAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "YURTICI_IPTAL",
      targetType: "Order",
      targetId: shipment.orderId,
      detail: `${shipment.cargoKey}: ${row.ok ? "CNL" : row.message}`
    });
    return { ok: row.ok, message: row.ok ? "Gönderi iptal edildi." : row.message || "İptal edilemedi." };
  } catch (error) {
    const message = friendly(error);
    await prisma.shipment.update({ where: { id: shipmentId }, data: { ykLastError: message } });
    return { ok: false, message };
  }
}
