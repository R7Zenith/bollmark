import Link from "next/link";

type Suggestion = { name: string; slug: string; imageUrl: string | null };

type Props = {
  categoryName: string | null;
  gender: string | null;
  suggestions: Suggestion[];
};

// Urunu olmayan kategori sayfasinin ekrani (bkz.
// BOS_KATEGORI_YAKINDA_TASARIMI_PLANI.md). Kartlardaki gorsel, o kategoriden
// ornek bir urunun fotografidir (yoksa kategori gorseli).
export function EmptyCategoryState({ categoryName, gender, suggestions }: Props) {
  const description = categoryName
    ? gender
      ? `${gender} koleksiyonunda ${categoryName} için yeni parçaları hazırlıyoruz. Çok yakında burada.`
      : `${categoryName} koleksiyonumuzu şu an hazırlıyoruz. Çok yakında burada.`
    : "Bu koleksiyonu şu an hazırlıyoruz. Yeni ürünler eklendiğinde burada olacak.";

  const suggestionHref = (slug: string) =>
    gender
      ? `/urunler?kategori=${encodeURIComponent(slug)}&cinsiyet=${encodeURIComponent(gender)}`
      : `/urunler?kategori=${encodeURIComponent(slug)}`;

  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center px-0 py-16 text-center md:py-24">
      <svg
        aria-hidden="true"
        viewBox="0 0 120 100"
        className="h-24 w-28 text-ink"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g className="empty-hanger-swing">
          {/* Askı: kanca + omuz hatti */}
          <path d="M60 6c0-4 6-4 6 1s-6 5-6 10v5" />
          <path d="M60 22 20 46a5 5 0 0 0 3 9h74a5 5 0 0 0 3-9L60 22Z" />
          {/* Askıdaki küçük tişört */}
          <path d="M44 58l-8 6 5 7 5-3v22h28V68l5 3 5-7-8-6c-3 5-8 7-11 7s-8-2-11-7Z" />
        </g>
        <path className="empty-sparkle" d="M100 20v8M96 24h8" style={{ animationDelay: "0s" }} />
        <path className="empty-sparkle" d="M14 66v6M11 69h6" style={{ animationDelay: "0.8s" }} />
        <path className="empty-sparkle" d="M108 74v5M105.5 76.5h5" style={{ animationDelay: "1.6s" }} />
      </svg>

      <p className="mt-6 text-[10px] uppercase tracking-[1px] text-ink/50">Yakında</p>
      <h2 className="mt-3 text-[27px] font-normal leading-tight tracking-tight md:text-[38px]">
        Yeni parçalar <em className="font-accent italic font-normal">yolda</em>
      </h2>
      <p className="mt-4 max-w-[440px] text-sm text-ink/60">{description}</p>

      <div className="mt-12 w-full border-t border-line pt-10">
        <p className="text-sm text-ink/60">Bu arada göz atmak ister misin?</p>
        {suggestions.length > 0 ? (
          // Kartlar sigarsa ilk kart soldan baslar (justify-center tasan icerigin
          // solunu keser); sigarsa auto kenar bosluklari ortalar.
          <ul className="-mx-4 mt-5 flex snap-x scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:scroll-pl-0 md:px-0 [&::-webkit-scrollbar]:hidden">
            {suggestions.map((s, i) => (
              <li
                key={s.slug}
                className={`w-[120px] shrink-0 snap-start ${i === 0 ? "ml-auto" : ""} ${
                  i === suggestions.length - 1 ? "mr-auto" : ""
                }`}
              >
                <Link href={suggestionHref(s.slug)} className="group block">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-line">
                    {s.imageUrl && (
                      // Urun/kategori gorseli next/image remotePatterns disinda bir
                      // kaynaktan gelebilir - katalog banner'i ile ayni sebepten duz <img>.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <span className="mt-2 block text-xs">{s.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Link
            href="/urunler"
            className="mt-5 inline-flex h-[44px] items-center justify-center rounded-[50px] border border-ink px-8 text-[10px] uppercase tracking-[1px] text-ink transition duration-300 hover:bg-ink hover:text-cream"
          >
            Tüm Ürünleri Gör
          </Link>
        )}
      </div>
    </div>
  );
}
