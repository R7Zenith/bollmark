import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/admin/card";

const LIST_LIMIT = 100;
const inputClass =
  "mt-1 rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

// Pazarlama onay kayitlari (KALP_TOPLA_PLANI.md 6.11, T3): son kayitlar +
// tarih araligiyla CSV. Yalniz ADMIN (sayfa ve CSV ucu ayri ayri kontrol eder).
export default async function AdminKalpToplaOnaylarPage() {
  await requireAdmin();
  const [rows, total] = await Promise.all([
    prisma.marketingConsentLog.findMany({ orderBy: { createdAt: "desc" }, take: LIST_LIMIT }),
    prisma.marketingConsentLog.count()
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-admin-text">Kalp Topla · Onaylar</h1>

      <Card title="CSV dışa aktar">
        <form action="/api/admin/kalp-topla/onaylar.csv" method="get" className="flex flex-wrap items-end gap-4">
          <div>
            <label className={labelClass} htmlFor="bas">
              Başlangıç
            </label>
            <input id="bas" name="bas" type="date" className={`block ${inputClass}`} />
          </div>
          <div>
            <label className={labelClass} htmlFor="bit">
              Bitiş
            </label>
            <input id="bit" name="bit" type="date" className={`block ${inputClass}`} />
          </div>
          <button className="rounded-md bg-admin-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            CSV indir
          </button>
        </form>
        <p className="mt-3 text-xs text-admin-text-muted">Tarih boş bırakılırsa o yönde sınır uygulanmaz. İndirme işlem geçmişine yazılır.</p>
      </Card>

      <Card title={`Son kayıtlar (${Math.min(total, LIST_LIMIT)} / ${total})`}>
        {rows.length === 0 ? (
          <p className="text-sm text-admin-text-muted">Henüz onay kaydı yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-admin-text-muted">
                <tr>
                  <th className="py-2 pr-4">Tarih (İstanbul)</th>
                  <th className="py-2 pr-4">E-posta</th>
                  <th className="py-2 pr-4">Kanal</th>
                  <th className="py-2 pr-4">İşlem</th>
                  <th className="py-2 pr-4">Kaynak</th>
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-2">Metin sürümü</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border text-admin-text">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                    <td className="py-2 pr-4">{r.email}</td>
                    <td className="py-2 pr-4">{r.channel}</td>
                    <td className="py-2 pr-4">{r.granted ? "Verildi" : "Geri çekildi"}</td>
                    <td className="py-2 pr-4">{r.source}</td>
                    <td className="py-2 pr-4">{r.ipPurgedAt ? "silindi (3 yıl)" : (r.ip ?? "—")}</td>
                    <td className="py-2">{r.textVersion}</td>
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
