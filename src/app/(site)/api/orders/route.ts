import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/format";
import { effectivePrice } from "@/lib/variant";

const lineSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  quantity: z.number().int().positive()
});

const orderSchema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(6),
  shippingAddress: z.string().min(5),
  city: z.string().min(2),
  district: z.string().min(2),
  postalCode: z.string().optional(),
  note: z.string().optional(),
  lines: z.array(lineSchema).min(1)
});

// NOT: Bu aşamada gerçek bir ödeme sağlayıcısı (iyzico vb.) bağlanmadığı için
// sipariş "PENDING_PAYMENT" durumunda oluşturulur. Ödeme entegrasyonu
// eklendiğinde bu route sağlayıcıdan gelen başarı bildirimiyle güncellenecek.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Fiyat hicbir zaman istemciden gelen deger uzerinden hesaplanmaz - her
  // satirin gecerli fiyati (varyant override'i veya urunun genel fiyati)
  // burada veritabanindan yeniden okunur. Bu hem musterinin gordugu fiyatla
  // sipariş tutarinin her zaman tutarli olmasini saglar, hem de istemci
  // tarafinda degistirilmis bir fiyatla siparis verilmesini engeller.
  const productIds = [...new Set(data.lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { variants: true }
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const resolvedLines: { productId: string; variantId: string; quantity: number; priceCents: number }[] = [];
  for (const line of data.lines) {
    const product = productById.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) {
      return NextResponse.json({ error: "Sepetteki bir ürün veya varyant artık mevcut değil." }, { status: 400 });
    }
    resolvedLines.push({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      priceCents: effectivePrice(product, variant)
    });
  }

  const subtotalCents = resolvedLines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const shippingCents = subtotalCents >= 100000 ? 0 : 4900;
  const totalCents = subtotalCents + shippingCents;

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      shippingAddress: data.shippingAddress,
      city: data.city,
      district: data.district,
      postalCode: data.postalCode,
      note: data.note,
      subtotalCents,
      shippingCents,
      totalCents,
      items: {
        create: resolvedLines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          unitPriceCents: l.priceCents,
          totalCents: l.priceCents * l.quantity
        }))
      },
      shipment: { create: {} }
    }
  });

  return NextResponse.json({ orderNumber: order.orderNumber }, { status: 201 });
}
