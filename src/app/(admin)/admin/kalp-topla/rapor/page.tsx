import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { addDaysToDateKey, formatDateTime, formatPrice, istanbulDateKey, istanbulDayStart } from "@/lib/format";
import { Card } from "@/components/admin/card";
import { StatCard } from "@/components/admin/stat-card";
import { getKalpReport } from "@/lib/kalp-topla/report";

const LIST_LIMIT = 50;
const PAGE = "/admin/kalp-topla/rapor";

const PERIODS = [
  { key: "7", label: "Son 7 gün" },
  { key: "30", label: "Son 30 gün" },
  { key: "90", label: "Son 90 gün" },
  { key: "tum", label: "Tümü" }
];

const tableClass = "w-full text-left text-sm";
const headClass = "text-xs uppercase tracking-wide text-admin-text-muted";
const rowClass = "border-t border-admin-border text-admin-text";

function href(gun: string, test: boolean) {
  const params = new URLSearchParams();
  if (gun !== "30") params.set("gun", gun);
  if (test) params.set("veri", "test");
  return params.size ? `${PAGE}?${params}` : PAGE;
}

function pillClass(active: boolean) {
  return `rounded-md px-3 py-1.5 ${active ? "bg-admin-accent text-white" : "text-admin-text-muted"}`;
}

function Empty() {
  return <p className="text-sm text-admin-text-muted">Bu dönemde veri yok.</p>;
}

// Kalp Topla raporu (KALP_TOPLA_PLANI.md 6.11). Varsayilan gorunum test verisini
// haric tutar (Y12); test gorunumu yalniz test verisini gosterir. Yalniz ADMIN.
export default async function AdminKalpToplaRaporPage({
  searchParams
}: {
  searchParams: Promise<{ gun?: string; veri?: string }>;
}) {
  await requireAdmin();
  const { gun, veri } = await searchParams;
  const period = PERIODS.find((p) => p.key === gun)?.key ?? "30";
  const test = veri === "test";
  const since = period === "tum" ? null : istanbulDayStart(addDaysToDateKey(istanbulDateKey(new Date()), -(Number(period) - 1)));

  const report = await getKalpReport(test ? "test" : "real", since);
  const name = (productId: string) => report.productNames.get(productId) ?? "Silinmiş ürün";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-admin-text">Kalp Topla · Rapor</h1>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Link key={p.key} href={href(p.key, test)} className={pillClass(p.key === period)}>
              {p.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <Link href={href(period, false)} className={pillClass(!test)}>
            Gerçek veri
          </Link>
          <Link href={href(period, true)} className={pillClass(test)}>
            Test verisi
          </Link>
        </div>
      </div>

      {test && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          TEST VERİSİ: Bu görünüm yalnız test kayıtlarını gösterir, kampanya sonucu değildir.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Verilen kupon" value={report.coupons.given} />
        <StatCard label="Kullanılan kupon" value={report.coupons.used} />
        <StatCard label="Süresi dolan kupon" value={report.coupons.expired} />
        <StatCard label="Kuponlu sipariş" value={report.sales.orders} />
        <StatCard label="Kupon kaynaklı ciro" value={formatPrice(report.sales.revenueCents)} />
        <StatCard label="İndirim tutarı" value={formatPrice(report.sales.discountCents)} />
        <StatCard label="Geçerli davet / yeni üye" value={report.invites.valid} />
        <StatCard label="İncelemede davet" value={report.invites.underReview} />
        <StatCard label="Bekleyen bonus (anlık)" value={report.bonuses.waiting} />
        <StatCard label="Süresi dolan bonus" value={report.bonuses.expired} />
      </div>
      <p className="text-xs text-admin-text-muted">
        Ciro yalnız kuponlu satırların tutarıdır, kısmi iadeler düşmez (genel raporlarla aynı). Dönem filtresi sipariş, kupon ve davet
        tarihine uygulanır.
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card title={`En çok dolan ürünler (${report.topProducts.length})`}>
          {report.topProducts.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead className={headClass}>
                  <tr>
                    <th className="py-2 pr-4">Ürün</th>
                    <th className="py-2 text-right">Dolan tur</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.slice(0, LIST_LIMIT).map((row) => (
                    <tr key={row.productId} className={rowClass}>
                      <td className="py-3 pr-4">{name(row.productId)}</td>
                      <td className="py-3 text-right">{row.rounds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={`Aktif barlar (${report.activeBars.length})`}>
          {report.activeBars.length === 0 ? (
            <p className="text-sm text-admin-text-muted">Şu an aktif bar yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead className={headClass}>
                  <tr>
                    <th className="py-2 pr-4">Ürün</th>
                    <th className="py-2 pr-4 text-right">Tur</th>
                    <th className="py-2 text-right">Kalp / eşik</th>
                  </tr>
                </thead>
                <tbody>
                  {report.activeBars.slice(0, LIST_LIMIT).map((row) => (
                    <tr key={row.productId} className={rowClass}>
                      <td className="py-3 pr-4">{name(row.productId)}</td>
                      <td className="py-3 pr-4 text-right">{row.roundNo}</td>
                      <td className="py-3 text-right">
                        {row.points} / {row.threshold}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title={`Talep (${report.demand.length} ürün)`}>
        {report.demand.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={headClass}>
                <tr>
                  <th className="py-2 pr-4">Ürün</th>
                  <th className="py-2 pr-4 text-right">Verilen kalp</th>
                  <th className="py-2 pr-4 text-right">Şu an açık</th>
                  <th className="py-2 pr-4 text-right">Geri çekilen</th>
                  <th className="py-2 text-right">Farklı üye</th>
                </tr>
              </thead>
              <tbody>
                {report.demand.slice(0, LIST_LIMIT).map((row) => (
                  <tr key={row.productId} className={rowClass}>
                    <td className="py-3 pr-4">{name(row.productId)}</td>
                    <td className="py-3 pr-4 text-right">{row.given}</td>
                    <td className="py-3 pr-4 text-right">{row.open}</td>
                    <td className="py-3 pr-4 text-right">{row.withdrawn}</td>
                    <td className="py-3 text-right">{row.customers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Kapanan turlar (${report.closedRounds.length})`}>
        {report.closedRounds.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={headClass}>
                <tr>
                  <th className="py-2 pr-4">Ürün</th>
                  <th className="py-2 pr-4 text-right">Tur</th>
                  <th className="py-2 pr-4 text-right">Eşik</th>
                  <th className="py-2 pr-4 text-right">Kupon</th>
                  <th className="py-2">Kapanış (İstanbul)</th>
                </tr>
              </thead>
              <tbody>
                {report.closedRounds.slice(0, LIST_LIMIT).map((row) => (
                  <tr key={row.id} className={rowClass}>
                    <td className="py-3 pr-4">{name(row.productId)}</td>
                    <td className="py-3 pr-4 text-right">{row.roundNo}</td>
                    <td className="py-3 pr-4 text-right">{row.threshold}</td>
                    <td className="py-3 pr-4 text-right">{row.coupons}</td>
                    <td className="whitespace-nowrap py-3">{row.closedAt ? formatDateTime(row.closedAt) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
