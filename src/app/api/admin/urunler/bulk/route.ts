import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteBlobUrls } from "@/lib/blob";

const allowedStatuses = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }
  if (session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Ürün seçilmedi." }, { status: 400 });
  }

  if (body.action === "DELETE") {
    const targets = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        images: { select: { url: true } },
        optionImages: { select: { url: true } }
      }
    });
    const urls = targets.flatMap((p) => [...p.images.map((i) => i.url), ...p.optionImages.map((i) => i.url)]);
    try {
      await prisma.product.deleteMany({ where: { id: { in: ids } } });
    } catch {
      return NextResponse.json(
        { error: "Seçili ürünlerden biri veya birkaçı mevcut siparişlere bağlı olduğu için silinemedi." },
        { status: 409 }
      );
    }
    await deleteBlobUrls(urls);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "SET_STATUS" && allowedStatuses.has(body.status)) {
    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { status: body.status } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
}
