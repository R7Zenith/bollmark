// Kargo esigi ve ucreti - hem odeme sayfasindaki (client, sadece gosterim
// icin) hem orders/route.ts'teki (server, gercek hesap) ozet buradan okur ki
// iki yerde ayri ayri hardcode edilip birbirinden sapmasin. Ucret artik
// StoreSettings.defaultShippingCents'ten (panel > Ayarlar) okunup buraya
// parametre olarak geciriliyor. Esik hala sabit kodda tutuluyor (StoreSettings'e
// tasima Faz A kapsami disi).
export const SHIPPING_THRESHOLD_CENTS = 150000; // 1.500 TL uzeri ucretsiz kargo

export function calculateShippingCents(
  payableCents: number,
  freeShipping: boolean,
  standardShippingCents: number
): number {
  if (freeShipping) return 0;
  return payableCents >= SHIPPING_THRESHOLD_CENTS ? 0 : standardShippingCents;
}
