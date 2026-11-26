// Microsoft Clarity (oturum kaydi + isi haritasi). KULLANICI KARARI (2026-11-27):
// cerez rizasina BAGLI DEGIL - (site) layout'unda her ziyaretcide yuklenir
// (components/clarity.tsx). consentv2 cagrilmaz, Clarity'nin varsayilan davranisi
// gecerli. GA4 ve Meta Pixel rizaya bagli kalir (lib/consent.ts).
// Kimlik bossa (yerel / onizleme) hicbir sey yuklenmez ve bu fonksiyon hicbir sey yapmaz.
// Kisisel alanlar data-clarity-mask="True" ile maskelenir (odeme, hesap, siparis durumu).

export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || "";

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

// Clarity'nin resmi kurulum kodundaki kuyruk: betik (lazyOnload) inene kadar
// cagrilar kuyrukta bekler, betik gelince islenir. Sayfa efektleri layout'taki
// yukleyiciden once calistigi icin kuyruk burada, ilk cagrida kurulur.
export function clarity(...args: unknown[]) {
  if (!CLARITY_PROJECT_ID || typeof window === "undefined") return;
  window.clarity ??= function () {
    (window.clarity!.q ??= []).push(arguments);
  } as ClarityFn;
  window.clarity(...args);
}
