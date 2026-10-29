import Link from "next/link";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { verifyEmailToken } from "@/lib/kalp-topla/email-verification";
import { resendVerification } from "./actions";

export const metadata = { title: "E-posta doğrulama", robots: { index: false } };

const MESSAGES: Record<string, { title: string; body: string }> = {
  verified: { title: "E-posta adresin doğrulandı", body: "Teşekkürler, hesabın hazır." },
  already: { title: "Bu bağlantı zaten kullanıldı", body: "E-posta adresin daha önce doğrulanmış." },
  dogrulanmis: { title: "E-posta adresin zaten doğrulanmış", body: "Yapman gereken bir şey yok." },
  expired: { title: "Bağlantının süresi dolmuş", body: "Doğrulama bağlantıları 24 saat geçerlidir." },
  invalid: { title: "Bağlantı geçersiz", body: "Bağlantıyı e-postadaki haliyle eksiksiz açtığından emin ol." },
  gonderildi: { title: "Yeni doğrulama e-postası gönderildi", body: "Gelen kutunu kontrol et." },
  bekle: { title: "Biraz bekle", body: "Son 10 dakika içinde zaten bir doğrulama e-postası gönderdik." }
};

export default async function HesapDogrulaPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; durum?: string }>;
}) {
  const { token, durum } = await searchParams;
  const key = token ? (await verifyEmailToken(token)).result : (durum ?? "invalid");
  const message = MESSAGES[key] ?? MESSAGES.invalid;
  const canResend = key === "expired" || key === "invalid";
  const session = canResend ? await getServerSession(customerAuthOptions) : null;

  return (
    <div className="mx-auto max-w-[480px] px-9 py-24 text-center">
      <h1 className="font-display text-3xl">{message.title}</h1>
      <p className="mt-4 text-sm text-ink/70">{message.body}</p>
      {canResend &&
        (session?.user?.id ? (
          <form action={resendVerification} className="mt-8">
            <button className="rounded-full bg-ink px-6 py-4 text-[10px] uppercase tracking-[1px] text-white hover:bg-ink/90">
              Yeni doğrulama e-postası gönder
            </button>
          </form>
        ) : (
          <p className="mt-8 text-sm text-ink/70">
            Yeni bağlantı almak için{" "}
            <Link href="/hesap/giris" className="underline">
              giriş yap
            </Link>{" "}
            ve bu sayfaya tekrar dön.
          </p>
        ))}
      <Link href="/" className="mt-10 inline-block text-[10px] uppercase tracking-[1px] underline text-ink/60 hover:text-ink">
        Alışverişe dön
      </Link>
    </div>
  );
}
