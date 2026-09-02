import { sendMail } from "@/lib/mail";
import { formatPrice } from "@/lib/format";
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
           <p><a href="https://bollmark.com/admin/siparisler/${order.id}">Siparişi görüntüle</a></p>`
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
