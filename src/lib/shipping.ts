import { formatPrice } from "@/lib/format";
import { STORE_INFO } from "@/lib/store-info";

// Kargo esigi ve ucreti - hem odeme sayfasindaki (client, sadece gosterim
// icin) hem orders/route.ts'teki (server, gercek hesap) ozet buradan okur ki
// iki yerde ayri ayri hardcode edilip birbirinden sapmasin. Ucret artik
// StoreSettings.defaultShippingCents'ten (panel > Ayarlar) okunup buraya
// parametre olarak geciriliyor. Esik hala sabit kodda tutuluyor (StoreSettings'e
// tasima Faz A kapsami disi).
export const SHIPPING_THRESHOLD_CENTS = 150000; // 1.500 TL uzeri ucretsiz kargo

// Urun sayfasi, sepet ve On Bilgilendirme Formu'ndaki ortak kargo metinleri.
export function shippingFeeSummary(standardShippingCents: number): string {
  return standardShippingCents > 0
    ? `Kargo ücreti ${formatPrice(standardShippingCents)}; ${formatPrice(SHIPPING_THRESHOLD_CENTS)} ve üzeri siparişlerde ücretsiz.`
    : "Kargo ücretsizdir.";
}

export const DISPATCH_TEXT = `Siparişiniz ${STORE_INFO.handlingDays.min}-${STORE_INFO.handlingDays.max} iş günü içinde kargoya verilir.`;

export function calculateShippingCents(
  payableCents: number,
  freeShipping: boolean,
  standardShippingCents: number
): number {
  if (freeShipping) return 0;
  return payableCents >= SHIPPING_THRESHOLD_CENTS ? 0 : standardShippingCents;
}
