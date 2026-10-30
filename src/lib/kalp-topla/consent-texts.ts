// Pazarlama onayi metinleri ve surumleri (KALP_TOPLA_PLANI.md T3, 4.2
// MarketingConsentLog.textVersion). Metin degisirse surum de degismeli: onay
// kaydi hangi metne onay verildigini ispatlar.
export const CONSENT_TEXTS = {
  EMAIL: {
    version: "EMAIL-2026-10-30",
    text: "Kalp Topla ve kampanya bildirimlerini e-postayla almak istiyorum."
  },
  PUSH: {
    version: "PUSH-2026-10-31",
    text: "Kalp Topla bildirimlerini tarayıcımdan almak istiyorum."
  },
  WHATSAPP: {
    version: "WHATSAPP-2026-10-30",
    text: "WhatsApp'tan kampanya bildirimi almak istiyorum."
  }
} as const;

// Kullanici karari (2026-10-31): kalp veren uyeye e-posta sorulmadan acilir, urun
// sayfasindaki not bu metindir. Onay kaydi gercek kaynagini ve bu surumu tasir.
export const HEART_EMAIL_NOTICE = {
  version: "EMAIL-KALP-2026-10-31",
  text: "Kalp verince bar ve kupon haberlerini e-postayla alırsın. İstediğin an tek tıkla çıkabilirsin."
} as const;

export type ConsentChannel = keyof typeof CONSENT_TEXTS;
export type ConsentSource = "KAYIT_FORMU" | "HESAP_AYARLARI" | "KALP_PENCERESI" | "KALP_VERME" | "ABONELIK_IPTAL_LINKI";
