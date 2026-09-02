import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { customerAuthOptions } from "@/lib/customer-auth";

const schema = z.object({
  productId: z.string().min(1),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(5),
  imageUrls: z.array(z.string().url()).max(5).optional()
});

// Misafir yorumu da calisir (customerId null), giris yapmis musteride
// oturumdan otomatik baglanir. Yorum hemen yayinlanmaz (BEKLIYOR) - admin
// onayindan sonra site tarafinda gorunur (bkz. lib/reviews.ts).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const data = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: data.productId }, select: { id: true } });
  if (!product) {
    return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
  }

  const customerSession = await getServerSession(customerAuthOptions);

  await prisma.productReview.create({
    data: {
      productId: data.productId,
      customerId: customerSession?.user?.id ?? null,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      rating: data.rating,
      comment: data.comment,
      imageUrls: data.imageUrls && data.imageUrls.length > 0 ? data.imageUrls.join("\n") : null
    }
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
