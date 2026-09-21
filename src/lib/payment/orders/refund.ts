import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCredentials, getPaymentSettings } from "@/lib/payment/settings";
import { iyzicoPost, IyzicoTransportError, type IyzicoCredentials } from "@/lib/payment/iyzico/client";
import { describeAdminError } from "@/lib/payment/iyzico/errors";
import { centsToDecimalString } from "@/lib/payment/iyzico/money";
import type { PaymentMode } from "@/lib/payment/iyzico/mode";
import { logPayment } from "@/lib/payment/log";
import {
  canCancelPayment,
  checkRefundAmount,
  nextRefundState,
  REFUNDABLE_PAYMENT_STATUSES,
  remainingCents,
  SHIPPING_LINE_KEY,
  type RefundLine
} from "@/lib/payment/orders/refund-math";

// Iade / iptal (bkz. plan 5.F). Akis: (1) siparis satiri kilitli transaction'da PENDING iade rezerve
// edilir (kalan tutar bekleyen iadeler dusulerek hesaplanir, cift tik/eszamanli istek fazla iade
// yapamaz), (2) iyzico cagrilir, (3) yalnizca BASARIDA sayaclar/durum degisir. Basarisizlikta
// sayaclar dokunulmaz. Ag/zaman asimi hatasinda sonuc BELIRSIZdir: kayit PENDING kalir (tutar
// rezerve kalir, ikinci iade engellenir), siparis "dikkat gerekiyor" olur, yonetici iyzico
// panelinden bakip kaydi elle sonuclandirir.

const REFUND_PATH = "/payment/refund";
const CANCEL_PATH = "/payment/cancel";
const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;

export const refundReasons = ["BUYER_REQUEST", "DOUBLE_PAYMENT", "FRAUD", "OTHER"] as const;
export type RefundReason = (typeof refundReasons)[number];

export const refundReasonLabel: Record<RefundReason, string> = {
  BUYER_REQUEST: "Müşteri talebi",
  DOUBLE_PAYMENT: "Çift ödeme",
  FRAUD: "Dolandırıcılık",
  OTHER: "Diğer"
};

type Tx = Prisma.TransactionClient;

export type RefundFailureCode =
  | "not-refundable"
  | "no-transaction"
  | "invalid-amount"
  | "exceeds"
  | "nothing-left"
  | "no-credentials"
  | "live-not-allowed"
  | "busy"
  | "iyzico-error"
  | "uncertain";

export type RefundOutcome =
  | { ok: true; refundId: string; amountCents: number; fullyRefunded: boolean }
  | { ok: false; code: RefundFailureCode; message: string };

const failure = (code: RefundFailureCode, message: string): RefundOutcome => ({ code, message, ok: false });

interface RefundApiResponse {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  hostReference?: string;
}

// ---- Kalemler ----

type OrderForLines = {
  shippingPaymentTransactionId: string | null;
  shippingPaidCents: number | null;
  shippingRefundedCents: number;
  items: {
    id: string;
    paymentTransactionId: string | null;
    paidCents: number | null;
    refundedCents: number;
    product?: { name: string } | null;
  }[];
  paymentRefunds: { status: string; kind: string; orderItemId: string | null; isShipping: boolean; amountCents: number }[];
};

export function buildRefundLines(order: OrderForLines): RefundLine[] {
  const pending = order.paymentRefunds.filter((refund) => refund.status === "PENDING" && refund.kind === "REFUND");
  const lines: RefundLine[] = order.items.map((item) => ({
    key: item.id,
    label: item.product?.name ?? "Ürün",
    paymentTransactionId: item.paymentTransactionId,
    paidCents: item.paidCents ?? 0,
    refundedCents: item.refundedCents,
    pendingCents: pending.filter((refund) => refund.orderItemId === item.id).reduce((sum, refund) => sum + refund.amountCents, 0)
  }));
  if ((order.shippingPaidCents ?? 0) > 0 || order.shippingPaymentTransactionId) {
    lines.push({
      key: SHIPPING_LINE_KEY,
      label: "Kargo",
      paymentTransactionId: order.shippingPaymentTransactionId,
      paidCents: order.shippingPaidCents ?? 0,
      refundedCents: order.shippingRefundedCents,
      pendingCents: pending.filter((refund) => refund.isShipping).reduce((sum, refund) => sum + refund.amountCents, 0)
    });
  }
  return lines;
}

// Siparis satirini kilitler: ayni siparis icin eszamanli iade/iptal istekleri sirayla islenir.
async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
}

const orderInclude = {
  items: { include: { product: { select: { name: true } } } },
  paymentRefunds: true,
  paymentAttempts: { where: { status: "SUCCESS" }, orderBy: { completedAt: "asc" as const }, take: 1 }
} satisfies Prisma.OrderInclude;

// Iade edilebilir tutarlar icin arayuz tarafinin okudugu gorunum (kilitsiz, salt okunur).
export async function getRefundView(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) return null;
  const lines = buildRefundLines(order);
  const attempt = order.paymentAttempts[0] ?? null;
  const refundedTotal = lines.reduce((sum, line) => sum + line.refundedCents, 0);
  const pendingTotal = order.paymentRefunds.filter((r) => r.status === "PENDING").reduce((sum, r) => sum + r.amountCents, 0);
  const refundable =
    order.paymentProvider === "IYZICO" &&
    (REFUNDABLE_PAYMENT_STATUSES as readonly string[]).includes(order.paymentStatus) &&
    attempt !== null &&
    order.deletedAt === null;
  return {
    lines,
    attempt,
    refundable,
    canCancel:
      refundable &&
      Boolean(attempt?.paymentId) &&
      canCancelPayment({ paymentStatus: order.paymentStatus, refundedTotalCents: refundedTotal, pendingTotalCents: pendingTotal }),
    hasPending: pendingTotal > 0 || order.paymentRefunds.some((r) => r.status === "PENDING")
  };
}

// ---- Ortak yardimcilar ----

// Yerel/preview ortam canli API'ye ASLA baglanmaz (DB ortak: yerelde canli anahtar cozulebilir).
function resolveCredentials(
  settings: Awaited<ReturnType<typeof getPaymentSettings>>,
  mode: string
): { ok: true; mode: PaymentMode; credentials: IyzicoCredentials } | { ok: false; outcome: RefundOutcome } {
  const paymentMode: PaymentMode = mode === "LIVE" ? "LIVE" : "SANDBOX";
  if (paymentMode === "LIVE" && process.env.VERCEL_ENV !== "production") {
    return {
      ok: false,
      outcome: failure("live-not-allowed", "Canlı ödemenin iadesi yalnızca canlı (production) ortamdan yapılabilir.")
    };
  }
  const credentials = getCredentials(settings, paymentMode);
  if (!credentials) return { ok: false, outcome: failure("no-credentials", "Sanal POS anahtarları çözülemedi; Sistem > Sanal POS'u kontrol edin.") };
  return { ok: true, mode: paymentMode, credentials };
}

function appendNote(existing: string | null, addition: string): string {
  return (existing ? `${existing} | ${addition}` : addition).slice(0, 900);
}

async function markUncertain(orderId: string, refundId: string, what: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { attentionNote: true } });
  await prisma.order.update({
    where: { id: orderId },
    data: {
      needsAttention: true,
      attentionNote: appendNote(
        order?.attentionNote ?? null,
        `${what} sonucu BELİRSİZ (kayıt ${refundId}): iyzico panelinden kontrol edip Ödeme kartından kaydı sonuçlandırın`
      )
    }
  });
}

// Basarili iade/iptali kesinlestirir (tek transaction): kayit, kalem sayaclari, siparis durumu, stok.
async function finalizeSuccess(refundId: string, hostReference: string | null): Promise<{ orderId: string; amountCents: number; fullyRefunded: boolean } | null> {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.paymentRefund.findUnique({ where: { id: refundId } });
    if (!refund) return null;
    await lockOrder(tx, refund.orderId);
    const claimed = await tx.paymentRefund.updateMany({
      where: { id: refundId, status: "PENDING" },
      data: { status: "SUCCESS", hostReference, errorCode: null, errorMessage: null, completedAt: new Date() }
    });
    if (claimed.count !== 1) return null;

    const order = await tx.order.findUniqueOrThrow({ where: { id: refund.orderId }, include: { items: true } });
    const restockVariants: { variantId: string; quantity: number }[] = [];

    if (refund.kind === "CANCEL") {
      // Iptal: odemenin TAMAMI geri alinir; tum kalemler ve kargo tamamen iade sayilir.
      for (const item of order.items) {
        await tx.orderItem.update({ where: { id: item.id }, data: { refundedCents: item.paidCents ?? 0 } });
        if (refund.restock && item.variantId) restockVariants.push({ variantId: item.variantId, quantity: item.quantity });
      }
      await tx.order.update({ where: { id: order.id }, data: { shippingRefundedCents: order.shippingPaidCents ?? 0 } });
    } else if (refund.isShipping) {
      await tx.order.update({ where: { id: order.id }, data: { shippingRefundedCents: { increment: refund.amountCents } } });
    } else if (refund.orderItemId) {
      const item = order.items.find((candidate) => candidate.id === refund.orderItemId);
      await tx.orderItem.update({ where: { id: refund.orderItemId }, data: { refundedCents: { increment: refund.amountCents } } });
      // Stok yalnizca kalem TAMAMEN iade edildiginde bir kez geri eklenir (kismi tutar iadesinde adet belirsiz).
      if (item && refund.restock && item.variantId && (item.refundedCents + refund.amountCents) >= (item.paidCents ?? 0)) {
        restockVariants.push({ variantId: item.variantId, quantity: item.quantity });
      }
    }

    for (const restock of restockVariants) {
      await tx.productVariant.update({ where: { id: restock.variantId }, data: { stock: { increment: restock.quantity } } });
    }

    const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, paymentRefunds: true } });
    const state = nextRefundState(buildRefundLines(fresh));
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: state.paymentStatus,
        // Iptal edilmis siparisin (gec odeme) durumu REFUNDED'a cevrilmez; odeme durumu ayrica izlenir.
        ...(state.fullyRefunded && fresh.status !== "CANCELLED" ? { status: "REFUNDED" } : {})
      }
    });
    return { orderId: order.id, amountCents: refund.amountCents, fullyRefunded: state.fullyRefunded };
  }, TX_OPTIONS);
}

async function failRefund(refundId: string, errorCode: string | null, errorMessage: string) {
  await prisma.paymentRefund.updateMany({
    where: { id: refundId, status: "PENDING" },
    data: { status: "FAILED", errorCode, errorMessage: errorMessage.slice(0, 300), completedAt: new Date() }
  });
}

// iyzico'ya gonderilecek ortak alanlar
function baseBody(refundId: string, reason: RefundReason, description: string | null, ip: string | null) {
  return {
    locale: "tr",
    conversationId: refundId,
    reason,
    ...(description ? { description: description.slice(0, 250) } : {}),
    ...(ip ? { ip } : {})
  };
}

// ---- Kalem/kismi iade ----

async function executeRefund(params: {
  orderId: string;
  lineKey: string;
  amountCents: number | null;
  reason: RefundReason;
  description: string | null;
  restock: boolean;
  actorEmail: string;
  ip: string | null;
}): Promise<RefundOutcome> {
  const settings = await getPaymentSettings();

  const reservation = await prisma.$transaction(async (tx) => {
    await lockOrder(tx, params.orderId);
    const order = await tx.order.findUnique({ where: { id: params.orderId }, include: orderInclude });
    if (!order || order.deletedAt) return { error: failure("not-refundable", "Sipariş bulunamadı veya silinmiş.") };
    const attempt = order.paymentAttempts[0];
    if (order.paymentProvider !== "IYZICO" || !attempt || !(REFUNDABLE_PAYMENT_STATUSES as readonly string[]).includes(order.paymentStatus)) {
      return { error: failure("not-refundable", "Bu sipariş iyzico ile ödenmemiş veya iade edilebilir durumda değil.") };
    }
    if (order.paymentRefunds.some((refund) => refund.status === "PENDING" && refund.kind === "CANCEL")) {
      return { error: failure("busy", "Bu siparişte sonuçlanmamış bir iptal işlemi var.") };
    }
    const line = buildRefundLines(order).find((candidate) => candidate.key === params.lineKey);
    if (!line) return { error: failure("not-refundable", "İade edilecek kalem bulunamadı.") };
    const check = checkRefundAmount(line, params.amountCents);
    if (!check.ok) {
      const messages = {
        "no-transaction": "Bu kalem için iyzico işlem numarası kayıtlı değil; iadeyi iyzico panelinden yapın.",
        invalid: "Geçersiz iade tutarı.",
        exceeds: "İade tutarı kalan iade edilebilir tutarı aşıyor.",
        "nothing-left": "Bu kalemde iade edilecek tutar kalmadı."
      } as const;
      const code = check.reason === "invalid" ? "invalid-amount" : check.reason;
      return { error: failure(code, messages[check.reason]) };
    }
    const resolved = resolveCredentials(settings, attempt.mode);
    if (!resolved.ok) return { error: resolved.outcome };

    const refund = await tx.paymentRefund.create({
      data: {
        orderId: order.id,
        attemptId: attempt.id,
        orderItemId: line.key === SHIPPING_LINE_KEY ? null : line.key,
        isShipping: line.key === SHIPPING_LINE_KEY,
        paymentTransactionId: line.paymentTransactionId!,
        amountCents: check.amountCents,
        kind: "REFUND",
        reason: params.reason,
        description: params.description,
        restock: params.restock,
        createdByEmail: params.actorEmail
      }
    });
    return { refund, line, mode: resolved.mode, credentials: resolved.credentials };
  }, TX_OPTIONS);

  if (reservation.error) return reservation.error;
  const { refund, line, mode, credentials } = reservation;

  let httpStatus: number | undefined;
  let data: RefundApiResponse;
  try {
    const result = await iyzicoPost<RefundApiResponse>(mode, credentials, REFUND_PATH, {
      ...baseBody(refund.id, params.reason, params.description, params.ip),
      paymentTransactionId: refund.paymentTransactionId,
      price: centsToDecimalString(refund.amountCents),
      currency: "TRY"
    });
    httpStatus = result.httpStatus;
    data = result.data;
  } catch (error) {
    const detail = error instanceof IyzicoTransportError ? error.message : "Beklenmeyen hata";
    await markUncertain(refund.orderId, refund.id, "İade");
    await logPayment({ kind: "REFUND", ok: false, orderId: refund.orderId, summary: `İade (${line.label}, ${refund.amountCents} kuruş) sonucu belirsiz: ${detail}` });
    return failure("uncertain", "iyzico'dan yanıt alınamadı; iade yapılıp yapılmadığı BELİRSİZ. iyzico panelinden kontrol edip Ödeme kartından kaydı sonuçlandırın.");
  }

  if (data.status === "success" && httpStatus < 500) {
    const done = await finalizeSuccess(refund.id, data.hostReference ? String(data.hostReference) : null);
    await logPayment({
      kind: "REFUND",
      ok: true,
      orderId: refund.orderId,
      httpStatus,
      summary: `İade başarılı: ${line.label}, ${refund.amountCents} kuruş, sebep ${params.reason}${done?.fullyRefunded ? " (sipariş tamamen iade)" : ""}`
    });
    return { ok: true, refundId: refund.id, amountCents: refund.amountCents, fullyRefunded: done?.fullyRefunded ?? false };
  }

  const errorCode = data.errorCode ? String(data.errorCode) : null;
  const message = describeAdminError(errorCode, data.errorMessage);
  await failRefund(refund.id, errorCode, message);
  await logPayment({
    kind: "REFUND",
    ok: false,
    orderId: refund.orderId,
    httpStatus,
    errorCode: errorCode ?? undefined,
    summary: `İade reddedildi: ${line.label}, ${refund.amountCents} kuruş — ${message}`
  });
  return failure("iyzico-error", message);
}

export type RefundRequest = {
  orderId: string;
  reason: RefundReason;
  description: string | null;
  restock: boolean;
  actorEmail: string;
  ip: string | null;
};

// Tek kalem/kargo iadesi (tutar bos = kalanin tamami).
export function requestLineRefund(params: RefundRequest & { lineKey: string; amountCents: number | null }): Promise<RefundOutcome> {
  return executeRefund(params);
}

// Tam iade: kalan tutari olan her kalem icin ayri iade cagrisi (iyzico islem numarasi kalem bazli).
// Bir kalem basarisiz olursa durur; onceki kalemlerin iadesi geri alinmaz ve sayaclara yansir.
export async function requestFullRefund(params: RefundRequest): Promise<{ completed: number; totalCents: number; outcome: RefundOutcome | null; skipped: string[] }> {
  const view = await getRefundView(params.orderId);
  if (!view || !view.refundable) {
    return { completed: 0, totalCents: 0, outcome: failure("not-refundable", "Bu sipariş iade edilebilir durumda değil."), skipped: [] };
  }
  const skipped = view.lines.filter((line) => remainingCents(line) > 0 && !line.paymentTransactionId).map((line) => line.label);
  let completed = 0;
  let totalCents = 0;
  for (const line of view.lines) {
    if (remainingCents(line) <= 0 || !line.paymentTransactionId) continue;
    const outcome = await executeRefund({ ...params, lineKey: line.key, amountCents: null });
    if (!outcome.ok) return { completed, totalCents, outcome, skipped };
    completed += 1;
    totalCents += outcome.amountCents;
  }
  return { completed, totalCents, outcome: null, skipped };
}

// ---- Iptal (payment/cancel: yalnizca tam tutar) ----

export async function requestCancel(params: RefundRequest): Promise<RefundOutcome> {
  const settings = await getPaymentSettings();

  const reservation = await prisma.$transaction(async (tx) => {
    await lockOrder(tx, params.orderId);
    const order = await tx.order.findUnique({ where: { id: params.orderId }, include: orderInclude });
    if (!order || order.deletedAt) return { error: failure("not-refundable", "Sipariş bulunamadı veya silinmiş.") };
    const attempt = order.paymentAttempts[0];
    if (order.paymentProvider !== "IYZICO" || !attempt?.paymentId) {
      return { error: failure("not-refundable", "Bu sipariş iyzico ile ödenmemiş.") };
    }
    const lines = buildRefundLines(order);
    const refundedTotal = lines.reduce((sum, line) => sum + line.refundedCents, 0);
    const pendingTotal = order.paymentRefunds.filter((r) => r.status === "PENDING").reduce((sum, r) => sum + r.amountCents, 0);
    const hasPending = order.paymentRefunds.some((r) => r.status === "PENDING");
    if (hasPending || !canCancelPayment({ paymentStatus: order.paymentStatus, refundedTotalCents: refundedTotal, pendingTotalCents: pendingTotal })) {
      return { error: failure("not-refundable", "İptal yalnızca hiç iade yapılmamış, ödemesi alınmış siparişlerde ve tam tutar için yapılabilir.") };
    }
    const resolved = resolveCredentials(settings, attempt.mode);
    if (!resolved.ok) return { error: resolved.outcome };

    const totalPaid = lines.reduce((sum, line) => sum + line.paidCents, 0);
    const refund = await tx.paymentRefund.create({
      data: {
        orderId: order.id,
        attemptId: attempt.id,
        paymentTransactionId: attempt.paymentId,
        amountCents: totalPaid,
        kind: "CANCEL",
        reason: params.reason,
        description: params.description,
        restock: params.restock,
        createdByEmail: params.actorEmail
      }
    });
    return { refund, paymentId: attempt.paymentId, mode: resolved.mode, credentials: resolved.credentials };
  }, TX_OPTIONS);

  if (reservation.error) return reservation.error;
  const { refund, paymentId, mode, credentials } = reservation;

  let httpStatus: number | undefined;
  let data: RefundApiResponse;
  try {
    const result = await iyzicoPost<RefundApiResponse>(mode, credentials, CANCEL_PATH, {
      ...baseBody(refund.id, params.reason, params.description, params.ip),
      paymentId
    });
    httpStatus = result.httpStatus;
    data = result.data;
  } catch (error) {
    const detail = error instanceof IyzicoTransportError ? error.message : "Beklenmeyen hata";
    await markUncertain(refund.orderId, refund.id, "İptal");
    await logPayment({ kind: "CANCEL", ok: false, orderId: refund.orderId, summary: `İptal sonucu belirsiz: ${detail}` });
    return failure("uncertain", "iyzico'dan yanıt alınamadı; iptalin yapılıp yapılmadığı BELİRSİZ. iyzico panelinden kontrol edip Ödeme kartından kaydı sonuçlandırın.");
  }

  if (data.status === "success" && httpStatus < 500) {
    const done = await finalizeSuccess(refund.id, data.hostReference ? String(data.hostReference) : null);
    await logPayment({ kind: "CANCEL", ok: true, orderId: refund.orderId, httpStatus, summary: `Ödeme iptal edildi (${refund.amountCents} kuruş, sebep ${params.reason})` });
    return { ok: true, refundId: refund.id, amountCents: refund.amountCents, fullyRefunded: done?.fullyRefunded ?? true };
  }

  const errorCode = data.errorCode ? String(data.errorCode) : null;
  const message = describeAdminError(errorCode, data.errorMessage);
  await failRefund(refund.id, errorCode, message);
  await logPayment({ kind: "CANCEL", ok: false, orderId: refund.orderId, httpStatus, errorCode: errorCode ?? undefined, summary: `İptal reddedildi: ${message}` });
  return failure("iyzico-error", message);
}

// ---- Belirsiz (PENDING) kaydi elle sonuclandirma ----

// Ag hatasi yuzunden sonucu bilinmeyen bir iade/iptal icin yonetici iyzico panelinden bakip
// "yapildi" (sayaclar guncellenir) ya da "yapilmadi" (tutar serbest kalir) der.
export async function resolvePendingRefund(refundId: string, result: "SUCCESS" | "FAILED"): Promise<{ ok: boolean; orderId: string | null; message: string }> {
  const refund = await prisma.paymentRefund.findUnique({ where: { id: refundId } });
  if (!refund || refund.status !== "PENDING") return { ok: false, orderId: refund?.orderId ?? null, message: "Kayıt bulunamadı veya zaten sonuçlanmış." };
  if (result === "FAILED") {
    await failRefund(refundId, null, "Yönetici: iyzico panelinde işlem yapılmadığı doğrulandı");
    await logPayment({ kind: refund.kind === "CANCEL" ? "CANCEL" : "REFUND", ok: false, orderId: refund.orderId, summary: "Belirsiz kayıt elle 'yapılmadı' olarak sonuçlandırıldı" });
    return { ok: true, orderId: refund.orderId, message: "Kayıt başarısız olarak kapatıldı; tutar yeniden iade edilebilir." };
  }
  const done = await finalizeSuccess(refundId, null);
  await logPayment({ kind: refund.kind === "CANCEL" ? "CANCEL" : "REFUND", ok: true, orderId: refund.orderId, summary: "Belirsiz kayıt elle 'yapıldı' olarak sonuçlandırıldı" });
  return { ok: Boolean(done), orderId: refund.orderId, message: done ? "Kayıt başarılı olarak işlendi." : "Kayıt işlenemedi." };
}
