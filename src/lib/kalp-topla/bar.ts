import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import type { Prisma } from "@/generated/prisma/client";
import { campaignStateFrom, getKalpSettings, type KalpCampaignState } from "./settings";
import { generateCouponCode } from "./coupons";
import { sendVerificationEmail } from "./email-verification";

// Kalp verme, geri cekme, PENDING -> ACTIVE ve tur kapanisi (KALP_TOPLA_PLANI.md
// 5.1-5.3). Bar sayimi atomiktir: her islem tek transaction'da, sabit kilit
// sirasiyla (Customer satiri -> KalpBar satiri, SELECT ... FOR UPDATE).
// Ayni bara es zamanli gelen kalpler bar kilidinde sirayla islenir; tur bu
// kilit altinda kapandigi icin cift sayim ya da cift kapanis olmaz.

type Tx = Prisma.TransactionClient;
type Settings = Awaited<ReturnType<typeof getKalpSettings>>;

const OPEN_STATUSES = ["PENDING", "ACTIVE"];
const RATE_LIMIT_PER_MINUTE = 20;
// Es zamanli kalplerde bar kilidi icin sira beklenir; varsayilan 5 sn dar.
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

export type KalpErrorCode = "NOT_FOUND" | "FROZEN" | "QUOTA" | "RATE" | "ROUND_CLOSED" | "NO_HEART";

export class KalpError extends Error {
  constructor(
    public code: KalpErrorCode,
    message: string
  ) {
    super(message);
  }
}

type ClosedRound = { roundId: string; productId: string; roundNo: number; threshold: number; isTest: boolean; coupons: number };

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

// Plan 5.1 madde 4: ilk kalpte bar/tur ayni anda iki istekte olusturulursa
// biri P2002 alir; islem bir kez bastan denenir (bar artik vardir).
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return run();
  }
}

// Gizli yayinda acilan tur test turudur ve test esigini kullanir (Y12);
// aksi halde guncel esik yalniz yeni turlara uygulanir (T16).
function newRoundParams(settings: Settings) {
  return settings.mode === "HIDDEN"
    ? { threshold: settings.testThreshold, isTest: true }
    : { threshold: settings.threshold, isTest: false };
}

async function lockCustomer(tx: Tx, customerId: string) {
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;
}

async function lockBar(tx: Tx, productId: string) {
  const rows = await tx.$queryRaw<{ currentRoundId: string; points: number }[]>`
    SELECT "currentRoundId", points FROM "KalpBar" WHERE "productId" = ${productId} FOR UPDATE`;
  return rows[0] ?? null;
}

// Bar yoksa ilk tur ile birlikte olusturulur. Urunun eski turlari varsa
// (test sifirlamasindan sonra) tur numarasi onlarin devamidir.
async function lockOrCreateBar(tx: Tx, productId: string, settings: Settings) {
  const existing = await lockBar(tx, productId);
  if (existing) return existing;
  const [last, closedRounds] = await Promise.all([
    tx.kalpRound.findFirst({ where: { productId }, orderBy: { roundNo: "desc" }, select: { roundNo: true } }),
    tx.kalpRound.count({ where: { productId, status: "CLOSED", isTest: false } })
  ]);
  const round = await tx.kalpRound.create({
    data: { productId, roundNo: (last?.roundNo ?? 0) + 1, ...newRoundParams(settings) }
  });
  await tx.kalpBar.create({ data: { productId, currentRoundId: round.id, points: 0, closedRounds } });
  return (await lockBar(tx, productId))!;
}

// Plan 5.2: bar kilidi altinda cagrilir. Puan turun esigine ulastiysa tur
// kapanir, ACTIVE kalpler WON olur ve her birine kupon yazilir, PENDING
// kalpler yeni tura tasinir, yeni tur 0 puanla acilir.
async function closeRoundIfFull(tx: Tx, productId: string, settings: Settings): Promise<ClosedRound | null> {
  const bar = await tx.kalpBar.findUniqueOrThrow({ where: { productId } });
  const round = await tx.kalpRound.findUniqueOrThrow({ where: { id: bar.currentRoundId } });
  if (bar.points < round.threshold) return null;

  const closedAt = new Date();
  const closed = await tx.kalpRound.updateMany({
    where: { id: round.id, status: "OPEN" },
    data: { status: "CLOSED", closedAt }
  });
  if (closed.count !== 1) return null;

  const winners = await tx.kalpHeart.findMany({ where: { roundId: round.id, status: "ACTIVE" }, select: { id: true, customerId: true } });
  await tx.kalpHeart.updateMany({ where: { roundId: round.id, status: "ACTIVE" }, data: { status: "WON", endedAt: closedAt } });

  const expiresAt = new Date(closedAt.getTime() + settings.couponHours * 60 * 60 * 1000);
  if (winners.length > 0) {
    await tx.kalpCoupon.createMany({
      data: winners.map((w) => ({
        code: generateCouponCode(),
        customerId: w.customerId,
        roundId: round.id,
        discountPercent: settings.discountPercent,
        expiresAt,
        isTest: round.isTest
      }))
    });
  }

  const next = await tx.kalpRound.create({
    data: { productId, roundNo: round.roundNo + 1, ...newRoundParams(settings) }
  });
  await tx.kalpHeart.updateMany({ where: { roundId: round.id, status: "PENDING" }, data: { roundId: next.id } });
  await tx.kalpBar.update({
    where: { productId },
    data: { currentRoundId: next.id, points: 0, closedRounds: { increment: round.isTest ? 0 : 1 } }
  });

  return { roundId: round.id, productId, roundNo: round.roundNo, threshold: round.threshold, isTest: round.isTest, coupons: winners.length };
}

async function auditClosedRounds(rounds: ClosedRound[]) {
  for (const r of rounds) {
    await logAudit({
      actorEmail: "sistem",
      actorRole: "SISTEM",
      action: "KALP_TOPLA_TUR_KAPANDI",
      targetType: "KalpRound",
      targetId: r.roundId,
      detail: `Ürün ${r.productId} · tur ${r.roundNo} · eşik ${r.threshold} · ${r.coupons} kupon${r.isTest ? " · test" : ""}`
    });
  }
}

async function assertProductInCampaign(productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "PUBLISHED", kalpToplaExcluded: false },
    select: { id: true }
  });
  if (!product) throw new KalpError("NOT_FOUND", "Bu ürün Kalp Topla'da değil.");
}

async function stateOrThrow(settings: Settings, customerId: string, allowFrozen: boolean): Promise<KalpCampaignState> {
  const state = await campaignStateFrom(settings, customerId);
  if (state === "INVISIBLE") throw new KalpError("NOT_FOUND", "Bulunamadı.");
  if (state === "FROZEN" && !allowFrozen) throw new KalpError("FROZEN", "Kampanya şu an duraklatıldı.");
  return state;
}

async function assertRateLimit(customerId: string) {
  const since = new Date(Date.now() - 60 * 1000);
  const recent = await prisma.kalpHeart.count({
    where: { customerId, OR: [{ createdAt: { gt: since } }, { status: "WITHDRAWN", endedAt: { gt: since } }] }
  });
  if (recent >= RATE_LIMIT_PER_MINUTE) throw new KalpError("RATE", "Çok fazla işlem yaptın, biraz sonra tekrar dene.");
}

// Plan 5.4: e-postasi dogrulanan uyenin PENDING kalpleri sirayla ACTIVE olur;
// her biri kendi barini kilitler, gerekirse tur kapanir. Kullanici karari
// (2026-10-30, Faz 4): kampanya o uye icin ACTIVE degilse kalpler bekler ve
// kampanya acikken uye bar/Kalplerim'i actiginda ya da kalp verdiginde sayilir.
export async function activatePendingHearts(customerId: string, known?: Settings): Promise<number> {
  const settings = known ?? (await getKalpSettings());
  if ((await campaignStateFrom(settings, customerId)) !== "ACTIVE") return 0;
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { emailVerifiedAt: true } });
  if (!customer?.emailVerifiedAt) return 0;

  const pending = await prisma.kalpHeart.findMany({
    where: { customerId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, productId: true }
  });
  const closedRounds: ClosedRound[] = [];
  let activated = 0;
  for (const heart of pending) {
    const result = await withRetry(() =>
      prisma.$transaction(async (tx) => {
        await lockCustomer(tx, customerId);
        const bar = await lockOrCreateBar(tx, heart.productId, settings);
        const claimed = await tx.kalpHeart.updateMany({
          where: { id: heart.id, status: "PENDING" },
          data: { status: "ACTIVE", roundId: bar.currentRoundId }
        });
        if (claimed.count !== 1) return { activated: false, closed: null };
        await tx.kalpBar.update({ where: { productId: heart.productId }, data: { points: { increment: 1 } } });
        return { activated: true, closed: await closeRoundIfFull(tx, heart.productId, settings) };
      }, TX_OPTIONS)
    );
    if (result.activated) activated += 1;
    if (result.closed) closedRounds.push(result.closed);
  }
  await auditClosedRounds(closedRounds);
  return activated;
}

async function hasPendingHearts(customerId: string) {
  return (await prisma.kalpHeart.count({ where: { customerId, status: "PENDING" } })) > 0;
}

export type GiveHeartResult = { status: "ACTIVE" | "PENDING"; created: boolean; isFirstHeart: boolean };

// Plan 5.1.
export async function giveHeart(customerId: string, productId: string): Promise<GiveHeartResult> {
  const settings = await getKalpSettings();
  await stateOrThrow(settings, customerId, false);
  await assertProductInCampaign(productId);
  await assertRateLimit(customerId);
  if (await hasPendingHearts(customerId)) await activatePendingHearts(customerId, settings);

  const result = await withRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockCustomer(tx, customerId);
      const customer = await tx.customer.findUniqueOrThrow({
        where: { id: customerId },
        select: { emailVerifiedAt: true }
      });
      const existing = await tx.kalpHeart.findFirst({
        where: { customerId, productId, status: { in: OPEN_STATUSES } },
        select: { status: true }
      });
      if (existing) {
        return { status: existing.status as "ACTIVE" | "PENDING", created: false, isFirstHeart: false, closed: null };
      }
      const open = await tx.kalpHeart.count({ where: { customerId, status: { in: OPEN_STATUSES } } });
      if (open >= settings.heartQuota) {
        throw new KalpError("QUOTA", `Aynı anda en fazla ${settings.heartQuota} ürüne kalp verebilirsin.`);
      }

      const bar = await lockOrCreateBar(tx, productId, settings);
      const status = customer.emailVerifiedAt ? "ACTIVE" : "PENDING";
      await tx.kalpHeart.create({ data: { customerId, productId, roundId: bar.currentRoundId, status } });
      let closed: ClosedRound | null = null;
      if (status === "ACTIVE") {
        await tx.kalpBar.update({ where: { productId }, data: { points: { increment: 1 } } });
        closed = await closeRoundIfFull(tx, productId, settings);
      }
      const total = await tx.kalpHeart.count({ where: { customerId } });
      return { status: status as "ACTIVE" | "PENDING", created: true, isFirstHeart: total === 1, closed };
    }, TX_OPTIONS)
  );

  if (result.closed) await auditClosedRounds([result.closed]);
  if (result.created && result.status === "PENDING") {
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, email: true, name: true } });
    if (customer) await sendVerificationEmail(customer, "KALP");
  }
  return { status: result.status, created: result.created, isFirstHeart: result.isFirstHeart };
}

// Plan 5.3 ve Y8: ACTIVE ya da FROZEN durumda. Bar kilitlendikten sonra kalp
// yeniden okunur: arada tur kapandiysa kalp WON olmustur ve geri cekilemez.
export async function withdrawHeart(customerId: string, productId: string): Promise<void> {
  const settings = await getKalpSettings();
  await stateOrThrow(settings, customerId, true);

  await prisma.$transaction(async (tx) => {
    await lockCustomer(tx, customerId);
    await lockBar(tx, productId);
    const heart = await tx.kalpHeart.findFirst({
      where: { customerId, productId, status: { in: OPEN_STATUSES } },
      select: { id: true, status: true }
    });
    if (!heart) {
      const won = await tx.kalpHeart.findFirst({ where: { customerId, productId, status: "WON" }, select: { id: true } });
      if (won) throw new KalpError("ROUND_CLOSED", "Bu tur doldu, kalbin kupona dönüştü.");
      throw new KalpError("NO_HEART", "Bu üründe geri çekilecek kalbin yok.");
    }
    await tx.kalpHeart.update({ where: { id: heart.id }, data: { status: "WITHDRAWN", endedAt: new Date() } });
    if (heart.status === "ACTIVE") {
      await tx.kalpBar.update({ where: { productId }, data: { points: { decrement: 1 } } });
    }
  }, TX_OPTIONS);
}

export type BarView = {
  state: KalpCampaignState;
  points: number;
  threshold: number;
  discountPercent: number;
  inviteBonus: number;
  couponHours: number;
  recentlyClosed: boolean;
  loggedIn: boolean;
  emailVerified: boolean;
  emailConsent: boolean;
  myHeart: "ACTIVE" | "PENDING" | null;
  wonCouponExpiresAt: string | null;
  quota: number;
  used: number;
};

// GET /api/kalp-topla/bar. Katilimci kimligi dondurmez (plan 5.10).
export async function getBarView(customerId: string | null, productId: string): Promise<BarView | null> {
  const settings = await getKalpSettings();
  const state = await campaignStateFrom(settings, customerId);
  if (state === "INVISIBLE") return null;
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "PUBLISHED", kalpToplaExcluded: false },
    select: { id: true }
  });
  if (!product) return null;

  if (customerId && state === "ACTIVE" && (await hasPendingHearts(customerId))) {
    await activatePendingHearts(customerId, settings);
  }

  const bar = await prisma.kalpBar.findUnique({ where: { productId } });
  const round = bar ? await prisma.kalpRound.findUnique({ where: { id: bar.currentRoundId } }) : null;
  const lastClosed = await prisma.kalpRound.findFirst({
    where: { productId, status: "CLOSED" },
    orderBy: { roundNo: "desc" },
    select: { id: true, closedAt: true }
  });
  const windowStart = Date.now() - settings.couponHours * 60 * 60 * 1000;

  const view: BarView = {
    state,
    points: bar?.points ?? 0,
    threshold: round?.threshold ?? newRoundParams(settings).threshold,
    discountPercent: settings.discountPercent,
    inviteBonus: settings.inviteBonus,
    couponHours: settings.couponHours,
    recentlyClosed: Boolean(lastClosed?.closedAt && lastClosed.closedAt.getTime() > windowStart),
    loggedIn: Boolean(customerId),
    emailVerified: false,
    emailConsent: false,
    myHeart: null,
    wonCouponExpiresAt: null,
    quota: settings.heartQuota,
    used: 0
  };
  if (!customerId) return view;

  const [customer, myHeart, used, coupon] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { emailVerifiedAt: true, marketingEmailAt: true } }),
    prisma.kalpHeart.findFirst({ where: { customerId, productId, status: { in: OPEN_STATUSES } }, select: { status: true } }),
    prisma.kalpHeart.count({ where: { customerId, status: { in: OPEN_STATUSES } } }),
    lastClosed
      ? prisma.kalpCoupon.findFirst({
          where: { customerId, roundId: lastClosed.id, status: "AVAILABLE", expiresAt: { gt: new Date() } },
          select: { expiresAt: true }
        })
      : null
  ]);
  view.emailVerified = Boolean(customer?.emailVerifiedAt);
  view.emailConsent = Boolean(customer?.marketingEmailAt);
  view.myHeart = (myHeart?.status as BarView["myHeart"]) ?? null;
  view.used = used;
  view.wonCouponExpiresAt = coupon?.expiresAt.toISOString() ?? null;
  return view;
}

// GET /api/kalp-topla/barlar: katalog rozetleri icin tek toplu sorgu.
export async function getBarsSummary(productIds: string[]) {
  const bars = await prisma.kalpBar.findMany({
    where: { productId: { in: productIds }, points: { gt: 0 } },
    select: { productId: true, points: true, currentRoundId: true }
  });
  if (bars.length === 0) return [];
  const [rounds, products] = await Promise.all([
    prisma.kalpRound.findMany({ where: { id: { in: bars.map((b) => b.currentRoundId) } }, select: { id: true, threshold: true } }),
    prisma.product.findMany({
      where: { id: { in: bars.map((b) => b.productId) }, status: "PUBLISHED", kalpToplaExcluded: false },
      select: { id: true }
    })
  ]);
  const thresholds = new Map(rounds.map((r) => [r.id, r.threshold]));
  const allowed = new Set(products.map((p) => p.id));
  return bars
    .filter((b) => allowed.has(b.productId) && thresholds.has(b.currentRoundId))
    .map((b) => ({ productId: b.productId, points: b.points, threshold: thresholds.get(b.currentRoundId)! }));
}
