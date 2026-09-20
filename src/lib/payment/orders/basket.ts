// iyzico sepet kalemlerinin olusturulmasi (bkz. IYZICO_SANAL_POS_PLANI.md 5.A).
// Saf fonksiyonlar: DB'ye dokunmaz, tum tutarlar tam sayi kurus. Toplam indirim
// (bundle + kupon + puan), satir toplamlarina orantili olarak "en buyuk kalan"
// (largest remainder) yontemiyle kurus kurus dagitilir; boylece kalem toplami
// HER ZAMAN siparis tutarina (kargo dahil) tam esit olur.

export type BasketLine = {
  /** iyzico basketItem.id - OrderItem.id */
  id: string;
  name: string;
  category: string;
  /** OrderItem.totalCents (indirim oncesi satir toplami) */
  lineTotalCents: number;
};

export type BasketItem = { id: string; name: string; category1: string; priceCents: number };

export class BasketError extends Error {}

export const SHIPPING_ITEM_ID = "SHIPPING";

// Toplam indirimi orantili dagitir: pay_i = floor(indirim * satir_i / toplam),
// artan kuruslar kalanlari en buyuk olan satirlardan baslayarak birer kurus verilir.
export function allocateDiscount(lineTotals: number[], discountCents: number): number[] {
  const sum = lineTotals.reduce((a, b) => a + b, 0);
  if (discountCents === 0) return lineTotals.map(() => 0);
  if (sum <= 0 || discountCents < 0 || discountCents > sum) {
    throw new BasketError("İndirim tutarı geçersiz.");
  }
  const bigDiscount = BigInt(discountCents);
  const bigSum = BigInt(sum);
  const shares = lineTotals.map((line) => Number((bigDiscount * BigInt(line)) / bigSum));
  const remainders = lineTotals.map((line) => (bigDiscount * BigInt(line)) % bigSum);

  let leftover = discountCents - shares.reduce((a, b) => a + b, 0);
  const order = lineTotals
    .map((_, index) => index)
    .sort((a, b) => (remainders[b] === remainders[a] ? a - b : remainders[b] > remainders[a] ? 1 : -1));
  for (const index of order) {
    if (leftover === 0) break;
    shares[index] += 1;
    leftover -= 1;
  }
  return shares;
}

// Kalem fiyati 0 veya negatif olamaz (iyzico hata 5050): 0'a dusen kalem 1 kurusa
// sabitlenir, fark o an en buyuk kalemden alinir. Bu mumkun degilse hata firlatir.
export function buildBasketItems(params: {
  lines: BasketLine[];
  shippingCents: number;
  totalCents: number;
}): BasketItem[] {
  const { lines, shippingCents, totalCents } = params;
  if (lines.length === 0) throw new BasketError("Sipariş kalemi yok.");

  const itemsTotal = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const payableForItems = totalCents - shippingCents;
  const discountCents = itemsTotal - payableForItems;
  if (payableForItems < lines.length || discountCents < 0) {
    throw new BasketError("Sipariş tutarı sepet kalemlerine dağıtılamıyor.");
  }

  const shares = allocateDiscount(
    lines.map((line) => line.lineTotalCents),
    discountCents
  );
  const prices = lines.map((line, index) => line.lineTotalCents - shares[index]);

  for (let index = 0; index < prices.length; index++) {
    if (prices[index] >= 1) continue;
    const deficit = 1 - prices[index];
    prices[index] = 1;
    let donor = 0;
    for (let i = 1; i < prices.length; i++) if (prices[i] > prices[donor]) donor = i;
    if (prices[donor] - deficit < 1) throw new BasketError("Sepet kalemi fiyatı 0'a düştü.");
    prices[donor] -= deficit;
  }

  const items: BasketItem[] = lines.map((line, index) => ({
    id: line.id,
    name: line.name,
    category1: line.category,
    priceCents: prices[index]
  }));
  if (shippingCents > 0) {
    items.push({ id: SHIPPING_ITEM_ID, name: "Kargo", category1: "Kargo", priceCents: shippingCents });
  }

  const basketTotal = items.reduce((sum, item) => sum + item.priceCents, 0);
  if (basketTotal !== totalCents) {
    throw new BasketError(`Sepet toplamı (${basketTotal}) sipariş tutarına (${totalCents}) eşit değil.`);
  }
  return items;
}
