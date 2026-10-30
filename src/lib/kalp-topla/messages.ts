// Bar durum mesajlari (KALP_TOPLA_PLANI.md 2. "Bar durum mesajlari"). Sunucu
// ve istemci ortak kullanir; sayilar turun kendi esigiyle (T16, Y12) hesaplanir.

export type BarMessageInput = {
  points: number;
  threshold: number;
  discountPercent: number;
  inviteBonus: number;
  couponHours: number;
  // Kullanicinin bu urunun son kapanan turundan gecerli kuponu var.
  wonCoupon: boolean;
  // Son tur yakin zamanda doldu ve yeni turda henuz kalp yok.
  recentlyClosed: boolean;
};

export function barMessage(input: BarMessageInput): string {
  const { points, threshold } = input;
  if (input.wonCoupon && points === 0) return `Kilit açıldı! Kuponun hesabında, ${input.couponHours} saat`;
  if (input.recentlyClosed && points === 0) return "Bu tur doldu, yeni tur başladı";
  if (points <= 0) return `İlk kalbi sen ver, %${input.discountPercent}'nin kilidini birlikte açalım`;
  const left = Math.max(threshold - points, 0);
  if (left <= 2) return `Son ${left} kalp! İstersen arkadaşını çağır, +${input.inviteBonus} eklesin`;
  return `${points}/${threshold} kalp · ${left} kalp kaldı`;
}
