import Link from "next/link";

export default function ThankYouPage({
  searchParams
}: {
  searchParams: { siparis?: string };
}) {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-display text-3xl">Teşekkürler!</h1>
      <p className="mt-4 text-ink/70">
        Siparişiniz alındı. Sipariş numaranız: <strong>{searchParams.siparis}</strong>
      </p>
      <p className="mt-2 text-sm text-ink/50">
        Sipariş detaylarını içerecek e-posta kısa süre içinde gönderilecektir.
      </p>
      <Link
        href="/urunler"
        className="mt-10 inline-block border border-ink px-8 py-3 text-sm uppercase tracking-wide hover:bg-ink hover:text-paper"
      >
        Alışverişe Devam Et
      </Link>
    </div>
  );
}
