import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { placeWaitingCredits } from "@/lib/kalp-topla/bar";
import { deliverOutbox, queueExpiringCoupons } from "@/lib/kalp-topla/notifications";
import { getKalpSettings } from "@/lib/kalp-topla/settings";

// Kalp Topla saatlik is (KALP_TOPLA_PLANI.md 7.6). Vercel Cron,
// "Authorization: Bearer $CRON_SECRET" ile (bkz. vercel.json).
// - Son 6 saate giren kuponlara COUPON_EXPIRING olayi.
// - Kampanya aciksa bekleyen bonus kredileri yerlestirilir (Y5).
// - Outbox'taki PENDING/FAILED satirlar (24 saatten genc) yeniden denenir.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const now = new Date();
  const expiring = await queueExpiringCoupons(now);

  const settings = await getKalpSettings();
  const waiting = await prisma.kalpBonusCredit.findMany({
    where: { status: "WAITING", expiresAt: { gt: now } },
    distinct: ["customerId"],
    select: { customerId: true }
  });
  for (const { customerId } of waiting) await placeWaitingCredits(customerId, settings);

  return NextResponse.json({ ok: true, expiring, waitingMembers: waiting.length, outbox: await deliverOutbox({ retry: true }) });
}
