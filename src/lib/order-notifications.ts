import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { formatPrice } from "@/lib/format";
import { getSiteUrl } from "@/lib/site-url";
import { returnStatusNotifiable, returnTypes, type OrderStatus, type ReturnStatus, type ReturnType } from "@/lib/status";
import { emailSiteUrl } from "@/lib/email/layout";
import { emailProductImagesSelect, emailVariantSelect, variantImageUrl, variantValues } from "@/lib/email/product-image";
import {
  orderReceivedEmail,
  orderStatusEmail,
  refundEmail,
  returnStatusEmail,
  type OrderEmailData,
  type ReturnEmailData,
  type StatusEmailKind
} from "@/lib/email/order-emails";
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
      variant: variantValues(item.variant),
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

// Talebin kalemleri: bu durumdaki en son guncellenen iade/degisim talebinden. Yalniz okur.
export async function loadReturnEmailData(order: Order, status: ReturnStatus): Promise<ReturnEmailData> {
  const [request, data] = await Promise.all([
    prisma.returnRequest.findFirst({ where: { orderId: order.id, status }, orderBy: { updatedAt: "desc" }, select: { type: true, itemsJson: true } }),
    loadOrderEmailData(order)
  ]);
  const byId = new Map(data.items.map((item) => [item.id, item]));
  const items = request ? parseReturnItems(request.itemsJson).flatMap(({ orderItemId, quantity }) => {
    const item = byId.get(orderItemId);
    if (!item) return [];
    return [{ ...item, quantity, totalCents: Math.round((item.totalCents / item.quantity) * quantity) }];
  }) : [];
  const type = request && (returnTypes as readonly string[]).includes(request.type) ? (request.type as ReturnType) : null;
  return { siteUrl: data.siteUrl, customerName: order.customerName, orderNumber: order.orderNumber, type, items };
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

export async function notifyReturnStatusChange(order: Order, status: ReturnStatus): Promise<void> {
  if (!returnStatusNotifiable.includes(status)) return;
  await sendMail({ to: order.customerEmail, ...returnStatusEmail(await loadReturnEmailData(order, status), status), log: { kind: "RETURN_STATUS" } });
}
