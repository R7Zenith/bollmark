import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ products: [], orders: [] }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ products: [], orders: [] });
  }

  const [products, orders] = await Promise.all([
    prisma.product.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true },
      take: 5
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } }
        ]
      },
      select: { id: true, orderNumber: true, customerName: true },
      take: 5
    })
  ]);

  return NextResponse.json({ products, orders });
}
