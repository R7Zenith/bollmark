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

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: { include: { product: true } }, shipment: true }
  });
  if (!order) notFound();

  const updateWithId = updateStatus.bind(null, order.id);

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl">Siparis {order.orderNumber}</h1>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="border border-line bg-white p-6">
          <p className="text-xs uppercase tracking-wide text-ink/50">Musteri</p>
          <p className="mt-2 text-sm">{order.customerName}</p>
          <p className="text-sm text-ink/60">{order.customerEmail}</p>
          <p className="text-sm text-ink/60">{order.customerPhone}</p>
          <p className="mt-3 text-sm">
            {order.shippingAddress}, {order.district} / {order.city} {order.postalCode}
          </p>
          {order.note && <p className="mt-2 text-sm italic text-ink/60">Not: {order.note}</p>}
        </div>

        <div className="border border-line bg-white p-6">
          <p className="text-xs uppercase tracking-wide text-ink/50">Durum</p>
          <p className="mt-2 text-sm">{statusLabel[order.status]}</p>
          <form action={updateWithId} className="mt-4 flex gap-2">
            <select name="status" defaultValue={order.status} className="flex-1 border border-line px-3 py-2 text-sm">
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
            <button className="bg-ink px-4 py-2 text-sm text-paper hover:bg-accent">Guncelle</button>
          </form>
        </div>
      </div>

      <div className="mt-8 border border-line bg-white">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between border-b border-line px-6 py-4 text-sm last:border-0">
            <span>
              {item.product.name} × {item.quantity}
            </span>
            <span>{formatPrice(item.totalCents)}</span>
          </div>
        ))}
        <div className="flex justify-between px-6 py-4 text-sm font-medium">
          <span>Toplam</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>
      </div>
    </div>
  );
}
