import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPublicPaymentState } from "@/lib/payment/orders/state";
import { describePaymentError } from "@/lib/payment/iyzico/errors";
import { RetryPaymentButton } from "@/components/retry-payment-button";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PaymentFailedPage({ searchParams }: { searchParams: Promise<{ siparis?: string }> }) {
  const { siparis } = await searchParams;
  if (!siparis) redirect("/");

  const { state, errorCode, canRetry } = await getPublicPaymentState(siparis);
  // Odeme aslinda basarili/inceleniyorsa kullanici yanlis sayfaya gelmis: dogru sayfaya gonder.
  if (state === "PAID" || state === "REVIEW") redirect(`/odeme/tesekkurler?siparis=${encodeURIComponent(siparis)}`);

  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-display text-3xl">Ödeme tamamlanamadı</h1>
      <p className="mt-4 text-ink/70">{describePaymentError(errorCode)}</p>
      <p className="mt-2 text-sm text-ink/50">Kartınızdan herhangi bir tutar çekilmedi. Sipariş numaranız: {siparis}</p>
      <div className="mt-10 flex flex-col items-center gap-4">
        {canRetry && state !== "CANCELLED" && state !== "UNKNOWN" ? (
          <RetryPaymentButton orderNumber={siparis} />
        ) : (
          <p className="text-sm text-ink/60">Bu siparişin süresi doldu; sepetinizden yeniden sipariş verebilirsiniz.</p>
        )}
        <Link
          href="/sepet"
          className="inline-block border border-ink px-8 py-3 text-sm uppercase tracking-wide hover:bg-ink hover:text-cream"
        >
          Sepete Dön
        </Link>
      </div>
    </div>
  );
}
