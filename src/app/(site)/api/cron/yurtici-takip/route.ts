import { NextRequest, NextResponse } from "next/server";
import { getYurticiMode, isYurticiSyncEnabled } from "@/lib/yurtici/config";
import { syncActiveYurticiShipments } from "@/lib/yurtici/shipments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Yurtici otomatik durum takibi (bkz. vercel.json; Turkiye saatiyle 10, 13, 16,
// 19). Takipteki gonderiler tek queryShipment cagrisinda sorgulanir; takip
// edilecek kayit yoksa Yurtici'ye istek atilmaz. YURTICI_SYNC=off ya da
// YURTICI_MODE=off iken hicbir sey yapmaz. Diger cron'larla ayni CRON_SECRET deseni.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (!isYurticiSyncEnabled()) {
    return NextResponse.json({ ok: true, skipped: "YURTICI_SYNC kapalı ya da YURTICI_MODE=off" });
  }
  const result = await syncActiveYurticiShipments();
  return NextResponse.json({ ok: true, mode: getYurticiMode(), ...result });
}
