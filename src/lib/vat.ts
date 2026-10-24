// KDV oranlari (bkz. GA4_KURULUM_PLANI.md). Fiyatlar KDV dahil tutulur; KDV tutari
// ic yuzde ile bulunur: fiyat x oran / (100 + oran).
// Oran onceligi: urunun kendi orani -> kategorininki -> ust kategorininki -> %10.

export const VAT_RATES = [1, 10, 20] as const;
export const DEFAULT_VAT_RATE = 10;
export const SHIPPING_VAT_RATE = 20;

// Admin formlarindaki <select> degeri: bos ya da gecersizse null.
export function parseVatRate(value: FormDataEntryValue | null): number | null {
  const rate = Number(value);
  return (VAT_RATES as readonly number[]).includes(rate) ? rate : null;
}

export function resolveVatRate(product: {
  vatRate: number | null;
  category: { vatRate: number | null; parent: { vatRate: number | null } | null } | null;
}): number {
  return product.vatRate ?? product.category?.vatRate ?? product.category?.parent?.vatRate ?? DEFAULT_VAT_RATE;
}

export function vatFromGrossCents(grossCents: number, rate: number): number {
  return (grossCents * rate) / (100 + rate);
}
