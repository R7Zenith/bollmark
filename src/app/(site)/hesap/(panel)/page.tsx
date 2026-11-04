import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { formatDate, formatPrice } from "@/lib/format";
import { orderStatusLabel, type OrderStatus } from "@/lib/status";
import { TR_MOBILE_ERROR } from "@/lib/phone";
import { addPhone } from "./actions";

export default async function HesapPage({ searchParams }: { searchParams: Promise<{ telefon?: string }> }) {
  const { telefon } = await searchParams;
  const session = await requireCustomer();
  const customerId = session.user!.id!;

  const [customer, orderCount, addressCount, recentOrders, defaultAddress] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { name: true, email: true, phone: true, loyaltyPoints: true } }),
    prisma.order.count({ where: { customerId, deletedAt: null } }),
    prisma.customerAddress.count({ where: { customerId } }),
    prisma.order.findMany({ where: { customerId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.customerAddress.findFirst({ where: { customerId, isDefault: true } })
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0">
      <div className="w-full max-w-[480px] mx-auto">
        <h2 className="font-display text-xl">Hesap Özeti</h2>

        {customer && !customer.phone && (
          <form action={addPhone} className="mt-6 rounded-lg border border-line bg-white p-6">
            <label htmlFor="hesap-phone" className="text-[10px] font-medium uppercase tracking-[1px] text-ink">
              Telefon numaranı ekle
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="hesap-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="05xx xxx xx xx"
                required
                aria-invalid={telefon === "hata" || undefined}
                aria-describedby={telefon === "hata" ? "hesap-phone-hata" : undefined}
                className="h-12 w-full rounded-lg border border-line bg-transparent px-4 text-xs sm:flex-1"
              />
              <button className="rounded-full bg-ink px-6 py-4 text-[10px] uppercase tracking-[1px] text-white hover:bg-ink/90">
                Kaydet
              </button>
            </div>
            {telefon === "hata" && (
              <p id="hesap-phone-hata" role="alert" className="mt-3 text-sm text-red-600">
                {TR_MOBILE_ERROR}
              </p>
            )}
          </form>
        )}
        {customer?.phone && telefon === "kaydedildi" && (
          <p role="status" className="mt-6 text-sm text-ink/70">
            Telefon numaran kaydedildi.
          </p>
        )}

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
                    <p className="text-ink/50">{formatDate(order.createdAt)}</p>
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

      <div className="lg:border-l lg:border-line">
        <div className="w-full max-w-[480px] mx-auto">
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
    </div>
  );
}
