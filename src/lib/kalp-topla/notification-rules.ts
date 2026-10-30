// Bildirim kurallari (KALP_TOPLA_PLANI.md 7.1, T15, Y1). Istemci de kullanir:
// burada sunucu bagimliligi yoktur.

export type NotificationType = "COUPON_WON" | "BAR_NEAR" | "INVITE_JOINED" | "COUPON_EXPIRING" | "BONUS_EXPIRED" | "COUPON_RESTORED";

// ALWAYS: sinirsiz. DAILY: kisi basi Istanbul gunu basina 1 (Y1). NONE: yalniz site ici.
export function emailRule(type: string): "ALWAYS" | "DAILY" | "NONE" {
  if (type === "COUPON_WON" || type === "COUPON_EXPIRING") return "ALWAYS";
  if (type === "BAR_NEAR" || type === "INVITE_JOINED") return "DAILY";
  return "NONE";
}

export function channelStatus(type: string): { emailStatus: string; pushStatus: string } {
  return emailRule(type) === "NONE"
    ? { emailStatus: "NOT_APPLICABLE", pushStatus: "NOT_APPLICABLE" }
    : { emailStatus: "PENDING", pushStatus: "PENDING" };
}

// "Son 2 kalp": acik turda 1 ya da 2 kalp kaldiysa kalan sayi, degilse null.
export function barNearLeft(points: number, threshold: number): number | null {
  const left = threshold - points;
  return points > 0 && left > 0 && left <= 2 ? left : null;
}

// Faz 0 kural 2: Vercel disinda push yalniz test hesaplarina gider.
export function pushTargetAllowed(input: { onVercel: boolean; testerIds: string[]; customerId: string }): boolean {
  return input.onVercel || input.testerIds.includes(input.customerId);
}

// Sunucu bu adrese istek atar: yalniz tarayici push servisleri kabul edilir.
const PUSH_HOSTS = /^(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)$/;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.test(url.hostname);
  } catch {
    return false;
  }
}

// 404/410: abonelik olmus, silinir (plan 7.5).
export function isGonePushStatus(status: number | undefined): boolean {
  return status === 404 || status === 410;
}
