import { prisma } from "@/lib/prisma";
import type { KalpToplaSettings } from "@/generated/prisma/client";

// Kalp Topla ayarlari ve kampanya durumu (KALP_TOPLA_PLANI.md 5.0, Y10, T14).

export type KalpMode = "OFF" | "HIDDEN" | "LIVE";
export type KalpCampaignState = "FROZEN" | "ACTIVE" | "INVISIBLE";

// Ayar satiri henuz yoksa (admin hic kaydetmediyse) semadaki varsayilanlar
// kullanilir; okuma sirasinda DB'ye satir yazilmaz.
export const KALP_DEFAULT_SETTINGS: Omit<KalpToplaSettings, "updatedAt"> = {
  id: "singleton",
  mode: "OFF",
  testerCustomerIds: [],
  threshold: 10,
  testThreshold: 2,
  discountPercent: 50,
  couponHours: 48,
  heartQuota: 3,
  inviteBonus: 2,
  refundExtraHours: 24,
  sameDeviceMaxAccounts: 1,
  sameIpWindowHours: 24,
  sameIpMinAccounts: 3
};

export async function getKalpSettings(): Promise<Omit<KalpToplaSettings, "updatedAt">> {
  const row = await prisma.kalpToplaSettings.findUnique({ where: { id: "singleton" } });
  return row ?? KALP_DEFAULT_SETTINGS;
}

// Plan 5.0 tablosu:
// - OFF + hic tur yok        -> herkese INVISIBLE
// - OFF (onceden acilmis)    -> herkese FROZEN
// - HIDDEN                   -> test hesabina ACTIVE, digerlerine INVISIBLE
// - LIVE                     -> herkese ACTIVE
export async function campaignStateFor(customerId: string | null): Promise<KalpCampaignState> {
  const settings = await getKalpSettings();
  if (settings.mode === "LIVE") return "ACTIVE";
  if (settings.mode === "HIDDEN") {
    return customerId && settings.testerCustomerIds.includes(customerId) ? "ACTIVE" : "INVISIBLE";
  }
  const anyRound = await prisma.kalpRound.findFirst({ select: { id: true } });
  return anyRound ? "FROZEN" : "INVISIBLE";
}
