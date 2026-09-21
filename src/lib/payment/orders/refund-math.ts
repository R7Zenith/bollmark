// Iade hesaplari (bkz. plan 5.F). Saf fonksiyonlar: DB'ye ve aga dokunmaz, boylece
// "kalan iade edilebilir tutar", eszamanli iade rezervasyonu ve siparis durumu gecisleri
// birim testlenebilir. Tum tutarlar tam sayi kurustur.

export const SHIPPING_LINE_KEY = "SHIPPING";

export type RefundLine = {
  // OrderItem.id ya da SHIPPING_LINE_KEY
  key: string;
  label: string;
  // iyzico'nun bu kalem icin verdigi islem numarasi; yoksa bu kalem uygulamadan iade edilemez.
  paymentTransactionId: string | null;
  paidCents: number;
  refundedCents: number;
  // Henuz sonuclanmamis (PENDING) iadelerin rezerve ettigi tutar.
  pendingCents: number;
};

export function remainingCents(line: Pick<RefundLine, "paidCents" | "refundedCents" | "pendingCents">): number {
  return Math.max(0, line.paidCents - line.refundedCents - line.pendingCents);
}

export type AmountCheck = { ok: true; amountCents: number } | { ok: false; reason: "no-transaction" | "invalid" | "exceeds" | "nothing-left" };

// requested: kurus. undefined/null ise "kalanin tamami" (tam kalem iadesi).
export function checkRefundAmount(line: RefundLine, requested: number | null | undefined): AmountCheck {
  if (!line.paymentTransactionId) return { ok: false, reason: "no-transaction" };
  const remaining = remainingCents(line);
  if (remaining <= 0) return { ok: false, reason: "nothing-left" };
  if (requested === null || requested === undefined) return { ok: true, amountCents: remaining };
  if (!Number.isSafeInteger(requested) || requested <= 0) return { ok: false, reason: "invalid" };
  if (requested > remaining) return { ok: false, reason: "exceeds" };
  return { ok: true, amountCents: requested };
}

// Yonetici girdisi ("123,45", "123.45", "1.234,50") -> kurus. Gecersizse null.
// Kurustan kucuk hane kabul edilmez (sessiz yuvarlama yok).
export function parseTlToCents(input: string): number | null {
  let text = input.trim().replace(/\s/g, "");
  if (!text) return null;
  if (text.includes(",")) {
    // Turkce bicim: binlik ayraci nokta, ondalik virgul
    text = text.replace(/\./g, "").replace(",", ".");
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  return Number.isSafeInteger(cents) ? cents : null;
}

export type NextRefundState = {
  paymentStatus: "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
  fullyRefunded: boolean;
};

// Basarili bir iadeden sonra siparisin odeme durumu. Odenmis tutari olan TUM kalemler
// tamamen iade edildiyse REFUNDED, herhangi bir iade varsa PARTIALLY_REFUNDED.
export function nextRefundState(lines: Pick<RefundLine, "paidCents" | "refundedCents">[]): NextRefundState {
  const paidLines = lines.filter((line) => line.paidCents > 0);
  const totalRefunded = lines.reduce((sum, line) => sum + line.refundedCents, 0);
  if (totalRefunded <= 0) return { paymentStatus: "PAID", fullyRefunded: false };
  const fullyRefunded = paidLines.length > 0 && paidLines.every((line) => line.refundedCents >= line.paidCents);
  return { paymentStatus: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED", fullyRefunded };
}

// Iyzico ile odenmis bir siparis icin refund/cancel yapilabilir mi?
export const REFUNDABLE_PAYMENT_STATUSES = ["PAID", "PARTIALLY_REFUNDED"] as const;

// Iptal (payment/cancel) yalnizca TAM tutar ve hic iade yokken mumkundur (bkz. plan 1.6).
export function canCancelPayment(params: { paymentStatus: string; refundedTotalCents: number; pendingTotalCents: number }): boolean {
  return params.paymentStatus === "PAID" && params.refundedTotalCents === 0 && params.pendingTotalCents === 0;
}
