import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ productIds: z.array(z.string()).max(200) });

// Giris aninda localStorage'daki favori id'lerini DB'ye tasir - var olanlar
// @@unique kisitiyla sessizce atlanir (skipDuplicates).
export async function POST(req: NextRequest) {
  const session = await getServerSession(customerAuthOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const customerId = session.user.id;
  await prisma.wishlistItem.createMany({
    data: parsed.data.productIds.map((productId) => ({ customerId, productId })),
    skipDuplicates: true
  });

  return NextResponse.json({ ok: true });
}
