import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { emailImageUrl, emailSiteUrl } from "@/lib/email/layout";
import {
  pickVerificationTemplate,
  verificationKalpEmail,
  verificationPlainEmail,
  verificationSignupEmail,
  type CampaignNumbers,
  type HeartProduct,
  type VerificationCommon
} from "@/lib/email/verification-emails";
import { campaignStateFrom, currentThreshold, getKalpSettings } from "./settings";
import { loadVitrin } from "./vitrin";

// E-posta dogrulama (KALP_TOPLA_PLANI.md 5.4): 32 bayt token, DB'de yalniz
// SHA-256 ozeti, 24 saat gecerli, tek kullanimlik. Ayni uyeye 10 dakikada en
// cok bir e-posta gider.
export const TOKEN_HOURS = 24;
const RESEND_MINUTES = 10;

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Uyelik e-postasindaki (15) 3 urun, kullanicinin sectigi sirayla: kadin kaban,
// erkek deri ceket, simli kazak. Biri yayinda/stokta/kampanyada degilse yerine
// Kalp Topla vitrinindeki siradaki uygun urun gelir.
export const SIGNUP_EMAIL_PRODUCT_SLUGS = [
  "cepli-d--meli-uzun-kollu-kruvaze-uzun-ka-e-kaban",
  "uzun-kollu-fermuarlı-cepli-gömlek-yaka-klasik-suni-deri-ceket",
  "kay-k-yaka-pullu-simli-triko-kazak"
];

type Settings = Awaited<ReturnType<typeof getKalpSettings>>;

const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
  optionImages: { orderBy: { position: "asc" }, take: 1, select: { url: true } }
} as const;

type CardProduct = { id: string; slug: string; name: string; images: { url: string }[]; optionImages: { url: string }[] };

// Urunlerin o anki bar durumu; bari olmayan urun 0 puan ve yeni tur esigiyle. Yalniz okur.
async function toHeartProducts(products: CardProduct[], settings: Settings, siteUrl: string): Promise<HeartProduct[]> {
  const bars = await prisma.kalpBar.findMany({
    where: { productId: { in: products.map((p) => p.id) } },
    select: { productId: true, points: true, currentRoundId: true }
  });
  const rounds = await prisma.kalpRound.findMany({ where: { id: { in: bars.map((b) => b.currentRoundId) } }, select: { id: true, threshold: true } });
  const thresholds = new Map(rounds.map((r) => [r.id, r.threshold]));
  const barByProduct = new Map(bars.map((b) => [b.productId, b]));
  return products.map((p) => {
    const bar = barByProduct.get(p.id);
    return {
      name: p.name,
      imageUrl: emailImageUrl(p.images[0]?.url ?? p.optionImages[0]?.url ?? null),
      url: `${siteUrl}/urunler/${encodeURIComponent(p.slug)}`,
      points: bar?.points ?? 0,
      threshold: (bar && thresholds.get(bar.currentRoundId)) || currentThreshold(settings)
    };
  });
}

// 14'teki kart: kalp verilen urun. Bulunamazsa null (kart gizlenir). Yalniz okur.
export async function loadKalpProductCard(productId: string | undefined, settings: Settings, siteUrl: string): Promise<HeartProduct | null> {
  if (!productId) return null;
  const product = await prisma.product.findUnique({ where: { id: productId }, select: productCardSelect });
  if (!product) return null;
  return (await toHeartProducts([product], settings, siteUrl))[0];
}

// 15'teki 3 urun. Yayinda, kampanyada ve stokta olanlar; eksik kalirsa vitrinden tamamlanir. Yalniz okur.
export async function loadSignupProducts(settings: Settings, siteUrl: string): Promise<HeartProduct[]> {
  const eligible = { status: "PUBLISHED", kalpToplaExcluded: false, variants: { some: { stock: { gt: 0 } } } };
  const picked = await prisma.product.findMany({ where: { ...eligible, slug: { in: SIGNUP_EMAIL_PRODUCT_SLUGS } }, select: productCardSelect });
  const chosen = SIGNUP_EMAIL_PRODUCT_SLUGS.flatMap((slug) => picked.filter((p) => p.slug === slug));
  if (chosen.length < SIGNUP_EMAIL_PRODUCT_SLUGS.length) {
    const vitrin = await loadVitrin();
    const ids = [...new Set([...vitrin.near, ...vitrin.top].map((v) => v.productId))].filter((id) => !chosen.some((c) => c.id === id));
    const extra = await prisma.product.findMany({ where: { ...eligible, id: { in: ids } }, select: productCardSelect });
    for (const id of ids) {
      const product = extra.find((p) => p.id === id);
      if (product && chosen.length < SIGNUP_EMAIL_PRODUCT_SLUGS.length) chosen.push(product);
    }
  }
  return toHeartProducts(chosen, settings, siteUrl);
}

export function campaignNumbers(settings: Settings): CampaignNumbers {
  return {
    threshold: currentThreshold(settings),
    discountPercent: settings.discountPercent,
    couponHours: settings.couponHours,
    inviteBonus: settings.inviteBonus
  };
}

// Kampanya bu uye icin acik degilse (plan 5.0 durumu ACTIVE degil) sade tasarim (06);
// aciksa kalp verince 14, normal uyelikte 15. "KALP": dogrulanmamis uye kalp verince
// (productId: kalp verilen urun, kartta gosterilir).
export async function sendVerificationEmail(
  customer: {
    id: string;
    email: string;
    name: string;
  },
  purpose: "KAYIT" | "KALP" = "KAYIT",
  productId?: string
): Promise<"sent" | "throttled"> {
  const recent = await prisma.emailVerificationToken.findFirst({
    where: { customerId: customer.id, createdAt: { gt: new Date(Date.now() - RESEND_MINUTES * 60 * 1000) } },
    select: { id: true }
  });
  if (recent) return "throttled";

  const token = randomBytes(32).toString("base64url");
  await prisma.emailVerificationToken.create({
    data: {
      customerId: customer.id,
      tokenHash: hashVerificationToken(token),
      expiresAt: new Date(Date.now() + TOKEN_HOURS * 60 * 60 * 1000)
    }
  });

  const siteUrl = emailSiteUrl();
  const common: VerificationCommon = {
    siteUrl,
    firstName: customer.name.trim().split(/\s+/)[0] ?? "",
    verifyUrl: `${siteUrl}/hesap/dogrula?token=${token}`,
    tokenHours: TOKEN_HOURS
  };
  let email = verificationPlainEmail(common);
  try {
    const settings = await getKalpSettings();
    const template = pickVerificationTemplate((await campaignStateFrom(settings, customer.id)) === "ACTIVE", purpose);
    if (template === "KALP_KAMPANYA") {
      email = verificationKalpEmail(common, campaignNumbers(settings), await loadKalpProductCard(productId, settings, siteUrl));
    } else if (template === "UYELIK_KAMPANYA") {
      email = verificationSignupEmail(common, campaignNumbers(settings), await loadSignupProducts(settings, siteUrl));
    }
  } catch (error) {
    // Kampanya verisi okunamazsa dogrulama yine gider (sade tasarimla).
    console.error("Kampanya dogrulama e-postasi hazirlanamadi, sade surum gidiyor:", error);
  }
  await sendMail({ to: customer.email, ...email });
  return "sent";
}

export type VerifyResult = "verified" | "already" | "expired" | "invalid";

export async function verifyEmailToken(token: string): Promise<{ result: VerifyResult; customerId?: string }> {
  if (!token) return { result: "invalid" };
  const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashVerificationToken(token) } });
  if (!row) return { result: "invalid" };
  if (row.usedAt) return { result: "already", customerId: row.customerId };
  if (row.expiresAt < new Date()) return { result: "expired", customerId: row.customerId };

  const now = new Date();
  const used = await prisma.$transaction(async (tx) => {
    // Kosullu guncelleme: ayni token'la es zamanli iki istekten yalniz biri kullanir.
    const claim = await tx.emailVerificationToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claim.count === 0) return false;
    await tx.customer.updateMany({ where: { id: row.customerId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
    return true;
  });
  return { result: used ? "verified" : "already", customerId: row.customerId };
}
