// Siparişler sayfasındaki dönem seçici için hazır aralık hesaplama. Her dönem,
// bir önceki eşit uzunluktaki dönemle kıyaslanabilmesi için "current" ve
// "previous" aralığı birlikte döner (özet kartlardaki trend oku için).

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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function shiftDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function resolvePeriodRange(
  donem: string | undefined,
  baslangic: string | undefined,
  bitis: string | undefined
): PeriodRange {
  const key: PeriodKey = periodKeys.includes(donem as PeriodKey) ? (donem as PeriodKey) : defaultPeriod;
  const now = new Date();

  if (key === "ozel") {
    const start = baslangic ? new Date(`${baslangic}T00:00:00.000`) : undefined;
    const end = bitis ? new Date(`${bitis}T23:59:59.999`) : undefined;
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
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endOfDay(now);
  const daysSoFar = now.getDate();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
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
