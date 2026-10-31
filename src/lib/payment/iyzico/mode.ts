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

export type LocalPaymentTest = { apiKey: string; secretKey: string; baseUrl: string };

// Yerel sandbox odeme testi: anahtar ve adres DB'den degil yerel .env'den okunur,
// ortak DB'deki Sanal POS kaydina dokunulmaz. Vercel'de ya da production derlemede
// degisken eklense bile etkisizdir; adres sandbox degilse de kapali kalir.
export function localPaymentTestFrom(env: Record<string, string | undefined>): LocalPaymentTest | null {
  if (env.PAYMENT_LOCAL_TEST !== "1" || env.VERCEL !== undefined || env.NODE_ENV === "production") return null;
  const apiKey = env.IYZICO_SANDBOX_API_KEY;
  const secretKey = env.IYZICO_SANDBOX_SECRET_KEY;
  const baseUrl = env.IYZICO_SANDBOX_BASE_URL?.replace(/\/+$/, "");
  if (!apiKey || !secretKey || !baseUrl?.startsWith("https://sandbox-")) return null;
  return { apiKey, secretKey, baseUrl };
}

export function localPaymentTest(): LocalPaymentTest | null {
  return localPaymentTestFrom(process.env);
}

export function iyzicoBaseUrl(mode: PaymentMode): string {
  return (mode === "SANDBOX" ? localPaymentTest()?.baseUrl : null) ?? IYZICO_BASE_URLS[mode];
}
