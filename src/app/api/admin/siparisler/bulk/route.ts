import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orderStatuses } from "@/lib/status";

const allowedStatuses = new Set<string>(orderStatuses);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Siparis secilmedi." }, { status: 400 });
  }

  if (body.action === "SET_STATUS" && allowedStatuses.has(body.status)) {
    await prisma.order.updateMany({ where: { id: { in: ids } }, data: { status: body.status } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Gecersiz istek." }, { status: 400 });
}
