import { NextRequest, NextResponse } from "next/server";
import { requestIp } from "@/lib/meta/capi";
import { setMarketingConsent, verifyUnsubscribeToken } from "@/lib/kalp-topla/consent";

// Abonelikten cikma (KALP_TOPLA_PLANI.md 6.10, 7.3). Yalniz POST islem yapar:
// e-posta guvenlik tarayicilari GET linkini onceden acabilir. Uc yoldan gelir:
// - /abonelik/iptal sayfasinin otomatik istegi (JSON yanit),
// - JS kapaliyken sayfadaki form (303 ile sayfaya doner),
// - posta istemcisinin List-Unsubscribe-Post istegi ("List-Unsubscribe=One-Click").
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const customerId = verifyUnsubscribeToken(token);
  const isForm = req.headers.get("content-type")?.includes("application/x-www-form-urlencoded") ?? false;
  const form = isForm ? await req.formData().catch(() => null) : null;
  const isOneClick = form?.get("List-Unsubscribe") === "One-Click";

  if (!customerId) {
    if (isForm && !isOneClick) return NextResponse.redirect(new URL("/abonelik/iptal?durum=gecersiz", req.url), 303);
    return NextResponse.json({ error: "Geçersiz bağlantı." }, { status: 400 });
  }

  await setMarketingConsent({
    customerId,
    channel: "EMAIL",
    granted: false,
    source: "ABONELIK_IPTAL_LINKI",
    ip: requestIp(req.headers)
  });

  if (isForm && !isOneClick) return NextResponse.redirect(new URL("/abonelik/iptal?durum=tamam", req.url), 303);
  return NextResponse.json({ ok: true });
}
