// Bir varyantin gecerli fiyati/indirimi: varyanta ozel deger girilmisse o
// kullanilir, bos birakilmissa urunun genel fiyati/indirimi kullanilir.

export function effectivePrice(
  product: { priceCents: number },
  variant?: { priceCents: number | null } | null
): number {
  return variant?.priceCents ?? product.priceCents;
}

export function effectiveCompareAt(
  product: { compareAtCents: number | null },
  variant?: { compareAtCents: number | null } | null
): number | null {
  return variant?.compareAtCents ?? product.compareAtCents ?? null;
}
