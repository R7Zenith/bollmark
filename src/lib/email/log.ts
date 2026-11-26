// Musteriye giden e-postalarin turleri (EmailLog.kind, admin > Giden Mailler).
// sendMail'e `log` verilen cagrilar kaydedilir; admin bildirimleri verilmez
// (istisna: yeni iade talebi, IADE_TALEBI_SISTEMI_PLANI.md 5).

export const EMAIL_KINDS = [
  "ORDER_RECEIVED",
  "ORDER_STATUS",
  "REFUND",
  "RETURN_STATUS",
  "RETURN_RECEIVED",
  "RETURN_REPLY",
  "RETURN_ADMIN_NEW",
  "VERIFICATION",
  "ABANDONED_CART",
  "RESTOCK",
  "KALP_TOPLA"
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const emailKindLabel: Record<EmailKind, string> = {
  ORDER_RECEIVED: "Sipariş alındı",
  ORDER_STATUS: "Sipariş durumu",
  REFUND: "İade yapıldı",
  RETURN_STATUS: "İade talebi",
  RETURN_RECEIVED: "İade talebi alındı",
  RETURN_REPLY: "İade talebine yanıt",
  RETURN_ADMIN_NEW: "Yeni iade talebi (admin)",
  VERIFICATION: "E-posta doğrulama",
  ABANDONED_CART: "Sepet hatırlatma",
  RESTOCK: "Tekrar stokta",
  KALP_TOPLA: "Kalp Topla bildirimi"
};

export function isEmailKind(value: string): value is EmailKind {
  return (EMAIL_KINDS as readonly string[]).includes(value);
}

// Kayitlar bu sureden sonra gunluk temizlikte silinir (kullanici karari, 2026-11-08).
export const EMAIL_LOG_RETENTION_DAYS = 30;
