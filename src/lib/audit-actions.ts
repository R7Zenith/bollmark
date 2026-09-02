// audit-log.ts'den ayri tutulur cunku o dosya prisma'yi (dolayisiyla Neon
// driver'ini) import ediyor - client bilesenlerinde (filtre/tablo) sadece bu
// sabitler gerekiyor, prisma'nin client bundle'a sizmasini engellemek icin.
export const auditActions = [
  "ORDER_STATUS_CHANGED",
  "RETURN_STATUS_CHANGED",
  "PERSONEL_CREATED",
  "PERSONEL_UPDATED",
  "LOYALTY_ADJUSTED"
] as const;

export const auditActionLabel: Record<string, string> = {
  ORDER_STATUS_CHANGED: "Sipariş Durumu Değişti",
  RETURN_STATUS_CHANGED: "İade Durumu Değişti",
  PERSONEL_CREATED: "Personel Oluşturuldu",
  PERSONEL_UPDATED: "Personel Güncellendi",
  LOYALTY_ADJUSTED: "Sadakat Puanı Düzeltildi"
};
