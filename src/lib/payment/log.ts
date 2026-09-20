import { prisma } from "@/lib/prisma";

export const paymentLogKinds = [
  "INIT",
  "CALLBACK",
  "RETRIEVE",
  "WEBHOOK",
  "REFUND",
  "CANCEL",
  "TEST",
  "RECONCILE",
  "EXPIRE",
  "SETTINGS"
] as const;

export type PaymentLogKind = (typeof paymentLogKinds)[number];

// audit-log.ts ile ayni best-effort prensip: gunluk yazilamamasi asil odeme
// akisini asla engellemez. Buraya kart, API key, secret veya token YAZILMAZ -
// sadece kisa, insan okur ozet.
export async function logPayment(params: {
  kind: PaymentLogKind;
  ok: boolean;
  summary: string;
  orderId?: string;
  attemptId?: string;
  httpStatus?: number;
  errorCode?: string;
}) {
  await prisma.paymentLog
    .create({ data: { ...params, summary: params.summary.slice(0, 500) } })
    .catch((e) => console.error("Ödeme günlüğü yazılamadı (yoksayıldı):", e));
}
