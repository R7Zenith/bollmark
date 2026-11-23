import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { getEfsaneSettings, testWindowFrom } from "@/lib/efsane-cuma-server";
import { efsaneActiveAt, kalpPausedAt, EFSANE_NAME } from "@/lib/efsane-cuma";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/admin/card";
import { saveEfsaneSettings } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";
const buttonClass = "rounded-md bg-admin-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700";

// datetime-local icin Istanbul saati (YYYY-MM-DDTHH:mm).
const toInput = (date: Date) => new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);

export default async function EfsaneCumaAdminPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata } = await searchParams;
  const settings = await getEfsaneSettings();
  const now = new Date();
  const window = { ...settings, startsAt: settings.startsAt.toISOString(), endsAt: settings.endsAt.toISOString() };
  const test = testWindowFrom(process.env);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Efsane Cuma</h1>
        <p className="mt-1 text-sm text-admin-text-muted">
          {EFSANE_NAME}. Başlangıç ve bitiş otomatiktir; anahtarlarla elle de açıp kapatabilirsiniz.{" "}
          <Link href="/efsane-cuma" className="underline" target="_blank">
            Koşullar sayfası
          </Link>
        </p>
      </div>

      {basarili && <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">Ayarlar kaydedildi.</p>}
      {hata && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Tarihler geçersiz: bitiş başlangıçtan sonra olmalı.</p>}
      {test && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Yerel test penceresi açık (EFSANE_CUMA_TEST_START/END): {formatDateTime(test.startsAt)} – {formatDateTime(test.endsAt)}. Canlıda
          yok sayılır.
        </p>
      )}

      <Card title="Durum">
        <ul className="space-y-1 text-sm">
          <li>
            Kampanya şu an: <strong>{efsaneActiveAt(window, now) ? "Geçerli" : "Geçerli değil"}</strong>
          </li>
          <li>
            Kalp Topla arası şu an: <strong>{kalpPausedAt(window, now) ? "Sürüyor" : "Yok"}</strong>
          </li>
          {settings.updatedAt && (
            <li className="text-admin-text-muted">
              Son değişiklik: {formatDateTime(settings.updatedAt)} {settings.updatedByEmail ? `(${settings.updatedByEmail})` : ""}
            </li>
          )}
        </ul>
      </Card>

      <Card title="Ayarlar">
        <form action={saveEfsaneSettings} className="space-y-5">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="h-4 w-4" />
            Kampanya açık (kapalıyken tarih aralığında da uygulanmaz ve görünmez)
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="kalpPause" defaultChecked={settings.kalpPause} className="h-4 w-4" />
            Kalp Topla bu tarihlerde ara versin (yeni kalp, geri çekme ve bar dolumu durur; kuponlar kullanılabilir)
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="startsAt">
                Başlangıç (Türkiye saati)
              </label>
              <input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toInput(settings.startsAt)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass} htmlFor="endsAt">
                Bitiş (Türkiye saati, dakikanın sonuna kadar)
              </label>
              <input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toInput(settings.endsAt)} className={inputClass} required />
            </div>
          </div>
          <button type="submit" className={buttonClass}>
            Kaydet
          </button>
        </form>
      </Card>
    </div>
  );
}
