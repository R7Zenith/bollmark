import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { cartLinesSchema } from "@/lib/cart-lines";
import { GUEST_CART_COOKIE, GUEST_CART_COOKIE_OPTIONS, readGuestId } from "@/lib/guest-cart";

const NO_STORE = { "Cache-Control": "no-store" };

const putSchema = z.object({
  lines: cartLinesSchema,
  couponCode: z.string().max(64).nullable()
});

// Giris yapmamis ziyaretcinin sepetini yazar (yalniz admin Aktif Sepetler icin;
// misafirde kaynak yine localStorage). Bos sepet satiri siler. Uyelerin
// sepeti CustomerCart'ta tutuldugu icin oturum varsa yazilmaz.
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400, headers: NO_STORE });
  }
  const session = await getServerSession(customerAuthOptions);
  if (session?.user?.id) return NextResponse.json({ ok: true }, { headers: NO_STORE });

  const existingId = readGuestId(req.cookies.get(GUEST_CART_COOKIE)?.value);
  const { lines, couponCode } = parsed.data;

  if (lines.length === 0) {
    if (existingId) await prisma.guestCart.deleteMany({ where: { guestId: existingId } });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  const guestId = existingId ?? randomUUID();
  const linesJson = JSON.stringify(lines);
  await prisma.guestCart.upsert({
    where: { guestId },
    create: { guestId, linesJson, couponCode },
    update: { linesJson, couponCode }
  });

  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  if (!existingId) response.cookies.set(GUEST_CART_COOKIE, guestId, GUEST_CART_COOKIE_OPTIONS);
  return response;
}

// Giris yapilinca misafir sepeti uye sepetine birlestirildigi icin satir silinir.
export async function DELETE(req: NextRequest) {
  const guestId = readGuestId(req.cookies.get(GUEST_CART_COOKIE)?.value);
  if (guestId) await prisma.guestCart.deleteMany({ where: { guestId } });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
