import { NextRequest, NextResponse } from "next/server";
import { syncInstagram } from "@/lib/instagram";

// Vercel Cron tarafindan gunde bir kez tetiklenir (bkz. vercel.json, saat
// 07:00), Vercel'in otomatik ekledigi "Authorization: Bearer $CRON_SECRET"
// header'i ile korunur. Anasayfa Instagram karelerini tazeler, token'i
// gerekirse yeniler (bkz. lib/instagram.ts). Baglanti yoksa hicbir sey yapmaz.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  return NextResponse.json(await syncInstagram());
}
