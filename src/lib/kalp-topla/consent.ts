import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { CONSENT_TEXTS, type ConsentChannel, type ConsentSource } from "./consent-texts";

// Pazarlama onayi ver / geri cek (KALP_TOPLA_PLANI.md T3, Y3). Her gercek
// degisiklik Customer alanina ve MarketingConsentLog'a (ham IP + metin surumu)
// birlikte yazilir; durum degismiyorsa hicbir sey yazilmaz.
const FIELD: Record<ConsentChannel, "marketingEmailAt" | "marketingWhatsappAt"> = {
  EMAIL: "marketingEmailAt",
  WHATSAPP: "marketingWhatsappAt"
};

export async function setMarketingConsent(params: {
  customerId: string;
  channel: ConsentChannel;
  granted: boolean;
  source: ConsentSource;
  ip: string | null;
}): Promise<boolean> {
  const field = FIELD[params.channel];
  const customer = await prisma.customer.findUnique({
    where: { id: params.customerId },
    select: { email: true, marketingEmailAt: true, marketingWhatsappAt: true }
  });
  if (!customer) return false;
  if (Boolean(customer[field]) === params.granted) return false;

  const now = new Date();
  await prisma.$transaction([
    prisma.customer.update({ where: { id: params.customerId }, data: { [field]: params.granted ? now : null } }),
    prisma.marketingConsentLog.create({
      data: {
        customerId: params.customerId,
        email: customer.email,
        channel: params.channel,
        granted: params.granted,
        source: params.source,
        ip: params.ip,
        textVersion: CONSENT_TEXTS[params.channel].version,
        createdAt: now
      }
    })
  ]);
  return true;
}

// Abonelikten cikma linki (plan 6.10, 7.3): girissiz, suresiz, HMAC imzali.
// Token = musteriId.imza; anahtar UNSUBSCRIBE_SECRET env'inde.
function sign(customerId: string, secret: string): string {
  return createHmac("sha256", secret).update(`abonelik-iptal:${customerId}`).digest("base64url");
}

export function createUnsubscribeToken(customerId: string, secret = process.env.UNSUBSCRIBE_SECRET): string {
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET tanımlı değil.");
  return `${customerId}.${sign(customerId, secret)}`;
}

export function verifyUnsubscribeToken(token: string, secret = process.env.UNSUBSCRIBE_SECRET): string | null {
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const customerId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(customerId, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? customerId : null;
}

export function unsubscribeUrl(customerId: string): string {
  return `${getSiteUrl()}/abonelik/iptal?t=${encodeURIComponent(createUnsubscribeToken(customerId))}`;
}

// Y3: onay su an GERI CEKILMIS durumdaysa ve geri cekme kaydi 3 yildan
// eskiyse, o musteri+kanalin o tarihe kadarki IP'leri silinir. Girdi her
// musteri+kanal icin EN SON kayit olmali.
export function consentGroupsToPurge<T extends { granted: boolean; createdAt: Date }>(latestPerGroup: T[], now: Date): T[] {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 3);
  return latestPerGroup.filter((row) => !row.granted && row.createdAt < cutoff);
}
