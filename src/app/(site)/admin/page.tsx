import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export default async function AdminDashboard() {
  const [productCount, orderCount, pendingOrders, revenue] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } }
    })
  ]);

  const stats = [
    { label: "Toplam Urun", value: productCount },
    { label: "Toplam Siparis", value: orderCount },
    { label: "Odeme Bekleyen", value: pendingOrders },
    { label: "Ciro", value: formatPrice(revenue._sum.totalCents ?? 0) }
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Genel Bakis</h1>
      <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-admin-border bg-admin-surface p-6">
            <p className="text-xs uppercase tracking-wide text-admin-text-muted">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-admin-text">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
