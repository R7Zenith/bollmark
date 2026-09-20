import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicPaymentState } from "@/lib/payment/orders/state";
import { reconcileToken } from "@/lib/payment/orders/reconcile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Yalnizca durum doner (kisisel veri yok). `kontrol=1` ise, siparisin acik bir odeme denemesi
// varsa iyzico'dan yeniden sorgulanir (callback ulasmadiysa "dogrulaniyor" ekranini cozer).
export async function GET(req: NextRequest) {
  const orderNumber = req.nextUrl.searchParams.get("siparis")?.trim();
  if (!orderNumber || orderNumber.length > 40) return NextResponse.json({ state: "UNKNOWN" });

  if (req.nextUrl.searchParams.get("kontrol") === "1") {
    const open = await prisma.paymentAttempt.findFirst({
      where: { order: { orderNumber }, status: { in: ["INITIATED", "REVIEW"] } },
      orderBy: { createdAt: "desc" },
      select: { token: true }
    });
    if (open) await reconcileToken(open.token, "poll").catch((error) => console.error("Durum sorgusu başarısız:", error));
  }

  const { state } = await getPublicPaymentState(orderNumber);
  return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
