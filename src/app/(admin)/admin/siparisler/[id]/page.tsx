import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { applyShipmentUpdate } from "@/lib/shipment";
import { notifyCustomerStatusChange } from "@/lib/order-notifications";
import { awardLoyaltyPoints } from "@/lib/loyalty";
import { logAudit } from "@/lib/audit-log";
import { checkManualStatusChange } from "@/lib/payment/order-guard";
import {
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  shipmentStatuses,
  shipmentStatusLabel,
  shipmentStatusTone,
  type OrderStatus
} from "@/lib/status";
import { Card } from "@/components/admin/card";
import { Badge } from "@/components/admin/badge";
import { Button } from "@/components/admin/button";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { OrderFeedback } from "@/components/admin/order-feedback";
import { OrderDeleteButton, OrderRestoreButton } from "@/components/admin/order-delete-restore-actions";
import { OrderPaymentCard } from "@/components/admin/order-payment-card";

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

async function setOrderStatus(id: string, status: OrderStatus) {
  "use server";
  const session = await getServerSession(authOptions);
  // Sunucu tarafi odeme kurali (butonu gizlemek yetmez, dogrudan POST de mumkun)
  if (await checkManualStatusChange([id], status)) redirect(`/admin/siparisler/${id}?hata=odeme-kurali`);
  let previousStatus: string | undefined;
  try {
    const before = await prisma.order.findUnique({ where: { id }, select: { status: true } });
    previousStatus = before?.status;
    const order = await prisma.order.update({ where: { id }, data: { status } });
    notifyCustomerStatusChange(order, status).catch((error) =>
      console.error("Sipariş durum bildirimi maili başarısız:", error)
    );
    if (status === "DELIVERED") {
      awardLoyaltyPoints(order).catch((error) => console.error("Sadakat puanı eklenemedi (yoksayıldı):", error));
    }
    logAudit({
      actorEmail: session?.user?.email ?? "bilinmiyor",
      actorRole: session?.user?.role ?? "ADMIN",
      action: "ORDER_STATUS_CHANGED",
      targetType: "Order",
      targetId: order.id,
      detail: `${previousStatus ?? "?"} -> ${status}${status === "PAID" ? " (elle işaretlendi)" : ""}`
    });
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
  searchParams: Promise<{ basarili?: string; hata?: string; mesaj?: string }>;
}) {
  const { id } = await params;
  const { basarili, hata, mesaj } = await searchParams;
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      shipment: true,
      coupon: { select: { code: true, name: true } },
      _count: { select: { paymentAttempts: true } }
    }
  });
  if (!order) notFound();
  const isDeleted = order.deletedAt !== null;

  if (order.viewedAt === null && !isDeleted) {
    await prisma.order.update({ where: { id: order.id }, data: { viewedAt: new Date() } });
  }

  const status = order.status as OrderStatus;
  const nextStatusAction =
    status === "PENDING_PAYMENT"
      ? { label: "Ödendi Olarak İşaretle", target: "PAID" as OrderStatus }
      : status === "PAID"
        ? { label: "Hazırlanıyor Olarak İşaretle", target: "PREPARING" as OrderStatus }
        : status === "PREPARING"
          ? { label: "Kargola", target: "SHIPPED" as OrderStatus }
          : status === "SHIPPED"
            ? { label: "Teslim Edildi Olarak İşaretle", target: "DELIVERED" as OrderStatus }
            : null;
  // Odemesi iyzico ile denenmis siparis elle "Odendi" yapilamaz (sunucu da reddeder)
  const hasPaymentAttempts = order._count.paymentAttempts > 0;
  const isManualPaidAction = nextStatusAction?.target === "PAID";
  const canCancel = status !== "CANCELLED" && status !== "DELIVERED" && status !== "REFUNDED";

  const timeline = [
    { label: "Sipariş Oluşturuldu", date: order.createdAt },
    ...(order.shipment?.shippedAt ? [{ label: "Kargoya Verildi", date: order.shipment.shippedAt }] : []),
    ...(order.shipment?.deliveredAt ? [{ label: "Teslim Edildi", date: order.shipment.deliveredAt }] : [])
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="max-w-5xl">
      <OrderFeedback basarili={basarili} hata={hata} mesaj={mesaj} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-admin-text">Sipariş {order.orderNumber}</h1>
        <p className="text-sm text-admin-text-muted">{formatDate(order.createdAt)}</p>
      </div>

      {isDeleted && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">
            Bu sipariş {formatDate(order.deletedAt!)} tarihinde
            {order.deletedByEmail ? ` ${order.deletedByEmail} tarafından` : ""} silindi. Aşağıdaki bilgiler salt okunur.
          </p>
          {isAdmin && <OrderRestoreButton orderId={order.id} />}
        </div>
      )}

      {order.needsAttention && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Dikkat gerekiyor:</strong> {order.attentionNote ?? "Bu siparişin ödemesinde kontrol edilmesi gereken bir durum var."}
        </div>
      )}

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
            <Badge tone={paymentStatusTone[order.paymentStatus] ?? "gray"}>
              Ödeme: {paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}
            </Badge>
            <span className="ml-2 text-lg font-semibold text-admin-text">{formatPrice(order.totalCents)}</span>
          </div>
          {!isDeleted && (
            <div className="flex items-center gap-2">
              {nextStatusAction && !(isManualPaidAction && hasPaymentAttempts) && (
                <form action={setOrderStatus.bind(null, order.id, nextStatusAction.target)}>
                  {isManualPaidAction ? (
                    <ConfirmSubmitButton
                      confirmMessage="Bu siparişin ödemesini (havale vb.) elle aldığınızı onaylıyor musunuz? İşlem denetim kaydına yazılır."
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-admin-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                      {nextStatusAction.label}
                    </ConfirmSubmitButton>
                  ) : (
                    <Button type="submit" variant="primary" size="sm">
                      {nextStatusAction.label}
                    </Button>
                  )}
                </form>
              )}
              {canCancel && (
                <form action={setOrderStatus.bind(null, order.id, "CANCELLED" as OrderStatus)}>
                  <Button type="submit" variant="danger" size="sm">
                    İptal Et
                  </Button>
                </form>
              )}
              {isAdmin && <OrderDeleteButton orderId={order.id} />}
            </div>
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card title="Ürünler">
            <div className="divide-y divide-admin-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between py-3 text-sm text-admin-text first:pt-0 last:pb-0">
                  <span>
                    {item.product.name} × {item.quantity}
                  </span>
                  <span>{formatPrice(item.totalCents)}</span>
                </div>
              ))}
              <div className="space-y-1 pt-3 text-sm text-admin-text">
                <div className="flex justify-between text-admin-text-muted">
                  <span>Ara Toplam</span>
                  <span>{formatPrice(order.subtotalCents)}</span>
                </div>
                {order.discountCents > 0 && (
                  <div className="flex justify-between text-admin-text-muted">
                    <span>İndirim{order.coupon ? ` (${order.coupon.code ?? order.coupon.name ?? "Otomatik"})` : ""}</span>
                    <span>-{formatPrice(order.discountCents)}</span>
                  </div>
                )}
                {order.loyaltyDiscountCents > 0 && (
                  <div className="flex justify-between text-admin-text-muted">
                    <span>Puan İndirimi ({order.pointsRedeemed} puan)</span>
                    <span>-{formatPrice(order.loyaltyDiscountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-admin-text-muted">
                  <span>Kargo</span>
                  <span>{order.shippingCents === 0 ? "Ücretsiz" : formatPrice(order.shippingCents)}</span>
                </div>
                <div className="flex justify-between pt-1 font-medium">
                  <span>Toplam</span>
                  <span>{formatPrice(order.totalCents)}</span>
                </div>
                {order.pointsEarned > 0 && (
                  <p className="pt-1 text-xs text-admin-text-muted">Müşteri bu siparişten {order.pointsEarned} puan kazandı.</p>
                )}
              </div>
            </div>
          </Card>

          <OrderPaymentCard orderId={order.id} isAdmin={isAdmin} isDeleted={isDeleted} />

          <Card title="Zaman Çizelgesi">
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
                      {formatDate(event.date)} {formatTime(event.date)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Müşteri">
            <p className="text-sm text-admin-text">{order.customerName}</p>
            <p className="text-sm text-admin-text-muted">{order.customerEmail}</p>
            <p className="text-sm text-admin-text-muted">{order.customerPhone}</p>
            <p className="mt-3 text-sm text-admin-text">
              {order.shippingAddress}, {order.district} / {order.city} {order.postalCode}
            </p>
            {order.note && <p className="mt-2 text-sm italic text-admin-text-muted">Not: {order.note}</p>}
          </Card>

          <Card title="Kargo" className="scroll-mt-6" id="kargo">
            {isDeleted && order.shipment ? (
              <div className="space-y-1 text-sm text-admin-text-muted">
                <p>{order.shipment.carrier || "Kargo firması girilmemiş"}</p>
                {order.shipment.trackingCode && <p>Takip: {order.shipment.trackingCode}</p>}
                <p>
                  Durum: {shipmentStatusLabel[order.shipment.status as keyof typeof shipmentStatusLabel] ?? order.shipment.status}
                </p>
              </div>
            ) : order.shipment ? (
              <form action={updateShipmentAction.bind(null, order.id)} className="space-y-3">
                <input type="hidden" name="shipmentId" value={order.shipment.id} />
                <div>
                  <label className={labelClass}>Kargo Firması</label>
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
                  Kargo Bilgilerini Güncelle
                </Button>
              </form>
            ) : (
              <p className="text-sm text-admin-text-muted">Bu siparişe ait kargo kaydı yok.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
