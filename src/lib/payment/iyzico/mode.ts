// Sanal POS modu (bkz. plan 3/5: tek noktadan mod belirleme).
// DB'den okuma ve anahtar cozme islemleri lib/payment/settings.ts'te.

export type PaymentMode = "SANDBOX" | "LIVE";

export const IYZICO_BASE_URLS: Record<PaymentMode, string> = {
  SANDBOX: "https://sandbox-api.iyzipay.com",
  LIVE: "https://api.iyzipay.com"
};

// Veritabani yerel ve canlida ORTAK oldugu icin (bkz. plan 2/h) LIVE secili
// olsa bile yalnizca Vercel production ortaminda gecerlidir; yerel ve preview
// ortamlar her zaman SANDBOX kullanir - yerelde canli anahtarla gercek kart cekilmez.
export function resolveModeFrom(dbMode: string | null | undefined, vercelEnv: string | undefined): PaymentMode {
  return dbMode === "LIVE" && vercelEnv === "production" ? "LIVE" : "SANDBOX";
}
