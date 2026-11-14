import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { optionValue } from "@/lib/variant-attributes";
import { getHepsijetCompanyInfo, getHepsijetMode } from "./config";
import { HepsijetError } from "./client";
import {
  buildHjPayload,
  hjSendBlockReason,
  hjTrackingUrl,
  HJ_CARRIER,
  HJ_PROVIDER,
  isHepsijetActive,
  nextDeliveryNo,
  type HjOrderItem
} from "./map";
import { deleteDelivery, getLabelPdf, sendDelivery, trackDeliveries } from "./shipments";

// HepsiJET islemlerinin DB tarafi (admin siparis karti, etiket route'u).
// Her islem tek HepsiJET cagrisi yapar.

export type Actor = { email: string; role: string };
export type HjResult = { ok: boolean; message: string };

function friendly(error: unknown): string {
  if (error instanceof HepsijetError) return error.message;
  console.error("HepsiJET işlemi beklenmeyen hata:", error);
  return "HepsiJET işlemi beklenmeyen bir hatayla durdu.";
}

type ItemWithProduct = {
  quantity: number;
  productId: string;
  product: { name: string; code: string | null };
  variant: (Parameters<typeof optionValue>[0] & { sku: string }) | null;
};

export function orderItemsForHj(items: ItemWithProduct[]): HjOrderItem[] {
  return items.map((item) => ({
    sku: item.variant?.sku || item.product.code || item.productId,
    name: item.product.name,
    variantLabel: item.variant
      ? [optionValue(item.variant, "Renk"), optionValue(item.variant, "Beden")].filter(Boolean).join(" / ")
      : "",
    quantity: item.quantity
  }));
}

export const hjItemsInclude = {
  items: {
    include: {
      product: { select: { name: true, code: true } },
      variant: { select: { sku: true, options: { include: { value: { include: { attribute: true } } } } } }
    }
  }
} as const;

export async function sendOrderToHepsijet(orderId: string, actor: Actor): Promise<HjResult> {
  const mode = getHepsijetMode();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true, ...hjItemsInclude } });
  if (!order) return { ok: false, message: "Sipariş bulunamadı." };
  const blocked = hjSendBlockReason(order, order.shipment, mode);
  if (blocked) return { ok: false, message: blocked };
  const shipment = order.shipment!;

  let deliveryNo = "";
  try {
    const company = getHepsijetCompanyInfo();
    deliveryNo = nextDeliveryNo(company.deliveryPrefix, order.orderNumber, shipment);
    const built = buildHjPayload(order, orderItemsForHj(order.items), company, { deliveryNo });
    if (!built.ok) return { ok: false, message: built.errors.join(" ") };
    const { mode: usedMode } = await sendDelivery(built.payload);
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        provider: HJ_PROVIDER,
        carrier: HJ_CARRIER,
        cargoKey: deliveryNo,
        trackingCode: deliveryNo,
        trackingUrl: hjTrackingUrl(deliveryNo),
        cargoCount: 1,
        hjStatus: null,
        hjStatusMessage: null,
        hjSentAt: new Date(),
        hjCancelledAt: null,
        hjLastSyncAt: null,
        hjLastError: null
      }
    });
    await logAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "HEPSIJET_GONDERILDI",
      targetType: "Order",
      targetId: order.id,
      detail: `${deliveryNo} · ${usedMode}`
    });
    return { ok: true, message: `Gönderi no ${deliveryNo}` };
  } catch (error) {
    const message = friendly(error);
    await prisma.shipment.update({ where: { id: shipment.id }, data: { hjLastError: message } });
    await logAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "HEPSIJET_GONDERIM_HATASI",
      targetType: "Order",
      targetId: order.id,
      detail: `${deliveryNo || order.orderNumber}: ${message}`
    });
    return { ok: false, message };
  }
}

// "Durumu yenile" (tek gonderi). Faz 3: yalniz HepsiJET alanlari yazilir;
// Shipment/siparis durumu eslemesi ve mailler Faz 4'te.
export async function syncHepsijetShipment(shipmentId: string, actor: Actor): Promise<HjResult> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment?.cargoKey || !isHepsijetActive(shipment)) return { ok: false, message: "HepsiJET'te aktif gönderi yok." };
  const now = new Date();
  try {
    const { rows } = await trackDeliveries([shipment.cargoKey]);
    const row = rows[0];
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { hjStatus: row.statusCode, hjStatusMessage: row.statusMessage || null, hjLastSyncAt: now, hjLastError: null }
    });
    await logAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "HEPSIJET_SORGULANDI",
      targetType: "Order",
      targetId: shipment.orderId,
      detail: `${shipment.cargoKey}: ${row.statusCode ?? "hareket yok"}`
    });
    return { ok: true, message: row.statusCode ?? "Kurye henüz teslim almadı." };
  } catch (error) {
    const message = friendly(error);
    await prisma.shipment.update({ where: { id: shipmentId }, data: { hjLastSyncAt: now, hjLastError: message } });
    return { ok: false, message };
  }
}

// Yalniz kurye toplamadan once (hjStatus bos). Iptalden sonra provider bosalir,
// siparis Yurtici'ye ya da yeniden HepsiJET'e (-2 ekiyle) gonderilebilir.
export async function cancelHepsijetShipment(shipmentId: string, actor: Actor): Promise<HjResult> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment?.cargoKey || !isHepsijetActive(shipment)) return { ok: false, message: "HepsiJET'te aktif gönderi yok." };
  if (shipment.hjStatus) return { ok: false, message: "Kurye gönderiyi teslim aldı; HepsiJET'te artık iptal edilemez." };
  try {
    const result = await deleteDelivery(shipment.cargoKey);
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        provider: null,
        hjCancelledAt: new Date(),
        hjLastError: null,
        status: "HAZIRLANIYOR",
        carrier: "",
        trackingCode: null,
        trackingUrl: null
      }
    });
    await logAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "HEPSIJET_IPTAL",
      targetType: "Order",
      targetId: shipment.orderId,
      detail: `${shipment.cargoKey}: ${result.message}`
    });
    return { ok: true, message: result.alreadyDeleted ? result.message : "Gönderi iptal edildi." };
  } catch (error) {
    const message = friendly(error);
    await prisma.shipment.update({ where: { id: shipmentId }, data: { hjLastError: message } });
    return { ok: false, message };
  }
}

export async function getHepsijetLabel(shipmentId: string): Promise<{ ok: true; pdf: Uint8Array; deliveryNo: string } | { ok: false; message: string }> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment?.cargoKey || !isHepsijetActive(shipment)) return { ok: false, message: "HepsiJET'te aktif gönderi yok." };
  try {
    const { pdf } = await getLabelPdf([shipment.cargoKey]);
    return { ok: true, pdf, deliveryNo: shipment.cargoKey };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}
