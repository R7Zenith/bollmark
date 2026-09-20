import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPublicPaymentState } from "@/lib/payment/orders/state";
import { ClearCartOnMount } from "@/components/clear-cart-on-mount";
import { PaymentStatusPoller } from "@/components/payment-status-poller";
import { RetryPaymentButton } from "@/components/retry-payment-button";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const continueLink = (
  <Link
    href="/urunler"
    className="mt-10 inline-block border border-ink px-8 py-3 text-sm uppercase tracking-wide hover:bg-ink hover:text-cream"
  >
    Alışverişe Devam Et
  </Link>
);

// Sayfa URL'deki hicbir parametreye guvenmez: siparis numarasindan DB'deki GERCEK odeme
// durumu okunur. Kisisel veri gosterilmez.
export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ siparis?: string }> }) {
  const { siparis } = await searchParams;
  if (!siparis) redirect("/");

  const { state, canRetry } = await getPublicPaymentState(siparis);
  if (state === "FAILED") redirect(`/odeme/basarisiz?siparis=${encodeURIComponent(siparis)}`);

  if (state === "PAID") {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <ClearCartOnMount />
        <h1 className="font-display text-3xl">Teşekkürler!</h1>
        <p className="mt-4 text-ink/70">
          Siparişiniz alındı ve ödemeniz onaylandı. Sipariş numaranız: <strong>{siparis}</strong>
        </p>
        <p className="mt-2 text-sm text-ink/50">
          Sipariş detaylarını içeren e-posta kısa süre içinde gönderilecektir.
        </p>
        {continueLink}
      </div>
    );
  }

  if (state === "CANCELLED" || state === "UNKNOWN") {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl">Sipariş bulunamadı veya süresi doldu</h1>
        <p className="mt-4 text-ink/70">
          Bu sipariş için ödeme alınmadı. Dilerseniz sepetinizden yeniden sipariş verebilirsiniz.
        </p>
        <Link
          href="/sepet"
          className="mt-10 inline-block border border-ink px-8 py-3 text-sm uppercase tracking-wide hover:bg-ink hover:text-cream"
        >
          Sepete Dön
        </Link>
      </div>
    );
  }

  // PENDING (callback henuz islenmedi / odeme tamamlanmadi) veya REVIEW (inceleme)
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-display text-3xl">{state === "REVIEW" ? "Ödemeniz inceleniyor" : "Ödemeniz doğrulanıyor…"}</h1>
      <p className="mt-4 text-ink/70">
        {state === "REVIEW"
          ? "Ödemeniz ek incelemeye alındı. Sonuç netleşince e-posta ile bilgilendirileceksiniz."
          : "Ödeme sonucunuzu kontrol ediyoruz, lütfen bu sayfadan ayrılmayın."}{" "}
        Sipariş numaranız: <strong>{siparis}</strong>
      </p>
      <PaymentStatusPoller orderNumber={siparis} initialState={state} />
      {state === "PENDING" && canRetry && (
        <div className="mt-10 border-t border-line pt-8">
          <p className="mb-4 text-sm text-ink/60">Ödemeyi tamamlamadıysanız buradan devam edebilirsiniz.</p>
          <RetryPaymentButton orderNumber={siparis} label="Ödemeye Devam Et" />
        </div>
      )}
    </div>
  );
}
