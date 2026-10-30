import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { customerAuthOptions } from "@/lib/customer-auth";
import { campaignStateFor } from "@/lib/kalp-topla/settings";
import { ensureReferralCode } from "@/lib/kalp-topla/invite";

const headers = { "Cache-Control": "no-store" };

async function memberId() {
  const session = await getServerSession(customerAuthOptions);
  const customerId = session?.user?.id;
  if (!customerId) return { error: NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401, headers }) };
  if ((await campaignStateFor(customerId)) === "INVISIBLE") {
    return { error: NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers }) };
  }
  return { customerId };
}

// GET ?productId=: davet linkinin yolu. Tam adres istemcide kurulur, yerelde
// de calissin diye (SITE_URL yerelde tanimli degil).
export async function GET(req: NextRequest) {
  const member = await memberId();
  if (!member.customerId) return member.error;
  const code = await ensureReferralCode(member.customerId);
  const productId = req.nextUrl.searchParams.get("productId");
  const product = productId
    ? await prisma.product.findFirst({ where: { id: productId, status: "PUBLISHED", kalpToplaExcluded: false }, select: { slug: true } })
    : null;
  return NextResponse.json({ path: `/davet/${code}${product ? `?urun=${encodeURIComponent(product.slug)}` : ""}` }, { headers });
}

// PUT { productId | null }: genel linkte +2'nin hedefi. Yalniz acik kalbi olan urun.
export async function PUT(req: NextRequest) {
  const member = await memberId();
  if (!member.customerId) return member.error;
  const body = (await req.json().catch(() => null)) as { productId?: unknown } | null;
  const productId = typeof body?.productId === "string" ? body.productId : null;
  if (productId) {
    const heart = await prisma.kalpHeart.findFirst({
      where: { customerId: member.customerId, productId, status: { in: ["PENDING", "ACTIVE"] } },
      select: { id: true }
    });
    if (!heart) return NextResponse.json({ error: "Bu üründe kalbin yok." }, { status: 409, headers });
  }
  await prisma.customer.update({ where: { id: member.customerId }, data: { inviteTargetProductId: productId } });
  return NextResponse.json({ ok: true }, { headers });
}
