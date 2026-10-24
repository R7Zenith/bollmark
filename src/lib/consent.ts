// Cerez rızası (KVKK) icin merkezi modul - bkz. CEREZ_BANDI_PLANI.md.
// Zorunlu cerezler her zaman acik; analitik ve pazarlama varsayilan KAPALI.
// Tercih birinci taraf bm_consent cerezinde 12 ay tutulur. Surum
// (CONSENT_VERSION) degisirse eski tercih gecersiz sayilir ve bant tekrar
// cikar - kategori/metin degisikliginde surumu artirin.
//
// Ucuncu taraf yukleyiciler (GA4: components/google-analytics.tsx, Meta Pixel:
// components/meta-pixel.tsx) scripti KENDILIGINDEN yuklemez, ilgili kategorinin
// rızasina baglidir: rıza yoksa script hic indirilmez, sonradan verilirse o an yuklenir.

export type ConsentCategory = "analytics" | "marketing";
export type ConsentState = Record<ConsentCategory, boolean>;
export type StoredConsent = ConsentState & { v: string; ts: number; id: string };

export const CONSENT_VERSION = "3"; // 3: GA4 eklendi, analitik aciklamasinda Google Analytics adi (bkz. GA4_KURULUM_PLANI.md)
export const CONSENT_COOKIE_NAME = "bm_consent";
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 12 ay
// Tercih degisince yayinlanir; detail: ConsentState.
export const CONSENT_CHANGE_EVENT = "bm-consent-change";
// Footer'daki "Cerez Tercihleri" gibi yerlerden tercih panelini acar.
export const CONSENT_OPEN_EVENT = "bm-consent-open";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  }
}

export function readConsentCookie(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)`));
  return match ? match[1] : "";
}

export function parseConsent(raw: string): StoredConsent | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Partial<StoredConsent>;
    if (data.v !== CONSENT_VERSION || typeof data.ts !== "number" || typeof data.id !== "string") return null;
    if (Date.now() - data.ts > CONSENT_MAX_AGE_SECONDS * 1000) return null;
    return { v: data.v, ts: data.ts, id: data.id, analytics: data.analytics === true, marketing: data.marketing === true };
  } catch {
    return null;
  }
}

export function getConsent(): StoredConsent | null {
  if (typeof document === "undefined") return null;
  return parseConsent(readConsentCookie());
}

export function hasConsent(category: ConsentCategory): boolean {
  return getConsent()?.[category] === true;
}

export function saveConsent(state: ConsentState) {
  const previous = getConsent();
  const stored: StoredConsent = {
    v: CONSENT_VERSION,
    ts: Date.now(),
    id: previous?.id ?? crypto.randomUUID(),
    analytics: state.analytics,
    marketing: state.marketing
  };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(stored))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;

  if (!state.analytics) clearCookies(ANALYTICS_COOKIES);
  if (!state.marketing) clearCookies(MARKETING_COOKIES);
  updateGoogleConsent(state);
  window.fbq?.("consent", state.marketing ? "grant" : "revoke");

  window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_CHANGE_EVENT, { detail: state }));

  // Ispat kaydi (ConsentLog) - yalniz kullanici secim yaptiginda tek istek.
  fetch("/api/cerez-rizasi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId: stored.id, version: stored.v, analytics: stored.analytics, marketing: stored.marketing }),
    keepalive: true
  }).catch(() => {});
}

export function openConsentPreferences() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

// Kategori icin rıza varsa callback'i hemen, yoksa rıza verildigi an bir kez
// calistirir. Donen fonksiyon dinlemeyi iptal eder.
export function onConsentGranted(category: ConsentCategory, callback: () => void): () => void {
  if (hasConsent(category)) {
    callback();
    return () => {};
  }
  const listener = (event: Event) => {
    if ((event as CustomEvent<ConsentState>).detail[category]) {
      window.removeEventListener(CONSENT_CHANGE_EVENT, listener);
      callback();
    }
  };
  window.addEventListener(CONSENT_CHANGE_EVENT, listener);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, listener);
}

// --- Google Consent Mode v2 ---
// GA4 yukleyicisi (components/google-analytics.tsx) gtag config'ten ONCE
// initGoogleConsent() cagirir; ileride Google Ads eklenirse ayni gtag kullanilir.
export const GOOGLE_CONSENT_DEFAULT = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied"
} as const;

export function googleConsentFor(state: ConsentState) {
  const ads = state.marketing ? "granted" : "denied";
  return {
    analytics_storage: state.analytics ? "granted" : "denied",
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads
  };
}

export function initGoogleConsent() {
  window.dataLayer = window.dataLayer || [];
  window.gtag ??= function gtag() {
    // gtag.js, dataLayer'a "arguments" nesnesinin kendisini bekler.
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", GOOGLE_CONSENT_DEFAULT);
  const current = getConsent();
  if (current) window.gtag("consent", "update", googleConsentFor(current));
}

export function updateGoogleConsent(state: ConsentState) {
  window.gtag?.("consent", "update", googleConsentFor(state));
}

// --- Rıza geri cekilince bilinen ucuncu taraf cerezlerini temizleme ---
// Sonu "*" ile bitenler onek eslesmesi (orn. _ga_XXXX).
const ANALYTICS_COOKIES = ["_ga", "_ga_*", "_gid", "_gat", "_gat_*"];
const MARKETING_COOKIES = ["_fbp", "_fbc", "_gcl_*"];

function clearCookies(patterns: string[]) {
  const names = document.cookie
    .split("; ")
    .map((pair) => pair.split("=")[0])
    .filter((name) =>
      patterns.some((pattern) => (pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern))
    );
  if (names.length === 0) return;

  // Cerez hangi domain ile yazildiysa o domain ile silinebilir; GA/Pixel
  // genelde kok domaine (.bollmark.com) yazar.
  const host = location.hostname;
  const domains = ["", `; Domain=${host}`, `; Domain=.${host.replace(/^www\./, "")}`];
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
    }
  }
}
