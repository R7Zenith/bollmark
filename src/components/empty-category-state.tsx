"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";

type Suggestion = { name: string; slug: string; imageUrl: string | null };

type Props = {
  categoryName: string | null;
  categoryId: string | null;
  gender: string | null;
  suggestions: Suggestion[];
};

// Urunu olmayan kategori sayfasinin ekrani (bkz.
// BOS_KATEGORI_YAKINDA_TASARIMI_PLANI.md). Kategori bilinmiyorsa (yalniz
// cinsiyet/tum urunler bos) "haber ver" formu gosterilmez.
export function EmptyCategoryState({ categoryName, categoryId, gender, suggestions }: Props) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const description = categoryName
    ? gender
      ? `${gender} koleksiyonunda ${categoryName} için yeni parçaları hazırlıyoruz. Ürünler eklendiği gün ilk sen haberdar ol.`
      : `${categoryName} koleksiyonumuzu şu an hazırlıyoruz. Yeni ürünler eklendiği gün ilk sen haberdar ol.`
    : "Bu koleksiyonu şu an hazırlıyoruz. Yeni ürünler eklendiğinde burada olacak.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading" || !categoryId) return;
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/kategori-bildirimi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, gender: gender ?? undefined, email, website })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(data?.error ?? "Bir sorun oluştu, lütfen tekrar deneyin.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setErrorMessage("Bağlantı kurulamadı, lütfen tekrar deneyin.");
      setStatus("error");
    }
  };

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

      {categoryId && (
        <div className="mt-8 w-full max-w-[440px]" aria-live="polite">
          {status === "success" ? (
            <p className="flex items-center justify-center gap-2 text-sm text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-cream">
                <Check size={14} aria-hidden="true" />
              </span>
              Tamam, ürünler gelince sana yazacağız.
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="category-alert-email" className="sr-only">
                E-posta adresiniz
              </label>
              <input
                id="category-alert-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta adresiniz"
                autoComplete="email"
                className="h-[44px] w-full rounded-[50px] border border-line px-5 text-sm focus:border-ink focus:outline-none"
              />
              {/* Gorunmez tuzak alan - gercek kullanici doldurmaz. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="h-[44px] shrink-0 rounded-[50px] border border-ink bg-ink px-8 text-[10px] uppercase tracking-[1px] text-cream transition duration-300 hover:bg-cream hover:text-ink disabled:opacity-40"
              >
                Haber Ver
              </button>
            </form>
          )}
          {status === "error" && <p className="mt-3 text-xs text-sale">{errorMessage}</p>}
        </div>
      )}

      <div className="mt-12 w-full border-t border-line pt-10">
        <p className="text-sm text-ink/60">Bu arada göz atmak ister misin?</p>
        {suggestions.length > 0 ? (
          <ul className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:justify-center md:px-0">
            {suggestions.map((s) => (
              <li key={s.slug} className="w-[120px] shrink-0 snap-start">
                <Link href={suggestionHref(s.slug)} className="group block">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-line">
                    {s.imageUrl && (
                      // Kategori imageUrl'i next/image remotePatterns disinda bir
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
