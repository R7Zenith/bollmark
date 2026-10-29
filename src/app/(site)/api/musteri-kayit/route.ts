import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { hasMarketingConsent, requestIp, sendMetaEvent } from "@/lib/meta/capi";
import { DISPOSABLE_EMAIL_MESSAGE, isBlockedEmail } from "@/lib/kalp-topla/email-domain-check";
import { setMarketingConsent } from "@/lib/kalp-topla/consent";
import { DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, recordDevice, resolveDeviceId } from "@/lib/kalp-topla/devices";
import { sendVerificationEmail } from "@/lib/kalp-topla/email-verification";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  // Kalp Topla (T3): ayri, isaretsiz onay kutulari
  marketingEmail: z.boolean().optional(),
  marketingWhatsapp: z.boolean().optional(),
  // Tarayicidaki Pixel olayiyla ayni event_id (Meta tekillestirir, bkz. lib/meta/track.ts).
  metaEventId: z.string().uuid().optional()
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, phone } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  // Y4/Y14: gecici e-posta alan adlari kayitta reddedilir.
  if (await isBlockedEmail(email)) {
    return NextResponse.json({ error: DISPOSABLE_EMAIL_MESSAGE }, { status: 400 });
  }

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const customer = await prisma.customer.create({ data: { name, email, phone, passwordHash } });

  const ip = requestIp(req.headers);
  if (parsed.data.marketingEmail) {
    await setMarketingConsent({ customerId: customer.id, channel: "EMAIL", granted: true, source: "KAYIT_FORMU", ip });
  }
  if (parsed.data.marketingWhatsapp) {
    await setMarketingConsent({ customerId: customer.id, channel: "WHATSAPP", granted: true, source: "KAYIT_FORMU", ip });
  }
  const { deviceId, isNew: isNewDevice } = resolveDeviceId(req.cookies.get(DEVICE_COOKIE)?.value);
  await recordDevice({ customerId: customer.id, deviceId, ip, event: "SIGNUP" });
  // Faz 3 karari: her yeni kayitta dogrulama e-postasi (sendMail best-effort).
  await sendVerificationEmail(customer);

  if (parsed.data.metaEventId && hasMarketingConsent(req.cookies)) {
    sendMetaEvent({
      eventName: "CompleteRegistration",
      eventId: parsed.data.metaEventId,
      sourceUrl: `${getSiteUrl()}/hesap/giris`,
      user: {
        email,
        phone,
        fullName: name,
        externalId: customer.id,
        ip,
        userAgent: req.headers.get("user-agent"),
        fbp: req.cookies.get("_fbp")?.value,
        fbc: req.cookies.get("_fbc")?.value
      },
      customData: { status: true }
    });
  }

  const response = NextResponse.json({ ok: true }, { status: 201 });
  if (isNewDevice) response.cookies.set(DEVICE_COOKIE, deviceId, DEVICE_COOKIE_OPTIONS);
  return response;
}
