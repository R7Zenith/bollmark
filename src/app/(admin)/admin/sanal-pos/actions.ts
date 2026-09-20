"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { encryptSecret, isEncryptionKeyConfigured } from "@/lib/payment/crypto";
import { getCredentials, getPaymentSettings } from "@/lib/payment/settings";
import { binCheck, IyzicoTransportError } from "@/lib/payment/iyzico/client";
import { describeAdminError } from "@/lib/payment/iyzico/errors";
import { logPayment } from "@/lib/payment/log";
import type { PaymentMode } from "@/lib/payment/iyzico/mode";

const PAGE = "/admin/sanal-pos";
const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12];
const MIN_EXPIRY_MINUTES = 10;
const MAX_EXPIRY_MINUTES = 1440;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

// Her server action dogrudan POST ile de cagrilabildigi icin (bkz. Next.js
// "Mutating Data" rehberi) yetki kontrolu her action'in icinde yapilir. Anahtar
// degerleri hicbir yerde loglanmaz/geri dondurulmez - yalnizca alan adlari.
export async function savePaymentSettings(formData: FormData) {
  const session = await requireAdmin();
  const actorEmail = session.user?.email ?? "";
  const current = await getPaymentSettings();

  const isEnabled = formData.get("isEnabled") === "on";
  const mode: PaymentMode = formData.get("mode") === "LIVE" ? "LIVE" : "SANDBOX";
  const maxInstallment = Number(text(formData, "maxInstallment"));
  const orderExpiryMinutes = Number(text(formData, "orderExpiryMinutes"));

  if (!INSTALLMENT_OPTIONS.includes(maxInstallment)) redirect(`${PAGE}?hata=taksit`);
  if (
    !Number.isInteger(orderExpiryMinutes) ||
    orderExpiryMinutes < MIN_EXPIRY_MINUTES ||
    orderExpiryMinutes > MAX_EXPIRY_MINUTES
  ) {
    redirect(`${PAGE}?hata=sure`);
  }

  const sandboxApiKey = text(formData, "sandboxApiKey");
  const sandboxSecretKey = text(formData, "sandboxSecretKey");
  const liveApiKey = text(formData, "liveApiKey");
  const liveSecretKey = text(formData, "liveSecretKey");

  // Sandbox ve canli anahtarlarin karismasini yakalar (bkz. plan 6/2).
  if ((sandboxApiKey && !sandboxApiKey.startsWith("sandbox-")) || (sandboxSecretKey && !sandboxSecretKey.startsWith("sandbox-"))) {
    redirect(`${PAGE}?hata=sandbox-anahtar-oneki`);
  }
  if ((liveApiKey && liveApiKey.startsWith("sandbox-")) || (liveSecretKey && liveSecretKey.startsWith("sandbox-"))) {
    redirect(`${PAGE}?hata=canli-anahtar-oneki`);
  }
  if ((sandboxApiKey || sandboxSecretKey || liveApiKey || liveSecretKey) && !isEncryptionKeyConfigured()) {
    redirect(`${PAGE}?hata=sifreleme-anahtari-yok`);
  }

  const data: {
    isEnabled: boolean;
    mode: string;
    maxInstallment: number;
    orderExpiryMinutes: number;
    sandboxApiKeyEnc?: string;
    sandboxSecretKeyEnc?: string;
    sandboxKeyLast4?: string;
    liveApiKeyEnc?: string;
    liveSecretKeyEnc?: string;
    liveKeyLast4?: string;
    lastTestAt?: null;
    lastTestOk?: null;
    lastTestMode?: null;
    lastTestMessage?: null;
  } = { isEnabled, mode, maxInstallment, orderExpiryMinutes };

  const changes: string[] = [];
  if (isEnabled !== current.isEnabled) changes.push(`isEnabled: ${current.isEnabled} → ${isEnabled}`);
  if (maxInstallment !== current.maxInstallment) changes.push(`maxInstallment: ${current.maxInstallment} → ${maxInstallment}`);
  if (orderExpiryMinutes !== current.orderExpiryMinutes) {
    changes.push(`orderExpiryMinutes: ${current.orderExpiryMinutes} → ${orderExpiryMinutes}`);
  }

  const changedKeyFields: string[] = [];
  if (sandboxApiKey) {
    data.sandboxApiKeyEnc = encryptSecret(sandboxApiKey);
    data.sandboxKeyLast4 = sandboxApiKey.slice(-4);
    changedKeyFields.push("sandboxApiKey");
  }
  if (sandboxSecretKey) {
    data.sandboxSecretKeyEnc = encryptSecret(sandboxSecretKey);
    changedKeyFields.push("sandboxSecretKey");
  }
  if (liveApiKey) {
    data.liveApiKeyEnc = encryptSecret(liveApiKey);
    data.liveKeyLast4 = liveApiKey.slice(-4);
    changedKeyFields.push("liveApiKey");
  }
  if (liveSecretKey) {
    data.liveSecretKeyEnc = encryptSecret(liveSecretKey);
    changedKeyFields.push("liveSecretKey");
  }
  if (changedKeyFields.length > 0) changes.push(`anahtarlar: ${changedKeyFields.join(", ")}`);

  // Anahtar degisince o moda ait onceki baglanti testi gecersiz sayilir.
  const sandboxKeysChanged = Boolean(sandboxApiKey || sandboxSecretKey);
  const liveKeysChanged = Boolean(liveApiKey || liveSecretKey);
  const testInvalidated =
    (sandboxKeysChanged && current.lastTestMode === "SANDBOX") || (liveKeysChanged && current.lastTestMode === "LIVE");
  if (testInvalidated) {
    data.lastTestAt = null;
    data.lastTestOk = null;
    data.lastTestMode = null;
    data.lastTestMessage = null;
  }

  // Canliya gecis sartlari: canli anahtarlar tanimli ve son canli baglanti testi basarili.
  if (mode === "LIVE") {
    const liveKeysDefined =
      Boolean(liveApiKey || current.liveApiKeyEnc) && Boolean(liveSecretKey || current.liveSecretKeyEnc);
    const liveTestOk = !testInvalidated && current.lastTestOk === true && current.lastTestMode === "LIVE";
    if (!liveKeysDefined || !liveTestOk) redirect(`${PAGE}?hata=canli-gecis-sarti`);
  }

  await prisma.paymentSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data
  });

  if (changes.length > 0) {
    await logAudit({
      actorEmail,
      actorRole: "ADMIN",
      action: "PAYMENT_SETTINGS_CHANGED",
      targetType: "PaymentSettings",
      targetId: "singleton",
      detail: changes.join("; ")
    });
    await logPayment({ kind: "SETTINGS", ok: true, summary: `Ayarlar güncellendi (${changes.length} değişiklik)` });
  }
  if (mode !== current.mode) {
    await logAudit({
      actorEmail,
      actorRole: "ADMIN",
      action: "PAYMENT_MODE_CHANGED",
      targetType: "PaymentSettings",
      targetId: "singleton",
      detail: `${current.mode} → ${mode}`
    });
    await logPayment({ kind: "SETTINGS", ok: true, summary: `Mod değişti: ${current.mode} → ${mode}` });
  }

  revalidatePath(PAGE);
  redirect(`${PAGE}?basarili=ayarlar`);
}

// Yan etkisiz bir BIN sorgusuyla kimlik dogrulamasini sinar (bkz. plan 6/3).
export async function testPaymentConnection(formData: FormData) {
  const session = await requireAdmin();
  const actorEmail = session.user?.email ?? "";
  const mode: PaymentMode = text(formData, "testMode") === "LIVE" ? "LIVE" : "SANDBOX";

  // Yerel/preview ortam canli API'ye hic baglanmaz (bkz. plan 2/h).
  if (mode === "LIVE" && process.env.VERCEL_ENV !== "production") {
    redirect(`${PAGE}?hata=canli-test-sadece-production`);
  }

  const settings = await getPaymentSettings();
  const credentials = getCredentials(settings, mode);
  if (!credentials) redirect(`${PAGE}?hata=test-anahtar-yok`);

  let ok = false;
  let message: string;
  let httpStatus: number | undefined;
  let errorCode: string | undefined;
  try {
    const result = await binCheck(mode, credentials);
    httpStatus = result.httpStatus;
    if (result.data.status === "success") {
      ok = true;
      message = "Bağlantı başarılı: iyzico kimlik doğrulaması geçti.";
    } else {
      errorCode = result.data.errorCode ? String(result.data.errorCode) : undefined;
      message = describeAdminError(errorCode, result.data.errorMessage);
    }
  } catch (error) {
    message = error instanceof IyzicoTransportError ? error.message : "Beklenmeyen bir hata oluştu.";
  }

  await prisma.paymentSettings.update({
    where: { id: "singleton" },
    data: { lastTestAt: new Date(), lastTestOk: ok, lastTestMode: mode, lastTestMessage: message }
  });
  await logPayment({
    kind: "TEST",
    ok,
    httpStatus,
    errorCode,
    summary: `${mode} bağlantı testi: ${message}`
  });
  await logAudit({
    actorEmail,
    actorRole: "ADMIN",
    action: "PAYMENT_CONNECTION_TESTED",
    targetType: "PaymentSettings",
    targetId: "singleton",
    detail: `${mode} ${ok ? "başarılı" : "başarısız"}${errorCode ? ` (${errorCode})` : ""}`
  });

  revalidatePath(PAGE);
  redirect(`${PAGE}?${ok ? "basarili=test" : "hata=test-basarisiz"}`);
}
