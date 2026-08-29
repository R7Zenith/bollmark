import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { applyShipmentUpdate } from "@/lib/shipment";
import {
  orderStatusLabel,
  orderStatusTone,
  shipmentStatuses,
  shipmentStatusLabel,
  shipmentStatusTone,
  type OrderStatus
} from "@/lib/status";
import { Card } from "@/components/admin/card";
import { Badge } from "@/components/admin/badge";
import { Button } from "@/components/admin/button";
import { OrderFeedback } from "@/components/admin/order-feedback";

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

async function setOrderStatus(id: string, status: OrderStatus) {
  "use server";
  try {
    await prisma.order.update({ where: { id }, data: { status } });
  } catch {
    redirect(`/admin/siparisler/${id}?hata=guncellenemedi`);
  }
  const anchor = status === "SHIPPED" ? "#kargo" : "";
  redirect(`/admin/siparisler/${id}?basarili=durum-guncellendi${anchor}`);
}

async function updateShipmentAction(id: string, formData: FormData) {
  "use server";
  try {
    await applyShipmentUpdate(formData);
  } catch {
    redirect(`/admin/siparisler/${id}?hata=guncellenemedi`);
  }
  redirect(`/admin/siparisler/${id}?basarili=kargo-guncellendi#kargo`);
}

export default async function OrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  const { id } = await params;
  const { basarili, hata } = await searchParams;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, shipment: true }
  });
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const nextStatusAction =
    status === "PENDING_PAYMENT"
      ? { label: "Odendi Olarak Isaretle", target: "PAID" as OrderStatus }
      : status === "PAID"
        ? { label: "Hazirlaniyor Olarak Isaretle", target: "PREPARING" as OrderStatus }
        : status === "PREPARING"
          ? { label: "Kargola", target: "SHIPPED" as OrderStatus }
          : status === "SHIPPED"
            ? { label: "Teslim Edildi Olarak Isaretle", target: "DELIVERED" as OrderStatus }
            : null;
  const canCancel = status !== "CANCELLED" && status !== "DELIVERED" && status !== "REFUNDED";

  const timeline = [
    { label: "Siparis Olusturuldu", date: order.createdAt },
    ...(order.shipment?.shippedAt ? [{ label: "Kargoya Verildi", date: order.shipment.shippedAt }] : []),
    ...(order.shipment?.deliveredAt ? [{ label: "Teslim Edildi", date: order.shipment.deliveredAt }] : [])
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="max-w-5xl">
      <OrderFeedback basarili={basarili} hata={hata} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-admin-text">Siparis {order.orderNumber}</h1>
        <p className="text-sm text-admin-text-muted">{order.createdAt.toLocaleDateString("tr-TR")}</p>
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge tone={orderStatusTone[status]}>{orderStatusLabel[status]}</Badge>
            {order.shipment ? (
              <Badge tone={shipmentStatusTone[order.shipment.status as keyof typeof shipmentStatusTone]}>
                {shipmentStatusLabel[order.shipment.status as keyof typeof shipmentStatusLabel] ?? order.shipment.status}
              </Badge>
            ) : (
              <Badge tone="gray">Kargo Yok</Badge>
            )}
            <span className="ml-2 text-lg font-semibold text-admin-text">{formatPrice(order.totalCents)}</span>
          </div>
          <div className="flex items-center gap-2">
            {nextStatusAction && (
              <form action={setOrderStatus.bind(null, order.id, nextStatusAction.target)}>
                <Button type="submit" variant="primary" size="sm">
                  {nextStatusAction.label}
                </Button>
              </form>
            )}
            {canCancel && (
              <form action={setOrderStatus.bind(null, order.id, "CANCELLED" as OrderStatus)}>
                <Button type="submit" variant="danger" size="sm">
                  Iptal Et
                </Button>
              </form>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card title="Urunler">
            <div className="divide-y divide-admin-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between py-3 text-sm text-admin-text first:pt-0 last:pb-0">
                  <span>
                    {item.product.name} × {item.quantity}
                  </span>
                  <span>{formatPrice(item.totalCents)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 text-sm font-medium text-admin-text">
                <span>Toplam</span>
                <span>{formatPrice(order.totalCents)}</span>
              </div>
            </div>
          </Card>

          <Card title="Zaman Cizelgesi">
            <ol className="space-y-4">
              {timeline.map((event, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-admin-accent" />
                    {i < timeline.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-admin-border" />}
                  </div>
                  <div className="-mt-1 pb-2">
                    <p className="text-sm font-medium text-admin-text">{event.label}</p>
                    <p className="text-xs text-admin-text-muted">
                      {event.date.toLocaleDateString("tr-TR")} {event.date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Musteri">
            <p className="text-sm text-admin-text">{order.customerName}</p>
            <p className="text-sm text-admin-text-muted">{order.customerEmail}</p>
            <p className="text-sm text-admin-text-muted">{order.customerPhone}</p>
            <p className="mt-3 text-sm text-admin-text">
              {order.shippingAddress}, {order.district} / {order.city} {order.postalCode}
            </p>
            {order.note && <p className="mt-2 text-sm italic text-admin-text-muted">Not: {order.note}</p>}
          </Card>

          <Card title="Kargo" className="scroll-mt-6" id="kargo">
            {order.shipment ? (
              <form action={updateShipmentAction.bind(null, order.id)} className="space-y-3">
                <input type="hidden" name="shipmentId" value={order.shipment.id} />
                <div>
                  <label className={labelClass}>Kargo Firmasi</label>
                  <input name="carrier" defaultValue={order.shipment.carrier} className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>Takip Kodu</label>
                  <input name="trackingCode" defaultValue={order.shipment.trackingCode ?? ""} className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>Durum</label>
                  <select name="status" defaultValue={order.shipment.status} className={`mt-1 ${inputClass}`}>
                    {shipmentStatuses.map((s) => (
                      <option key={s} value={s}>
                        {shipmentStatusLabel[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="sm" className="w-full justify-center">
                  Kargo Bilgilerini Guncelle
                </Button>
              </form>
            ) : (
              <p className="text-sm text-admin-text-muted">Bu siparise ait kargo kaydi yok.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
