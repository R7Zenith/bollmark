import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consentGroupsToPurge } from "@/lib/kalp-topla/consent";

// Kalp Topla gunluk temizlik (KALP_TOPLA_PLANI.md 5.9, Y3). Vercel Cron,
// "Authorization: Bearer $CRON_SECRET" ile (bkz. vercel.json).
// - CustomerDevice: 90 gunden eski satirlar silinir.
// - MarketingConsentLog: onay su an geri cekilmis ve geri cekme 3 yildan
//   eskiyse o musteri+kanalin o tarihe kadarki IP'leri null'lanir.
// - Kullanilmis ya da suresi dolmus dogrulama tokenlari 7 gun sonra silinir.
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const now = new Date();

  const devices = await prisma.customerDevice.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 90 * DAY_MS) } }
  });

  // Her musteri+kanal icin en son kayit.
  const latest = await prisma.marketingConsentLog.findMany({
    distinct: ["customerId", "channel"],
    orderBy: [{ customerId: "asc" }, { channel: "asc" }, { createdAt: "desc" }],
    select: { customerId: true, channel: true, granted: true, createdAt: true }
  });
  let purgedIps = 0;
  for (const group of consentGroupsToPurge(latest, now)) {
    const res = await prisma.marketingConsentLog.updateMany({
      where: { customerId: group.customerId, channel: group.channel, createdAt: { lte: group.createdAt }, ip: { not: null } },
      data: { ip: null, ipPurgedAt: now }
    });
    purgedIps += res.count;
  }

  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const tokens = await prisma.emailVerificationToken.deleteMany({
    where: { OR: [{ usedAt: { lt: weekAgo } }, { expiresAt: { lt: weekAgo } }] }
  });

  return NextResponse.json({ ok: true, deletedDevices: devices.count, purgedIps, deletedTokens: tokens.count });
}
