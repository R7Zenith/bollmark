import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { getSiteUrl } from "@/lib/site-url";
import { hasMarketingConsent, requestIp, sendMetaEvent } from "@/lib/meta/capi";

// AddToCart / InitiateCheckout'un CAPI kopyasi (bkz. lib/meta/track.ts). Kasitli
// olarak hafif: DB sorgusu yok, Meta'ya gonderim after() ile yanittan sonra.
// Degerler takip amacli oldugu icin istemciden alinir (yalniz sinirlanir).
const contentSchema = z.object({
  id: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(999),
  item_price: z.number().nonnegative().max(1_000_000)
});

const schema = z.object({
  event: z.enum(["AddToCart", "InitiateCheckout"]),
  eventId: z.string().uuid(),
  customData: z.object({
    currency: z.literal("TRY"),
    value: z.number().nonnegative().max(10_000_000),
    content_type: z.literal("product"),
    content_name: z.string().max(200).optional(),
    content_ids: z.array(z.string().min(1).max(100)).max(50),
    contents: z.array(contentSchema).max(50),
    num_items: z.number().int().nonnegative().max(10_000)
  })
});

function sourceUrl(referer: string | null): string {
  const site = getSiteUrl();
  return referer && referer.startsWith(site) ? referer : site;
}

export async function POST(req: NextRequest) {
  if (!hasMarketingConsent(req.cookies)) return new NextResponse(null, { status: 204 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  // Oturum JWT'den okunur (DB yok): giris yapmis musteride e-posta + id eslesme icin.
  const session = await getServerSession(customerAuthOptions);
  sendMetaEvent({
    eventName: parsed.data.event,
    eventId: parsed.data.eventId,
    sourceUrl: sourceUrl(req.headers.get("referer")),
    user: {
      email: session?.user?.email,
      externalId: session?.user?.id,
      ip: requestIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      fbp: req.cookies.get("_fbp")?.value,
      fbc: req.cookies.get("_fbc")?.value
    },
    customData: parsed.data.customData
  });
  return new NextResponse(null, { status: 204 });
}
