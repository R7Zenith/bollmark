// Para yardimcilari: tutarlar her yerde tam sayi kurus olarak tutulur, iyzico'ya
// iki ondalikli metin olarak gider. Float carpma/bolme yok (bkz. plan 2/g).

export function centsToDecimalString(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`Geçersiz kuruş tutarı: ${cents}`);
  }
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

// iyzico yanitlari fiyati sayi ya da metin olarak dondurebilir ("10.5", 10.5,
// "10.50"). Metne cevirip 2 ondaliga kadar okur; 2. ondaligin otesinde sifir
// olmayan hane varsa (kurustan kucuk) hata firlatir - sessiz yuvarlama yok.
export function decimalToCents(value: string | number): number {
  const text = typeof value === "number" ? String(value) : value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    throw new Error(`Geçersiz tutar: ${text}`);
  }
  const whole = match[1];
  const fraction = match[2] ?? "";
  if (/[1-9]/.test(fraction.slice(2))) {
    throw new Error(`Tutar kuruştan küçük hane içeriyor: ${text}`);
  }
  const cents = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Tutar çok büyük: ${text}`);
  }
  return cents;
}

// Yanit imzasi hesabindan once fiyat alanlarinin sondaki sifirlari atilir
// (10.50 -> 10.5, 10.00 -> 10, bkz. plan 1.4).
export function trimTrailingZeros(value: string | number): string {
  const text = typeof value === "number" ? String(value) : value.trim();
  if (!text.includes(".")) return text;
  return text.replace(/0+$/, "").replace(/\.$/, "");
}
