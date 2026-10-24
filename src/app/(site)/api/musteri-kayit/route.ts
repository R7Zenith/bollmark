import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { hasMarketingConsent, requestIp, sendMetaEvent } from "@/lib/meta/capi";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
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

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const customer = await prisma.customer.create({ data: { name, email, phone, passwordHash } });

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
        ip: requestIp(req.headers),
        userAgent: req.headers.get("user-agent"),
        fbp: req.cookies.get("_fbp")?.value,
        fbc: req.cookies.get("_fbc")?.value
      },
      customData: { status: true }
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
