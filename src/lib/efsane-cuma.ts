// Efsane Cuma sepet kampanyasi (docs/reklam/efsane-cuma-2026.md). Saf
// fonksiyonlar: hem istemci (vitrin yazilari, serit, geri sayim) hem sunucu
// (lib/pricing/price-cart.ts) kullanir. DB/ortam okumasi efsane-cuma-server.ts'te.

export const EFSANE_NAME = "Muhteşem Kasım — 2. Ürüne %50 İndirim";
export const EFSANE_LINE_LABEL = "Muhteşem Kasım – 2. ürüne %50";
export const EFSANE_PATH = "/muhtesem-kasim";
export const EFSANE_RED = "#D0021B";

// Istanbul saatiyle 26 Kasim 2026 00:00:00 - 29 Kasim 2026 23:59:59 (UTC+3).
export const EFSANE_DEFAULT_START = new Date("2026-11-26T00:00:00+03:00");
export const EFSANE_DEFAULT_END = new Date("2026-11-29T23:59:59+03:00");

export const EFSANE_COMBINE_NOTE =
  "Muhteşem Kasım indirimi ile Kalp Topla kuponu birlikte kullanılamaz; sana daha avantajlı olan uygulandı.";
export const EFSANE_CODE_NOTE = "Muhteşem Kasım boyunca kupon kodu kullanılamaz.";
export const EFSANE_SINGLE_ITEM_NOTE = "Bir ürün daha ekle, ucuz olana %50 indirim uygulansın.";
export const KALP_PAUSE_NOTE = "Kalp Topla, Muhteşem Kasım boyunca ara verdi. 30 Kasım'da kaldığın yerden devam ediyor.";

// Sayfalara (ISR) gomulen pencere; aktiflik tarayicida o anki saatle hesaplanir.
export type EfsaneWindow = {
  enabled: boolean;
  kalpPause: boolean;
  startsAt: string;
  endsAt: string;
};

function isOpen(window: EfsaneWindow, now: number): boolean {
  return now >= new Date(window.startsAt).getTime() && now <= new Date(window.endsAt).getTime();
}

export function efsaneActiveAt(window: EfsaneWindow, now: Date | number): boolean {
  return window.enabled && isOpen(window, typeof now === "number" ? now : now.getTime());
}

export function kalpPausedAt(window: EfsaneWindow, now: Date | number): boolean {
  return window.kalpPause && isOpen(window, typeof now === "number" ? now : now.getTime());
}

// "2. urun olarak" fiyat: yarisi, kurusa yuvarlanir (x,5 kurus yukari).
export function efsaneHalfCents(unitCents: number): number {
  return Math.round(unitCents / 2);
}

export type EfsaneLine = { variantId: string; unitCents: number; quantity: number };
export type EfsaneAssignment = { variantId: string; count: number; unitCents: number; originalUnitCents: number };

// Adetler tek tek acilir, birim satis fiyatina gore buyukten kucuge siralanir
// (esitlikte sepet sirasi korunur); 2., 4., 6. ... adet yari fiyat olur.
export function assignEfsane(lines: EfsaneLine[]): EfsaneAssignment[] {
  const units = lines.flatMap((line) => Array.from({ length: line.quantity }, () => line));
  const sorted = units
    .map((line, index) => ({ line, index }))
    .sort((a, b) => b.line.unitCents - a.line.unitCents || a.index - b.index);
  const counts = new Map<string, EfsaneAssignment>();
  sorted.forEach(({ line }, rank) => {
    if (rank % 2 === 0) return;
    const current = counts.get(line.variantId);
    if (current) current.count += 1;
    else {
      counts.set(line.variantId, {
        variantId: line.variantId,
        count: 1,
        unitCents: efsaneHalfCents(line.unitCents),
        originalUnitCents: line.unitCents
      });
    }
  });
  return [...counts.values()];
}

export function efsaneDiscountOf(assignments: EfsaneAssignment[]): number {
  return assignments.reduce((sum, a) => sum + (a.originalUnitCents - a.unitCents) * a.count, 0);
}
