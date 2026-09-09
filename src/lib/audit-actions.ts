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
  "ORDER_DELETED",
  "ORDER_RESTORED"
] as const;

export const auditActionLabel: Record<string, string> = {
  ORDER_STATUS_CHANGED: "Sipariş Durumu Değişti",
  RETURN_STATUS_CHANGED: "İade Durumu Değişti",
  PERSONEL_CREATED: "Personel Oluşturuldu",
  PERSONEL_UPDATED: "Personel Güncellendi",
  LOYALTY_ADJUSTED: "Sadakat Puanı Düzeltildi",
  ABANDONED_CART_REMINDER_SENT: "Sepet Hatırlatması Elle Gönderildi",
  KAMPANYA_OTOMATIK_OLUSTURULDU: "Otomatik Kampanya Oluşturuldu",
  ORDER_DELETED: "Sipariş Silindi",
  ORDER_RESTORED: "Sipariş Geri Yüklendi"
};
