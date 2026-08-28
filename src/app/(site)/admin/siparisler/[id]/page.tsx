import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

type OrderStatus = "PENDING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

const statuses: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED"
];

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "Odeme Bekliyor",
  PAID: "Odendi",
  PREPARING: "Hazirlaniyor",
  SHIPPED: "Kargolandi",
  DELIVERED: "Teslim Edildi",
  CANCELLED: "Iptal",
  REFUNDED: "Iade Edildi"
};

async function updateStatus(id: string, formData: FormData) {
  "use server";
  const status = String(formData.get("status")) as OrderStatus;
  await prisma.order.update({ where: { id }, data: { status } });
  redirect(`/admin/siparisler/${id}`);
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, shipment: true }
  });
  if (!order) notFound();

  const updateWithId = updateStatus.bind(null, order.id);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-admin-text">Siparis {order.orderNumber}</h1>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="rounded-lg border border-admin-border bg-admin-surface p-6">
          <p className="text-xs uppercase tracking-wide text-admin-text-muted">Musteri</p>
          <p className="mt-2 text-sm text-admin-text">{order.customerName}</p>
          <p className="text-sm text-admin-text-muted">{order.customerEmail}</p>
          <p className="text-sm text-admin-text-muted">{order.customerPhone}</p>
          <p className="mt-3 text-sm text-admin-text">
            {order.shippingAddress}, {order.district} / {order.city} {order.postalCode}
          </p>
          {order.note && <p className="mt-2 text-sm italic text-admin-text-muted">Not: {order.note}</p>}
        </div>

        <div className="rounded-lg border border-admin-border bg-admin-surface p-6">
          <p className="text-xs uppercase tracking-wide text-admin-text-muted">Durum</p>
          <p className="mt-2 text-sm text-admin-text">{statusLabel[order.status]}</p>
          <form action={updateWithId} className="mt-4 flex gap-2">
            <select
              name="status"
              defaultValue={order.status}
              className="flex-1 rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Guncelle
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
        {order.items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between border-b border-admin-border px-6 py-4 text-sm text-admin-text last:border-0"
          >
            <span>
              {item.product.name} × {item.quantity}
            </span>
            <span>{formatPrice(item.totalCents)}</span>
          </div>
        ))}
        <div className="flex justify-between px-6 py-4 text-sm font-medium text-admin-text">
          <span>Toplam</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>
      </div>
    </div>
  );
}
