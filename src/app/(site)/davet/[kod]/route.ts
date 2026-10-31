import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { customerAuthOptions } from "@/lib/customer-auth";
import { campaignProductId, resolveInviter } from "@/lib/kalp-topla/invite";
import { formatInviteValue, INVITE_COOKIE, INVITE_COOKIE_OPTIONS, parseInviteValue } from "@/lib/kalp-topla/invite-rules";

// Davet linki (KALP_TOPLA_PLANI.md 5.5, T8): /davet/KOD ve /davet/KOD?urun=slug.
// Gecersiz kodda, girisli uyede ve Gizli yayinda test hesabi olmayan davet edende
// cerez yazilmaz; ziyaretci yine de yonlendirilir, kampanya sizdirilmaz.
export async function GET(req: NextRequest, { params }: { params: Promise<{ kod: string }> }) {
  const { kod } = await params;
  const slug = req.nextUrl.searchParams.get("urun");
  const product = slug
    ? await prisma.product.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true, slug: true } })
    : null;
  const response = NextResponse.redirect(new URL(product ? `/urunler/${product.slug}` : "/", req.url));

  const code = parseInviteValue(kod.toUpperCase())?.code;
  const session = await getServerSession(customerAuthOptions);
  if (!code || session?.user?.id || !(await resolveInviter(code))) return response;

  const productId = await campaignProductId(product?.id ?? null);
  response.cookies.set(INVITE_COOKIE, formatInviteValue(code, productId), INVITE_COOKIE_OPTIONS);
  return response;
}
