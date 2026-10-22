import Link from "next/link";
import { CampaignCountdown } from "@/components/home/campaign-countdown";
import { percentWithDative } from "@/lib/home-products";

// Eski genis lookbook'un yeri. Aktif otomatik kampanya varsa siyah bant
// (oran page.tsx campaignPercent: kartlara gercekten uygulanan en yuksek
// kampanya indirimi); yoksa guncel sezonun en cok kartli renkleri.
export function CampaignBand({ percent, endsAt }: { percent: number; endsAt: string | null }) {
  return (
    <section className="mb-section bg-ink px-6 py-16 text-center text-cream md:py-24">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-cream/70">Sezon fırsatı</p>
      <h2 className="mx-auto mt-4 max-w-3xl font-display text-5xl font-light leading-[1.05] tracking-[-0.04em] md:text-8xl">
        {percentWithDative(percent)} varan <em className="font-accent italic font-normal">indirim</em>
      </h2>
      {endsAt && <CampaignCountdown endsAt={endsAt} />}
      <Link
        href="/urunler?indirimli=1"
        className="mt-10 inline-flex items-center rounded-full border border-cream px-8 py-3.5 text-sm uppercase tracking-wide transition hover:bg-cream hover:text-ink"
      >
        İndirimleri gör
      </Link>
    </section>
  );
}

export function SeasonColors({ colors }: { colors: { name: string; hex: string; count: number }[] }) {
  if (colors.length === 0) return null;
  return (
    <section className="px-4 pb-section md:px-6 xl:px-9">
      <h2 className="mb-8 font-display text-3xl font-normal tracking-[-0.04em] md:mb-10 md:text-5xl">
        Sezonun <em className="font-accent italic font-normal">renkleri</em>
      </h2>
      <ul className="grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-4">
        {colors.map((c) => (
          <li key={c.name}>
            <Link href={`/urunler?renk=${encodeURIComponent(c.name)}`} className="group block">
              <span
                className="block aspect-[3/4] border border-ink/10 transition duration-500 ease-out group-hover:scale-[0.97]"
                style={{ backgroundColor: c.hex }}
              />
              <span className="mt-2 block text-xs text-ink md:text-sm">{c.name}</span>
              <span className="block text-[11px] text-ink/50">{c.count} ürün</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
