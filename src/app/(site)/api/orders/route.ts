import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/format";
import { CouponInvalidError } from "@/lib/coupons";
import { LoyaltyInvalidError } from "@/lib/loyalty";
import { KalpCouponInvalidError, loadPriceLines, priceCart } from "@/lib/pricing/price-cart";
import { splitOrderItems } from "@/lib/kalp-topla/pricing";
import { customerAuthOptions } from "@/lib/customer-auth";
import { getPaymentSettings, getReadiness } from "@/lib/payment/settings";
import { localPaymentTest } from "@/lib/payment/iyzico/mode";
import { revalidateCatalog } from "@/lib/revalidate-catalog";
import { buildOrderMetaContext } from "@/lib/meta/capi";

const lineSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  quantity: z.number().int().positive(),
  // Musterinin ekranda gordugu birim fiyat (opsiyonel - eski istemciler
  // gondermeyebilir). Tutar HER ZAMAN DB fiyatindan hesaplanir; bu deger
  // yalnizca ekrandaki fiyatla farkli bir tutar tahsil edilmesin diye
  // uyusmazlikta siparisi durdurmak icin kullanilir.
  expectedPriceCents: z.number().int().nonnegative().optional()
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
  pointsToRedeem: z.number().int().nonnegative().optional(),
  kalpSelection: z.object({ manual: z.array(z.string()), removed: z.array(z.string()) }).optional(),
  // Ekrandaki Kalp Topla indirimi: kupon arada dolduysa ya da atama degistiyse
  // farkli tutar tahsil edilmesin diye uyusmazlikta siparis durur.
  expectedKalpDiscountCents: z.number().int().nonnegative().optional(),
  // Client tarafindaki "required" disable yetmez - mesafeli satis sozlesmesi
  // onayi sunucuda da zorunlu tutulur (fiyat/indirim ile ayni "istemciden
  // gelen degere guvenme" prensibi).
  termsAccepted: z.literal(true, { message: "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylamalısınız." }),
  lines: z.array(lineSchema).min(1)
});

// Sipariş "PENDING_PAYMENT" + paymentStatus "UNPAID" olarak oluşturulur; ödeme
// /api/odeme/baslat ile başlar ve iyzico sonucu doğrulanınca (lib/payment/orders/reconcile.ts)
// sipariş PAID olur. Mail, sepet temizleme ve stok düşümü ödeme doğrulanınca yapılır.
// Sanal POS hazır değilse sipariş HİÇ oluşturulmaz (ödemesiz sahte sipariş olmasın).
const ORDER_NUMBER_RETRIES = 5;

// Uye kilidi ve kupon ayirma varsayilan 5 sn'yi asabilir (bar.ts ile ayni deger).
const ORDER_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

class KalpPriceChangedError extends Error {}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

const priceChangedResponse = () =>
  NextResponse.json(
    { code: "PRICE_CHANGED", error: "Sepetinizdeki bazı ürünlerin fiyatı güncellendi. Lütfen fiyatları kontrol edip tekrar deneyin." },
    { status: 409 }
  );

export async function POST(req: NextRequest) {
  const paymentSettings = await getPaymentSettings();
  if (!getReadiness(paymentSettings).ready) {
    return NextResponse.json(
      { error: "Ödeme sistemi şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Giris yapmis musteri varsa siparis otomatik hesabina baglanir ve puan
  // kazanir - misafir siparişte customerId null kalir, davranis degismez.
  const customerSession = await getServerSession(customerAuthOptions);
  const customerId = customerSession?.user?.id ?? null;

  // Fiyat hicbir zaman istemciden gelen deger uzerinden hesaplanmaz - her
  // satirin gecerli fiyati (varyant override'i veya urunun genel fiyati)
  // burada veritabanindan yeniden okunur. Bu hem musterinin gordugu fiyatla
  // sipariş tutarinin her zaman tutarli olmasini saglar, hem de istemci
  // tarafinda degistirilmis bir fiyatla siparis verilmesini engeller.
  const resolvedLines = await loadPriceLines(prisma, data.lines);
  if (!resolvedLines) {
    return NextResponse.json({ error: "Sepetteki bir ürün veya varyant artık mevcut değil." }, { status: 400 });
  }
  const priceChanged = data.lines.some(
    (line, index) => line.expectedPriceCents !== undefined && line.expectedPriceCents !== resolvedLines[index].priceCents
  );
  if (priceChanged) return priceChangedResponse();

  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  const defaultShippingCents = storeSettings?.defaultShippingCents ?? 0;
  // Odeme onayi baska bir istekte (webhook/cron) gelebilir: Purchase icin
  // siparis anindaki pazarlama rizasi ve tarayici baglami siparisle saklanir.
  const metaCapiContext = buildOrderMetaContext(req.cookies, req.headers);
  // Bu siparisle bir otomatik kampanyanin kullanim limiti doldu mu (createOrder icinde set edilir).
  let campaignExhausted = false;

  try {
    // orderNumber günlük 4 haneli rastgele sayıdır (@unique): nadir çakışmada tüm transaction
    // (kupon/puan düşümü dahil) geri alınır ve yeni numarayla yeniden denenir.
    let order: Awaited<ReturnType<typeof createOrder>> | undefined;
    for (let attempt = 1; attempt <= ORDER_NUMBER_RETRIES; attempt++) {
      try {
        order = await createOrder();
        break;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === ORDER_NUMBER_RETRIES) throw error;
      }
    }
    if (!order) throw new Error("Sipariş oluşturulamadı.");

    // Limiti dolan otomatik kampanya artik gecerli degil: onbellekteki urun
    // sayfalari/katalog indirimli fiyati gostermeyi biraksin. Best-effort.
    if (campaignExhausted) {
      try {
        revalidateCatalog();
      } catch (error) {
        console.error("Katalog tazeleme başarısız (yoksayıldı):", error);
      }
    }

    return NextResponse.json({ orderNumber: order.orderNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof CouponInvalidError || error instanceof LoyaltyInvalidError || error instanceof KalpCouponInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof KalpPriceChangedError) return priceChangedResponse();
    throw error;
  }

  function createOrder() {
    return prisma.$transaction(async (tx) => {
      // Indirimlerin tamami HER ZAMAN sunucuda, tek fonksiyonda hesaplanir
      // (lib/pricing/price-cart.ts) - istemci yalniz kupon KODUNU, kalp secimini
      // ve puan SAYISINI gonderir. usedCount artisi ayni transaction icinde
      // yapilir ki yaris durumunda (iki musterinin ayni kampanyanin son
      // kullanim hakkini es zamanli tuketmesi) limit asilmasin.
      const price = await priceCart(tx, {
        customerId,
        lines: resolvedLines!,
        couponCode: data.couponCode ?? null,
        kalpSelection: data.kalpSelection,
        pointsToRedeem: data.pointsToRedeem,
        defaultShippingCents,
        mode: "ORDER"
      });
      if (data.expectedKalpDiscountCents !== undefined && data.expectedKalpDiscountCents !== price.kalpDiscountCents) {
        throw new KalpPriceChangedError();
      }
      const result = price.best;
      if (data.couponCode && result.codeMessage && result.couponId == null) {
        throw new CouponInvalidError(result.codeMessage);
      }
      const { subtotalCents, bundleDiscountCents, kalpDiscountCents, pointsRedeemed, loyaltyDiscountCents, shippingCents, totalCents } = price;
      const discountCents = result.discountCents;
      const couponId = result.couponId;
      if (couponId) {
        const coupon = await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
        campaignExhausted = coupon.code === null && coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit;
      }

      const createdOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          customerId,
          shippingAddress: data.shippingAddress,
          city: data.city,
          district: data.district,
          postalCode: data.postalCode,
          // Yerel sandbox siparisi Vega'da bulunabilsin (SiparisNotu olarak gider).
          note: localPaymentTest() ? ["LOCAL TEST", data.note].filter(Boolean).join(" | ") : data.note,
          subtotalCents,
          discountCents,
          couponId,
          bundleDiscountCents,
          kalpDiscountCents,
          pointsRedeemed,
          loyaltyDiscountCents,
          shippingCents,
          totalCents,
          termsAcceptedAt: new Date(),
          metaCapiContext,
          paymentStatus: "UNPAID",
          paymentExpiresAt: new Date(Date.now() + paymentSettings.orderExpiryMinutes * 60 * 1000),
          items: { create: splitOrderItems(resolvedLines!, price.assignments) },
          shipment: { create: {} }
        }
      });

      if (pointsRedeemed > 0 && customerId) {
        await tx.loyaltyTransaction.create({
          data: { customerId, points: -pointsRedeemed, reason: "SIPARIS_KULLANIM", orderId: createdOrder.id }
        });
        await tx.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { decrement: pointsRedeemed } } });
      }

      return createdOrder;
    }, ORDER_TX_OPTIONS);
  }
}
