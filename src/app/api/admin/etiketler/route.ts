import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9ığüşöç\s-]/gi, "")
    .replace(/\s+/g, "-");
}

// Urun formundaki etiket secicisinden yeni bir etiket eklemek icin -
// mevcut etiketler arasinda ayni isim (buyuk/kucuk harf duyarsiz) varsa onu
// dondurur, yoksa yeni bir Tag olusturur.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Etiket adı gerekli." }, { status: 400 });
  }

  const existing = await prisma.tag.findFirst({
    where: { name: { equals: name, mode: "insensitive" } }
  });
  if (existing) {
    return NextResponse.json({ tag: existing });
  }

  const tag = await prisma.tag.create({
    data: { name, slug: slugify(name) }
  });
  return NextResponse.json({ tag });
}
