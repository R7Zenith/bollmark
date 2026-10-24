import Link from "next/link";

const tlNumber = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

// "Bütçene göre": fotografsiz, tipografik kutular. Esikler ve sayimlar
// home-products.ts'te (BUDGET_TIERS_TL, countBudgetTiers); sayisi 0 olan
// kutu gizlenir, hepsi 0 ise bolum hic cikmaz. Telefonda 2x2, masaustunde 4'lu.
export function BudgetTiles({
  tiers,
  onSaleCount
}: {
  tiers: { maxTl: number; count: number }[];
  onSaleCount: number;
}) {
  const tiles = [
    ...tiers.map((t) => ({
      key: `max-${t.maxTl}`,
      href: `/urunler?fiyat-max=${t.maxTl}`,
      count: t.count,
      label: (
        <>
          <span className="block font-display text-4xl font-light tracking-[-0.04em] md:text-6xl">
            {tlNumber.format(t.maxTl)}
          </span>
          <span className="mt-1 block text-xs md:text-sm">TL ve altı</span>
        </>
      )
    })),
    {
      key: "indirimli",
      href: "/urunler?indirimli=1",
      count: onSaleCount,
      label: (
        <span className="block font-display text-xl font-light tracking-[-0.04em] md:text-5xl">
          İndirimdekiler
        </span>
      )
    }
  ].filter((t) => t.count > 0);
  if (tiles.length === 0) return null;

  return (
    <section data-nosnippet className="px-4 pb-section md:px-6 xl:px-9">
      <h2 className="mb-8 font-display text-3xl font-normal tracking-[-0.04em] md:mb-10 md:text-5xl">
        Bütçene <em className="font-accent italic font-normal">göre</em>
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {tiles.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className="flex aspect-square flex-col justify-between bg-image-bg p-4 text-ink transition-colors duration-300 hover:bg-ink hover:text-cream md:aspect-[4/3] md:p-6"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] opacity-60">{t.count} ürün</span>
            <span>{t.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
