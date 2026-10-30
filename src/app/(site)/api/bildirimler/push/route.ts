import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { customerAuthOptions } from "@/lib/customer-auth";
import { requestIp } from "@/lib/meta/capi";
import { logPushConsent } from "@/lib/kalp-topla/consent";
import { isAllowedPushEndpoint } from "@/lib/kalp-topla/notification-rules";
import { campaignStateFor } from "@/lib/kalp-topla/settings";

// Push aboneligi (KALP_TOPLA_PLANI.md 6.5, 7.5): POST kaydet, DELETE sil.
const headers = { "Cache-Control": "no-store" };

async function memberId() {
  const session = await getServerSession(customerAuthOptions);
  const customerId = session?.user?.id;
  if (!customerId) return { error: NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401, headers }) };
  if ((await campaignStateFor(customerId)) === "INVISIBLE") {
    return { error: NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers }) };
  }
  return { customerId };
}

export async function POST(req: NextRequest) {
  const member = await memberId();
  if (!member.customerId) return member.error;
  const body = (await req.json().catch(() => null)) as {
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  } | null;
  const { endpoint, keys } = body?.subscription ?? {};
  if (typeof endpoint !== "string" || !isAllowedPushEndpoint(endpoint) || typeof keys?.p256dh !== "string" || typeof keys.auth !== "string") {
    return NextResponse.json({ error: "Geçersiz abonelik." }, { status: 400, headers });
  }
  const before = await prisma.pushSubscription.count({ where: { customerId: member.customerId } });
  const data = { customerId: member.customerId, p256dh: keys.p256dh, auth: keys.auth };
  await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
  if (before === 0) {
    await logPushConsent({
      customerId: member.customerId,
      granted: true,
      source: "HESAP_AYARLARI",
      ip: requestIp(req.headers)
    });
  }
  return NextResponse.json({ ok: true }, { headers });
}

export async function DELETE(req: NextRequest) {
  const member = await memberId();
  if (!member.customerId) return member.error;
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Abonelik eksik." }, { status: 400, headers });
  const removed = await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, customerId: member.customerId } });
  const left = await prisma.pushSubscription.count({ where: { customerId: member.customerId } });
  if (removed.count > 0 && left === 0) {
    await logPushConsent({ customerId: member.customerId, granted: false, source: "HESAP_AYARLARI", ip: requestIp(req.headers) });
  }
  return NextResponse.json({ ok: true }, { headers });
}
