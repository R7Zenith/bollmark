import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { getCredentials, getPaymentSettings, getReadiness } from "@/lib/payment/settings";
import { iyzicoPost, IyzicoTransportError, type IyzicoBaseResponse } from "@/lib/payment/iyzico/client";
import { centsToDecimalString } from "@/lib/payment/iyzico/money";
import { verifyInitializeSignature } from "@/lib/payment/iyzico/signature";
import { describePaymentError } from "@/lib/payment/iyzico/errors";
import { logPayment } from "@/lib/payment/log";
import { BasketError, buildBasketItems } from "@/lib/payment/orders/basket";
import { BuyerError, buildBuyerAndAddresses } from "@/lib/payment/orders/buyer";
import { finalizeFreeOrder } from "@/lib/payment/orders/reconcile";

export type InitializeResult =
  | { ok: true; paymentPageUrl: string }
  | { ok: true; free: true }
  | { ok: false; status: number; message: string };

const INIT_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const ALLOWED_INSTALLMENTS = [1, 2, 3, 6, 9, 12];
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
// iyzico CF token'i 30 dk gecerli (sandbox'ta tokenExpireTime=1800 gozlendi): aktif odeme
// sirasinda siparis suresi dolmasin diye her baslatmada en az bu kadar uzatilir.
const MIN_PAYMENT_WINDOW_MS = 30 * 60 * 1000;

const GENERIC_ERROR = "Ödeme başlatılamadı. Lütfen birkaç dakika sonra tekrar deneyin.";

type InitResponse = IyzicoBaseResponse & { token?: string; paymentPageUrl?: string; signature?: string };

const fail = (status: number, message: string): InitializeResult => ({ ok: false, status, message });

export async function initializePayment(orderNumber: string, ip: string): Promise<InitializeResult> {
  const settings = await getPaymentSettings();
  const readiness = getReadiness(settings);
  if (!readiness.ready) return fail(503, "Ödeme sistemi şu an kullanılamıyor.");
  const mode = readiness.mode;
  const credentials = getCredentials(settings, mode);
  if (!credentials) return fail(503, "Ödeme sistemi şu an kullanılamıyor.");

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { product: { include: { category: true } } } } }
  });
  if (!order || order.deletedAt) return fail(404, "Sipariş bulunamadı.");
  if (order.paymentStatus === "PAID" || order.paymentStatus === "REVIEW") {
    return fail(409, "Bu siparişin ödemesi zaten alındı veya inceleniyor.");
  }
  if (order.status !== "PENDING_PAYMENT") return fail(409, "Bu sipariş için ödeme alınamaz.");
  if (order.paymentExpiresAt && order.paymentExpiresAt.getTime() < Date.now()) {
    return fail(410, "Sipariş süresi doldu. Lütfen sepetinizden yeniden sipariş verin.");
  }

  // Hiz siniri: ayni siparise 10 dakikada en fazla 5 baslatma
  const recentAttempts = await prisma.paymentAttempt.count({
    where: { orderId: order.id, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } }
  });
  if (recentAttempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    return fail(429, "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.");
  }

  // Stok, her satir icin yeniden kontrol edilir (ayni varyant birden cok satirsa toplanir)
  const variantIds = order.items.map((i) => i.variantId).filter((id): id is string => Boolean(id));
  const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds } } });
  const stockByVariant = new Map(variants.map((v) => [v.id, v.stock]));
  const neededByVariant = new Map<string, number>();
  for (const item of order.items) {
    if (item.variantId) neededByVariant.set(item.variantId, (neededByVariant.get(item.variantId) ?? 0) + item.quantity);
  }
  for (const [variantId, needed] of neededByVariant) {
    if ((stockByVariant.get(variantId) ?? 0) < needed) {
      return fail(409, "Sepetinizdeki bir ürünün stoğu tükendi. Lütfen sepetinizi güncelleyip tekrar deneyin.");
    }
  }

  // Tutari sifir olan (tamamen indirimli) siparis iyzico'ya gitmeden sonlandirilir.
  if (order.totalCents === 0) {
    await finalizeFreeOrder(order.id);
    return { ok: true, free: true };
  }

  let phoneOrNameError: string | null = null;
  let requestBody: Record<string, unknown> | null = null;
  const attemptId = randomUUID();
  try {
    const basketItems = buildBasketItems({
      lines: order.items.map((item) => ({
        id: item.id,
        name: item.product.name.slice(0, 200),
        category: item.product.category?.name ?? "Giyim",
        lineTotalCents: item.totalCents
      })),
      shippingCents: order.shippingCents,
      totalCents: order.totalCents
    });
    const { buyer, shippingAddress, billingAddress } = buildBuyerAndAddresses(order, ip);
    const price = centsToDecimalString(order.totalCents);
    requestBody = {
      locale: "tr",
      conversationId: attemptId,
      price,
      paidPrice: price,
      currency: "TRY",
      basketId: order.orderNumber,
      paymentGroup: "PRODUCT",
      callbackUrl: `${getSiteUrl()}/api/odeme/iyzico/callback`,
      enabledInstallments: ALLOWED_INSTALLMENTS.filter((n) => n <= settings.maxInstallment),
      buyer,
      shippingAddress,
      billingAddress,
      basketItems: basketItems.map((item) => ({
        id: item.id,
        name: item.name,
        category1: item.category1,
        itemType: "PHYSICAL",
        price: centsToDecimalString(item.priceCents)
      }))
    };
  } catch (error) {
    if (error instanceof BuyerError) {
      phoneOrNameError =
        error.field === "phone"
          ? "Telefon numarası geçersiz. Lütfen 05XX XXX XX XX biçiminde girin."
          : "Ad soyad geçersiz.";
    } else if (error instanceof BasketError) {
      // Sepet toplami tutmuyorsa iyzico'ya HIC gidilmez (bkz. plan 5.A).
      await logPayment({ kind: "INIT", ok: false, orderId: order.id, summary: `Sepet oluşturulamadı: ${error.message}` });
      return fail(500, GENERIC_ERROR);
    } else {
      throw error;
    }
  }
  if (phoneOrNameError || !requestBody) return fail(400, phoneOrNameError ?? GENERIC_ERROR);

  let response: { httpStatus: number; data: InitResponse };
  try {
    response = await iyzicoPost<InitResponse>(mode, credentials, INIT_PATH, requestBody);
  } catch (error) {
    const message = error instanceof IyzicoTransportError ? error.message : "Beklenmeyen hata.";
    await logPayment({ kind: "INIT", ok: false, orderId: order.id, attemptId, summary: `Başlatma isteği başarısız: ${message}` });
    return fail(502, GENERIC_ERROR);
  }

  const { httpStatus, data } = response;
  const valid =
    data.status === "success" &&
    typeof data.token === "string" &&
    typeof data.paymentPageUrl === "string" &&
    verifyInitializeSignature(data, credentials.secretKey) &&
    data.conversationId === attemptId;

  if (!valid) {
    const errorCode = data.errorCode ? String(data.errorCode) : undefined;
    const reason =
      data.status === "success" ? "yanıt doğrulanamadı (imza/alanlar)" : `iyzico hatası ${errorCode ?? ""} ${data.errorMessage ?? ""}`.trim();
    await prisma.paymentAttempt.create({
      data: {
        id: attemptId,
        orderId: order.id,
        mode,
        token: `failed-${attemptId}`,
        conversationId: attemptId,
        status: "FAILED",
        errorCode: errorCode ?? null,
        errorMessage: reason.slice(0, 300),
        completedAt: new Date()
      }
    });
    await logPayment({ kind: "INIT", ok: false, orderId: order.id, attemptId, httpStatus, errorCode, summary: `Başlatma reddedildi: ${reason}` });
    return fail(502, describePaymentError(errorCode));
  }

  await prisma.$transaction([
    prisma.paymentAttempt.create({
      data: { id: attemptId, orderId: order.id, mode, token: data.token!, conversationId: attemptId, status: "INITIATED" }
    }),
    prisma.order.update({
      where: { id: order.id },
      data: {
        paymentProvider: "IYZICO",
        paymentMode: mode,
        ...(order.paymentStatus === "FAILED" ? { paymentStatus: "UNPAID" } : {}),
        paymentExpiresAt: new Date(Math.max(order.paymentExpiresAt?.getTime() ?? 0, Date.now() + MIN_PAYMENT_WINDOW_MS))
      }
    })
  ]);
  await logPayment({ kind: "INIT", ok: true, orderId: order.id, attemptId, httpStatus, summary: `Ödeme başlatıldı (${mode})` });
  return { ok: true, paymentPageUrl: data.paymentPageUrl! };
}
