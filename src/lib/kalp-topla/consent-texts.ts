// Pazarlama onayi metinleri ve surumleri (KALP_TOPLA_PLANI.md T3, 4.2
// MarketingConsentLog.textVersion). Metin degisirse surum de degismeli: onay
// kaydi hangi metne onay verildigini ispatlar.
export const CONSENT_TEXTS = {
  EMAIL: {
    version: "EMAIL-2026-10-30",
    text: "Kalp Topla ve kampanya bildirimlerini e-postayla almak istiyorum."
  },
  WHATSAPP: {
    version: "WHATSAPP-2026-10-30",
    text: "WhatsApp'tan kampanya bildirimi almak istiyorum."
  }
} as const;

export type ConsentChannel = keyof typeof CONSENT_TEXTS;
export type ConsentSource = "KAYIT_FORMU" | "HESAP_AYARLARI" | "KALP_PENCERESI" | "ABONELIK_IPTAL_LINKI";
