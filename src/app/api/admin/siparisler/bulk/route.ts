import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orderStatuses, type OrderStatus } from "@/lib/status";
import { notifyCustomerStatusChange } from "@/lib/order-notifications";
import { awardLoyaltyPoints } from "@/lib/loyalty";
import { logAudit } from "@/lib/audit-log";

const allowedStatuses = new Set<string>(orderStatuses);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Sipariş seçilmedi." }, { status: 400 });
  }

  if (body.action === "SET_STATUS" && allowedStatuses.has(body.status)) {
    const status = body.status as OrderStatus;
    const orders = await prisma.$transaction(
      ids.map((id) => prisma.order.update({ where: { id }, data: { status } }))
    );
    for (const order of orders) {
      notifyCustomerStatusChange(order, status).catch((error) =>
        console.error("Sipariş durum bildirimi maili başarısız:", error)
      );
      if (status === "DELIVERED") {
        awardLoyaltyPoints(order).catch((error) => console.error("Sadakat puanı eklenemedi (yoksayıldı):", error));
      }
      logAudit({
        actorEmail: session.user?.email ?? "bilinmiyor",
        actorRole: session.user?.role ?? "ADMIN",
        action: "ORDER_STATUS_CHANGED",
        targetType: "Order",
        targetId: order.id,
        detail: `-> ${status} (toplu işlem)`
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
}
