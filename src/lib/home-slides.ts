// Anasayfa hero slaytlari (docs/planlar/ANASAYFA_BANNER_YONETIMI_PLANI.md).
// Saf fonksiyonlar: hem tarayici (hangi slayt su an gorunur) hem admin
// (durum rozeti, siralama) kullanir. DB okumasi home-slides-server.ts'te.

// Kalp Topla slayti icerik olarak kodda (hero-kalp-topla-slide.tsx); DB'de bu
// id'li satir yalniz aç/kapat + sira tutar.
export const KALP_SLIDE_ID = "kalp-topla";

export type SlideKind = "IMAGE_ONLY" | "TEXT_OVERLAY" | "KALP_TOPLA";
export type SlideAlign = "LEFT" | "CENTER";
export type SlideTone = "LIGHT" | "DARK";
export type SlideOverlay = "NONE" | "LIGHT" | "MEDIUM";

// Sayfaya (ISR) gomulen, serilestirilebilir slayt verisi.
export type HomeSlideData = {
  id: string;
  name: string;
  kind: SlideKind;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  startsAt: string | null;
  endsAt: string | null;
  desktopImageUrl: string;
  mobileImageUrl: string | null;
  desktopFocus: string;
  mobileFocus: string;
  altText: string;
  href: string | null;
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  buttonLabel: string | null;
  textAlign: SlideAlign;
  textTone: SlideTone;
  overlay: SlideOverlay;
  showCountdown: boolean;
};

export const SLIDE_KIND_LABEL: Record<SlideKind, string> = {
  IMAGE_ONLY: "Yazılı görsel",
  TEXT_OVERLAY: "Görsel + site yazısı",
  KALP_TOPLA: "Sistem slaytı"
};

// 3x3 odak noktasi secimi -> CSS object-position. Secilmeyen ozel bir deger
// (orn. sezon hero'sunun "50% 18%") de gecerlidir; panelde "Özel" gorunur.
export const FOCUS_PRESETS = [
  "0% 0%", "50% 0%", "100% 0%",
  "0% 50%", "50% 50%", "100% 50%",
  "0% 100%", "50% 100%", "100% 100%"
];

export function isValidFocus(value: string): boolean {
  return /^(100|\d{1,2})% (100|\d{1,2})%$/.test(value);
}

type Windowed = { enabled: boolean; startsAt: string | null; endsAt: string | null };

// Acik ve tarih penceresi icinde mi (uclar dahil, ms hassasiyetinde).
export function slideInWindow(slide: Windowed, now: number): boolean {
  if (!slide.enabled) return false;
  if (slide.startsAt && now < new Date(slide.startsAt).getTime()) return false;
  if (slide.endsAt && now > new Date(slide.endsAt).getTime()) return false;
  return true;
}

export type SlideStatus = "YAYINDA" | "PLANLANDI" | "SURESI_DOLDU" | "KAPALI";

export function slideStatus(slide: Windowed, now: number): SlideStatus {
  if (!slide.enabled) return "KAPALI";
  if (slide.startsAt && now < new Date(slide.startsAt).getTime()) return "PLANLANDI";
  if (slide.endsAt && now > new Date(slide.endsAt).getTime()) return "SURESI_DOLDU";
  return "YAYINDA";
}

// sortOrder artan; esitlikte once olusturulan once.
export function sortSlides<T extends { sortOrder: number; createdAt: string }>(slides: T[]): T[] {
  return [...slides].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

// Su an anasayfada gorunecek slaytlar, sirasiyla. Kalp Topla yalniz kampanya
// LIVE iken ve Muhtesem Kasim arasi disinda.
export function visibleSlides(
  slides: HomeSlideData[],
  now: number,
  kalp: { live: boolean; paused: boolean }
): HomeSlideData[] {
  return sortSlides(slides).filter(
    (s) => slideInWindow(s, now) && (s.kind !== "KALP_TOPLA" || (kalp.live && !kalp.paused))
  );
}

// Panelde yukari/asagi: siralanmis id listesinde birini bir adim kaydirir.
// Sinirdaysa liste aynen doner.
export function moveInOrder(ids: string[], id: string, direction: "up" | "down"): string[] {
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// datetime-local degeri Istanbul saati (Turkiye kalici UTC+3) olarak okunur.
export function parseIstanbulInput(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}:00+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Date -> datetime-local degeri (Istanbul saati, YYYY-MM-DDTHH:mm).
export function toIstanbulInput(date: Date | string | null): string {
  if (!date) return "";
  return new Date(new Date(date).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
