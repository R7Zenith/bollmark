import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { formatExactPrice, formatPrice } from "@/lib/format";
import { getSiteUrl } from "@/lib/site-url";
import { returnStatusNotifiable, returnTypes, type OrderStatus, type ReturnStatus, type ReturnType } from "@/lib/status";
import { emailSiteUrl } from "@/lib/email/layout";
import { emailProductImagesSelect, emailVariantSelect, variantImageUrl, variantValues } from "@/lib/email/product-image";
import {
  orderReceivedEmail,
  orderStatusEmail,
  refundEmail,
  returnReplyEmail,
  returnStatusEmail,
  type OrderEmailData,
  type ReturnEmailData,
  type StatusEmailKind
} from "@/lib/email/order-emails";
import { sendReturnCreatedMails } from "@/lib/email/return-mails";
import type { Order } from "@/generated/prisma/client";

// Sadece musterinin bilmesi gereken 3 kritik gecis icin mail atilir - her
// durum degisikliginde gondermek gurultu yaratir.
const notifiableStatuses: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];

export async function notifyAdminNewOrder(order: Order): Promise<void> {
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.MAIL_FROM;
  if (!to) return;
  await sendMail({
    to,
    subject: `Yeni sipariş: ${order.orderNumber}`,
    html: `<p>${order.customerName} - ${formatPrice(order.totalCents)}</p>
           <p><a href="${getSiteUrl()}/admin/siparisler/${order.id}">Siparişi görüntüle</a></p>`
  });
}

// Odeme sistemi bir siparisin odemesinde dikkat gerektiren bir durum buldugunda (cift/gec odeme,
// dolandiricilik incelemesi, dogrulama hatasi, stok yetersizligi) admin'e haber verir.
export async function notifyAdminPaymentAttention(order: Order, note: string): Promise<void> {
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.MAIL_FROM;
  if (!to) return;
  await sendMail({
    to,
    subject: `Ödeme dikkat gerektiriyor: ${order.orderNumber}`,
    html: `<p>${order.orderNumber} numaralı siparişte ödeme ile ilgili bir durum var:</p>
           <p><strong>${note}</strong></p>
           <p><a href="${getSiteUrl()}/admin/siparisler/${order.id}">Siparişi görüntüle</a></p>`
  });
}

// Musteri e-postalari icin siparis verisi (kalemler gorselli, kargo bilgisi). Yalniz okur.
export async function loadOrderEmailData(order: Order): Promise<OrderEmailData> {
  const [items, shipment] = await Promise.all([
    prisma.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { id: "asc" },
      select: {
        id: true,
        quantity: true,
        totalCents: true,
        campaignLabel: true,
        campaignOriginalUnitCents: true,
        product: { select: { name: true, ...emailProductImagesSelect } },
        variant: { select: emailVariantSelect }
      }
    }),
    prisma.shipment.findUnique({ where: { orderId: order.id }, select: { carrier: true, trackingCode: true } })
  ]);
  return {
    siteUrl: emailSiteUrl(),
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    items: items.map((item) => ({
      id: item.id,
      name: item.product.name,
      // Efsane Cuma: indirimli adet ayri satirdir; hangi urune ne indirim yapildigi yazilir.
      variant: [
        variantValues(item.variant),
        item.campaignOriginalUnitCents != null
          ? `${item.campaignLabel ?? "Kampanya"} (normal birim ${formatExactPrice(item.campaignOriginalUnitCents)})`
          : null
      ]
        .filter(Boolean)
        .join(" · "),
      quantity: item.quantity,
      totalCents: item.totalCents,
      imageUrl: variantImageUrl(item.product, item.variant)
    })),
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents + order.bundleDiscountCents + order.loyaltyDiscountCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    address: { line: order.shippingAddress, district: order.district, city: order.city, postalCode: order.postalCode },
    shipment
  };
}

export async function notifyCustomerOrderReceived(order: Order): Promise<void> {
  await sendMail({ to: order.customerEmail, ...orderReceivedEmail(await loadOrderEmailData(order)), log: { kind: "ORDER_RECEIVED" } });
}

export async function notifyCustomerStatusChange(order: Order, status: OrderStatus): Promise<void> {
  if (!notifiableStatuses.includes(status)) return;
  const kind = status as StatusEmailKind;
  await sendMail({ to: order.customerEmail, ...orderStatusEmail(await loadOrderEmailData(order), kind), log: { kind: "ORDER_STATUS" } });
}

export async function notifyCustomerRefund(order: Order, amountCents: number, fullyRefunded: boolean): Promise<void> {
  const data = { siteUrl: emailSiteUrl(), customerName: order.customerName, orderNumber: order.orderNumber };
  await sendMail({ to: order.customerEmail, ...refundEmail(data, amountCents, fullyRefunded), log: { kind: "REFUND" } });
}

// Iade talebinin mail verisi (kalemler gorselli). Yalniz okur.
export async function loadReturnEmailData(order: Order, returnId: string): Promise<ReturnEmailData> {
  const [request, data] = await Promise.all([
    prisma.returnRequest.findUnique({
      where: { id: returnId },
      select: { type: true, itemsJson: true, reason: true, customerNote: true, customerReply: true }
    }),
    loadOrderEmailData(order)
  ]);
  const byId = new Map(data.items.map((item) => [item.id, item]));
  const items = request ? parseReturnItems(request.itemsJson).flatMap(({ orderItemId, quantity }) => {
    const item = byId.get(orderItemId);
    if (!item) return [];
    return [{ ...item, quantity, totalCents: Math.round((item.totalCents / item.quantity) * quantity) }];
  }) : [];
  const type = request && (returnTypes as readonly string[]).includes(request.type) ? (request.type as ReturnType) : null;
  return {
    siteUrl: data.siteUrl,
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    type,
    items,
    reason: request?.reason ?? "",
    customerNote: request?.customerNote ?? null,
    customerReply: request?.customerReply ?? null,
    viewUrl: order.customerId ? `${data.siteUrl}/hesap/iade-taleplerim` : `${data.siteUrl}/siparis-durumu`
  };
}

function parseReturnItems(raw: string): { orderItemId: string; quantity: number }[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((v) => (v && typeof v.orderItemId === "string" ? [{ orderItemId: v.orderItemId, quantity: Number(v.quantity) || 1 }] : []));
  } catch {
    return [];
  }
}

export async function notifyReturnStatusChange(order: Order, status: ReturnStatus, returnId: string): Promise<void> {
  if (!returnStatusNotifiable.includes(status)) return;
  await sendMail({ to: order.customerEmail, ...returnStatusEmail(await loadReturnEmailData(order, returnId), status), log: { kind: "RETURN_STATUS" } });
}

// 18: durum maili gitmeyen kayitta yeni/degisen musteri yaniti.
export async function notifyReturnReply(order: Order, status: ReturnStatus, returnId: string): Promise<void> {
  await sendMail({ to: order.customerEmail, ...returnReplyEmail(await loadReturnEmailData(order, returnId), status), log: { kind: "RETURN_REPLY" } });
}

// 16 + 17: talep acilinca musteriye ve bize.
export async function notifyReturnCreated(order: Order, returnId: string): Promise<void> {
  await sendReturnCreatedMails(
    {
      customerEmail: order.customerEmail,
      data: await loadReturnEmailData(order, returnId),
      adminTo: process.env.ADMIN_NOTIFY_EMAIL || process.env.MAIL_FROM || null,
      adminUrl: `${getSiteUrl()}/admin/iadeler?q=${encodeURIComponent(order.orderNumber)}`
    },
    sendMail
  );
}
