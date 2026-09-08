import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  ids: z.array(z.string()).min(1)
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }
  if (session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { ids } = parsed.data;

  const categories = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, parentId: true }
  });
  if (categories.length !== ids.length) {
    return NextResponse.json({ error: "Kategorilerden biri bulunamadı." }, { status: 404 });
  }
  const parentIds = new Set(categories.map((c) => c.parentId));
  if (parentIds.size > 1) {
    return NextResponse.json({ error: "Sadece aynı üst kategori altındaki kategoriler sıralanabilir." }, { status: 400 });
  }

  await prisma.$transaction(ids.map((id, index) => prisma.category.update({ where: { id }, data: { sortOrder: index * 10 } })));

  return NextResponse.json({ ok: true });
}
