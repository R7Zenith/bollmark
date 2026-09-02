import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel, type OrderStatus } from "@/lib/status";
import { HesapNav } from "@/components/hesap-nav";

export default async function HesapPage() {
  const session = await requireCustomer();
  const customerId = session.user!.id!;

  const [customer, orderCount, addressCount, recentOrders] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { name: true, email: true, loyaltyPoints: true } }),
    prisma.order.count({ where: { customerId } }),
    prisma.customerAddress.count({ where: { customerId } }),
    prisma.order.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 5 })
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">Merhaba, {customer?.name}</h1>
      <div className="mt-8">
        <HesapNav />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="border border-line bg-white p-6">
          <p className="text-xs uppercase tracking-wide text-ink/50">Sipariş Sayısı</p>
          <p className="mt-2 font-display text-2xl">{orderCount}</p>
        </div>
        <div className="border border-line bg-white p-6">
          <p className="text-xs uppercase tracking-wide text-ink/50">Sadakat Puanı</p>
          <p className="mt-2 font-display text-2xl">{customer?.loyaltyPoints ?? 0}</p>
        </div>
        <div className="border border-line bg-white p-6">
          <p className="text-xs uppercase tracking-wide text-ink/50">Kayıtlı Adres</p>
          <p className="mt-2 font-display text-2xl">{addressCount}</p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-xl">Son Siparişler</h2>
        {recentOrders.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">Henüz siparişiniz yok.</p>
        ) : (
          <div className="mt-4 divide-y divide-line border border-line bg-white">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between px-6 py-4 text-sm">
                <div>
                  <p className="font-medium">{order.orderNumber}</p>
                  <p className="text-ink/50">{order.createdAt.toLocaleDateString("tr-TR")}</p>
                </div>
                <div className="text-right">
                  <p>{formatPrice(order.totalCents)}</p>
                  <p className="text-ink/50">{orderStatusLabel[order.status as OrderStatus] ?? order.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <Link href="/hesap/siparislerim" className="mt-4 inline-block text-sm underline hover:text-accent">
          Tüm siparişlerimi gör
        </Link>
      </div>
    </div>
  );
}
