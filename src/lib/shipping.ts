// Kargo esigi ve ucreti - hem odeme sayfasindaki (client, sadece gosterim
// icin) hem orders/route.ts'teki (server, gercek hesap) ozet buradan okur ki
// iki yerde ayri ayri hardcode edilip birbirinden sapmasin. Esik hala sabit
// kodda tutuluyor (StoreSettings'e tasima Faz A kapsami disi).
export const SHIPPING_THRESHOLD_CENTS = 100000; // 1.000 TL uzeri ucretsiz kargo
export const STANDARD_SHIPPING_CENTS = 4900;

export function calculateShippingCents(payableCents: number, freeShipping: boolean): number {
  if (freeShipping) return 0;
  return payableCents >= SHIPPING_THRESHOLD_CENTS ? 0 : STANDARD_SHIPPING_CENTS;
}
