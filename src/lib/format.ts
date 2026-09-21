// Intl'in otomatik ekledigi ₺ sembolu yerine Release temasindaki gibi duz
// "TL" metni gosteriliyor (bkz. KATALOG_ROZET_HOVER_PLANI.md 3.1) - binlik/
// ondalik ayiraclar tr-TR formatindan (nokta/virgul) geliyor, sadece sembol
// yerine yazi kullaniliyor. Bu fonksiyon site geneli + admin panelde
// kullanildigi icin degisiklik her yere yansir.
export function formatPrice(cents: number): string {
  const amount = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(cents / 100);
  return `${amount} TL`;
}

// Odeme/iade tutarlari kurus hassasiyetiyle gosterilir (formatPrice tam TL'ye yuvarlar: 150,50 -> 151).
export function formatExactPrice(cents: number): string {
  const isWhole = cents % 100 === 0;
  const amount = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2
  }).format(cents / 100);
  return `${amount} TL`;
}

// Vercel sunucusu UTC'de calistigi icin tarih/saat gosterimi ve gun sinirlari
// (rapor gruplamalari, kampanya tarihleri, siparis numarasi) sunucu/tarayici
// saat diline birakilmaz, her zaman Turkiye saatine gore hesaplanir.
export const TIME_ZONE = "Europe/Istanbul";

// Turkiye 2016'dan beri kalici UTC+3 (yaz/kis saati yok); gun sinirlari bu
// sabit ofsetle uretilir.
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const ISTANBUL_OFFSET = "+03:00";

type DateInput = Date | string | number;

export function formatDate(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString("tr-TR", { ...options, timeZone: TIME_ZONE });
}

export function formatDateTime(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleString("tr-TR", { ...options, timeZone: TIME_ZONE });
}

export function formatTime(value: DateInput): string {
  return new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
}

// Istanbul takvim gununu "YYYY-MM-DD" olarak dondurur (gun bazli gruplama anahtari).
export function istanbulDateKey(value: DateInput): string {
  return new Date(new Date(value).getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" gununun Istanbul saatiyle 00:00:00.000 ani.
export function istanbulDayStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000${ISTANBUL_OFFSET}`);
}

// "YYYY-MM-DD" gununun Istanbul saatiyle 23:59:59.999 ani.
export function istanbulDayEnd(dateKey: string): Date {
  return new Date(`${dateKey}T23:59:59.999${ISTANBUL_OFFSET}`);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// dateKey'in ayinin (monthOffset ay sonrasinin/oncesinin) ilk gunu, "YYYY-MM-DD".
export function monthStartDateKey(dateKey: string, monthOffset = 0): string {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + monthOffset, 1)).toISOString().slice(0, 10);
}

// start ve end dahil, aradaki tum Istanbul gunlerinin anahtarlari.
export function istanbulDateKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const last = istanbulDateKey(end);
  for (let key = istanbulDateKey(start); key <= last; key = addDaysToDateKey(key, 1)) keys.push(key);
  return keys;
}

export function generateOrderNumber(): string {
  const [year, month, day] = istanbulDateKey(new Date()).split("-");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BLM${year.slice(-2)}${month}${day}-${rand}`;
}
