"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { formatPrice } from "@/lib/format";
import { notifyCustomerRefund } from "@/lib/order-notifications";
import { extractIp } from "@/lib/payment/orders/buyer";
import { reconcileToken } from "@/lib/payment/orders/reconcile";
import { parseTlToCents, SHIPPING_LINE_KEY } from "@/lib/payment/orders/refund-math";
import {
  refundReasons,
  requestCancel,
  requestFullRefund,
  requestLineRefund,
  resolvePendingRefund,
  type RefundOutcome,
  type RefundReason
} from "@/lib/payment/orders/refund";

// Tum iade/iptal/mutabakat eylemleri yalnizca ADMIN'e aciktir. Server action'lar dogrudan POST ile de
// cagrilabildigi icin yetki her action'in icinde kontrol edilir (bkz. Next.js "Mutating Data" rehberi).

const page = (id: string) => `/admin/siparisler/${id}`;

function done(id: string, code: string): never {
  revalidatePath(page(id));
  redirect(`${page(id)}?basarili=${code}#odeme`);
}

function fail(id: string, code: string, message?: string): never {
  revalidatePath(page(id));
  const query = message ? `&mesaj=${encodeURIComponent(message.slice(0, 250))}` : "";
  redirect(`${page(id)}?hata=${code}${query}#odeme`);
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function requestContext(formData: FormData) {
  const session = await requireAdmin();
  const reasonRaw = text(formData, "reason");
  const reason: RefundReason = (refundReasons as readonly string[]).includes(reasonRaw) ? (reasonRaw as RefundReason) : "BUYER_REQUEST";
  const description = text(formData, "description").slice(0, 250) || null;
  const requestHeaders = await headers();
  return {
    actorEmail: session.user?.email ?? "bilinmiyor",
    reason,
    description,
    restock: formData.get("restock") === "on",
    ip: extractIp(requestHeaders)
  };
}

async function afterRefundEffects(orderId: string, actorEmail: string, amountCents: number, fullyRefunded: boolean, detail: string, action: "PAYMENT_REFUND_CREATED" | "PAYMENT_CANCEL_CREATED") {
  await logAudit({ actorEmail, actorRole: "ADMIN", action, targetType: "Order", targetId: orderId, detail });
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order) await notifyCustomerRefund(order, amountCents, fullyRefunded).catch((e) => console.error("İade bildirim maili başarısız:", e));
}

function failMessage(outcome: RefundOutcome): string {
  return outcome.ok ? "" : outcome.message;
}

// scope: "ALL" = tam iade (kalan tutari olan tum kalemler), aksi halde tek kalem/kargo (tutar bos = kalanin tamami).
export async function refundPaymentAction(orderId: string, formData: FormData) {
  const context = await requestContext(formData);
  const scope = text(formData, "scope");
  const request = { orderId, ...context };

  if (scope === "ALL") {
    const result = await requestFullRefund(request);
    if (result.completed > 0) {
      await afterRefundEffects(
        orderId,
        context.actorEmail,
        result.totalCents,
        !result.outcome && result.skipped.length === 0,
        `Tam iade: ${result.completed} kalem, ${formatPrice(result.totalCents)}, sebep ${context.reason}${result.outcome ? " (yarım kaldı)" : ""}`,
        "PAYMENT_REFUND_CREATED"
      );
    }
    if (result.outcome) {
      fail(orderId, "iade-basarisiz", `${result.completed > 0 ? `${result.completed} kalem iade edildi, sonra durdu: ` : ""}${failMessage(result.outcome)}`);
    }
    if (result.completed === 0) fail(orderId, "iade-basarisiz", "İade edilecek tutar kalmadı.");
    if (result.skipped.length > 0) fail(orderId, "iade-basarisiz", `İade edildi ancak işlem numarası olmayan kalemler atlandı: ${result.skipped.join(", ")}. Bunları iyzico panelinden iade edin.`);
    done(orderId, "iade-yapildi");
  }

  const amountText = text(formData, "amount");
  const amountCents = amountText ? parseTlToCents(amountText) : null;
  if (amountText && amountCents === null) fail(orderId, "iade-basarisiz", "İade tutarı geçersiz (örnek: 150,50).");

  const outcome = await requestLineRefund({ ...request, lineKey: scope, amountCents });
  if (!outcome.ok) fail(orderId, "iade-basarisiz", outcome.message);
  await afterRefundEffects(
    orderId,
    context.actorEmail,
    outcome.amountCents,
    outcome.fullyRefunded,
    `${scope === SHIPPING_LINE_KEY ? "Kargo" : "Kalem"} iadesi: ${formatPrice(outcome.amountCents)}, sebep ${context.reason}`,
    "PAYMENT_REFUND_CREATED"
  );
  done(orderId, "iade-yapildi");
}

export async function cancelPaymentAction(orderId: string, formData: FormData) {
  const context = await requestContext(formData);
  const outcome = await requestCancel({ orderId, ...context });
  if (!outcome.ok) fail(orderId, "iptal-basarisiz", outcome.message);
  await afterRefundEffects(
    orderId,
    context.actorEmail,
    outcome.amountCents,
    true,
    `Ödeme iptali (tam tutar): ${formatPrice(outcome.amountCents)}, sebep ${context.reason}`,
    "PAYMENT_CANCEL_CREATED"
  );
  done(orderId, "iptal-yapildi");
}

// iyzico'dan durumu sorgula: bekleyen/incelemedeki/basarisiz denemeleri ortak reconcile ile yeniden dogrular.
export async function reconcileOrderAction(orderId: string) {
  const session = await requireAdmin();
  const attempts = await prisma.paymentAttempt.findMany({
    where: { orderId, status: { in: ["INITIATED", "REVIEW", "FAILED"] } },
    orderBy: { createdAt: "asc" }
  });
  const results: string[] = [];
  try {
    for (const attempt of attempts) {
      const result = await reconcileToken(attempt.token, "admin");
      results.push(result.kind);
    }
  } catch (error) {
    console.error("Elle ödeme sorgusu başarısız:", error);
    fail(orderId, "sorgu-basarisiz");
  }
  await logAudit({
    actorEmail: session.user?.email ?? "bilinmiyor",
    actorRole: "ADMIN",
    action: "PAYMENT_MANUAL_RECONCILE",
    targetType: "Order",
    targetId: orderId,
    detail: attempts.length === 0 ? "sorgulanacak deneme yok" : `sonuç: ${results.join(", ")}`
  });
  done(orderId, "sorgulandi");
}

export async function clearAttentionAction(orderId: string) {
  const session = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { attentionNote: true } });
  await prisma.order.update({ where: { id: orderId }, data: { needsAttention: false, attentionNote: null } });
  await logAudit({
    actorEmail: session.user?.email ?? "bilinmiyor",
    actorRole: "ADMIN",
    action: "PAYMENT_ATTENTION_CLEARED",
    targetType: "Order",
    targetId: orderId,
    detail: (order?.attentionNote ?? "").slice(0, 300)
  });
  done(orderId, "uyari-kapatildi");
}

export async function resolvePendingRefundAction(orderId: string, refundId: string, result: "SUCCESS" | "FAILED") {
  const session = await requireAdmin();
  const outcome = await resolvePendingRefund(refundId, result);
  if (!outcome.ok) fail(orderId, "iade-basarisiz", outcome.message);
  await logAudit({
    actorEmail: session.user?.email ?? "bilinmiyor",
    actorRole: "ADMIN",
    action: "PAYMENT_REFUND_RESOLVED",
    targetType: "Order",
    targetId: orderId,
    detail: `kayıt ${refundId}: ${result === "SUCCESS" ? "yapıldı" : "yapılmadı"} olarak sonuçlandırıldı`
  });
  done(orderId, "kayit-sonuclandi");
}
