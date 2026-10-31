import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { getBarView } from "@/lib/kalp-topla/bar";

// Urun sayfasi bari (plan 6.1). Oturuma gore cozulur, onbelleklenmez.
export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const productId = req.nextUrl.searchParams.get("productId") ?? "";
  const session = await getServerSession(customerAuthOptions);
  const view = productId ? await getBarView(session?.user?.id ?? null, productId) : null;
  if (!view) return NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers });
  return NextResponse.json(view, { headers });
}
