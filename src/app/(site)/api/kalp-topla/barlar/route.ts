import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { getBarsSummary } from "@/lib/kalp-topla/bar";
import { campaignStateFrom, getKalpSettings } from "@/lib/kalp-topla/settings";

// Katalog rozetleri: tek toplu istek, en cok 60 urun (plan 6.2). LIVE'da
// oturumdan bagimsizdir ve CDN'de onbelleklenir; gizli yayinda yalniz test
// hesabina, onbelleksiz cevap verir.
const MAX_IDS = 60;

export async function GET(req: NextRequest) {
  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean))].slice(0, MAX_IDS);
  const settings = await getKalpSettings();
  if (settings.mode === "LIVE") {
    return NextResponse.json(
      { bars: ids.length > 0 ? await getBarsSummary(ids) : [] },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  }
  const headers = { "Cache-Control": "no-store" };
  const session = await getServerSession(customerAuthOptions);
  const state = await campaignStateFrom(settings, session?.user?.id ?? null);
  if (state === "INVISIBLE") return NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers });
  // FROZEN'da rozetler gizlidir (T14).
  const bars = state === "ACTIVE" && ids.length > 0 ? await getBarsSummary(ids) : [];
  return NextResponse.json({ bars }, { headers });
}
