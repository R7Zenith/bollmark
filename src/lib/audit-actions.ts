// audit-log.ts'den ayri tutulur cunku o dosya prisma'yi (dolayisiyla Neon
// driver'ini) import ediyor - client bilesenlerinde (filtre/tablo) sadece bu
// sabitler gerekiyor, prisma'nin client bundle'a sizmasini engellemek icin.
export const auditActions = [
  "ORDER_STATUS_CHANGED",
  "RETURN_STATUS_CHANGED",
  "PERSONEL_CREATED",
  "PERSONEL_UPDATED",
  "LOYALTY_ADJUSTED",
  "ABANDONED_CART_REMINDER_SENT",
  "KAMPANYA_OTOMATIK_OLUSTURULDU",
  "KAMPANYA_KAPSAM_DEGISTIRILDI",
  "ORDER_DELETED",
  "ORDER_RESTORED",
  "CONTACT_MESSAGE_STATUS_CHANGED",
  "CONTACT_MESSAGE_DELETED",
  "PAYMENT_SETTINGS_CHANGED",
  "PAYMENT_MODE_CHANGED",
  "PAYMENT_CONNECTION_TESTED",
  "PAYMENT_REFUND_CREATED",
  "PAYMENT_CANCEL_CREATED",
  "PAYMENT_MANUAL_RECONCILE",
  "PAYMENT_ATTENTION_CLEARED",
  "PAYMENT_REFUND_RESOLVED"
] as const;

export const auditActionLabel: Record<string, string> = {
  ORDER_STATUS_CHANGED: "Sipariş Durumu Değişti",
  RETURN_STATUS_CHANGED: "İade Durumu Değişti",
  PERSONEL_CREATED: "Personel Oluşturuldu",
  PERSONEL_UPDATED: "Personel Güncellendi",
  LOYALTY_ADJUSTED: "Sadakat Puanı Düzeltildi",
  ABANDONED_CART_REMINDER_SENT: "Sepet Hatırlatması Elle Gönderildi",
  KAMPANYA_OTOMATIK_OLUSTURULDU: "Otomatik Kampanya Oluşturuldu",
  KAMPANYA_KAPSAM_DEGISTIRILDI: "Kampanya Kapsamı Değiştirildi",
  ORDER_DELETED: "Sipariş Silindi",
  ORDER_RESTORED: "Sipariş Geri Yüklendi",
  CONTACT_MESSAGE_STATUS_CHANGED: "Mesaj Durumu Değişti",
  CONTACT_MESSAGE_DELETED: "Mesaj Silindi",
  PAYMENT_SETTINGS_CHANGED: "Sanal POS Ayarları Değişti",
  PAYMENT_MODE_CHANGED: "Sanal POS Modu Değişti",
  PAYMENT_CONNECTION_TESTED: "Sanal POS Bağlantı Testi",
  PAYMENT_REFUND_CREATED: "Ödeme İadesi Yapıldı",
  PAYMENT_CANCEL_CREATED: "Ödeme İptal Edildi",
  PAYMENT_MANUAL_RECONCILE: "Ödeme Durumu Elle Sorgulandı",
  PAYMENT_ATTENTION_CLEARED: "Ödeme Uyarısı Kapatıldı",
  PAYMENT_REFUND_RESOLVED: "Belirsiz İade Kaydı Sonuçlandırıldı"
};
