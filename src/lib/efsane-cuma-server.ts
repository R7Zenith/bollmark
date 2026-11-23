import { prisma } from "@/lib/prisma";
import { EFSANE_DEFAULT_END, EFSANE_DEFAULT_START, kalpPausedAt, type EfsaneWindow } from "@/lib/efsane-cuma";

// Ayar satiri yoksa koddaki varsayilanlar (26-29 Kasim 2026, iki anahtar acik).
// Yerel test: EFSANE_CUMA_TEST_START / EFSANE_CUMA_TEST_END (ISO) pencereyi
// degistirir. Vercel'de ve production derlemede yok sayilir (ortak DB'deki
// canli tarihlere dokunmadan yerelde denemek icin; bkz. lib/payment/iyzico/mode.ts).
export function testWindowFrom(env: Record<string, string | undefined>): { startsAt: Date; endsAt: Date } | null {
  if (env.VERCEL !== undefined || env.NODE_ENV === "production") return null;
  const start = env.EFSANE_CUMA_TEST_START ? new Date(env.EFSANE_CUMA_TEST_START) : null;
  const end = env.EFSANE_CUMA_TEST_END ? new Date(env.EFSANE_CUMA_TEST_END) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { startsAt: start, endsAt: end };
}

export async function getEfsaneSettings() {
  const row = await prisma.efsaneCumaSettings.findUnique({ where: { id: "singleton" } });
  return {
    enabled: row?.enabled ?? true,
    kalpPause: row?.kalpPause ?? true,
    startsAt: row?.startsAt ?? EFSANE_DEFAULT_START,
    endsAt: row?.endsAt ?? EFSANE_DEFAULT_END,
    updatedByEmail: row?.updatedByEmail ?? null,
    updatedAt: row?.updatedAt ?? null
  };
}

// Kalp Topla arasi su an suruyor mu (lib/kalp-topla/settings.ts campaignStateFrom).
export async function kalpPausedNow(): Promise<boolean> {
  return kalpPausedAt(await getEfsaneWindow(), new Date());
}

// Layout (ISR) icin: pencere + render ani (dakikaya yuvarli; hidrasyonda istemci ayni degeri kullanir).
export async function getEfsaneClientValue() {
  return { window: await getEfsaneWindow(), renderedAt: Math.floor(Date.now() / 60_000) * 60_000 };
}

export async function getEfsaneWindow(): Promise<EfsaneWindow> {
  const settings = await getEfsaneSettings();
  const test = testWindowFrom(process.env);
  return {
    enabled: settings.enabled,
    kalpPause: settings.kalpPause,
    startsAt: (test?.startsAt ?? settings.startsAt).toISOString(),
    endsAt: (test?.endsAt ?? settings.endsAt).toISOString()
  };
}
