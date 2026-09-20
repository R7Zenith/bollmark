import { sendMail } from "@/lib/mail";
import { formatPrice } from "@/lib/format";
import { getSiteUrl } from "@/lib/site-url";
import { orderStatusLabel, returnStatusLabel, returnStatusNotifiable, type OrderStatus, type ReturnStatus } from "@/lib/status";
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

export async function notifyCustomerOrderReceived(
  order: Order,
  items: { productName: string; quantity: number; totalCents: number }[]
): Promise<void> {
  const itemsHtml = items
    .map((item) => `<li>${item.productName} × ${item.quantity} - ${formatPrice(item.totalCents)}</li>`)
    .join("");
  await sendMail({
    to: order.customerEmail,
    subject: `Siparişiniz alındı - ${order.orderNumber}`,
    html: `<p>Merhaba ${order.customerName}, ${order.orderNumber} numaralı siparişiniz alındı.</p>
           <ul>${itemsHtml}</ul>
           <p>Toplam: ${formatPrice(order.totalCents)}</p>
           <p>Teslimat Adresi: ${order.shippingAddress}, ${order.district} / ${order.city}${
             order.postalCode ? ` ${order.postalCode}` : ""
           }</p>
           <p>Siparişinizi <a href="${getSiteUrl()}/siparis-durumu">${new URL(getSiteUrl()).host}/siparis-durumu</a> üzerinden takip edebilirsiniz.</p>`
  });
}

export async function notifyCustomerStatusChange(order: Order, status: OrderStatus): Promise<void> {
  if (!notifiableStatuses.includes(status)) return;
  await sendMail({
    to: order.customerEmail,
    subject: `Siparişiniz ${orderStatusLabel[status]} - ${order.orderNumber}`,
    html: `<p>Merhaba ${order.customerName}, ${order.orderNumber} numaralı siparişinizin durumu
           "${orderStatusLabel[status]}" olarak güncellendi.</p>`
  });
}

export async function notifyReturnStatusChange(order: Order, status: ReturnStatus): Promise<void> {
  if (!returnStatusNotifiable.includes(status)) return;
  await sendMail({
    to: order.customerEmail,
    subject: `İade talebiniz ${returnStatusLabel[status]} - ${order.orderNumber}`,
    html: `<p>Merhaba ${order.customerName}, ${order.orderNumber} numaralı siparişinize ait
           iade/değişim talebinizin durumu "${returnStatusLabel[status]}" olarak güncellendi.</p>`
  });
}
