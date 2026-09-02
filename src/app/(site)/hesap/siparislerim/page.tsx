import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel, returnStatuses, type OrderStatus } from "@/lib/status";
import { HesapNav } from "@/components/hesap-nav";
import { HesapOrderCard, type HesapOrderView } from "@/components/hesap-order-card";

interface ReturnItemSnapshot {
  orderItemId: string;
  quantity: number;
}

function parseItemsJson(raw: string): ReturnItemSnapshot[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
      .map((v) => ({ orderItemId: String(v.orderItemId ?? ""), quantity: Number(v.quantity) || 0 }))
      .filter((v) => v.orderItemId);
  } catch {
    return [];
  }
}

export default async function HesapSiparislerimPage() {
  const session = await requireCustomer();
  const customerId = session.user!.id!;

  const orders = await prisma.order.findMany({
    where: { customerId },
    include: {
      items: { include: { product: { select: { name: true } } } },
      shipment: true,
      returnRequests: { orderBy: { createdAt: "desc" } }
    },
    orderBy: { createdAt: "desc" }
  });

  const views: HesapOrderView[] = orders.map((order) => {
    const openItemIds = new Set<string>();
    for (const rr of order.returnRequests) {
      if (rr.status === "TAMAMLANDI" || rr.status === "REDDEDILDI") continue;
      for (const item of parseItemsJson(rr.itemsJson)) openItemIds.add(item.orderItemId);
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      statusLabel: orderStatusLabel[order.status as OrderStatus] ?? order.status,
      createdAtLabel: order.createdAt.toLocaleDateString("tr-TR"),
      totalLabel: formatPrice(order.totalCents),
      shipment: order.shipment ? { carrier: order.shipment.carrier, trackingCode: order.shipment.trackingCode } : null,
      customerEmail: order.customerEmail,
      eligibleForReturn: order.status === "DELIVERED",
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        quantity: item.quantity,
        totalLabel: formatPrice(item.totalCents),
        hasOpenReturn: openItemIds.has(item.id)
      })),
      returnRequests: order.returnRequests.map((rr) => ({
        id: rr.id,
        type: rr.type,
        reason: rr.reason,
        status: returnStatuses.includes(rr.status as (typeof returnStatuses)[number]) ? rr.status : "TALEP_EDILDI",
        createdAtLabel: rr.createdAt.toLocaleDateString("tr-TR"),
        adminNote: rr.adminNote
      }))
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">Siparişlerim</h1>
      <div className="mt-8">
        <HesapNav />
      </div>

      <div className="mt-8 space-y-6">
        {views.length === 0 ? (
          <p className="text-sm text-ink/60">Henüz siparişiniz yok.</p>
        ) : (
          views.map((order) => <HesapOrderCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  );
}
