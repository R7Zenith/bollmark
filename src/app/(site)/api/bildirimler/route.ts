import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { customerAuthOptions } from "@/lib/customer-auth";
import { campaignStateFor } from "@/lib/kalp-topla/settings";

// Bildirim zili (KALP_TOPLA_PLANI.md 6.7): GET son bildirimler + okunmamis sayisi,
// POST tumunu okundu yapar.
const headers = { "Cache-Control": "no-store" };
const LIMIT = 8;

async function memberId() {
  const session = await getServerSession(customerAuthOptions);
  const customerId = session?.user?.id;
  if (!customerId || (await campaignStateFor(customerId)) === "INVISIBLE") return null;
  return customerId;
}

export async function GET() {
  const customerId = await memberId();
  if (!customerId) return NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers });
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true }
    }),
    prisma.notification.count({ where: { customerId, readAt: null } })
  ]);
  return NextResponse.json({ items, unread }, { headers });
}

export async function POST() {
  const customerId = await memberId();
  if (!customerId) return NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers });
  await prisma.notification.updateMany({ where: { customerId, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true }, { headers });
}
