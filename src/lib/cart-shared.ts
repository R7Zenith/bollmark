// Sepet icin istemci (cart.tsx) ile sunucunun (lib/cart-lines.ts, api/sepet)
// ortak kullandigi limitler ve tipler. Prisma/sunucu bagimliligi icermez.

export const MAX_CART_LINES = 50;
export const MAX_LINE_QUANTITY = 99;

// UNAVAILABLE: urun/varyant silinmis ya da artik yayinda degil (PUBLISHED degil).
export type CartLineIssue = "UNAVAILABLE" | "OUT_OF_STOCK";

// /api/sepet ve /api/sepet/dogrula'nin dondugu, guncel urun kaydindan uretilmis satir.
export type ResolvedCartLine = {
  productId: string;
  variantId: string;
  // Meta Pixel content_ids icin (bkz. lib/meta/track.ts).
  sku: string;
  quantity: number;
  name: string;
  // GA4 item_brand / item_category icin (bkz. lib/meta/track.ts); yoksa "".
  brand: string;
  category: string;
  size: string;
  color: string;
  image: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  // Gorsel gri zemin + mix-blend-multiply ile mi gosterilsin (bkz. lib/image-backdrop.ts).
  greyBackdrop: boolean;
  issue: CartLineIssue | null;
};
