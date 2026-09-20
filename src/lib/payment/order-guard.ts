import { prisma } from "@/lib/prisma";

// Sunucu tarafi koruma: admin panelinden (tek siparis butonu VE toplu islem) elle yapilan durum
// degisiklikleri odeme gercegiyle celismemeli. Buton gizlemek yetmez, dogrudan POST de mumkun.
// Hata varsa Turkce mesaj, yoksa null doner.
const PREPARATION_STATUSES = ["PREPARING", "SHIPPED", "DELIVERED"];

export async function checkManualStatusChange(orderIds: string[], target: string): Promise<string | null> {
  if (target !== "PAID" && !PREPARATION_STATUSES.includes(target)) return null;

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { orderNumber: true, paymentStatus: true, _count: { select: { paymentAttempts: true } } }
  });
  for (const order of orders) {
    if (target === "PAID" && order._count.paymentAttempts > 0) {
      return `${order.orderNumber}: ödemesi iyzico ile denenmiş bir sipariş elle "Ödendi" yapılamaz; ödeme doğrulanınca otomatik güncellenir.`;
    }
    if (order.paymentStatus === "REVIEW" && PREPARATION_STATUSES.includes(target)) {
      return `${order.orderNumber}: ödeme inceleniyor, sonuç netleşene kadar hazırlama/kargolama yapılamaz.`;
    }
  }
  return null;
}
