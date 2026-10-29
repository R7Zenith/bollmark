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
// Kullanici karari (2026-10-30, Faz 4): OFF'ta yalniz test turu varsa
// (kampanya hic herkese acilmamis) yalniz test hesaplari FROZEN gorur.
export async function campaignStateFor(customerId: string | null): Promise<KalpCampaignState> {
  return campaignStateFrom(await getKalpSettings(), customerId);
}

export async function campaignStateFrom(
  settings: Pick<KalpToplaSettings, "mode" | "testerCustomerIds">,
  customerId: string | null
): Promise<KalpCampaignState> {
  const isTester = Boolean(customerId && settings.testerCustomerIds.includes(customerId));
  if (settings.mode === "LIVE") return "ACTIVE";
  if (settings.mode === "HIDDEN") return isTester ? "ACTIVE" : "INVISIBLE";
  const anyRound = await prisma.kalpRound.findFirst({
    where: isTester ? {} : { isTest: false },
    select: { id: true }
  });
  return anyRound ? "FROZEN" : "INVISIBLE";
}
