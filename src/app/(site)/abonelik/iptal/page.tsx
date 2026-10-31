import { UnsubscribeRunner } from "./unsubscribe-runner";

export const metadata = { title: "Bildirimlerden çık", robots: { index: false } };

// Girissiz abonelikten cikma sayfasi (KALP_TOPLA_PLANI.md 6.10). Sayfanin
// kendisi (GET) hicbir islem yapmaz; islem POST ile yapilir.
export default async function AbonelikIptalPage({
  searchParams
}: {
  searchParams: Promise<{ t?: string; durum?: string }>;
}) {
  const { t, durum } = await searchParams;

  return (
    <div className="mx-auto max-w-[480px] px-9 py-24 text-center">
      <h1 className="font-display text-3xl">Bildirimlerden çık</h1>
      {durum === "tamam" ? (
        <p className="mt-4 text-sm text-ink/70">Kampanya e-postalarından çıktın.</p>
      ) : durum === "gecersiz" || !t ? (
        <p className="mt-4 text-sm text-red-600">Bağlantı geçersiz.</p>
      ) : (
        <>
          <UnsubscribeRunner token={t} />
          <noscript>
            <form method="post" action={`/api/abonelik/iptal?t=${encodeURIComponent(t)}`} className="mt-6">
              <button className="rounded-full bg-ink px-6 py-4 text-[10px] uppercase tracking-[1px] text-white">
                Bu bildirimleri almak istemiyorum
              </button>
            </form>
          </noscript>
        </>
      )}
    </div>
  );
}
