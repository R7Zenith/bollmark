import type { Prisma } from "@/generated/prisma/client";

// Davet bonusu kredileri (KALP_TOPLA_PLANI.md 5.6.1, T4, Y5, Y11). Kredi tek
// satirdir ve tek bir yerde durur: WAITING -> APPLIED gecisi kosullu guncellemeyle
// yapilir, ayni kredi iki kez yerlesemez. Davet basina tek kok kredi ve kredi
// basina tek bolunme veritabaninda benzersiz indeksle de garantidir.

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
export const BONUS_WAITING_DAYS = 30;

export function waitingExpiry(from = new Date()): Date {
  return new Date(from.getTime() + BONUS_WAITING_DAYS * DAY_MS);
}

export type TargetHeart = { heartId: string; productId: string; left: number; createdAt: Date };

// T4: once linkin urunundeki aktif kalp, yoksa dolmaya en yakin bar (esitlikte en eski kalp).
export function chooseTargetHeart(hearts: TargetHeart[], preferredProductId: string | null): TargetHeart | null {
  const preferred = hearts.find((h) => h.productId === preferredProductId);
  if (preferred) return preferred;
  return [...hearts].sort((a, b) => a.left - b.left || a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null;
}

export type Allocation<T> = {
  applied: T[];
  // Bar bu krediyle dolar: keep puani bara girer, rest puani yeni bekleyen kredi olur (Y11).
  split: { credit: T; keep: number; rest: number } | null;
  // Bara hic girmeyenler: bekler, 30 gunu bastan baslar (plan 10.2).
  returned: T[];
};

export function allocateCredits<T extends { points: number }>(credits: T[], room: number): Allocation<T> {
  const result: Allocation<T> = { applied: [], split: null, returned: [] };
  let left = room;
  for (const credit of credits) {
    if (left <= 0) result.returned.push(credit);
    else if (credit.points <= left) {
      result.applied.push(credit);
      left -= credit.points;
    } else {
      result.split = { credit, keep: left, rest: credit.points - left };
      left = 0;
    }
  }
  return result;
}

export type WaitingCredit = { id: string; points: number; inviteId: string; customerId: string; isTest: boolean };

export function readWaitingCredits(tx: Tx, customerId: string): Promise<WaitingCredit[]> {
  return tx.kalpBonusCredit.findMany({
    where: { customerId, status: "WAITING", expiresAt: { gt: new Date() } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, points: true, inviteId: true, customerId: true, isTest: true }
  });
}

// Bar kilidi altinda cagrilir. Eklenen puani dondurur; tur kapanisi cagirana aittir.
export async function applyCreditsToBar(
  tx: Tx,
  bar: { productId: string; heartId: string; roundId: string; room: number },
  credits: WaitingCredit[]
): Promise<number> {
  const { applied, split, returned } = allocateCredits(credits, bar.room);
  const target = { status: "APPLIED", heartId: bar.heartId, roundId: bar.roundId, expiresAt: null };
  let added = 0;

  for (const credit of applied) {
    const claim = await tx.kalpBonusCredit.updateMany({ where: { id: credit.id, status: "WAITING" }, data: target });
    if (claim.count === 1) added += credit.points;
  }
  if (split) {
    const { credit, keep, rest } = split;
    const claim = await tx.kalpBonusCredit.updateMany({
      where: { id: credit.id, status: "WAITING" },
      data: { ...target, points: keep }
    });
    if (claim.count === 1) {
      added += keep;
      await tx.kalpBonusCredit.create({
        data: {
          inviteId: credit.inviteId,
          customerId: credit.customerId,
          points: rest,
          status: "WAITING",
          splitFromId: credit.id,
          expiresAt: waitingExpiry(),
          isTest: credit.isTest
        }
      });
    }
  }
  if (returned.length > 0) {
    await tx.kalpBonusCredit.updateMany({
      where: { id: { in: returned.map((c) => c.id) }, status: "WAITING" },
      data: { expiresAt: waitingExpiry() }
    });
  }
  if (added > 0) await tx.kalpBar.update({ where: { productId: bar.productId }, data: { points: { increment: added } } });
  return added;
}
