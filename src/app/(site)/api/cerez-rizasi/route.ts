import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

// Cerez bandindaki rıza seciminin ispat kaydi (bkz. src/lib/consent.ts
// saveConsent). Yalniz kullanici secim yaptiginda cagrilir, sayfa
// yuklemelerinde hic istek atilmaz. Ham IP saklanmaz.
const schema = z.object({
  visitorId: z.string().uuid(),
  version: z.string().min(1).max(20),
  analytics: z.boolean(),
  marketing: z.boolean()
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const session = await getServerSession(customerAuthOptions);
  await prisma.consentLog.create({
    data: { ...parsed.data, userId: session?.user?.id ?? null }
  });
  return new NextResponse(null, { status: 204 });
}
