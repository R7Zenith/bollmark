import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { campaignStateFor } from "@/lib/kalp-topla/settings";

// Kalp Topla gorunurlugu istemcide oturuma gore buradan cozulur (plan 5.0):
// ISR onbellekli sayfalar gizli yayin modunu sizdirmasin diye. INVISIBLE
// durumda diger kampanya uclari gibi 404 doner.
export async function GET() {
  const session = await getServerSession(customerAuthOptions);
  const state = await campaignStateFor(session?.user?.id ?? null);
  const headers = { "Cache-Control": "no-store" };
  if (state === "INVISIBLE") {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers });
  }
  return NextResponse.json({ state }, { headers });
}
