import { NextRequest, NextResponse } from "next/server";
import { getYurticiMode, isYurticiSyncEnabled } from "@/lib/yurtici/config";
import { syncActiveYurticiShipments } from "@/lib/yurtici/shipments";
import { getHepsijetMode, isHepsijetSyncEnabled } from "@/lib/hepsijet/config";
import { syncActiveHepsijetShipments } from "@/lib/hepsijet/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Yurtici otomatik durum takibi (bkz. vercel.json; Turkiye saatiyle 10, 13, 16,
// 19). Takipteki gonderiler tek queryShipment cagrisinda sorgulanir; takip
// edilecek kayit yoksa Yurtici'ye istek atilmaz. YURTICI_SYNC=off ya da
// YURTICI_MODE=off iken hicbir sey yapmaz. Diger cron'larla ayni CRON_SECRET deseni.
//
// HepsiJET takibi de burada (ayri cron yok, bkz. HEPSIJET_ENTEGRASYON_PLANI.md
// bolum 4.5): Yurtici'den sonra, tek istekte; hatasi Yurtici sonucunu bozmaz.
// HEPSIJET_SYNC=off ya da HEPSIJET_MODE=off iken atlanir.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (!isYurticiSyncEnabled()) {
    return NextResponse.json({ ok: true, skipped: "YURTICI_SYNC kapalı ya da YURTICI_MODE=off", hepsijet: await syncHepsijet() });
  }
  const result = await syncActiveYurticiShipments();
  return NextResponse.json({ ok: true, mode: getYurticiMode(), ...result, hepsijet: await syncHepsijet() });
}

async function syncHepsijet() {
  if (!isHepsijetSyncEnabled()) return { skipped: "HEPSIJET_SYNC kapalı ya da HEPSIJET_MODE=off" };
  try {
    return { mode: getHepsijetMode(), ...(await syncActiveHepsijetShipments()) };
  } catch (error) {
    console.error("HepsiJET takibi başarısız:", error);
    return { error: "HepsiJET takibi başarısız." };
  }
}
