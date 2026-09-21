import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCredentials, getPaymentSettings } from "@/lib/payment/settings";
import { logPayment } from "@/lib/payment/log";
import { reconcileToken } from "@/lib/payment/orders/reconcile";
import { CHECKOUT_FORM_EVENT, checkWebhookSignature, webhookSchema } from "@/lib/payment/orders/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// iyzico bildirimi (bkz. plan 5.D) - callback'in kacirdigi durumlar icin guvenlik agi.
// Kural: aksiyon govdedeki HICBIR alana degil, token ile iyzico'dan yapilan sunucu-sunucu sorguya
// dayanir (reconcileToken). Bu yuzden imza basligi yoksa (ozellik henuz acilmamis olabilir) da islenir;
// baslik VARSA ve yanlissa 401. Yanit kurali: islendi / zaten islenmisti / bilinmeyen token -> 200;
// gecici hata (DB, iyzico agi) -> 5xx (iyzico 15 dk arayla en fazla 3 kez tekrar dener).
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    await logPayment({ kind: "WEBHOOK", ok: false, httpStatus: 400, summary: "Webhook gövdesi JSON değil" });
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = webhookSchema.safeParse(json);
  if (!parsed.success) {
    await logPayment({ kind: "WEBHOOK", ok: false, httpStatus: 400, summary: "Webhook gövdesi beklenen biçimde değil" });
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const payload = parsed.data;

  try {
    if (payload.iyziEventType !== CHECKOUT_FORM_EVENT) {
      await logPayment({ kind: "WEBHOOK", ok: true, httpStatus: 200, summary: `Webhook (${payload.iyziEventType}) işlenmeyen olay türü, yok sayıldı` });
      return NextResponse.json({ result: "ignored" });
    }

    const attempt = payload.token
      ? await prisma.paymentAttempt.findUnique({ where: { token: payload.token }, select: { id: true, orderId: true, mode: true } })
      : null;
    if (!attempt) {
      await logPayment({ kind: "WEBHOOK", ok: true, httpStatus: 200, summary: "Webhook bilinmeyen/boş token ile geldi, yok sayıldı" });
      return NextResponse.json({ result: "unknown" });
    }

    const settings = await getPaymentSettings();
    const credentials = getCredentials(settings, attempt.mode === "LIVE" ? "LIVE" : "SANDBOX");
    const verdict = credentials
      ? checkWebhookSignature(payload, credentials.secretKey, req.headers.get("x-iyz-signature-v3"))
      : "missing";
    if (verdict === "invalid") {
      await logPayment({
        kind: "WEBHOOK",
        ok: false,
        httpStatus: 401,
        orderId: attempt.orderId,
        attemptId: attempt.id,
        summary: "Webhook imzası (X-IYZ-SIGNATURE-V3) geçersiz, işlenmedi"
      });
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    const result = await reconcileToken(payload.token, "webhook");
    const transient = result.kind === "error";
    await logPayment({
      kind: "WEBHOOK",
      ok: !transient,
      httpStatus: transient ? 500 : 200,
      orderId: attempt.orderId,
      attemptId: attempt.id,
      summary: `Webhook (${payload.status || "?"}, imza: ${verdict === "valid" ? "geçerli" : "yok"}) → ${result.kind}`
    });
    if (transient) return NextResponse.json({ error: "retry later" }, { status: 500 });
    return NextResponse.json({ result: result.kind });
  } catch (error) {
    console.error("Webhook işlenemedi (iyzico yeniden deneyecek):", error);
    await logPayment({ kind: "WEBHOOK", ok: false, httpStatus: 500, summary: "Webhook işlenirken geçici hata" });
    return NextResponse.json({ error: "retry later" }, { status: 500 });
  }
}
