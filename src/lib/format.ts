// Intl'in otomatik ekledigi ₺ sembolu yerine Release temasindaki gibi duz
// "TL" metni gosteriliyor (bkz. KATALOG_ROZET_HOVER_PLANI.md 3.1) - binlik/
// ondalik ayiraclar tr-TR formatindan (nokta/virgul) geliyor, sadece sembol
// yerine yazi kullaniliyor. Bu fonksiyon site geneli + admin panelde
// kullanildigi icin degisiklik her yere yansir.
export function formatPrice(cents: number): string {
  const amount = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(cents / 100);
  return `${amount} TL`;
}

export function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BLM${y}${m}${d}-${rand}`;
}
