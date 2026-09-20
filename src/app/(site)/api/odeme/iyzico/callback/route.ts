import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { logPayment } from "@/lib/payment/log";
import { reconcileToken } from "@/lib/payment/orders/reconcile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readToken(req: NextRequest): Promise<string | null> {
  try {
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      const body = await req.json();
      return typeof body?.token === "string" ? body.token : null;
    }
    const token = (await req.formData()).get("token");
    if (typeof token === "string" && token) return token;
  } catch {
    // govde okunamadi, query'ye bakilacak
  }
  return req.nextUrl.searchParams.get("token");
}

// POST'tan sonra 303 ile GET'e yonlendirilir (tarayici formu tekrar gondermesin).
function redirectTo(path: string) {
  return NextResponse.redirect(new URL(path, getSiteUrl()), 303);
}

// iyzico odeme formu bitince tarayiciyi buraya POST eder. Sonuc YALNIZCA token ile iyzico'dan
// sorgulanarak ogrenilir; yonlendirmedeki baska hicbir alana guvenilmez. Tarayiciya asla 500 verilmez.
export async function POST(req: NextRequest) {
  const token = await readToken(req);
  if (!token) {
    await logPayment({ kind: "CALLBACK", ok: false, summary: "Callback token olmadan çağrıldı" });
    return redirectTo("/");
  }

  let orderNumber: string | undefined;
  let kind = "error";
  try {
    const result = await reconcileToken(token, "callback");
    orderNumber = result.orderNumber;
    kind = result.kind;
  } catch (error) {
    console.error("Callback işlenemedi (sonuç sorgulanamadı):", error);
    // Sorgu basarisiz: kullaniciya "dogrulaniyor" gosterilir, webhook/mutabakat tamamlar.
    orderNumber = (
      await prisma.paymentAttempt
        .findUnique({ where: { token }, select: { order: { select: { orderNumber: true } } } })
        .catch(() => null)
    )?.order.orderNumber;
  }

  await logPayment({
    kind: "CALLBACK",
    ok: kind !== "error" && kind !== "unknown" && kind !== "invalid",
    summary: `Callback alındı → ${kind}`
  });

  if (!orderNumber) return redirectTo("/");
  const query = `?siparis=${encodeURIComponent(orderNumber)}`;
  return redirectTo(kind === "failed" ? `/odeme/basarisiz${query}` : `/odeme/tesekkurler${query}`);
}
