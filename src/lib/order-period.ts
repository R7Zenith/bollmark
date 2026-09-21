// Siparişler sayfasındaki dönem seçici için hazır aralık hesaplama. Her dönem,
// bir önceki eşit uzunluktaki dönemle kıyaslanabilmesi için "current" ve
// "previous" aralığı birlikte döner (özet kartlardaki trend oku için).

import { istanbulDateKey, istanbulDayEnd, istanbulDayStart, monthStartDateKey } from "@/lib/format";

export type PeriodKey = "bugun" | "dun" | "son7gun" | "son30gun" | "buay" | "ozel";

export const periodOptions: { value: PeriodKey; label: string }[] = [
  { value: "bugun", label: "Bugün" },
  { value: "dun", label: "Dün" },
  { value: "son7gun", label: "Son 7 Gün" },
  { value: "son30gun", label: "Son 30 Gün" },
  { value: "buay", label: "Bu Ay" },
  { value: "ozel", label: "Özel Aralık" }
];

export const defaultPeriod: PeriodKey = "son30gun";

const periodKeys = periodOptions.map((o) => o.value);

export interface DateRange {
  start?: Date;
  end?: Date;
}

export interface PeriodRange {
  key: PeriodKey;
  current: DateRange;
  previous: DateRange;
}

// Gun sinirlari sunucu saat dilimine (Vercel'de UTC) degil Istanbul gunune gore
// hesaplanir. Turkiye'de yaz/kis saati olmadigi icin 24 saatlik kaydirma
// gun kaydirmaya esittir.
function startOfDay(d: Date): Date {
  return istanbulDayStart(istanbulDateKey(d));
}

function endOfDay(d: Date): Date {
  return istanbulDayEnd(istanbulDateKey(d));
}

function shiftDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export function resolvePeriodRange(
  donem: string | undefined,
  baslangic: string | undefined,
  bitis: string | undefined
): PeriodRange {
  const key: PeriodKey = periodKeys.includes(donem as PeriodKey) ? (donem as PeriodKey) : defaultPeriod;
  const now = new Date();

  if (key === "ozel") {
    const start = baslangic ? istanbulDayStart(baslangic) : undefined;
    const end = bitis ? istanbulDayEnd(bitis) : undefined;
    if (!start || !end) {
      return { key, current: { start, end }, previous: {} };
    }
    const lengthMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - lengthMs);
    return { key, current: { start, end }, previous: { start: prevStart, end: prevEnd } };
  }

  if (key === "bugun") {
    const start = startOfDay(now);
    const end = endOfDay(now);
    return { key, current: { start, end }, previous: { start: shiftDays(start, -1), end: shiftDays(end, -1) } };
  }

  if (key === "dun") {
    const yesterday = shiftDays(now, -1);
    const start = startOfDay(yesterday);
    const end = endOfDay(yesterday);
    return { key, current: { start, end }, previous: { start: shiftDays(start, -1), end: shiftDays(end, -1) } };
  }

  if (key === "son7gun") {
    const start = shiftDays(startOfDay(now), -6);
    const end = endOfDay(now);
    return { key, current: { start, end }, previous: { start: shiftDays(start, -7), end: shiftDays(end, -7) } };
  }

  if (key === "son30gun") {
    const start = shiftDays(startOfDay(now), -29);
    const end = endOfDay(now);
    return { key, current: { start, end }, previous: { start: shiftDays(start, -30), end: shiftDays(end, -30) } };
  }

  // buay
  const todayKey = istanbulDateKey(now);
  const start = istanbulDayStart(monthStartDateKey(todayKey));
  const end = endOfDay(now);
  const daysSoFar = Number(todayKey.slice(8));
  const prevMonthStart = istanbulDayStart(monthStartDateKey(todayKey, -1));
  const prevMonthEnd = endOfDay(shiftDays(prevMonthStart, daysSoFar - 1));
  return { key, current: { start, end }, previous: { start: prevMonthStart, end: prevMonthEnd } };
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} gün ${hours} saat`;
  if (hours > 0) return `${hours} saat ${minutes} dakika`;
  return `${minutes} dakika`;
}
