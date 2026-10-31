import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { campaignStateFrom, getKalpSettings } from "@/lib/kalp-topla/settings";

// Kalp Topla gorunurlugu istemcide oturuma gore buradan cozulur (plan 5.0):
// ISR onbellekli sayfalar gizli yayin modunu sizdirmasin diye. INVISIBLE
// durumda diger kampanya uclari gibi 404 doner.
export async function GET() {
  const session = await getServerSession(customerAuthOptions);
  const settings = await getKalpSettings();
  const state = await campaignStateFrom(settings, session?.user?.id ?? null);
  const headers = { "Cache-Control": "no-store" };
  if (state === "INVISIBLE") {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers });
  }
  return NextResponse.json({ state, threshold: settings.threshold, discountPercent: settings.discountPercent }, { headers });
}
