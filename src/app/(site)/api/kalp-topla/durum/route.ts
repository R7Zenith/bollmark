import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { campaignStateFrom, getKalpSettings } from "@/lib/kalp-topla/settings";
import { kalpPausedNow } from "@/lib/efsane-cuma-server";

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
  // paused: Efsane Cuma arasi (lib/efsane-cuma.ts) - bar yerine ara notu gosterilir.
  const paused = state === "FROZEN" && (await kalpPausedNow());
  return NextResponse.json({ state, paused, threshold: settings.threshold, discountPercent: settings.discountPercent }, { headers });
}
