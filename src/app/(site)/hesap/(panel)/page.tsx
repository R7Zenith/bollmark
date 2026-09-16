import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel, type OrderStatus } from "@/lib/status";

export default async function HesapPage() {
  const session = await requireCustomer();
  const customerId = session.user!.id!;

  const [customer, orderCount, addressCount, recentOrders, defaultAddress] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { name: true, email: true, loyaltyPoints: true } }),
    prisma.order.count({ where: { customerId, deletedAt: null } }),
    prisma.customerAddress.count({ where: { customerId } }),
    prisma.order.findMany({ where: { customerId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.customerAddress.findFirst({ where: { customerId, isDefault: true } })
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0">
      <div>
        <h2 className="font-display text-xl">Hesap Özeti</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-white p-6">
            <p className="text-xs uppercase tracking-wide text-ink/50">Sipariş Sayısı</p>
            <p className="mt-2 font-display text-2xl">{orderCount}</p>
          </div>
          <div className="rounded-lg border border-line bg-white p-6">
            <p className="text-xs uppercase tracking-wide text-ink/50">Sadakat Puanı</p>
            <p className="mt-2 font-display text-2xl">{customer?.loyaltyPoints ?? 0}</p>
          </div>
          <div className="rounded-lg border border-line bg-white p-6">
            <p className="text-xs uppercase tracking-wide text-ink/50">Kayıtlı Adres</p>
            <p className="mt-2 font-display text-2xl">{addressCount}</p>
          </div>
        </div>

        <div className="mt-10">
          <h3 className="font-display text-xl">Son Siparişler</h3>
          {recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-ink/60">Henüz siparişiniz yok.</p>
          ) : (
            <div className="mt-4 divide-y divide-line rounded-lg border border-line bg-white">
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
          <Link href="/hesap/siparislerim" className="mt-4 inline-block text-[10px] uppercase tracking-[1px] underline hover:text-clay">
            Tüm siparişlerimi gör
          </Link>
        </div>
      </div>

      <div className="lg:border-l lg:border-line lg:pl-16">
        <h2 className="font-display text-xl">Adres Bilgileri</h2>

        {defaultAddress ? (
          <div className="mt-6 rounded-lg border border-line bg-white p-6 text-sm">
            <p className="font-medium">{defaultAddress.label}</p>
            <p className="mt-1 text-ink/70">
              {defaultAddress.name} · {defaultAddress.phone}
            </p>
            <p className="mt-1 text-ink/50">
              {defaultAddress.address}, {defaultAddress.district} / {defaultAddress.city} {defaultAddress.postalCode}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink/60">Henüz kayıtlı adresiniz yok.</p>
        )}

        <Link
          href="/hesap/adreslerim"
          className="mt-6 inline-block rounded-full border border-ink px-6 py-4 text-[10px] uppercase tracking-[1px] text-ink hover:bg-ink hover:text-white"
        >
          Adreslerimi Gör
        </Link>
      </div>
    </div>
  );
}
