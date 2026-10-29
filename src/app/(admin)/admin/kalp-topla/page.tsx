import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { getKalpSettings } from "@/lib/kalp-topla/settings";
import { getTestResetSummary } from "@/lib/kalp-topla/test-reset";
import { formatPrice } from "@/lib/format";
import { Card } from "@/components/admin/card";
import { KalpToplaFeedback } from "@/components/admin/kalp-topla-feedback";
import {
  addBlockedDomain,
  addKalpTester,
  confirmKalpLive,
  removeBlockedDomain,
  removeKalpTester,
  saveKalpMode,
  saveKalpValues
} from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";
const buttonClass = "rounded-md bg-admin-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700";
const linkButtonClass = "text-xs text-red-600 underline hover:text-red-700";

const modeOptions = [
  {
    value: "OFF",
    label: "Kapalı",
    help: "Kapalı: barlar dondurulur, kalp verilemez ama geri çekilebilir, kazanılmış kuponlar süreleri boyunca geçerli."
  },
  { value: "HIDDEN", label: "Gizli yayın", help: "Gizli yayında kampanyayı yalnız aşağıdaki test hesapları görür." },
  { value: "LIVE", label: "Açık", help: "Kampanya herkese görünür ve çalışır." }
];

function NumberInput({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type="number" min={1} step={1} defaultValue={value} className={inputClass} required />
    </div>
  );
}

export default async function AdminKalpToplaPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string; onay?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata, onay } = await searchParams;

  const settings = await getKalpSettings();
  const [testers, openRounds, blockedDomains] = await Promise.all([
    prisma.customer.findMany({
      where: { id: { in: settings.testerCustomerIds } },
      select: { id: true, email: true, name: true }
    }),
    prisma.kalpRound.count({ where: { status: "OPEN" } }),
    prisma.blockedEmailDomain.findMany({ orderBy: { domain: "asc" } })
  ]);
  const isHidden = settings.mode === "HIDDEN";
  const resetSummary = onay === "acik" && settings.mode !== "LIVE" ? await getTestResetSummary() : null;

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold text-admin-text">Kalp Topla · Ayarlar</h1>

      <KalpToplaFeedback basarili={basarili} hata={hata} />

      {resetSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="kalp-live-title">
          <div className="w-full max-w-lg rounded-lg bg-admin-surface p-6 shadow-xl">
            <h2 id="kalp-live-title" className="text-lg font-semibold text-admin-text">
              Herkese açılınca test verisi sıfırlanacak
            </h2>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-admin-text">
              <li>{resetSummary.rounds} test turu ve {resetSummary.hearts} kalp silinecek</li>
              <li>{resetSummary.invites} davet ve {resetSummary.waitingBonuses} bekleyen bonus silinecek</li>
              <li>{resetSummary.unusedCoupons} kullanılmamış test kuponu iptal edilecek (test-iptal)</li>
            </ul>
            <p className="mt-3 text-xs text-admin-text-muted">
              Test edilen ürünlerin barları normal eşikle ({settings.threshold}) sıfırdan başlar. Ödenmiş test
              siparişleri ({resetSummary.paidOrders}) silinmez, raporlardan hariç tutulur.
            </p>

            {resetSummary.unpaidOrders.length > 0 && (
              <div className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-medium">Test kuponu bekleyen ödenmemiş siparişler iptal edilecek:</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {resetSummary.unpaidOrders.map((o) => (
                    <li key={o.id}>
                      {o.orderNumber} · {o.customerName} · {formatPrice(o.totalCents)} ·{" "}
                      {o.createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Link href="/admin/kalp-topla" className="rounded-md border border-admin-border px-4 py-2.5 text-sm text-admin-text hover:bg-admin-bg">
                Vazgeç
              </Link>
              <form action={confirmKalpLive}>
                {resetSummary.unpaidOrders.length > 0 && <input type="hidden" name="cancelOrders" value="1" />}
                <button className={buttonClass}>
                  {resetSummary.unpaidOrders.length > 0 ? "Siparişleri iptal et ve devam et" : "Onayla ve herkese aç"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <Card title="Mod">
        <form action={saveKalpMode} className="space-y-4">
          {modeOptions.map((option) => (
            <label key={option.value} className="flex items-start gap-3 text-sm text-admin-text">
              <input
                type="radio"
                name="mode"
                value={option.value}
                defaultChecked={settings.mode === option.value}
                className="mt-0.5 h-4 w-4 border-admin-border text-admin-accent focus:ring-admin-accent"
              />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="block text-xs text-admin-text-muted">{option.help}</span>
              </span>
            </label>
          ))}
          <button className={buttonClass}>Modu Kaydet</button>
        </form>
      </Card>

      {isHidden && (
        <Card title="Test hesapları (gizli yayın)">
          <p className="mb-4 text-xs text-admin-text-muted">Gizli yayında kampanyayı yalnız bu hesaplar görür.</p>
          {testers.length === 0 ? (
            <p className="mb-4 text-sm text-admin-text-muted">Henüz test hesabı yok.</p>
          ) : (
            <ul className="mb-4 divide-y divide-admin-border text-sm">
              {testers.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <span className="text-admin-text">
                    {t.email} <span className="text-admin-text-muted">({t.name})</span>
                  </span>
                  <form action={removeKalpTester}>
                    <input type="hidden" name="customerId" value={t.id} />
                    <button className={linkButtonClass}>Çıkar</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addKalpTester} className="flex items-end gap-3">
            <div className="flex-1">
              <label className={labelClass} htmlFor="tester-email">
                Müşteri e-postası
              </label>
              <input id="tester-email" name="email" type="email" className={inputClass} required />
            </div>
            <button className={buttonClass}>Ekle</button>
          </form>
        </Card>
      )}

      <Card title="Kampanya değerleri">
        <form action={saveKalpValues} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <NumberInput name="threshold" label="Eşik (kalp)" value={settings.threshold} />
            {isHidden && <NumberInput name="testThreshold" label="Test eşiği" value={settings.testThreshold} />}
            <NumberInput name="discountPercent" label="İndirim oranı (%)" value={settings.discountPercent} />
            <NumberInput name="couponHours" label="Kupon süresi (saat)" value={settings.couponHours} />
            <NumberInput name="heartQuota" label="Kalp hakkı" value={settings.heartQuota} />
            <NumberInput name="inviteBonus" label="Davet bonusu (kalp)" value={settings.inviteBonus} />
            <NumberInput name="refundExtraHours" label="İade sonrası ek süre (saat)" value={settings.refundExtraHours} />
          </div>
          <p className="rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Eşik değişikliği yalnız yeni başlayan turlara uygulanır. Şu an açık {openRounds} tur, başladıkları eşikle
            devam eder.
          </p>
          {isHidden && (
            <p className="text-xs text-admin-text-muted">
              Test eşiği yalnız gizli yayında açılan test turlarına uygulanır.
            </p>
          )}

          <div className="border-t border-admin-border pt-5">
            <p className="text-sm font-semibold text-admin-text">Kötüye kullanım</p>
            <p className="mt-1 text-xs text-admin-text-muted">
              Bu kurallar üyeliği, kalbi ya da kuponu engellemez, yalnız +2 davet bonusunu etkiler. Aynı IP yalnız
              işarettir, bonusu durdurmaz.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <NumberInput
                name="sameDeviceMaxAccounts"
                label="Aynı cihazdan bonusu otomatik sayılan hesap sayısı"
                value={settings.sameDeviceMaxAccounts}
              />
              <NumberInput name="sameIpWindowHours" label="Aynı IP penceresi (saat)" value={settings.sameIpWindowHours} />
              <NumberInput
                name="sameIpMinAccounts"
                label="Aynı IP işareti için yeni hesap sayısı"
                value={settings.sameIpMinAccounts}
              />
            </div>
          </div>

          <button className={buttonClass}>Değerleri Kaydet</button>
        </form>
      </Card>

      <Card title="Engelli e-posta alan adları">
        <p className="mb-4 text-xs text-admin-text-muted">
          Bu liste, geçici e-posta paketindeki listeye ektir. Alt alan adları da engellenir.
        </p>
        {blockedDomains.length === 0 ? (
          <p className="mb-4 text-sm text-admin-text-muted">Listede alan adı yok.</p>
        ) : (
          <ul className="mb-4 divide-y divide-admin-border text-sm">
            {blockedDomains.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <span className="text-admin-text">{d.domain}</span>
                <form action={removeBlockedDomain}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className={linkButtonClass}>Kaldır</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addBlockedDomain} className="flex items-end gap-3">
          <div className="flex-1">
            <label className={labelClass} htmlFor="blocked-domain">
              Alan adı
            </label>
            <input id="blocked-domain" name="domain" placeholder="ornekmail.com" className={inputClass} required />
          </div>
          <button className={buttonClass}>Engelle</button>
        </form>
      </Card>
    </div>
  );
}
