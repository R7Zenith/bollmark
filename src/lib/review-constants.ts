// audit-actions.ts / loyalty-constants.ts ile ayni gerekce: prisma import
// eden dosyalardan (reviews.ts) ayri tutulur ki client bilesenlere
// (yorum formu, admin tablosu) prisma/Neon sizmasin.
export const reviewStatuses = ["BEKLIYOR", "ONAYLANDI", "REDDEDILDI"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const reviewStatusLabel: Record<ReviewStatus, string> = {
  BEKLIYOR: "Bekliyor",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi"
};

export const reviewStatusTone: Record<ReviewStatus, "yellow" | "green" | "red"> = {
  BEKLIYOR: "yellow",
  ONAYLANDI: "green",
  REDDEDILDI: "red"
};
