import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { requestIp } from "@/lib/meta/capi";
import { setMarketingConsent } from "@/lib/kalp-topla/consent";
import { campaignStateFor } from "@/lib/kalp-topla/settings";

// Ilk kalp penceresindeki e-posta onay kutusu (plan 6.1, T3): kaynak KALP_PENCERESI.
export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const session = await getServerSession(customerAuthOptions);
  const customerId = session?.user?.id;
  if (!customerId) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401, headers });
  if ((await campaignStateFor(customerId)) === "INVISIBLE") {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers });
  }
  await setMarketingConsent({ customerId, channel: "EMAIL", granted: true, source: "KALP_PENCERESI", ip: requestIp(req.headers) });
  return NextResponse.json({ ok: true }, { headers });
}
