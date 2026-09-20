import "server-only";
import { prisma } from "@/lib/prisma";

// Musteriye gosterilen odeme durumu: her zaman DB'deki gercek duruma bakar, URL'deki hicbir
// parametreye guvenilmez. Kisisel veri dondurmez.
export type PublicPaymentState = "UNKNOWN" | "PAID" | "REVIEW" | "FAILED" | "CANCELLED" | "PENDING";

export async function getPublicPaymentState(orderNumber: string): Promise<{
  state: PublicPaymentState;
  errorCode: string | null;
  canRetry: boolean;
}> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      status: true,
      paymentStatus: true,
      paymentExpiresAt: true,
      deletedAt: true,
      paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, errorCode: true } }
    }
  });
  if (!order || order.deletedAt) return { state: "UNKNOWN", errorCode: null, canRetry: false };

  const latest = order.paymentAttempts[0];
  const paidLike = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(order.paymentStatus);
  const shipped = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"].includes(order.status);
  if (paidLike || shipped) return { state: "PAID", errorCode: null, canRetry: false };
  if (order.paymentStatus === "REVIEW") return { state: "REVIEW", errorCode: null, canRetry: false };
  if (order.status === "CANCELLED") return { state: "CANCELLED", errorCode: null, canRetry: false };

  const expired = order.paymentExpiresAt !== null && order.paymentExpiresAt.getTime() < Date.now();
  if (order.paymentStatus === "FAILED" || latest?.status === "FAILED") {
    return { state: "FAILED", errorCode: latest?.errorCode ?? null, canRetry: !expired };
  }
  return { state: "PENDING", errorCode: null, canRetry: !expired };
}
