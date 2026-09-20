import { NextRequest, NextResponse } from "next/server";
import { sweepPayments } from "@/lib/payment/orders/expire";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Gunluk odeme mutabakati (bkz. vercel.json): callback/webhook ulasmamis odemeleri iyzico'dan
// sorgular, suresi dolan odenmemis siparisleri iptal edip kupon/puani geri verir. Ayni is
// baslatma ve admin siparis listesinde de kucuk partiler halinde (lazy) calisir.
// sepet-hatirlatma cron'uyla ayni CRON_SECRET deseni.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const result = await sweepPayments(50);
  return NextResponse.json({ ok: true, ...result });
}
