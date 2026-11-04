import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/admin/badge";
import { Card } from "@/components/admin/card";
import { KalpCouponActions } from "@/components/admin/kalp-coupon-actions";
import { istanbulInputValue } from "@/lib/kalp-topla/admin-rules";
import { formatTrMobile } from "@/lib/phone";
import { CustomerHeader, InfoItem } from "@/components/admin/customer-detail/customer-header";
import { CustomerSummaryCards } from "@/components/admin/customer-detail/summary-cards";
import { OrderAddressesList } from "@/components/admin/customer-detail/order-addresses";
import { OrderHistoryCard } from "@/components/admin/customer-detail/order-history-card";
import { IpLocationCard } from "@/components/admin/customer-detail/ip-location-card";
import {
  deviceIpEvents,
  ipTrackingStart,
  loadCustomerOrders,
  orderAddresses,
  orderIpEvents,
  summarizeOrders
} from "@/components/admin/customer-detail/data";
import { cancelCouponAction, extendCouponAction } from "./actions";

const LIST_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const RESULT_LABEL: Record<string, string> = {
  iptal: "Kupon iptal edildi.",
  uzatildi: "Kupon süresi uzatıldı.",
  degismis: "Kuponun durumu değişmiş, işlem yapılmadı.",
  "gecersiz-tarih": "Yeni bitiş hem şu andan hem mevcut bitişten sonra olmalı."
};
const HEART_LABEL: Record<string, string> = {
  PENDING: "Doğrulama bekliyor",
  ACTIVE: "Aktif",
  WITHDRAWN: "Geri çekildi",
  WON: "Kazandı"
};
const CREDIT_LABEL: Record<string, string> = {
  WAITING: "Bekleyen",
  APPLIED: "Uygulanan",
  ROUND_CLOSED: "Tur kapandı",
  VOID_WITHDRAWN: "Kalp çekildi",
  EXPIRED: "Süresi doldu",
  CANCELLED: "İptal"
};
const COUPON_LABEL: Record<string, string> = {
  AVAILABLE: "Kullanılabilir",
  RESERVED: "Ödeme bekleyen siparişte",
  USED: "Kullanıldı",
  CANCELLED: "İptal edildi",
  TEST_CANCELLED: "Test-iptal"
};
const CHANNEL_LABEL: Record<string, string> = { EMAIL: "E-posta", PUSH: "Push", WHATSAPP: "WhatsApp" };

const tableClass = "w-full text-left text-sm";
const headClass = "text-xs uppercase tracking-wide text-admin-text-muted";
const rowClass = "border-t border-admin-border text-admin-text";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-admin-text-muted">{children}</p>;
}

// Hesapli musteri detayi: kimlik, ozet, adresler, siparisler, IP/konum; altta
// Kalp Topla bolumleri (KALP_TOPLA_PLANI.md 6.11). Test kayitlari gizlenmez,
// rozetle gorunur; hariç tutma kurali yalniz raporlar icindir. Yalniz ADMIN
// (PERSONEL /admin/musteriler'e proxy'de giremez, bkz. lib/roles.ts).
export default async function AdminCustomerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sonuc?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { sonuc } = await searchParams;

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      loyaltyPoints: true,
      createdAt: true,
      emailVerifiedAt: true,
      marketingEmailAt: true,
      addresses: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!customer) notFound();

  // Hesap acmadan once misafir olarak verdigi siparisler de sayilir.
  const [orders, deviceEvents] = await Promise.all([
    loadCustomerOrders({ OR: [{ customerId: id }, { customerEmail: customer.email }] }),
    deviceIpEvents(id)
  ]);
  const ipEvents = [...orderIpEvents(orders), ...deviceEvents].sort((a, b) => b.at.getTime() - a.at.getTime());
  const trackingStart = ipEvents.length === 0 ? await ipTrackingStart() : null;
  const ordersHref = `/admin/siparisler?q=${encodeURIComponent(customer.email)}`;

  const [hearts, coupons, credits, consents, devices] = await Promise.all([
    prisma.kalpHeart.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: LIST_LIMIT }),
    prisma.kalpCoupon.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: LIST_LIMIT }),
    prisma.kalpBonusCredit.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: LIST_LIMIT }),
    prisma.marketingConsentLog.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: LIST_LIMIT }),
    prisma.customerDevice.findMany({ where: { customerId: id }, select: { deviceId: true, ipHash: true } })
  ]);

  const deviceIds = [...new Set(devices.map((d) => d.deviceId))];
  const ipHashes = [...new Set(devices.flatMap((d) => (d.ipHash ? [d.ipHash] : [])))];
  const [rounds, related] = await Promise.all([
    prisma.kalpRound.findMany({ where: { id: { in: hearts.map((h) => h.roundId) } }, select: { id: true, roundNo: true, isTest: true } }),
    prisma.customerDevice.findMany({
      where: { customerId: { not: id }, OR: [{ deviceId: { in: deviceIds } }, { ipHash: { in: ipHashes } }] },
      select: { customerId: true, deviceId: true, ipHash: true }
    })
  ]);
  const [products, relatedCustomers] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: hearts.map((h) => h.productId) } }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { id: { in: related.map((r) => r.customerId) } }, select: { id: true, email: true } })
  ]);
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const roundById = new Map(rounds.map((r) => [r.id, r]));

  const deviceSet = new Set(deviceIds);
  const ipSet = new Set(ipHashes);
  const matches = relatedCustomers.map((c) => ({
    ...c,
    sameDevice: related.some((r) => r.customerId === c.id && deviceSet.has(r.deviceId)),
    sameIp: related.some((r) => r.customerId === c.id && r.ipHash !== null && ipSet.has(r.ipHash))
  }));
  const now = new Date();

  return (
    <div className="space-y-8">
      <CustomerHeader
        name={customer.name}
        badge={<Badge tone="blue">Hesaplı</Badge>}
        action={
          <Link
            href={`/admin/musteriler/${customer.id}/duzenle`}
            className="inline-flex shrink-0 items-center justify-center rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Düzenle
          </Link>
        }
      />

      {sonuc && RESULT_LABEL[sonuc] && (
        <p className="rounded-md border border-admin-border bg-admin-surface px-4 py-3 text-sm text-admin-text">{RESULT_LABEL[sonuc]}</p>
      )}

      <Card
        title="Müşteri bilgileri"
        action={
          <Link href={ordersHref} className="text-sm text-admin-accent hover:underline">
            Siparişlerini gör
          </Link>
        }
      >
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem label="E-posta">{customer.email}</InfoItem>
          <InfoItem label="Telefon">
            {customer.phone ? formatTrMobile(customer.phone) : <span className="text-admin-text-muted">Kayıtlı değil</span>}
          </InfoItem>
          <InfoItem label="E-posta doğrulama">
            {customer.emailVerifiedAt ? <Badge tone="green">Doğrulandı</Badge> : <Badge tone="yellow">Doğrulanmadı</Badge>}
          </InfoItem>
          <InfoItem label="Kayıt tarihi">{formatDateTime(customer.createdAt)}</InfoItem>
          <InfoItem label="Sadakat puanı">{customer.loyaltyPoints}</InfoItem>
        </dl>
      </Card>

      <CustomerSummaryCards summary={summarizeOrders(orders)} />

      <Card title="Adresler">
        {customer.addresses.length === 0 ? (
          <Empty>Kayıtlı adres yok.</Empty>
        ) : (
          <ul className="divide-y divide-admin-border text-sm">
            {customer.addresses.map((a) => (
              <li key={a.id} className="py-3">
                <p className="flex flex-wrap items-center gap-2 font-medium text-admin-text">
                  {a.label} {a.isDefault && <Badge tone="green">Varsayılan</Badge>}
                </p>
                <p className="text-admin-text">
                  {a.name} · {formatTrMobile(a.phone)}
                </p>
                <p className="break-words text-admin-text-muted">
                  {a.address}, {a.district} / {a.city} {a.postalCode}
                </p>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Siparişlerde kullanılan adresler</h3>
        <OrderAddressesList addresses={orderAddresses(orders, customer.addresses)} emptyText="Kayıtlı adreslerden farklı sipariş adresi yok." />
      </Card>

      <OrderHistoryCard orders={orders} allOrdersHref={ordersHref} />

      <IpLocationCard events={ipEvents} withDevices trackingStart={trackingStart} />

      <h2 className="border-t border-admin-border pt-8 text-lg font-semibold text-admin-text">Kalp Topla</h2>

      <Card title="Doğrulama">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-admin-text-muted">E-posta</dt>
            <dd className="mt-1">
              {customer.emailVerifiedAt ? <Badge tone="green">Doğrulandı · {formatDateTime(customer.emailVerifiedAt)}</Badge> : <Badge tone="yellow">Doğrulanmadı</Badge>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-admin-text-muted">Kayıt tarihi</dt>
            <dd className="mt-1 text-admin-text">{formatDateTime(customer.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-admin-text-muted">E-posta izni</dt>
            <dd className="mt-1 text-admin-text">{customer.marketingEmailAt ? formatDateTime(customer.marketingEmailAt) : "Yok"}</dd>
          </div>
        </dl>
      </Card>

      <Card title={`Kuponlar (${coupons.length})`}>
        {coupons.length === 0 ? (
          <Empty>Kupon yok.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={headClass}>
                <tr>
                  <th className="py-2 pr-4">Kod</th>
                  <th className="py-2 pr-4">İndirim</th>
                  <th className="py-2 pr-4">Durum</th>
                  <th className="py-2 pr-4">Bitiş (İstanbul)</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => {
                  const available = coupon.status === "AVAILABLE";
                  const expired = available && coupon.expiresAt <= now;
                  const base = coupon.expiresAt > now ? coupon.expiresAt : now;
                  return (
                    <tr key={coupon.id} className={rowClass}>
                      <td className="whitespace-nowrap py-3 pr-4 font-medium">
                        {coupon.code} {coupon.isTest && <Badge tone="gray">test</Badge>}
                      </td>
                      <td className="py-3 pr-4">%{coupon.discountPercent}</td>
                      <td className="whitespace-nowrap py-3 pr-4">{expired ? "Süresi doldu" : COUPON_LABEL[coupon.status] ?? coupon.status}</td>
                      <td className="whitespace-nowrap py-3 pr-4">{formatDateTime(coupon.expiresAt)}</td>
                      <td className="py-3 text-right">
                        {available && (
                          <KalpCouponActions
                            id={coupon.id}
                            customerId={customer.id}
                            code={coupon.code}
                            expiresLabel={formatDateTime(coupon.expiresAt)}
                            defaultExpiry={istanbulInputValue(new Date(base.getTime() + DAY_MS))}
                            cancelAction={cancelCouponAction}
                            extendAction={extendCouponAction}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Kalpler (${hearts.length})`}>
        {hearts.length === 0 ? (
          <Empty>Kalp yok.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={headClass}>
                <tr>
                  <th className="py-2 pr-4">Ürün</th>
                  <th className="py-2 pr-4">Tur</th>
                  <th className="py-2 pr-4">Durum</th>
                  <th className="py-2">Tarih (İstanbul)</th>
                </tr>
              </thead>
              <tbody>
                {hearts.map((heart) => {
                  const round = roundById.get(heart.roundId);
                  return (
                    <tr key={heart.id} className={rowClass}>
                      <td className="py-3 pr-4">
                        {productNames.get(heart.productId) ?? "Silinmiş ürün"} {round?.isTest && <Badge tone="gray">test</Badge>}
                      </td>
                      <td className="py-3 pr-4">{round?.roundNo ?? "-"}</td>
                      <td className="whitespace-nowrap py-3 pr-4">{HEART_LABEL[heart.status] ?? heart.status}</td>
                      <td className="whitespace-nowrap py-3">{formatDateTime(heart.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Bonus kredileri (${credits.length})`}>
        {credits.length === 0 ? (
          <Empty>Bonus kredisi yok.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={headClass}>
                <tr>
                  <th className="py-2 pr-4">Puan</th>
                  <th className="py-2 pr-4">Durum</th>
                  <th className="py-2 pr-4">Bitiş (İstanbul)</th>
                  <th className="py-2">Oluşturma</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((credit) => (
                  <tr key={credit.id} className={rowClass}>
                    <td className="whitespace-nowrap py-3 pr-4">
                      +{credit.points} {credit.isTest && <Badge tone="gray">test</Badge>}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4">{CREDIT_LABEL[credit.status] ?? credit.status}</td>
                    <td className="whitespace-nowrap py-3 pr-4">{credit.expiresAt ? formatDateTime(credit.expiresAt) : "-"}</td>
                    <td className="whitespace-nowrap py-3">{formatDateTime(credit.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Onaylar (${consents.length})`}>
        {consents.length === 0 ? (
          <Empty>Onay kaydı yok.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={headClass}>
                <tr>
                  <th className="py-2 pr-4">Kanal</th>
                  <th className="py-2 pr-4">İşlem</th>
                  <th className="py-2 pr-4">Kaynak</th>
                  <th className="py-2 pr-4">Metin sürümü</th>
                  <th className="py-2">Tarih (İstanbul)</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((consent) => (
                  <tr key={consent.id} className={rowClass}>
                    <td className="py-3 pr-4">{CHANNEL_LABEL[consent.channel] ?? consent.channel}</td>
                    <td className="whitespace-nowrap py-3 pr-4">{consent.granted ? "Verildi" : "Geri çekildi"}</td>
                    <td className="py-3 pr-4">{consent.source}</td>
                    <td className="py-3 pr-4">{consent.textVersion}</td>
                    <td className="whitespace-nowrap py-3">{formatDateTime(consent.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Cihaz eşleşmeleri (${matches.length})`}>
        <p className="mb-3 text-xs text-admin-text-muted">Cihaz kayıtları 90 gün tutulur; yalnız bu süredeki eşleşmeler görünür.</p>
        {matches.length === 0 ? (
          <Empty>Aynı cihaz ya da IP özetini kullanan başka hesap yok.</Empty>
        ) : (
          <ul className="divide-y divide-admin-border text-sm">
            {matches.map((match) => (
              <li key={match.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <Link href={`/admin/musteriler/${match.id}`} className="text-admin-text hover:underline">
                  {match.email}
                </Link>
                <span className="flex gap-2">
                  {match.sameDevice && <Badge tone="red">Aynı cihaz</Badge>}
                  {match.sameIp && <Badge tone="yellow">Aynı IP</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
