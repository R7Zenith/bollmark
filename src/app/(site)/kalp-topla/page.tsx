import type { CSSProperties } from "react";
import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Heart } from "lucide-react";
import { customerAuthOptions } from "@/lib/customer-auth";
import { campaignStateFrom, getKalpSettings } from "@/lib/kalp-topla/settings";
import { campaignPitch, campaignSlogan } from "@/lib/kalp-topla/messages";
import { getVitrin, type VitrinProduct } from "@/lib/kalp-topla/vitrin";
import { COUPON_SHAPE, KalpNasilCalisir } from "@/components/kalp-topla/kalp-nasil-calisir";

// Kampanya sayfasi (KALP_TOPLA_PLANI.md 6.8). Oturuma gore dinamik render edilir.
// Kullanici karari (2026-10-31): INVISIBLE 404 doner; FROZEN'da sayfa acik kalir,
// ustte duraklatma notu cikar, listeler (barlar) gizlenir.
const MAX_HERO_HEARTS = 20;
const PILL =
  "inline-block rounded-full px-6 py-3.5 text-center text-[11px] uppercase tracking-[1px] transition";
const PILL_FILLED = `${PILL} bg-ink text-white hover:bg-ink/90`;

const resolvePage = cache(async () => {
  const [session, settings] = await Promise.all([getServerSession(customerAuthOptions), getKalpSettings()]);
  const customerId = session?.user?.id ?? null;
  return { settings, loggedIn: Boolean(customerId), state: await campaignStateFrom(settings, customerId) };
});

export async function generateMetadata(): Promise<Metadata> {
  const { settings, state } = await resolvePage();
  if (state === "INVISIBLE") return {};
  const title = `Kalp Topla: ${campaignSlogan(settings.threshold, settings.discountPercent)}`;
  const description = campaignPitch(settings.threshold, settings.discountPercent);
  return {
    title,
    description,
    alternates: { canonical: "/kalp-topla" },
    robots: settings.mode === "LIVE" ? undefined : { index: false },
    openGraph: { title, description, url: "/kalp-topla", images: [{ url: "/og-kalp-topla.jpg", width: 1200, height: 630 }] }
  };
}

function HeroBar({ threshold, percent, animate }: { threshold: number; percent: number; animate: boolean }) {
  const count = Math.min(threshold, MAX_HERO_HEARTS);
  return (
    <div className="relative mt-10 md:mt-14" aria-hidden="true">
      <div className="grid gap-1 md:gap-3" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="relative block aspect-square">
            <Heart strokeWidth={1.2} className="absolute inset-0 h-full w-full text-ink/20" />
            {animate && (
              <Heart
                strokeWidth={1.2}
                className="kh-heart absolute inset-0 h-full w-full fill-sale text-sale"
                style={{ "--i": i } as CSSProperties}
              />
            )}
          </span>
        ))}
      </div>
      {animate && (
        <svg
          viewBox="30 36 100 48"
          className="kh-coupon absolute -top-[72px] right-0 w-[116px] md:-top-[132px] md:w-[220px]"
          style={{ "--i": count } as CSSProperties}
        >
          <path d={COUPON_SHAPE} className="fill-[#FFC83D]" />
          <text x={80} y={71} textAnchor="middle" className="fill-ink text-[29px] font-bold">
            %{percent}
          </text>
        </svg>
      )}
    </div>
  );
}

function FrozenNote({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div role="status" className="border-b border-line bg-cream">
      <div className="mx-auto max-w-[1400px] px-6 py-4 xl:px-9">
        <p className="text-sm font-medium text-ink">Kampanya şu an duraklatıldı</p>
        <p className="mt-1 max-w-[70ch] text-sm text-ink/70">
          Kazandığın kuponlar süreleri boyunca geçerli, sepette kullanabilirsin. Kalplerin ve barlar korunuyor, kampanya
          açılınca kaldığı yerden devam eder. Bu sırada yeni kalp verilemez, istersen kalbini geri çekebilirsin.
          {loggedIn && (
            <>
              {" "}
              <Link href="/hesap/kalplerim" className="text-ink underline underline-offset-4">
                Kalplerim
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function NearCard({ product }: { product: VitrinProduct }) {
  const left = Math.max(product.threshold - product.points, 0);
  return (
    <li>
      <Link href={`/urunler/${product.slug}`} className="group block">
        <div className="relative aspect-[3/4] overflow-hidden bg-image-bg">
          {product.image && (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(min-width: 768px) 25vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-ink">{product.name}</p>
        <p className="mt-1 flex items-center gap-1 text-sm font-medium text-sale">
          <Heart size={14} className="shrink-0 fill-sale" aria-hidden="true" />
          {left} kalp kaldı
        </p>
      </Link>
    </li>
  );
}

function TopRow({ product }: { product: VitrinProduct }) {
  return (
    <li>
      <Link href={`/urunler/${product.slug}`} className="flex items-center gap-4">
        <span className="relative h-20 w-16 shrink-0 overflow-hidden bg-image-bg">
          {product.image && <Image src={product.image} alt="" fill sizes="64px" className="object-cover" />}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm text-ink">{product.name}</span>
          <span className="mt-1 block text-sm text-ink/60">{product.closedRounds} kez doldu</span>
        </span>
      </Link>
    </li>
  );
}

function faqItems(s: { threshold: number; discountPercent: number; couponHours: number; heartQuota: number; inviteBonus: number; refundExtraHours: number }) {
  const percent = `%${s.discountPercent}`;
  return [
    {
      q: "Kimler katılabilir?",
      a: "Bollmark üyesi olan herkes. Kalbinin bara sayılması için e-postanı doğrulaman yeterli, doğrulayana kadar kalbin bekler."
    },
    {
      q: "Aynı anda kaç ürüne kalp verebilirim?",
      a: `En fazla ${s.heartQuota} ürüne. Bar dolunca ya da kalbini geri çekince hakkın boşalır.`
    },
    {
      q: "Kalbimi geri çekebilir miyim?",
      a: "Evet, bar dolmadan istediğin an geri çekebilirsin. O ürüne eklenmiş davet bonusların da o turdan düşer."
    },
    {
      q: "Arkadaşımı çağırmak zorunda mıyım?",
      a: `Hayır. Bar başka üyelerin kalpleriyle de dolar. Hızlandırmak istersen linkinle gelen arkadaşın e-postasını doğrulayınca barına +${s.inviteBonus} kalp ekler.`
    },
    {
      q: "Kuponu nasıl kullanırım?",
      a: `Bar dolunca ${percent} kuponun hesabına gelir ve ${s.couponHours} saat geçerli olur. Kod yazman gerekmez, sepetinde en çok kazandıran ürüne otomatik uygulanır. Kupon tek ürünün tek adedi içindir.`
    },
    {
      q: "İndirimli üründe kupon nasıl hesaplanır?",
      a: `${percent}, ürünün indirimsiz fiyatı üzerinden hesaplanır. Mevcut indirimli fiyat daha düşükse düşük olan geçerlidir, kuponla hiçbir zaman daha pahalıya ödemezsin. Kupon başka kampanyalarla birleşmez, kuponlu ürüne puan kullanılamaz.`
    },
    {
      q: "Ürünü iade edersem kuponum ne olur?",
      a: `Tam iade tamamlanınca kupon kalan süresiyle hesabına döner. Süresi dolmuşsa ${s.refundExtraHours} saatlik yeni süre verilir.`
    },
    {
      q: "Bildirimleri nasıl kapatırım?",
      a: "Kalp verince bar ve kupon haberleri e-postayla gelir. Her e-postadaki bağlantıdan ya da Hesabım > İletişim Tercihleri'nden kapatabilirsin."
    }
  ];
}

export default async function KalpToplaPage() {
  const { settings, loggedIn, state } = await resolvePage();
  if (state === "INVISIBLE") notFound();

  const active = state === "ACTIVE";
  const { near, top } = active ? await getVitrin(settings.mode) : { near: [], top: [] };
  const faq = faqItems(settings);

  return (
    <>
      {state === "FROZEN" && <FrozenNote loggedIn={loggedIn} />}

      <section className="overflow-hidden bg-[#FFF1F4]">
        <div className="mx-auto max-w-[1400px] px-6 pb-10 pt-12 md:pb-14 md:pt-20 xl:px-9">
          <p className="flex items-center gap-1.5 text-sm font-medium text-sale">
            <Heart size={14} className="fill-sale" aria-hidden="true" />
            Kalp Topla
          </p>
          <h1 className="mt-3 text-[44px] font-semibold leading-[1.05] tracking-[-1.5px] text-ink [text-wrap:balance] md:text-[84px] md:tracking-[-3px]">
            {campaignSlogan(settings.threshold, settings.discountPercent)}
          </h1>
          <p className="mt-4 max-w-[46ch] text-base text-ink/70">{campaignPitch(settings.threshold, settings.discountPercent)}</p>
          {active && (
            <div className="mt-6">
              {loggedIn ? (
                <Link href="/urunler" className={PILL_FILLED}>
                  Ürünlere bak
                </Link>
              ) : (
                <Link href="/hesap/giris?sekme=kayit&callbackUrl=/urunler" className={PILL_FILLED}>
                  Üye ol
                </Link>
              )}
            </div>
          )}
          <HeroBar threshold={settings.threshold} percent={settings.discountPercent} animate={active} />
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 py-14 md:py-20">
        <h2 className="text-[28px] font-medium tracking-[-0.8px] text-ink md:text-4xl">Nasıl çalışır?</h2>
        <div className="mt-8">
          <KalpNasilCalisir inviteBonus={settings.inviteBonus} discountPercent={settings.discountPercent} couponHours={settings.couponHours} />
        </div>
      </section>

      {near.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-6 pb-14 md:pb-20 xl:px-9">
          <h2 className="text-[28px] font-medium tracking-[-0.8px] text-ink md:text-4xl">Dolmak üzere</h2>
          <ul className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5">
            {near.map((product) => (
              <NearCard key={product.productId} product={product} />
            ))}
          </ul>
        </section>
      )}

      {top.length > 0 && (
        <section className="mx-auto max-w-[1100px] px-6 pb-14 md:pb-20">
          <h2 className="text-[28px] font-medium tracking-[-0.8px] text-ink md:text-4xl">En çok dolan ürünler</h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-2 md:gap-x-10">
            {top.map((product) => (
              <TopRow key={product.productId} product={product} />
            ))}
          </ul>
        </section>
      )}

      {active && near.length === 0 && top.length === 0 && (
        <section className="mx-auto max-w-[1100px] px-6 pb-14 md:pb-20">
          <h2 className="text-[28px] font-medium tracking-[-0.8px] text-ink md:text-4xl">İlk kalbi sen ver</h2>
          <p className="mt-3 text-base text-ink/70">Henüz dolmaya yaklaşan bar yok. Beğendiğin ürünü seç, barını sen başlat.</p>
        </section>
      )}

      <section className="mx-auto max-w-[760px] px-6 pb-16 md:pb-24">
        <h2 className="text-[28px] font-medium tracking-[-0.8px] text-ink md:text-4xl">Sık sorulan sorular</h2>
        <div className="mt-6 border-b border-line">
          {faq.map((item) => (
            <details key={item.q} className="group border-t border-line">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="text-lg font-normal leading-none text-ink/50 transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-ink/70">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink/70">
          Tüm kurallar için{" "}
          <Link href="/sayfa/kalp-topla-kosullari" className="text-ink underline underline-offset-4">
            Kampanya Koşulları
          </Link>
          .
        </p>
      </section>
    </>
  );
}
