import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initializePayment } from "@/lib/payment/orders/initialize";
import { extractIp } from "@/lib/payment/orders/buyer";
import { sweepPayments } from "@/lib/payment/orders/expire";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ orderNumber: z.string().min(3).max(40) });

// Siparis DB'de zaten olusmus olmali (POST /api/orders). Tutar/kalemler HER ZAMAN DB'den
// okunur; istemciden yalnizca siparis numarasi gelir.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  // Lazy sure dolumu: kucuk parti, hata akisi etkilemez.
  await sweepPayments(5).catch((error) => console.error("Ödeme süpürmesi başarısız (yoksayıldı):", error));

  try {
    const result = await initializePayment(parsed.data.orderNumber, extractIp(req.headers));
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    if ("free" in result) return NextResponse.json({ free: true });
    return NextResponse.json({ paymentPageUrl: result.paymentPageUrl });
  } catch (error) {
    console.error("Ödeme başlatılamadı:", error);
    return NextResponse.json({ error: "Ödeme başlatılamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
