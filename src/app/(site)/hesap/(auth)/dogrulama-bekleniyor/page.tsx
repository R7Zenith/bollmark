import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Heart } from "lucide-react";
import { customerAuthOptions } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { isSafeInternalPath } from "@/lib/safe-path";
import { campaignStateFrom, getKalpSettings } from "@/lib/kalp-topla/settings";
import { campaignPitch } from "@/lib/kalp-topla/messages";
import { COUPON_SHAPE } from "@/components/kalp-topla/kalp-nasil-calisir";
import { resendVerificationFromWaiting } from "./actions";

export const metadata = { title: "E-postanı doğrula", robots: { index: false } };

const RESULTS: Record<string, string> = {
  gonderildi: "Gönderildi. Gelen kutunu kontrol et.",
  bekle: "Son 10 dakika içinde zaten gönderdik, biraz bekle."
};

// "ozilevent@gmail.com" -> "oz***@gmail.com"
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, local.length > 2 ? 2 : 1)}***@${domain}`;
}

// Kalp Topla acikken: dogrulanmamis uyenin kalpleri bara sayilmaz (activatePendingHearts),
// bu yuzden kampanyanin kendi renkleri ve /kalp-topla hero animasyonuyla hatirlatilir.
function KalpDogrulaKarti({ threshold, discountPercent }: { threshold: number; discountPercent: number }) {
  const count = Math.min(threshold, 10);
  return (
    <section aria-labelledby="kalp-dogrula-baslik" className="relative mt-10 overflow-hidden rounded-2xl bg-[#FFF1F4] px-6 pb-6 pt-7 text-left">
      <svg
        viewBox="30 36 100 48"
        aria-hidden="true"
        className="kh-coupon absolute right-4 top-5 w-[76px]"
        style={{ "--i": count } as CSSProperties}
      >
        <path d={COUPON_SHAPE} className="fill-[#FFC83D]" />
        <text x={80} y={71} textAnchor="middle" className="fill-ink text-[29px] font-bold">
          %{discountPercent}
        </text>
      </svg>
      <p className="flex items-center gap-1.5 text-xs font-medium text-sale">
        <Heart size={13} className="fill-sale" aria-hidden="true" />
        Kalp Topla
      </p>
      <h2 id="kalp-dogrula-baslik" className="mt-2 pr-20 text-xl font-semibold leading-tight tracking-[-0.5px] text-ink [text-wrap:balance]">
        Kalp Topla&apos;dan faydalanmak için e&#8209;postanı doğrula
      </h2>
      <div className="mt-5 grid gap-1" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="relative block aspect-square">
            <Heart strokeWidth={1.4} className="absolute inset-0 h-full w-full text-ink/20" />
            <Heart
              strokeWidth={1.4}
              className="kh-heart absolute inset-0 h-full w-full fill-sale text-sale"
              style={{ "--i": i } as CSSProperties}
            />
          </span>
        ))}
      </div>
      <p className="mt-5 text-sm text-ink/70">
        Verdiğin kalpler, e-postanı doğruladığında bara sayılır. {campaignPitch(threshold, discountPercent)}
      </p>
      <Link href="/kalp-topla" className="mt-3 inline-block text-sm text-ink underline underline-offset-4 hover:text-sale">
        Kampanya nasıl çalışır?
      </Link>
    </section>
  );
}

// Kayittan hemen sonra acilir (giris/page.tsx). ?devam= kayit oncesi gidilecek
// site ici yol (Kalp Topla'da ?kalp= ile urun sayfasi).
export default async function DogrulamaBekleniyorPage({
  searchParams
}: {
  searchParams: Promise<{ devam?: string; durum?: string }>;
}) {
  const { devam: rawDevam = "", durum } = await searchParams;
  const devam = isSafeInternalPath(rawDevam) ? rawDevam : "/hesap";

  const session = await getServerSession(customerAuthOptions);
  if (!session?.user?.id) redirect("/hesap/giris");
  const [customer, kalpSettings] = await Promise.all([
    prisma.customer.findUnique({ where: { id: session.user.id }, select: { email: true, emailVerifiedAt: true } }),
    getKalpSettings()
  ]);
  if (!customer) redirect("/hesap/giris");
  if (customer.emailVerifiedAt) redirect(devam);
  const kalpActive = (await campaignStateFrom(kalpSettings, session.user.id)) === "ACTIVE";

  const result = durum ? RESULTS[durum] : undefined;

  return (
    <div className="mx-auto max-w-[480px] px-9 py-24 text-center">
      <h1 className="font-display text-3xl">E-postanı doğrula</h1>
      <p className="mt-4 text-sm text-ink/70">
        Hesabın oluşturuldu. <span className="font-medium text-ink">{maskEmail(customer.email)}</span> adresine bir
        doğrulama bağlantısı gönderdik. Bağlantıya tıklayarak hesabını doğrula.
      </p>
      <p className="mt-3 text-sm text-ink/70">Göremiyorsan Spam / Gereksiz klasörüne bak.</p>

      {kalpActive && <KalpDogrulaKarti threshold={kalpSettings.threshold} discountPercent={kalpSettings.discountPercent} />}

      <div className="mt-10 flex flex-col gap-3">
        <Link
          href={devam}
          className="rounded-full bg-ink px-6 py-4 text-[10px] uppercase tracking-[1px] text-white hover:bg-ink/90"
        >
          Alışverişe devam et
        </Link>
        <form action={resendVerificationFromWaiting}>
          <input type="hidden" name="devam" value={devam} />
          <button className="w-full rounded-full border border-ink px-6 py-4 text-[10px] uppercase tracking-[1px] text-ink hover:bg-ink hover:text-white">
            Doğrulama e-postasını tekrar gönder
          </button>
        </form>
      </div>
      <p role="status" className="mt-4 min-h-5 text-sm text-ink/70">
        {result}
      </p>
    </div>
  );
}
