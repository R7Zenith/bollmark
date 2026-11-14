import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { notifyCustomerStatusChange } from "@/lib/order-notifications";
import { awardLoyaltyPoints } from "@/lib/loyalty";
import { optionValue } from "@/lib/variant-attributes";
import { getHepsijetCompanyInfo, getHepsijetMode } from "./config";
import { HepsijetError } from "./client";
import {
  buildHjPayload,
  hjSendBlockReason,
  hjTrackingUrl,
  HJ_CARRIER,
  HJ_FINAL_STATUSES,
  HJ_PROVIDER,
  isHepsijetActive,
  nextDeliveryNo,
  planHjTransition,
  type HjOrderItem
} from "./map";
import { deleteDelivery, getLabelPdf, sendDelivery, trackDeliveries, type HjTrackingRow } from "./shipments";

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

// --- Durum sorgusu ve gecisler (Faz 4) ---

type ShipmentWithOrder = NonNullable<Awaited<ReturnType<typeof loadShipment>>>;

function loadShipment(id: string) {
  return prisma.shipment.findUnique({ where: { id }, include: { order: true } });
}

const SYSTEM_ACTOR: Actor = { email: "hepsijet-takip", role: "SYSTEM" };

// Tek takip satirini uygular: HepsiJET alanlari, Shipment.status, tarihler,
// siparis durumu (kosullu, tek sefer) ve buna bagli mail. Yurtici akisiyla ayni.
async function applyHjRow(shipment: ShipmentWithOrder, row: HjTrackingRow, actor: Actor): Promise<string> {
  const now = new Date();
  const order = shipment.order;
  const plan = planHjTransition(
    {
      orderStatus: order.status,
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
      attentionNote: order.needsAttention ? order.attentionNote : null
    },
    row,
    now
  );
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      hjStatus: row.statusCode,
      hjStatusMessage: row.statusMessage || null,
      hjLastSyncAt: now,
      hjLastError: null,
      // HepsiJET tarafinda silinmis: admin iptaliyle ayni sonuc.
      ...(plan.cancelled
        ? { provider: null, hjCancelledAt: now, status: "HAZIRLANIYOR", carrier: "", trackingCode: null, trackingUrl: null }
        : {}),
      ...(plan.shipmentStatus ? { status: plan.shipmentStatus } : {}),
      ...(plan.setShippedAt ? { shippedAt: now } : {}),
      ...(plan.deliveredAt ? { deliveredAt: plan.deliveredAt } : {})
    }
  });

  if (plan.attention) {
    await prisma.order.update({ where: { id: order.id }, data: { needsAttention: true, attentionNote: plan.attention } });
  }

  if (plan.orderStatus) {
    // Kosullu guncelleme: ayni gecis iki kez (cron + elle sorgu) gelse de yalniz biri basarir.
    const { count } = await prisma.order.updateMany({
      where: { id: order.id, status: { in: plan.orderStatus.from } },
      data: { status: plan.orderStatus.to }
    });
    if (count === 1) {
      const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      await logAudit({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "ORDER_STATUS_CHANGED",
        targetType: "Order",
        targetId: order.id,
        detail: `${order.status} -> ${plan.orderStatus.to} (HepsiJET ${row.statusCode})`
      });
      await notifyCustomerStatusChange(updated, plan.orderStatus.to).catch((error) =>
        console.error("HepsiJET durum maili başarısız:", error)
      );
      if (plan.orderStatus.to === "DELIVERED") {
        await awardLoyaltyPoints(updated).catch((error) => console.error("Sadakat puanı eklenemedi (yoksayıldı):", error));
      }
    }
  }
  return row.statusCode ?? "hareket yok";
}

// "Durumu yenile" (tek gonderi).
export async function syncHepsijetShipment(shipmentId: string, actor: Actor): Promise<HjResult> {
  const shipment = await loadShipment(shipmentId);
  if (!shipment?.cargoKey || !isHepsijetActive(shipment)) return { ok: false, message: "HepsiJET'te aktif gönderi yok." };
  try {
    const { rows } = await trackDeliveries([shipment.cargoKey]);
    const result = await applyHjRow(shipment, rows[0], actor);
    await logAudit({
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "HEPSIJET_SORGULANDI",
      targetType: "Order",
      targetId: shipment.orderId,
      detail: `${shipment.cargoKey}: ${result}`
    });
    return { ok: true, message: rows[0].statusCode ?? "Kurye henüz teslim almadı." };
  } catch (error) {
    const message = friendly(error);
    await prisma.shipment.update({ where: { id: shipmentId }, data: { hjLastSyncAt: new Date(), hjLastError: message } });
    return { ok: false, message };
  }
}

export const HJ_TRACK_WINDOW_DAYS = 30;

// Otomatik takip (Yurtici cron'u icinde): takipteki tum gonderiler TEK istekte.
// Takip edilecek kayit yoksa HepsiJET'e hic istek atilmaz.
export async function syncActiveHepsijetShipments(
  now = new Date()
): Promise<{ tracked: number; requested: boolean; results: Record<string, string> }> {
  const since = new Date(now.getTime() - HJ_TRACK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const due = await prisma.shipment.findMany({
    where: {
      provider: HJ_PROVIDER,
      cargoKey: { not: null },
      hjCancelledAt: null,
      hjSentAt: { gte: since },
      OR: [{ hjStatus: null }, { hjStatus: { notIn: HJ_FINAL_STATUSES } }]
    },
    include: { order: true }
  });
  if (due.length === 0) return { tracked: 0, requested: false, results: {} };

  const results: Record<string, string> = {};
  try {
    const { rows } = await trackDeliveries(due.map((s) => s.cargoKey!));
    for (const shipment of due) {
      const row = rows.find((r) => r.customerDeliveryNo === shipment.cargoKey)!;
      try {
        results[shipment.cargoKey!] = await applyHjRow(shipment, row, SYSTEM_ACTOR);
      } catch (error) {
        results[shipment.cargoKey!] = friendly(error);
      }
    }
  } catch (error) {
    const message = friendly(error);
    await prisma.shipment.updateMany({ where: { id: { in: due.map((s) => s.id) } }, data: { hjLastSyncAt: now, hjLastError: message } });
    for (const s of due) results[s.cargoKey!] = message;
  }
  return { tracked: due.length, requested: true, results };
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
