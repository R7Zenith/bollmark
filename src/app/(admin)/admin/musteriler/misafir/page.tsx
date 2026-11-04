import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { formatTrMobile } from "@/lib/phone";
import { Badge } from "@/components/admin/badge";
import { Card } from "@/components/admin/card";
import { CustomerHeader, InfoItem } from "@/components/admin/customer-detail/customer-header";
import { CustomerSummaryCards } from "@/components/admin/customer-detail/summary-cards";
import { OrderAddressesList } from "@/components/admin/customer-detail/order-addresses";
import { OrderHistoryCard } from "@/components/admin/customer-detail/order-history-card";
import { IpLocationCard } from "@/components/admin/customer-detail/ip-location-card";
import { ipTrackingStart, loadCustomerOrders, orderAddresses, orderIpEvents, summarizeOrders } from "@/components/admin/customer-detail/data";

// Misafir musteri (Customer kaydi yok): bilgiler yalniz siparislerde, salt okunur.
// Musteri listesi gibi customerEmail birebir eslesir. Statik "misafir" segmenti
// [id]'den once eslesir.
export default async function AdminGuestCustomerPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  await requireAdmin();
  const email = (await searchParams).email?.trim() ?? "";
  if (!email) notFound();

  const account = await prisma.customer.findUnique({ where: { email }, select: { id: true } });
  if (account) redirect(`/admin/musteriler/${account.id}`);

  const orders = await loadCustomerOrders({ customerEmail: email });
  if (orders.length === 0) notFound();

  const names = [...new Set(orders.map((o) => o.customerName.trim()))];
  const phones = [...new Set(orders.map((o) => formatTrMobile(o.customerPhone.trim())))];
  const ipEvents = orderIpEvents(orders);
  const trackingStart = ipEvents.length === 0 ? await ipTrackingStart() : null;
  const ordersHref = `/admin/siparisler?q=${encodeURIComponent(email)}`;

  return (
    <div className="space-y-8">
      <CustomerHeader name={names[0]} badge={<Badge tone="gray">Misafir</Badge>}>
        <p className="mt-1 text-sm text-admin-text-muted">
          Misafir müşterinin bilgileri siparişlerinde saklanır. Teslimat bilgisini değiştirmek için ilgili siparişi açın.
        </p>
      </CustomerHeader>

      <Card
        title="Müşteri bilgileri"
        action={
          <Link href={ordersHref} className="text-sm text-admin-accent hover:underline">
            Siparişlerini gör
          </Link>
        }
      >
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem label="E-posta">{email}</InfoItem>
          <InfoItem label={names.length > 1 ? "Kullanılan adlar (en yeni üstte)" : "Ad"}>
            {names.map((n) => (
              <span key={n} className="block">
                {n}
              </span>
            ))}
          </InfoItem>
          <InfoItem label={phones.length > 1 ? "Kullanılan telefonlar (en yeni üstte)" : "Telefon"}>
            {phones.map((p) => (
              <span key={p} className="block">
                {p}
              </span>
            ))}
          </InfoItem>
        </dl>
      </Card>

      <CustomerSummaryCards summary={summarizeOrders(orders)} />

      <Card title="Siparişlerde kullanılan adresler">
        <OrderAddressesList addresses={orderAddresses(orders)} emptyText="Adres yok." />
      </Card>

      <OrderHistoryCard orders={orders} allOrdersHref={ordersHref} />

      <IpLocationCard events={ipEvents} withDevices={false} trackingStart={trackingStart} />
    </div>
  );
}
