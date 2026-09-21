import { CheckCircle2, Info, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { getSiteUrl } from "@/lib/site-url";
import { getPaymentSettings, getReadiness } from "@/lib/payment/settings";
import { paymentLogKinds } from "@/lib/payment/log";
import { Card } from "@/components/admin/card";
import { Badge } from "@/components/admin/badge";
import { CopyButton } from "@/components/admin/copy-button";
import { Pagination } from "@/components/admin/pagination";
import { SanalPosFeedback } from "@/components/admin/sanal-pos-feedback";
import { SanalPosSaveButton } from "@/components/admin/sanal-pos-save-button";
import { formatDateTime as formatDateTimeIstanbul } from "@/lib/format";
import { savePaymentSettings, testPaymentConnection } from "./actions";

const LOG_PAGE_SIZE = 25;
const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12];

const inputClass =
  "mt-1 w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

const kindLabel: Record<string, string> = {
  INIT: "Başlatma",
  CALLBACK: "Callback",
  RETRIEVE: "Sorgulama",
  WEBHOOK: "Webhook",
  REFUND: "İade",
  CANCEL: "İptal",
  TEST: "Bağlantı testi",
  RECONCILE: "Mutabakat",
  EXPIRE: "Süre dolumu",
  SETTINGS: "Ayarlar"
};

const testCards = [
  ["Visa (kredi)", "4603 4500 0000 0000"],
  ["Visa (banka)", "4766 6200 0000 0001"],
  ["MasterCard (kredi)", "5526 0800 0000 0006"],
  ["MasterCard (banka)", "5890 0400 0000 0016"],
  ["Troy (kredi)", "9792 0300 0000 0000"],
  ["American Express", "3744 2700 0000 003"],
  ["Yabancı kart", "5400 0100 0000 0004"]
];

const failureCards = [
  ["Yetersiz bakiye", "4111 1111 1111 1129"],
  ["Do not honour", "4129 1111 1111 1111"],
  ["Geçersiz işlem", "4128 1111 1111 1112"],
  ["Süresi dolmuş kart", "4125 1111 1111 1115"],
  ["Geçersiz CVC", "4124 1111 1111 1116"],
  ["Fraud şüphesi", "4121 1111 1111 1119"],
  ["Genel hata", "4130 1111 1111 1118"],
  ["3D Secure başlatılamadı", "4151 1111 1111 1112"],
  ["Başarılı ama iptal/iade edilemez", "5406 6700 0000 0009"]
];

interface SearchParams {
  basarili?: string;
  hata?: string;
  tur?: string;
  sonuc?: string;
  siparis?: string;
  page?: string;
}

function formatDateTime(date: Date): string {
  return formatDateTimeIstanbul(date, { dateStyle: "short", timeStyle: "medium" });
}

export default async function AdminSanalPosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { basarili, hata, tur, sonuc, siparis, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const settings = await getPaymentSettings();
  const readiness = getReadiness(settings);
  const siteUrl = getSiteUrl();

  // Gunluk filtreleri (tur / sonuc / siparis no)
  let orderIdFilter: string[] | null = null;
  if (siparis?.trim()) {
    const orders = await prisma.order.findMany({
      where: { orderNumber: { contains: siparis.trim(), mode: "insensitive" } },
      select: { id: true },
      take: 50
    });
    orderIdFilter = orders.map((o) => o.id);
  }
  const logWhere = {
    ...(tur && (paymentLogKinds as readonly string[]).includes(tur) ? { kind: tur } : {}),
    ...(sonuc === "basarili" ? { ok: true } : sonuc === "hata" ? { ok: false } : {}),
    ...(orderIdFilter ? { orderId: { in: orderIdFilter } } : {})
  };
  const [logCount, logs] = await Promise.all([
    prisma.paymentLog.count({ where: logWhere }),
    prisma.paymentLog.findMany({
      where: logWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * LOG_PAGE_SIZE,
      take: LOG_PAGE_SIZE
    })
  ]);
  const logOrderIds = [...new Set(logs.map((l) => l.orderId).filter((id): id is string => Boolean(id)))];
  const logOrders = logOrderIds.length
    ? await prisma.order.findMany({ where: { id: { in: logOrderIds } }, select: { id: true, orderNumber: true } })
    : [];
  const orderNumberById = new Map(logOrders.map((o) => [o.id, o.orderNumber]));
  const totalPages = Math.max(1, Math.ceil(logCount / LOG_PAGE_SIZE));

  const filterParams = new URLSearchParams();
  if (tur) filterParams.set("tur", tur);
  if (sonuc) filterParams.set("sonuc", sonuc);
  if (siparis) filterParams.set("siparis", siparis);
  const paginationBase = `/admin/sanal-pos${filterParams.toString() ? `?${filterParams.toString()}` : ""}`;

  const statusBadge = !settings.isEnabled ? (
    <Badge tone="gray">Kapalı</Badge>
  ) : readiness.mode === "LIVE" ? (
    <Badge tone="green">Canlı</Badge>
  ) : (
    <Badge tone="yellow">Test (Sandbox)</Badge>
  );

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Sanal POS</h1>
        <p className="mt-1 text-sm text-admin-text-muted">iyzico ile kartlı ödeme ayarları.</p>
      </div>

      <SanalPosFeedback basarili={basarili} hata={hata} />

      <Card title="Durum" action={statusBadge}>
        <ul className="space-y-2 text-sm">
          {readiness.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2">
              {check.ok ? (
                <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0 text-green-600" />
              ) : (
                <XCircle size={17} className="mt-0.5 flex-shrink-0 text-red-500" />
              )}
              <span className="text-admin-text">
                {check.label}
                {!check.ok && check.hint ? <span className="text-admin-text-muted"> — {check.hint}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-admin-text">
          {readiness.ready ? (
            <strong className="text-green-700">Ödeme almaya hazır.</strong>
          ) : (
            <strong className="text-admin-text-muted">Ödeme almaya hazır değil.</strong>
          )}
          {!settings.isEnabled ? <span className="text-admin-text-muted"> Sanal POS şu an kapalı.</span> : null}
        </p>
        {settings.mode === "LIVE" && readiness.mode === "SANDBOX" ? (
          <p className="mt-2 text-xs text-admin-text-muted">
            Kayıtlı mod Canlı, ancak bu ortam production olmadığı için Sandbox kullanılıyor.
          </p>
        ) : null}
        {settings.lastTestAt ? (
          <p className="mt-4 rounded-md bg-admin-bg p-3 text-xs text-admin-text-muted">
            Son bağlantı testi ({settings.lastTestMode === "LIVE" ? "Canlı" : "Sandbox"},{" "}
            {formatDateTime(settings.lastTestAt)}):{" "}
            <span className={settings.lastTestOk ? "font-medium text-green-700" : "font-medium text-red-600"}>
              {settings.lastTestMessage}
            </span>
          </p>
        ) : null}
      </Card>

      <Card title="Ayarlar">
        <form action={savePaymentSettings} className="space-y-5">
          <label className="flex items-center gap-2 text-sm text-admin-text">
            <input
              type="checkbox"
              name="isEnabled"
              defaultChecked={settings.isEnabled}
              className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
            />
            Sanal POS aktif
          </label>

          <div>
            <label className={labelClass}>Mod</label>
            <select name="mode" defaultValue={settings.mode} className={`${inputClass} max-w-[240px]`}>
              <option value="SANDBOX">Test (Sandbox)</option>
              <option value="LIVE">Canlı</option>
            </select>
            <p className="mt-1 text-xs text-admin-text-muted">
              Canlı mod yalnızca production ortamında geçerlidir. Canlıya geçmek için canlı anahtarlar tanımlı
              ve son canlı bağlantı testi başarılı olmalı.
            </p>
          </div>

          <div className="space-y-4 rounded-md border border-admin-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Sandbox anahtarları</p>
            <KeyField
              name="sandboxApiKey"
              label="Sandbox API Key"
              placeholder="sandbox-..."
              saved={settings.sandboxApiKeyEnc ? `•••• son 4: ${settings.sandboxKeyLast4 ?? "----"}` : null}
            />
            <KeyField
              name="sandboxSecretKey"
              label="Sandbox Secret Key"
              placeholder="sandbox-..."
              saved={settings.sandboxSecretKeyEnc ? "•••• kayıtlı (gizli)" : null}
            />
          </div>

          <div className="space-y-4 rounded-md border border-admin-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Canlı anahtarlar</p>
            <KeyField
              name="liveApiKey"
              label="Canlı API Key"
              placeholder="iyzico canlı API Key"
              saved={settings.liveApiKeyEnc ? `•••• son 4: ${settings.liveKeyLast4 ?? "----"}` : null}
            />
            <KeyField
              name="liveSecretKey"
              label="Canlı Secret Key"
              placeholder="iyzico canlı Secret Key"
              saved={settings.liveSecretKeyEnc ? "•••• kayıtlı (gizli)" : null}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Maksimum taksit</label>
              <select name="maxInstallment" defaultValue={settings.maxInstallment} className={inputClass}>
                {INSTALLMENT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "Tek çekim" : `${n} taksit`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sipariş bekleme süresi (dakika)</label>
              <input
                name="orderExpiryMinutes"
                type="number"
                min={10}
                max={1440}
                defaultValue={settings.orderExpiryMinutes}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-admin-text-muted">
                Ödemesi tamamlanmayan sipariş bu süre sonunda iptal edilir.
              </p>
            </div>
          </div>

          <SanalPosSaveButton currentMode={settings.mode} />
        </form>
      </Card>

      <Card title="Bağlantıyı Test Et">
        <p className="mb-4 text-sm text-admin-text-muted">
          Kayıtlı anahtarlarla iyzico&apos;ya yan etkisiz bir BIN sorgusu gönderir; para hareketi olmaz. Anahtarları
          değiştirdikten sonra önce kaydedin, sonra test edin.
        </p>
        <div className="flex flex-wrap gap-3">
          <form action={testPaymentConnection}>
            <input type="hidden" name="testMode" value="SANDBOX" />
            <button className="rounded-md border border-admin-border bg-admin-surface px-4 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
              Sandbox bağlantısını test et
            </button>
          </form>
          <form action={testPaymentConnection}>
            <input type="hidden" name="testMode" value="LIVE" />
            <button className="rounded-md border border-admin-border bg-admin-surface px-4 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
              Canlı bağlantıyı test et
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-admin-text-muted">
          Canlı test yalnızca production ortamında çalışır; yerel ve önizleme ortamları canlı API&apos;ye bağlanmaz.
        </p>
      </Card>

      <Card title="Entegrasyon Adresleri">
        <div className="space-y-4">
          <AddressRow label="Callback URL" value={`${siteUrl}/api/odeme/iyzico/callback`} />
          <AddressRow label="Webhook URL" value={`${siteUrl}/api/odeme/iyzico/webhook`} />
        </div>
        <div className="mt-4 flex gap-3 rounded-md bg-admin-bg p-4 text-sm text-admin-text-muted">
          <Info size={18} className="mt-0.5 flex-shrink-0 text-admin-accent" />
          <p>
            Callback adresi ödeme başlatılırken iyzico&apos;ya otomatik gönderilir, ayrıca girmeniz gerekmez. Webhook
            adresini iyzico merchant panelinde <strong>Ayarlar → Firma Ayarları</strong> bölümüne (HTTPS) girin.
            Webhook imzasının (X-IYZ-SIGNATURE-V3) açılması için hesabınızda ayrıca{" "}
            <strong>entegrasyon@iyzico.com</strong> adresine talep göndermeniz gerekir.
          </p>
        </div>
      </Card>

      {readiness.mode === "SANDBOX" ? (
        <Card title="Test Rehberi (Sandbox)">
          <p className="mb-3 text-sm text-admin-text-muted">
            Son kullanma tarihi olarak gelecekte herhangi bir ay/yıl, CVC olarak herhangi bir 3 hane girin. 3D Secure
            doğrulama sayfası kodu ekranda gösterir (OTP): o kodu girin. iyzico dokümanındaki{" "}
            <strong className="text-admin-text">123456</strong> sandbox&apos;ta kabul edilmedi.
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <CardTable title="Başarılı ödeme kartları" rows={testCards} />
            <CardTable title="Hata senaryosu kartları" rows={failureCards} />
          </div>
        </Card>
      ) : null}

      <Card title="Ödeme Günlüğü">
        <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
          <div>
            <label className={labelClass}>Tür</label>
            <select name="tur" defaultValue={tur ?? ""} className={inputClass}>
              <option value="">Tümü</option>
              {paymentLogKinds.map((k) => (
                <option key={k} value={k}>
                  {kindLabel[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Sonuç</label>
            <select name="sonuc" defaultValue={sonuc ?? ""} className={inputClass}>
              <option value="">Tümü</option>
              <option value="basarili">Başarılı</option>
              <option value="hata">Hata</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Sipariş no</label>
            <input name="siparis" defaultValue={siparis ?? ""} placeholder="BM-..." className={inputClass} />
          </div>
          <button className="rounded-md bg-admin-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            Filtrele
          </button>
        </form>

        {logs.length === 0 ? (
          <p className="text-sm text-admin-text-muted">Kayıt yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-admin-border text-xs uppercase tracking-wide text-admin-text-muted">
                  <th className="py-2 pr-4 font-medium">Tarih</th>
                  <th className="py-2 pr-4 font-medium">Tür</th>
                  <th className="py-2 pr-4 font-medium">Sonuç</th>
                  <th className="py-2 pr-4 font-medium">Sipariş</th>
                  <th className="py-2 font-medium">Özet</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-admin-border last:border-0 align-top">
                    <td className="whitespace-nowrap py-2 pr-4 text-admin-text-muted">{formatDateTime(log.createdAt)}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-admin-text">{kindLabel[log.kind] ?? log.kind}</td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      <Badge tone={log.ok ? "green" : "red"}>{log.ok ? "Başarılı" : "Hata"}</Badge>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-admin-text-muted">
                      {(log.orderId && orderNumberById.get(log.orderId)) || "—"}
                    </td>
                    <td className="py-2 text-admin-text">
                      {log.summary}
                      {log.errorCode ? <span className="text-admin-text-muted"> (kod {log.errorCode})</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="-mx-5 -mb-5 mt-4">
          <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} baseUrl={paginationBase} />
        </div>
      </Card>
    </div>
  );
}

function KeyField({
  name,
  label,
  placeholder,
  saved
}: {
  name: string;
  label: string;
  placeholder: string;
  saved: string | null;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {saved ? <span className="ml-2 normal-case tracking-normal text-green-700">{saved}</span> : null}
      </label>
      <input
        name={name}
        type="password"
        autoComplete="off"
        placeholder={saved ? "Değiştirmek için yeni değer girin (boş bırakırsanız değişmez)" : placeholder}
        className={inputClass}
      />
    </div>
  );
}

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-admin-bg px-3 py-2 text-sm text-admin-text">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function CardTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-text-muted">{title}</p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([name, number]) => (
            <tr key={number} className="border-b border-admin-border last:border-0">
              <td className="py-1.5 pr-3 text-admin-text">{name}</td>
              <td className="py-1.5 font-mono text-xs text-admin-text-muted">{number}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
