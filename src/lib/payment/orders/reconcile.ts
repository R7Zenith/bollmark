import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { getCredentials, getPaymentSettings } from "@/lib/payment/settings";
import { iyzicoPost } from "@/lib/payment/iyzico/client";
import { decimalToCents } from "@/lib/payment/iyzico/money";
import { logPayment } from "@/lib/payment/log";
import { SHIPPING_ITEM_ID } from "@/lib/payment/orders/basket";
import { evaluateRetrieve, type PaidDetails, type RetrieveResponse } from "@/lib/payment/orders/evaluate";
import { notifyAdminNewOrder, notifyAdminPaymentAttention, notifyCustomerOrderReceived } from "@/lib/order-notifications";

// Odeme sonucunun TEK dogruluk kaynagi: yonlendirmedeki/webhook'taki hicbir alana
// guvenilmez, sonuc her zaman token ile iyzico'dan sorgulanir (bkz. plan 5.B).
// Bu dosyadaki tum durum gecisleri kosullu updateMany ile "kazanan tek istek" mantigiyla
// yapilir; callback yenileme, webhook + callback cakismasi, cift tik yan etkileri
// (stok, mail, durum) yalnizca BIR kez calistirir.

const RETRIEVE_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail";

export type ReconcileSource = "callback" | "webhook" | "cron" | "admin" | "poll";

export type ReconcileResult = {
  kind: "unknown" | "already" | "paid" | "double" | "late" | "review" | "failed" | "pending" | "invalid" | "error";
  orderNumber?: string;
  orderId?: string;
};

type Tx = Prisma.TransactionClient;

function appendNote(existing: string | null, addition: string): string {
  const combined = existing ? `${existing} | ${addition}` : addition;
  return combined.slice(0, 900);
}

// Ayni varyanttan birden cok satir olabilir: toplanip tek atomik dusum yapilir.
// Yetersiz stokta siparis GERI ALINMAZ (para alindi); admin'e not dusulur.
async function decrementStock(tx: Tx, items: { variantId: string | null; quantity: number }[]): Promise<string[]> {
  const needed = new Map<string, number>();
  for (const item of items) {
    if (item.variantId) needed.set(item.variantId, (needed.get(item.variantId) ?? 0) + item.quantity);
  }
  const problems: string[] = [];
  for (const [variantId, quantity] of needed) {
    const result = await tx.productVariant.updateMany({
      where: { id: variantId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } }
    });
    if (result.count !== 1) problems.push(`stok yetersiz (varyant ${variantId}, ${quantity} adet)`);
  }
  return problems;
}

// Odeme dogrulaninca (best-effort, hata akisi bozmaz): tek birlesik onay maili + admin
// bildirimi, terk edilmis sepeti "kurtarildi" isaretleme, denetim kaydi.
async function afterPaid(orderId: string, detail: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { select: { name: true } } } } }
  });
  if (!order) return;
  await Promise.allSettled([
    notifyAdminNewOrder(order),
    notifyCustomerOrderReceived(
      order,
      order.items.map((item) => ({ productName: item.product.name, quantity: item.quantity, totalCents: item.totalCents }))
    ),
    prisma.abandonedCart.updateMany({
      where: { email: order.customerEmail, recoveredAt: null },
      data: { recoveredAt: new Date() }
    }),
    logAudit({
      actorEmail: "iyzico",
      actorRole: "SISTEM",
      action: "ORDER_STATUS_CHANGED",
      targetType: "Order",
      targetId: order.id,
      detail
    })
  ]);
}

async function notifyAttention(orderId: string, note: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order) await notifyAdminPaymentAttention(order, note).catch((e) => console.error("Admin ödeme uyarı maili başarısız:", e));
}

type PaidOutcome = { kind: "paid" | "double" | "late"; note: string | null } | { kind: "lost" };

async function applyPaid(attemptId: string, details: PaidDetails): Promise<PaidOutcome> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentAttempt.updateMany({
      where: { id: attemptId, status: { in: ["INITIATED", "REVIEW"] } },
      data: {
        status: "SUCCESS",
        paymentId: details.paymentId,
        paidCents: details.paidCents,
        installment: details.installment,
        fraudStatus: details.fraudStatus ?? 1,
        cardAssociation: details.cardAssociation,
        cardType: details.cardType,
        cardFamily: details.cardFamily,
        binNumber: details.binNumber,
        lastFourDigits: details.lastFourDigits,
        errorCode: null,
        errorMessage: null,
        completedAt: new Date()
      }
    });
    if (claimed.count !== 1) return { kind: "lost" as const };

    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const order = await tx.order.findUniqueOrThrow({ where: { id: attempt.orderId }, include: { items: true } });

    // Cift odeme: siparis zaten odenmis (veya elle ilerletilmis) iken ikinci basarili odeme.
    // Attempt kaydedildi (para alindi); otomatik iade YOK, admin'e "iade edin" notu.
    const alreadyPaid = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(order.paymentStatus);
    if (alreadyPaid || (order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED")) {
      const note = `ÇİFT ÖDEME — iade edin (ödeme ${details.paymentId}, ${(details.paidCents / 100).toFixed(2)} TL)`;
      await tx.order.update({
        where: { id: order.id },
        data: { needsAttention: true, attentionNote: appendNote(order.attentionNote, note) }
      });
      return { kind: "double" as const, note };
    }

    const late = order.status === "CANCELLED";
    const notes: string[] = [];

    // itemTransactions -> OrderItem.paymentTransactionId (kalem bazli iade icin sart)
    const itemIds = new Set(order.items.map((item) => item.id));
    let shippingTransactionId: string | null = null;
    let shippingPaidCents: number | null = null;
    for (const transaction of details.itemTransactions) {
      const transactionId = transaction.paymentTransactionId === undefined ? null : String(transaction.paymentTransactionId);
      if (!transaction.itemId || !transactionId) continue;
      let paidCents: number | null = null;
      try {
        paidCents = decimalToCents(transaction.paidPrice ?? transaction.price ?? "");
      } catch {
        paidCents = null;
      }
      if (transaction.itemId === SHIPPING_ITEM_ID) {
        shippingTransactionId = transactionId;
        shippingPaidCents = paidCents;
      } else if (itemIds.has(transaction.itemId)) {
        await tx.orderItem.update({
          where: { id: transaction.itemId },
          data: { paymentTransactionId: transactionId, paidCents }
        });
      }
    }
    if (order.shippingCents > 0 && !shippingTransactionId) notes.push("kargo kalemi için işlem numarası alınamadı");
    const mappedItems = details.itemTransactions.filter((t) => t.itemId && itemIds.has(t.itemId)).length;
    if (mappedItems !== order.items.length) notes.push("bazı kalemlerin ödeme işlem numarası eşleşmedi (iade için iyzico panelini kontrol edin)");

    if (late) {
      notes.push(
        `GEÇ ÖDEME — sipariş süresi dolup iptal edildikten sonra ödeme alındı (ödeme ${details.paymentId}); elle iade edin veya siparişi yeniden açın`
      );
    } else {
      notes.push(...(await decrementStock(tx, order.items)));
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        ...(late ? {} : { status: "PAID" }),
        paymentStatus: "PAID",
        paymentProvider: "IYZICO",
        paymentMode: attempt.mode,
        paidAt: new Date(),
        paidCents: details.paidCents,
        installment: details.installment,
        shippingPaymentTransactionId: shippingTransactionId,
        shippingPaidCents,
        paymentExpiresAt: null,
        ...(notes.length > 0 ? { needsAttention: true, attentionNote: appendNote(order.attentionNote, notes.join("; ")) } : {})
      }
    });
    return { kind: late ? ("late" as const) : ("paid" as const), note: notes.length > 0 ? notes.join("; ") : null };
  });
}

async function applyReview(attemptId: string, details: PaidDetails | null, reason: string, fraud: boolean): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentAttempt.updateMany({
      where: { id: attemptId, status: "INITIATED" },
      data: {
        status: "REVIEW",
        errorMessage: reason.slice(0, 300),
        ...(details
          ? {
              paymentId: details.paymentId || null,
              paidCents: details.paidCents,
              installment: details.installment,
              fraudStatus: details.fraudStatus,
              cardAssociation: details.cardAssociation,
              cardType: details.cardType,
              cardFamily: details.cardFamily,
              binNumber: details.binNumber,
              lastFourDigits: details.lastFourDigits
            }
          : {})
      }
    });
    if (claimed.count !== 1) return false;
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const note = fraud
      ? "iyzico ödemeyi dolandırıcılık incelemesine aldı — sonuç netleşene kadar HAZIRLAMA/KARGOLAMA YAPMAYIN"
      : `İNCELE: iyzico ödeme başarılı diyor ama doğrulama başarısız (${reason}) — kargolamayın`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: attempt.orderId } });
    await tx.order.updateMany({
      where: { id: order.id, paymentStatus: { in: ["UNPAID", "FAILED"] } },
      data: { paymentStatus: "REVIEW", needsAttention: true, attentionNote: appendNote(order.attentionNote, note) }
    });
    return true;
  });
}

async function applyFailed(attemptId: string, errorCode: string | null, errorMessage: string | null): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentAttempt.updateMany({
      where: { id: attemptId, status: { in: ["INITIATED", "REVIEW"] } },
      data: { status: "FAILED", errorCode, errorMessage: errorMessage?.slice(0, 300) ?? null, completedAt: new Date() }
    });
    if (claimed.count !== 1) return false;
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    // Baska bir deneme basarili/incelemede olabilir: siparisin odeme durumu yalnizca
    // henuz odenmemis siparislerde FAILED'a cekilir.
    const stillOpen = await tx.paymentAttempt.count({
      where: { orderId: attempt.orderId, id: { not: attemptId }, status: { in: ["INITIATED", "REVIEW"] } }
    });
    if (stillOpen === 0) {
      await tx.order.updateMany({
        where: { id: attempt.orderId, paymentStatus: { in: ["UNPAID", "FAILED", "REVIEW"] } },
        data: { paymentStatus: "FAILED", needsAttention: false, attentionNote: null }
      });
    }
    return true;
  });
}

export async function reconcileToken(token: string, source: ReconcileSource): Promise<ReconcileResult> {
  const attempt = await prisma.paymentAttempt.findUnique({ where: { token }, include: { order: true } });
  if (!attempt) return { kind: "unknown" };
  const base = { orderNumber: attempt.order.orderNumber, orderId: attempt.orderId };
  if (["SUCCESS", "FAILED", "EXPIRED"].includes(attempt.status)) return { kind: "already", ...base };

  const settings = await getPaymentSettings();
  const credentials = getCredentials(settings, attempt.mode === "LIVE" ? "LIVE" : "SANDBOX");
  if (!credentials) {
    await logPayment({ kind: "RETRIEVE", ok: false, orderId: attempt.orderId, attemptId: attempt.id, summary: `(${source}) anahtarlar çözülemedi` });
    return { kind: "error", ...base };
  }

  // Ag/DB hatasi yukari firlar: cagiran taraf (webhook 5xx, callback "dogrulaniyor") karar verir.
  const { httpStatus, data } = await iyzicoPost<RetrieveResponse>(
    attempt.mode === "LIVE" ? "LIVE" : "SANDBOX",
    credentials,
    RETRIEVE_PATH,
    { locale: "tr", conversationId: attempt.id, token: attempt.token }
  );

  const evaluation = evaluateRetrieve({
    res: data,
    attempt: { id: attempt.id, token: attempt.token },
    order: { orderNumber: attempt.order.orderNumber, totalCents: attempt.order.totalCents },
    secretKey: credentials.secretKey
  });
  const log = (ok: boolean, summary: string, errorCode?: string) =>
    logPayment({ kind: "RETRIEVE", ok, orderId: attempt.orderId, attemptId: attempt.id, httpStatus, errorCode, summary: `(${source}) ${summary}` });

  switch (evaluation.outcome) {
    case "PAID": {
      const outcome = await applyPaid(attempt.id, evaluation.details);
      if (outcome.kind === "lost") {
        await log(true, "PAID — başka bir istek zaten işledi");
        return { kind: "already", ...base };
      }
      await log(true, `PAID → ${outcome.kind}${outcome.note ? `; not: ${outcome.note}` : ""}`);
      if (outcome.kind === "paid") await afterPaid(attempt.orderId, `PENDING_PAYMENT -> PAID (iyzico, ${source})`);
      if (outcome.note) await notifyAttention(attempt.orderId, outcome.note);
      return { kind: outcome.kind, ...base };
    }
    case "REVIEW": {
      const changed = await applyReview(attempt.id, evaluation.details, "fraudStatus 0 (inceleniyor)", true);
      await log(true, `REVIEW (fraudStatus 0)${changed ? "" : " — zaten kayıtlı"}`);
      if (changed) await notifyAttention(attempt.orderId, "iyzico ödemeyi dolandırıcılık incelemesine aldı.");
      return { kind: "review", ...base };
    }
    case "FAILED": {
      const changed = await applyFailed(attempt.id, evaluation.errorCode, evaluation.errorMessage);
      await log(false, `FAILED${changed ? "" : " — zaten kayıtlı"}`, evaluation.errorCode ?? undefined);
      return { kind: changed ? "failed" : "already", ...base };
    }
    case "INVALID": {
      const changed = await applyReview(attempt.id, evaluation.details, evaluation.reason, false);
      await log(false, `INVALID — ${evaluation.reason}`);
      if (changed) await notifyAttention(attempt.orderId, `Ödeme doğrulaması başarısız: ${evaluation.reason}`);
      return { kind: "invalid", ...base };
    }
    case "PENDING":
      await log(true, "PENDING — ödeme henüz tamamlanmadı");
      return { kind: "pending", ...base };
    case "ERROR":
      await log(false, `iyzico hatası: ${evaluation.errorMessage ?? ""}`.trim(), evaluation.errorCode ?? undefined);
      return { kind: "error", ...base };
  }
}

// Tutari 0 olan (tamamen indirimli) siparis: iyzico'ya gitmeden odenmis sayilir.
export async function finalizeFreeOrder(orderId: string): Promise<void> {
  const won = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT", paymentStatus: { in: ["UNPAID", "FAILED"] }, totalCents: 0 },
      data: { status: "PAID", paymentStatus: "PAID", paymentProvider: "NONE", paidAt: new Date(), paidCents: 0, paymentExpiresAt: null }
    });
    if (claimed.count !== 1) return false;
    const items = await tx.orderItem.findMany({ where: { orderId } });
    const problems = await decrementStock(tx, items);
    if (problems.length > 0) {
      await tx.order.update({ where: { id: orderId }, data: { needsAttention: true, attentionNote: problems.join("; ") } });
    }
    return true;
  });
  if (won) {
    await logPayment({ kind: "RECONCILE", ok: true, orderId, summary: "Tutarı 0 olan sipariş ödeme gerektirmeden sonlandırıldı" });
    await afterPaid(orderId, "PENDING_PAYMENT -> PAID (ödeme gerekmedi, tutar 0)");
  }
}
