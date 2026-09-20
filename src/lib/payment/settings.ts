import "server-only";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { decryptSecret, isEncryptionKeyConfigured } from "@/lib/payment/crypto";
import { resolveModeFrom, type PaymentMode } from "@/lib/payment/iyzico/mode";
import type { IyzicoCredentials } from "@/lib/payment/iyzico/client";

export type PaymentSettingsRow = NonNullable<Awaited<ReturnType<typeof prisma.paymentSettings.findUnique>>>;

export function getPaymentSettings(): Promise<PaymentSettingsRow> {
  return prisma.paymentSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {}
  });
}

// Gecerli mod: DB'de LIVE + Vercel production ise LIVE, aksi halde SANDBOX.
export function effectiveMode(settings: Pick<PaymentSettingsRow, "mode">): PaymentMode {
  return resolveModeFrom(settings.mode, process.env.VERCEL_ENV);
}

export function hasKeys(settings: PaymentSettingsRow, mode: PaymentMode): boolean {
  return mode === "LIVE"
    ? Boolean(settings.liveApiKeyEnc && settings.liveSecretKeyEnc)
    : Boolean(settings.sandboxApiKeyEnc && settings.sandboxSecretKeyEnc);
}

// Sifrelenmis anahtarlari cozer. Anahtar tanimli degilse ya da cozme basarisiz
// olursa (yanlis PAYMENT_ENCRYPTION_KEY, bozuk veri) null doner - cagiran taraf
// "POS hazir degil" der, hata metnine anahtar/sifreli veri sizmaz.
export function getCredentials(settings: PaymentSettingsRow, mode: PaymentMode): IyzicoCredentials | null {
  const apiKeyEnc = mode === "LIVE" ? settings.liveApiKeyEnc : settings.sandboxApiKeyEnc;
  const secretKeyEnc = mode === "LIVE" ? settings.liveSecretKeyEnc : settings.sandboxSecretKeyEnc;
  if (!apiKeyEnc || !secretKeyEnc) return null;
  try {
    return { apiKey: decryptSecret(apiKeyEnc), secretKey: decryptSecret(secretKeyEnc) };
  } catch {
    return null;
  }
}

export type ReadinessCheck = { id: string; label: string; ok: boolean; hint?: string };

export function getReadiness(settings: PaymentSettingsRow): {
  mode: PaymentMode;
  checks: ReadinessCheck[];
  ready: boolean;
} {
  const mode = effectiveMode(settings);
  const modeLabel = mode === "LIVE" ? "Canlı" : "Sandbox";
  const checks: ReadinessCheck[] = [
    { id: "keys", label: `${modeLabel} API Key ve Secret Key tanımlı`, ok: hasKeys(settings, mode) },
    {
      id: "encryption",
      label: "PAYMENT_ENCRYPTION_KEY tanımlı",
      ok: isEncryptionKeyConfigured(),
      hint: "Vercel ortam değişkenlerine eklenmeli."
    },
    {
      id: "test",
      label: `${modeLabel} bağlantı testi başarılı`,
      ok: settings.lastTestOk === true && settings.lastTestMode === mode
    },
    {
      id: "site-url",
      label: "SITE_URL HTTPS",
      ok: getSiteUrl().startsWith("https://"),
      hint: "iyzico callback adresi geçerli bir SSL adresi olmalı."
    }
  ];
  if (settings.mode === "LIVE") {
    checks.push({
      id: "production",
      label: "Canlı mod yalnızca production ortamında geçerli",
      ok: process.env.VERCEL_ENV === "production",
      hint: "Yerel ve önizleme ortamlarında her zaman Sandbox kullanılır."
    });
  }
  return { mode, checks, ready: settings.isEnabled && checks.every((c) => c.ok) };
}
