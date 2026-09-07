// Tek seferlik script: "yeni sipariş" rozetini gözle görmek için, henüz
// görüntülenmemiş (viewedAt: null) örnek bir test siparişi oluşturur.
// Rastgele bir ürün/varyant seçer, yoksa kalem fiyatlarını 0 kabul eder.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { generateOrderNumber } from "../src/lib/format";

async function main() {
  const variant = await prisma.productVariant.findFirst({
    include: { product: true }
  });

  if (!variant) {
    throw new Error("Veritabanında hiç ürün varyantı yok, önce bir ürün oluşturun.");
  }

  const unitPriceCents = variant.priceCents ?? variant.product.priceCents;
  const quantity = 2;
  const totalCents = unitPriceCents * quantity;
  const shippingCents = 0;

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      status: "PENDING_PAYMENT",
      customerName: "Ayşe Yılmaz",
      customerEmail: "ayse.yilmaz@example.com",
      customerPhone: "0532 123 45 67",
      shippingAddress: "Bağdat Caddesi No: 123 Daire: 4",
      city: "İstanbul",
      district: "Kadıköy",
      postalCode: "34710",
      note: "Kapıcıya teslim edilebilir.",
      subtotalCents: totalCents,
      discountCents: 0,
      shippingCents,
      totalCents: totalCents + shippingCents,
      viewedAt: null,
      items: {
        create: [
          {
            productId: variant.productId,
            variantId: variant.id,
            quantity,
            unitPriceCents,
            totalCents
          }
        ]
      }
    }
  });

  console.log(`Test siparişi oluşturuldu: ${order.orderNumber} (id: ${order.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
