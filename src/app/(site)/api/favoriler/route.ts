import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ productId: z.string().min(1) });

export async function GET() {
  const session = await getServerSession(customerAuthOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ productIds: [] });
  }
  const items = await prisma.wishlistItem.findMany({
    where: { customerId: session.user.id },
    select: { productId: true }
  });
  return NextResponse.json({ productIds: items.map((i) => i.productId) });
}

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

  // Ayni urun tekrar eklenmeye calisilirsa @@unique hata vermesin diye upsert.
  await prisma.wishlistItem.upsert({
    where: { customerId_productId: { customerId: session.user.id, productId: parsed.data.productId } },
    update: {},
    create: { customerId: session.user.id, productId: parsed.data.productId }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(customerAuthOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  await prisma.wishlistItem
    .delete({ where: { customerId_productId: { customerId: session.user.id, productId: parsed.data.productId } } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
