import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(["SET_ACTIVE", "SET_INACTIVE", "DELETE"])
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
  const { ids, action } = parsed.data;

  if (action === "SET_ACTIVE" || action === "SET_INACTIVE") {
    await prisma.category.updateMany({
      where: { id: { in: ids } },
      data: { isActive: action === "SET_ACTIVE" }
    });
    return NextResponse.json({ ok: true });
  }

  // DELETE: urunu veya alt kategorisi olanlar atlanir - tekli silme akisiyla
  // tutarli, bu toplu islemde otomatik "tasi" yapilmaz.
  const categories = await prisma.category.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { products: true, children: true } } }
  });
  const deletableIds = categories
    .filter((c) => c._count.products === 0 && c._count.children === 0)
    .map((c) => c.id);

  if (deletableIds.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: deletableIds } } });
  }

  return NextResponse.json({ deleted: deletableIds.length, skipped: ids.length - deletableIds.length });
}
