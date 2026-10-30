import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { campaignStateFrom, getKalpSettings } from "./settings";
import { lockBar, lockCustomer, placeWaitingCredits } from "./bar";
import { waitingExpiry } from "./bonus";
import { parseInviteValue, reviewReasons } from "./invite-rules";
import { notifyInviteJoined } from "./notifications";

// Davet (KALP_TOPLA_PLANI.md 5.5, T2, T8, Y2, Y11, Y13). Cihaz ve IP kurallari
// uyeligi, kalbi ya da kuponu engellemez; yalniz +2 bonusunun durumunu belirler.

const DEVICE_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

// Kupon kodlariyla ayni alfabe; kisi basi tek, tahmin edilemeyen kod (plan 5.10).
export function generateInviteCode(): string {
  let code = "";
  for (const byte of randomBytes(CODE_LENGTH)) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

// Ilk ihtiyacta uretilir (plan 4.1).
export async function ensureReferralCode(customerId: string): Promise<string> {
  const existing = await prisma.customer.findUnique({ where: { id: customerId }, select: { referralCode: true } });
  if (existing?.referralCode) return existing.referralCode;
  // Kosullu yazim: es zamanli istekte ilk yazilan kod kalir.
  await prisma.customer.updateMany({ where: { id: customerId, referralCode: null }, data: { referralCode: generateInviteCode() } });
  const row = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { referralCode: true } });
  return row.referralCode!;
}

// Yayinda ve kampanyada degilse urun yok sayilir; davet yine gecerlidir.
export async function campaignProductId(productId: string | null): Promise<string | null> {
  if (!productId) return null;
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "PUBLISHED", kalpToplaExcluded: false },
    select: { id: true }
  });
  return product?.id ?? null;
}

// Kod gecerli ve kampanya davet eden icin gorunur olmali (Gizli yayinda yalniz
// test hesaplari, plan 5.5). Musteri tablosunda pasiflik alani yoktur.
export async function resolveInviter(code: string) {
  const inviter = await prisma.customer.findUnique({ where: { referralCode: code }, select: { id: true } });
  if (!inviter) return null;
  const state = await campaignStateFrom(await getKalpSettings(), inviter.id);
  return state === "INVISIBLE" ? null : inviter;
}

// Y12: Gizli yayinda ya da kampanya hic herkese acilmadan kapatildiysa test verisidir.
async function isTestInvite(mode: string) {
  if (mode === "LIVE") return false;
  if (mode === "HIDDEN") return true;
  return !(await prisma.kalpRound.findFirst({ where: { isTest: false }, select: { id: true } }));
}

// Plan 5.5: yalniz yeni kayitta. Cerez ya da gizli alan istemciden gelir,
// bu yuzden kod, davet eden ve urun burada yeniden dogrulanir.
export async function createInviteOnSignup(customerId: string, rawInvite: string | null | undefined) {
  const parsed = parseInviteValue(rawInvite);
  if (!parsed) return;
  const inviter = await resolveInviter(parsed.code);
  if (!inviter || inviter.id === customerId) return;

  const [productId, settings] = await Promise.all([campaignProductId(parsed.productId), getKalpSettings()]);
  const isTest = await isTestInvite(settings.mode);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.customer.updateMany({
      where: { id: customerId, referredById: null },
      data: { referredById: inviter.id }
    });
    if (claimed.count !== 1) return;
    await tx.kalpInvite.create({ data: { inviterId: inviter.id, inviteeId: customerId, productId, isTest } });
  });
}

async function signupOf(customerId: string) {
  return prisma.customerDevice.findFirst({
    where: { customerId, event: "SIGNUP" },
    orderBy: { createdAt: "desc" },
    select: { deviceId: true, ipHash: true, createdAt: true }
  });
}

// Y2 cihaz kurallari. Kayit cihazi bilinmiyorsa neden uretilmez.
async function deviceReviewReasons(inviteeId: string, inviterId: string, deviceId: string | undefined, maxAccounts: number) {
  if (!deviceId) return [];
  const since = new Date(Date.now() - DEVICE_WINDOW_DAYS * DAY_MS);
  const [others, inviterSeen] = await Promise.all([
    prisma.customerDevice.findMany({
      where: { deviceId, event: "SIGNUP", customerId: { not: inviteeId }, createdAt: { gte: since } },
      distinct: ["customerId"],
      select: { customerId: true }
    }),
    prisma.customerDevice.count({ where: { deviceId, customerId: inviterId } })
  ]);
  return reviewReasons({
    otherAccountsOnDevice: others.length,
    sameDeviceMaxAccounts: maxAccounts,
    inviterSeenOnDevice: inviterSeen > 0
  });
}

// Y2/Y13: esik asilirsa yalniz isaret; onceki hesaplarin durumu ve bonusu degismez.
async function flagSameIp(signup: { ipHash: string | null; createdAt: Date } | null, windowHours: number, minAccounts: number) {
  if (!signup?.ipHash) return;
  const rows = await prisma.customerDevice.findMany({
    where: {
      ipHash: signup.ipHash,
      event: "SIGNUP",
      createdAt: { gte: new Date(signup.createdAt.getTime() - windowHours * 60 * 60 * 1000), lte: signup.createdAt }
    },
    distinct: ["customerId"],
    select: { customerId: true }
  });
  if (rows.length < minAccounts) return;
  await prisma.kalpInvite.updateMany({
    where: { inviteeId: { in: rows.map((r) => r.customerId) }, sameIpFlagAt: null },
    data: { sameIpFlagAt: new Date() }
  });
}

async function createRootCredit(invite: { id: string; inviterId: string; isTest: boolean }, points: number) {
  await prisma.kalpBonusCredit.create({
    data: { inviteId: invite.id, customerId: invite.inviterId, points, status: "WAITING", expiresAt: waitingExpiry(), isTest: invite.isTest }
  });
}

// Plan 5.5: davetli e-postasini dogruladiginda bir kez calisir. Durum kosullu
// guncellemeyle alinir; es zamanli ikinci cagri hicbir sey yapmaz.
export async function processInviteOnVerification(inviteeId: string) {
  const invite = await prisma.kalpInvite.findFirst({ where: { inviteeId, status: "PENDING_VERIFICATION" } });
  if (!invite) return;

  const settings = await getKalpSettings();
  const inviter = await prisma.customer.findUnique({
    where: { id: invite.inviterId },
    select: { id: true, inviteTargetProductId: true }
  });
  const state = inviter ? await campaignStateFrom(settings, inviter.id) : "INVISIBLE";
  if (!inviter || state === "INVISIBLE" || inviter.id === inviteeId) {
    await prisma.kalpInvite.updateMany({
      where: { id: invite.id, status: "PENDING_VERIFICATION" },
      data: { status: "CANCELLED", reviewReasons: ["INVITER_INELIGIBLE"], verifiedAt: new Date() }
    });
    return;
  }

  const signup = await signupOf(inviteeId);
  const reasons = await deviceReviewReasons(inviteeId, inviter.id, signup?.deviceId, settings.sameDeviceMaxAccounts);
  // Linkte urun yoksa genel linkin hedefi; ikisi de kredi olusurken dogrulanir.
  const productId = await campaignProductId(invite.productId ?? inviter.inviteTargetProductId);

  const claimed = await prisma.kalpInvite.updateMany({
    where: { id: invite.id, status: "PENDING_VERIFICATION" },
    data: { status: reasons.length > 0 ? "UNDER_REVIEW" : "CREDITED", reviewReasons: reasons, verifiedAt: new Date(), productId }
  });
  if (claimed.count !== 1) return;

  await flagSameIp(signup, settings.sameIpWindowHours, settings.sameIpMinAccounts);
  if (reasons.length > 0) return;
  await createRootCredit(invite, settings.inviteBonus);
  await placeWaitingCredits(inviter.id, settings);
  await notifyInviteJoined(invite, settings.inviteBonus);
}

type AdminActor = { actorEmail: string; actorRole: string };

// Plan 5.5: onay anindaki duruma gore T4 sirasiyla yerlesir (Y5).
export async function approveInvite(inviteId: string, actor: AdminActor): Promise<boolean> {
  const invite = await prisma.kalpInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return false;
  const claimed = await prisma.kalpInvite.updateMany({
    where: { id: inviteId, status: "UNDER_REVIEW" },
    data: { status: "CREDITED", reviewedByEmail: actor.actorEmail, reviewedAt: new Date() }
  });
  if (claimed.count !== 1) return false;
  const settings = await getKalpSettings();
  await createRootCredit(invite, settings.inviteBonus);
  await placeWaitingCredits(invite.inviterId, settings);
  await notifyInviteJoined(invite, settings.inviteBonus);
  await logAudit({ ...actor, action: "KALP_TOPLA_DAVET_ONAYLANDI", targetType: "KalpInvite", targetId: inviteId, detail: `+${settings.inviteBonus} bonus` });
  return true;
}

// Plan 5.5, Y11: bekleyen kisim iptal, acik bardaki kisim bardan duser, kapanmis
// tura dokunulmaz (kupon geri alinmaz). Kilit sirasi: davet eden -> barlar (urun
// sirasiyla, iki iptal birbirini beklemesin).
export async function cancelInvite(inviteId: string, note: string, actor: AdminActor): Promise<boolean> {
  const invite = await prisma.kalpInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return false;

  const removed = await prisma.$transaction(async (tx) => {
    await lockCustomer(tx, invite.inviterId);
    const claimed = await tx.kalpInvite.updateMany({
      where: { id: inviteId, status: { in: ["UNDER_REVIEW", "CREDITED"] } },
      data: { status: "CANCELLED", reviewedByEmail: actor.actorEmail, reviewedAt: new Date() }
    });
    if (claimed.count !== 1) return null;

    const applied = await tx.kalpBonusCredit.findMany({
      where: { inviteId, status: "APPLIED" },
      select: { id: true, points: true, roundId: true }
    });
    const rounds = await tx.kalpRound.findMany({
      where: { id: { in: applied.flatMap((c) => (c.roundId ? [c.roundId] : [])) } },
      select: { id: true, productId: true },
      orderBy: { productId: "asc" }
    });
    let points = 0;
    for (const round of rounds) {
      await lockBar(tx, round.productId);
      const credits = applied.filter((c) => c.roundId === round.id);
      const sum = credits.reduce((total, c) => total + c.points, 0);
      await tx.kalpBar.update({ where: { productId: round.productId }, data: { points: { decrement: sum } } });
      points += sum;
    }
    await tx.kalpBonusCredit.updateMany({ where: { inviteId, status: { in: ["WAITING", "APPLIED"] } }, data: { status: "CANCELLED" } });
    return points;
  }, { maxWait: 10_000, timeout: 20_000 });
  if (removed === null) return false;

  await logAudit({
    ...actor,
    action: "KALP_TOPLA_DAVET_IPTAL",
    targetType: "KalpInvite",
    targetId: inviteId,
    detail: `Bardan düşen: ${removed}${note ? ` · ${note}` : ""}`
  });
  return true;
}
