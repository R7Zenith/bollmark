import { decimalToCents } from "@/lib/payment/iyzico/money";
import { verifyRetrieveSignature } from "@/lib/payment/iyzico/signature";

// CF sorgulama yanitinin (bkz. plan 1.3/5.B) karar mantigi. Saf fonksiyon: DB'ye
// ve aga dokunmaz, boylece tum "PAID sayilma" kosullari birim testlenebilir.

export type ItemTransaction = {
  itemId?: string;
  paymentTransactionId?: string | number;
  price?: string | number;
  paidPrice?: string | number;
  transactionStatus?: number;
};

export type RetrieveResponse = {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  paymentStatus?: string;
  paymentId?: string | number;
  price?: string | number;
  paidPrice?: string | number;
  installment?: number;
  currency?: string;
  basketId?: string;
  conversationId?: string;
  token?: string;
  fraudStatus?: number | string;
  cardType?: string;
  cardAssociation?: string;
  cardFamily?: string;
  binNumber?: string;
  lastFourDigits?: string;
  signature?: string;
  itemTransactions?: ItemTransaction[];
};

export type PaidDetails = {
  paymentId: string;
  paidCents: number;
  installment: number;
  fraudStatus: number | null;
  cardAssociation: string | null;
  cardType: string | null;
  cardFamily: string | null;
  binNumber: string | null;
  lastFourDigits: string | null;
  itemTransactions: ItemTransaction[];
};

export type Evaluation =
  | { outcome: "PAID"; details: PaidDetails }
  // Banka/iyzico dolandiricilik incelemesi: para alindi ama kargolama YAPILMAZ.
  | { outcome: "REVIEW"; details: PaidDetails }
  | { outcome: "FAILED"; errorCode: string | null; errorMessage: string | null }
  // Odeme henuz bitmemis (3DS/kart girisi suruyor): durum degismez.
  | { outcome: "PENDING" }
  // iyzico "SUCCESS" diyor ama bizim dogrulamamiz gecmedi: PAID SAYILMAZ, admin'e bildirilir.
  | { outcome: "INVALID"; reason: string; details: PaidDetails | null }
  // API duzeyinde hata (token bulunamadi vb.): durum degismez, tekrar denenebilir.
  | { outcome: "ERROR"; errorCode: string | null; errorMessage: string | null };

export function evaluateRetrieve(params: {
  res: RetrieveResponse;
  attempt: { id: string; token: string };
  order: { orderNumber: string; totalCents: number };
  secretKey: string;
}): Evaluation {
  const { res, attempt, order, secretKey } = params;

  if (res.status !== "success") {
    return { outcome: "ERROR", errorCode: res.errorCode ?? null, errorMessage: res.errorMessage ?? null };
  }

  if (res.paymentStatus === "FAILURE") {
    return { outcome: "FAILED", errorCode: res.errorCode ?? null, errorMessage: res.errorMessage ?? null };
  }
  if (res.paymentStatus !== "SUCCESS") {
    return { outcome: "PENDING" };
  }

  // Buradan sonrasi: iyzico "SUCCESS" diyor. PAID icin HEPSI dogru olmali.
  const reasons: string[] = [];

  let priceCents: number | null = null;
  let paidCents: number | null = null;
  try {
    priceCents = decimalToCents(res.price ?? "");
    paidCents = decimalToCents(res.paidPrice ?? "");
  } catch {
    reasons.push("tutar okunamadı");
  }

  if (!verifyRetrieveSignature(res, secretKey)) reasons.push("yanıt imzası geçersiz");
  if (res.token !== attempt.token) reasons.push("token uyuşmuyor");
  if (res.conversationId !== attempt.id) reasons.push("conversationId uyuşmuyor");
  if (res.basketId !== order.orderNumber) reasons.push("basketId sipariş numarasıyla uyuşmuyor");
  if (res.currency !== "TRY") reasons.push("para birimi TRY değil");
  if (priceCents !== null && priceCents !== order.totalCents) {
    reasons.push(`tutar uyuşmuyor (iyzico ${priceCents}, sipariş ${order.totalCents} kuruş)`);
  }
  if (priceCents !== null && paidCents !== null && paidCents < priceCents) {
    reasons.push("ödenen tutar fiyattan düşük");
  }
  if (res.paymentId === undefined || res.paymentId === null || String(res.paymentId) === "") {
    reasons.push("paymentId yok");
  }

  const fraud = res.fraudStatus === undefined || res.fraudStatus === null ? null : Number(res.fraudStatus);
  const details: PaidDetails | null =
    paidCents === null
      ? null
      : {
          paymentId: String(res.paymentId ?? ""),
          paidCents,
          installment: typeof res.installment === "number" ? res.installment : 1,
          fraudStatus: fraud !== null && Number.isFinite(fraud) ? fraud : null,
          cardAssociation: res.cardAssociation ?? null,
          cardType: res.cardType ?? null,
          cardFamily: res.cardFamily ?? null,
          binNumber: res.binNumber ?? null,
          lastFourDigits: res.lastFourDigits ?? null,
          itemTransactions: Array.isArray(res.itemTransactions) ? res.itemTransactions : []
        };

  if (reasons.length > 0 || !details) {
    return { outcome: "INVALID", reason: reasons.join("; "), details };
  }

  if (details.fraudStatus === -1) {
    return { outcome: "FAILED", errorCode: null, errorMessage: "Dolandırıcılık denetimi reddetti." };
  }
  if (details.fraudStatus === 0) return { outcome: "REVIEW", details };
  // fraudStatus 1 (onayli). Yanitta hic gelmediyse de imza ve tum eslesmeler dogru oldugu
  // icin onayli sayilir; sandbox'ta gozlenip DEPLOY_STATUS'a yazilir (plan 1.9).
  return { outcome: "PAID", details };
}

// iyzico CF token'i 30 dk gecerli; marj ile 35 dk sonra bir deneme kesin "olu" sayilir.
export const TOKEN_DEAD_AFTER_MS = 35 * 60 * 1000;

// ONEMLI (sandbox'ta gozlendi): musteri 3D Secure ekraninda SMS kodunu girerken sorgu
// paymentStatus=FAILURE doner (hata kodu yok). Bu yuzden FAILURE, yalnizca iyzico akisin bittigini
// kendisi bildirdiginde (callback/webhook) ya da token omru dolunca KESIN sayilir. Aksi halde
// (poll/cron/admin sorgusu) deneme "devam ediyor" kalir; yoksa dogru kodu giren musterinin basarili
// odemesi "basarisiz" kaydedilirdi.
export function isFailureFinal(source: string, tokenAgeMs: number): boolean {
  return source === "callback" || source === "webhook" || tokenAgeMs > TOKEN_DEAD_AFTER_MS;
}
