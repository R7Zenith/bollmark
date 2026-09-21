import { prisma } from "@/lib/prisma";
import { formatDateTime, formatExactPrice as formatPrice } from "@/lib/format";
import { paymentStatusLabel, paymentStatusTone } from "@/lib/status";
import { getRefundView, refundReasonLabel, refundReasons, type RefundReason } from "@/lib/payment/orders/refund";
import { remainingCents } from "@/lib/payment/orders/refund-math";
import {
  cancelPaymentAction,
  clearAttentionAction,
  reconcileOrderAction,
  refundPaymentAction,
  resolvePendingRefundAction
} from "@/app/(admin)/admin/siparisler/[id]/odeme-actions";
import { Card } from "@/components/admin/card";
import { Badge } from "@/components/admin/badge";
import { Button } from "@/components/admin/button";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";
const dangerButton =
  "inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700";

const attemptStatusLabel: Record<string, string> = {
  INITIATED: "Başlatıldı",
  SUCCESS: "Başarılı",
  FAILED: "Başarısız",
  REVIEW: "İnceleniyor",
  EXPIRED: "Süresi doldu"
};

const refundStatusLabel: Record<string, string> = { PENDING: "Sonuç belirsiz", SUCCESS: "Başarılı", FAILED: "Reddedildi" };
const refundStatusTone: Record<string, "yellow" | "green" | "red"> = { PENDING: "yellow", SUCCESS: "green", FAILED: "red" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-admin-text-muted">{label}</span>
      <span className="text-right text-admin-text">{children}</span>
    </div>
  );
}

// Sipariş detayındaki "Ödeme" kartı (bkz. plan 5.F). Herkes okur; iade/iptal/sorgu düğmeleri yalnızca ADMIN'e.
export async function OrderPaymentCard({ orderId, isAdmin, isDeleted }: { orderId: string; isAdmin: boolean; isDeleted: boolean }) {
  const [order, view, attempts, refunds] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        paymentStatus: true,
        paymentProvider: true,
        paymentMode: true,
        paidAt: true,
        paidCents: true,
        totalCents: true,
        installment: true,
        needsAttention: true,
        attentionNote: true
      }
    }),
    getRefundView(orderId),
    prisma.paymentAttempt.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } }),
    prisma.paymentRefund.findMany({ where: { orderId }, orderBy: { createdAt: "desc" } })
  ]);
  if (!order || (attempts.length === 0 && order.paymentProvider === null)) return null;

  const success = view?.attempt ?? null;
  const showActions = isAdmin && !isDeleted;
  const reconcilable = attempts.some((attempt) => ["INITIATED", "REVIEW", "FAILED"].includes(attempt.status));
  const refundableLines = (view?.lines ?? []).filter((line) => remainingCents(line) > 0 && line.paymentTransactionId);
  const linesWithoutTransaction = (view?.lines ?? []).filter((line) => remainingCents(line) > 0 && !line.paymentTransactionId);
  const pendingRefunds = refunds.filter((refund) => refund.status === "PENDING");

  return (
    <Card title="Ödeme" className="scroll-mt-6" id="odeme">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={paymentStatusTone[order.paymentStatus] ?? "gray"}>{paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}</Badge>
        {order.paymentMode && <Badge tone={order.paymentMode === "LIVE" ? "red" : "gray"}>{order.paymentMode === "LIVE" ? "Canlı" : "Test (Sandbox)"}</Badge>}
      </div>

      {order.paymentProvider === "IYZICO" && success && (
        <div className="divide-y divide-admin-border">
          <Row label="Sağlayıcı">iyzico</Row>
          <Row label="Ödeme no (paymentId)">
            <span className="font-mono text-xs">{success.paymentId ?? "-"}</span>
          </Row>
          <Row label="Ödenen tutar">
            {formatPrice(order.paidCents ?? order.totalCents)}
            {order.paidCents !== null && order.paidCents !== order.totalCents ? ` (sipariş ${formatPrice(order.totalCents)})` : ""}
          </Row>
          <Row label="Taksit">{order.installment && order.installment > 1 ? `${order.installment} taksit` : "Tek çekim"}</Row>
          <Row label="Kart">
            {[success.cardAssociation, success.cardFamily, success.cardType].filter(Boolean).join(" · ") || "-"}
            {success.lastFourDigits ? ` •••• ${success.lastFourDigits}` : ""}
          </Row>
          <Row label="Dolandırıcılık durumu">
            {success.fraudStatus === 1 ? "Onaylı" : success.fraudStatus === 0 ? "İnceleniyor" : success.fraudStatus === -1 ? "Reddedildi" : "-"}
          </Row>
          {order.paidAt && <Row label="Ödeme zamanı">{formatDateTime(order.paidAt)}</Row>}
        </div>
      )}

      {attempts.length > 0 && (
        <div className="mt-4">
          <p className={labelClass}>Ödeme denemeleri</p>
          <ul className="mt-1 space-y-1 text-xs text-admin-text-muted">
            {attempts.map((attempt) => (
              <li key={attempt.id}>
                {formatDateTime(attempt.createdAt)} — {attemptStatusLabel[attempt.status] ?? attempt.status}
                {attempt.errorMessage ? ` (${attempt.errorMessage})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.needsAttention && showActions && (
        <form action={clearAttentionAction.bind(null, orderId)} className="mt-4">
          <ConfirmSubmitButton
            confirmMessage="Uyarıyı kapatmadan önce konuyu çözdüğünüzden emin misiniz? İşlem denetim kaydına yazılır."
            className="rounded-md border border-admin-border px-3 py-1.5 text-xs font-medium text-admin-text hover:bg-admin-bg"
          >
            Uyarıyı kapat
          </ConfirmSubmitButton>
        </form>
      )}

      {showActions && reconcilable && (
        <form action={reconcileOrderAction.bind(null, orderId)} className="mt-4">
          <Button type="submit" size="sm" variant="secondary">
            iyzico&apos;dan durumu sorgula
          </Button>
        </form>
      )}

      {pendingRefunds.length > 0 && (
        <div className="mt-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900">
          <p className="font-medium">Sonucu belirsiz iade/iptal kaydı var</p>
          <p className="mt-1">iyzico&apos;dan yanıt alınamadı. iyzico panelinde ilgili işlemi kontrol edip kaydı sonuçlandırın; sonuçlanana kadar aynı tutar tekrar iade edilemez.</p>
          {showActions &&
            pendingRefunds.map((refund) => (
              <div key={refund.id} className="mt-2 flex flex-wrap items-center gap-2">
                <span>
                  {refund.kind === "CANCEL" ? "İptal" : "İade"} {formatPrice(refund.amountCents)} ({formatDateTime(refund.createdAt)})
                </span>
                <form action={resolvePendingRefundAction.bind(null, orderId, refund.id, "SUCCESS")}>
                  <ConfirmSubmitButton
                    confirmMessage="iyzico panelinde bu işlemin YAPILDIĞINI doğruladınız mı? Sayaçlar güncellenecek."
                    className="rounded-md border border-yellow-400 bg-white px-2 py-1 font-medium hover:bg-yellow-100"
                  >
                    iyzico&apos;da yapılmış
                  </ConfirmSubmitButton>
                </form>
                <form action={resolvePendingRefundAction.bind(null, orderId, refund.id, "FAILED")}>
                  <ConfirmSubmitButton
                    confirmMessage="iyzico panelinde bu işlemin YAPILMADIĞINI doğruladınız mı? Tutar yeniden iade edilebilir hale gelecek."
                    className="rounded-md border border-yellow-400 bg-white px-2 py-1 font-medium hover:bg-yellow-100"
                  >
                    iyzico&apos;da yapılmamış
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
        </div>
      )}

      {view?.refundable && (
        <div className="mt-5">
          <p className={labelClass}>İade edilebilir tutarlar</p>
          <div className="mt-1 divide-y divide-admin-border text-sm">
            {view.lines.map((line) => (
              <div key={line.key} className="flex justify-between gap-3 py-1.5">
                <span className="text-admin-text">{line.label}</span>
                <span className="text-right text-admin-text-muted">
                  {formatPrice(remainingCents(line))} / {formatPrice(line.paidCents)}
                  {line.pendingCents > 0 ? ` (${formatPrice(line.pendingCents)} belirsiz)` : ""}
                </span>
              </div>
            ))}
          </div>
          {linesWithoutTransaction.length > 0 && (
            <p className="mt-2 text-xs text-red-700">
              {linesWithoutTransaction.map((line) => line.label).join(", ")} için iyzico işlem numarası kayıtlı değil; bu kalemleri iyzico panelinden iade edin.
            </p>
          )}
        </div>
      )}

      {showActions && view?.refundable && refundableLines.length > 0 && (
        <form action={refundPaymentAction.bind(null, orderId)} className="mt-5 space-y-3 rounded-md border border-admin-border p-3">
          <p className="text-sm font-medium text-admin-text">İade yap</p>
          <div>
            <label className={labelClass}>Kapsam</label>
            <select name="scope" defaultValue="ALL" className={`mt-1 ${inputClass}`}>
              <option value="ALL">Tam iade (kalan tüm tutar)</option>
              {refundableLines.map((line) => (
                <option key={line.key} value={line.key}>
                  {line.label} (en fazla {formatPrice(remainingCents(line))})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tutar (TL) — yalnızca tek kalem için, boşsa kalanın tamamı</label>
            <input name="amount" inputMode="decimal" placeholder="örn. 150,50" className={`mt-1 ${inputClass}`} />
          </div>
          <div>
            <label className={labelClass}>Sebep</label>
            <select name="reason" defaultValue="BUYER_REQUEST" className={`mt-1 ${inputClass}`}>
              {refundReasons.map((reason: RefundReason) => (
                <option key={reason} value={reason}>
                  {refundReasonLabel[reason]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Not (isteğe bağlı)</label>
            <input name="description" maxLength={250} className={`mt-1 ${inputClass}`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-admin-text">
            <input type="checkbox" name="restock" />
            Stoğa geri ekle (kalem tamamen iade edilince)
          </label>
          <ConfirmSubmitButton
            confirmMessage="Kartı olan müşteriye gerçek iade yapılacak (test modunda sandbox iadesi). Bu işlem geri alınamaz. Devam edilsin mi?"
            className={dangerButton}
          >
            İade Et
          </ConfirmSubmitButton>
        </form>
      )}

      {showActions && view?.canCancel && (
        <form action={cancelPaymentAction.bind(null, orderId)} className="mt-4 space-y-3 rounded-md border border-admin-border p-3">
          <p className="text-sm font-medium text-admin-text">Ödemeyi iptal et (aynı gün, tam tutar)</p>
          <p className="text-xs text-admin-text-muted">
            İptal, banka gün sonu kesintisinden önce ve yalnızca tam tutar için çalışır; kart ekstresine yansımaz. Süresi geçtiyse iyzico reddeder, o zaman &quot;İade Et&quot;i kullanın.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select name="reason" defaultValue="BUYER_REQUEST" className={`${inputClass} max-w-[220px]`}>
              {refundReasons.map((reason: RefundReason) => (
                <option key={reason} value={reason}>
                  {refundReasonLabel[reason]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-admin-text">
              <input type="checkbox" name="restock" />
              Stoğa geri ekle
            </label>
          </div>
          <ConfirmSubmitButton
            confirmMessage="Ödemenin TAMAMI iptal edilecek. Bu işlem geri alınamaz. Devam edilsin mi?"
            className={dangerButton}
          >
            Ödemeyi İptal Et
          </ConfirmSubmitButton>
        </form>
      )}

      {refunds.length > 0 && (
        <div className="mt-5">
          <p className={labelClass}>İade geçmişi</p>
          <ul className="mt-1 space-y-2 text-xs">
            {refunds.map((refund) => (
              <li key={refund.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border pb-2 last:border-0">
                <span className="text-admin-text">
                  {refund.kind === "CANCEL" ? "İptal" : refund.isShipping ? "Kargo iadesi" : "Kalem iadesi"} · {formatPrice(refund.amountCents)} ·{" "}
                  {refundReasonLabel[refund.reason as RefundReason] ?? refund.reason}
                  <span className="block text-admin-text-muted">
                    {formatDateTime(refund.createdAt)} · {refund.createdByEmail}
                    {refund.errorMessage ? ` · ${refund.errorMessage}` : ""}
                  </span>
                </span>
                <Badge tone={refundStatusTone[refund.status] ?? "gray"}>{refundStatusLabel[refund.status] ?? refund.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
