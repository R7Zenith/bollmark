import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { cartLinesSchema, resolveCartLines } from "@/lib/cart-lines";
import { parseKalpSelection } from "@/lib/kalp-topla/pricing";

const NO_STORE = { "Cache-Control": "no-store" };

const putSchema = z.object({
  lines: cartLinesSchema,
  couponCode: z.string().max(64).nullable(),
  kalpSelection: z.object({ manual: z.array(z.string()).max(50), removed: z.array(z.string()).max(50) }).optional()
});

// Oturumdaki musterinin kayitli sepeti - satirlar guncel fiyat/stok ile
// zenginlestirilir. Silinmis urunler (artik cozumlenemeyen satirlar) atlanir;
// bir sonraki PUT ile DB'den de duser.
export async function GET() {
  const session = await getServerSession(customerAuthOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401, headers: NO_STORE });
  }

  const cart = await prisma.customerCart.findUnique({ where: { customerId: session.user.id } });
  let stored: unknown = [];
  try {
    stored = JSON.parse(cart?.linesJson ?? "[]");
  } catch {
    // bozuk kayit bos sepet sayilir
  }
  const parsed = cartLinesSchema.safeParse(stored);
  const lines = parsed.success ? (await resolveCartLines(parsed.data)).filter((l) => l.name !== "") : [];

  return NextResponse.json(
    { lines, couponCode: cart?.couponCode ?? null, kalpSelection: parseKalpSelection(cart?.kalpSelectionJson) },
    { headers: NO_STORE }
  );
}

// Sepetin tamamini yazar (son yazan kazanir). Fiyat/isim/gorsel kabul edilmez.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(customerAuthOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401, headers: NO_STORE });
  }

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400, headers: NO_STORE });
  }

  const customerId = session.user.id;
  const linesJson = JSON.stringify(parsed.data.lines);
  const couponCode = parsed.data.couponCode;
  const kalpSelectionJson = parsed.data.kalpSelection ? JSON.stringify(parsed.data.kalpSelection) : undefined;
  await prisma.customerCart.upsert({
    where: { customerId },
    create: { customerId, linesJson, couponCode, kalpSelectionJson },
    update: { linesJson, couponCode, kalpSelectionJson }
  });

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
