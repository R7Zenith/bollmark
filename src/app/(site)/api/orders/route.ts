import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/format";
import { effectivePrice } from "@/lib/variant";
import { validateCoupon, CouponInvalidError } from "@/lib/coupons";
import { calculateShippingCents } from "@/lib/shipping";
import { notifyAdminNewOrder } from "@/lib/order-notifications";

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
  couponCode: z.string().optional(),
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

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Indirim de fiyat gibi hicbir zaman istemciden gelen deger uzerinden
      // hesaplanmaz - istemci sadece kupon KODUNU gonderir, tutar burada
      // (validateCoupon icinde) sunucuda yeniden hesaplanir. usedCount artisi
      // ayni transaction icinde yapilir ki yaris durumunda (iki musterinin
      // ayni kuponun son kullanim hakkini es zamanli tuketmesi) limit asilmasin.
      let discountCents = 0;
      let couponId: string | null = null;
      let freeShipping = false;
      if (data.couponCode) {
        const result = await validateCoupon(tx, data.couponCode, subtotalCents);
        if (!result.valid) {
          throw new CouponInvalidError(result.message);
        }
        discountCents = result.discountCents;
        freeShipping = result.freeShipping;
        couponId = result.couponId;
        await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
      }

      const shippingCents = calculateShippingCents(subtotalCents - discountCents, freeShipping);
      const totalCents = subtotalCents - discountCents + shippingCents;

      return tx.order.create({
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
          discountCents,
          couponId,
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
    });

    // Best-effort, transaction disinda (deleteBlobUrls ile ayni desen): ayni
    // e-posta icin acik (recoveredAt=null) terk edilmis sepet kayitlari
    // "kurtarildi" olarak isaretlenir - artik hatirlatma gonderilmez. Hata
    // olursa sadece loglanir, siparis olusturma basarisini etkilemez.
    await prisma.abandonedCart
      .updateMany({ where: { email: data.customerEmail, recoveredAt: null }, data: { recoveredAt: new Date() } })
      .catch((error) => console.error("Terk edilmiş sepet kurtarma işaretlemesi başarısız (yoksayıldı):", error));

    notifyAdminNewOrder(order).catch((error) => console.error("Yeni sipariş maili başarısız:", error));

    return NextResponse.json({ orderNumber: order.orderNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof CouponInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
