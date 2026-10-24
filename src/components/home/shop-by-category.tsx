import Image from "next/image";
import Link from "next/link";
import type { HomeImage } from "@/lib/home-products";

export type StripCategoryItem = { name: string; slug: string; href: string; image: HomeImage | null };
export type CollectionBox = { label: string; count: number; href: string; image: HomeImage | null };

// Gorseller ya kategorinin admin imageUrl'i ya da gruptaki gercek bir urunun
// fotografi (bkz. home-products.ts). Ikisi de yoksa kart gizlenmez: gri zemin
// (image-bg) uzerinde yalniz yazi. next.config'te unoptimized:true oldugu
// icin next/image her kaynaktan gelen URL'i oldugu gibi kullanir.
function CardImage({ image, sizes }: { image: HomeImage; sizes: string }) {
  return (
    <Image
      src={image.url}
      alt=""
      fill
      sizes={sizes}
      className={`object-cover transition duration-500 ease-out group-hover:scale-105${
        image.greyBackdrop ? " mix-blend-multiply" : ""
      }`}
    />
  );
}

// Ust: yatay kayan yuvarlak kategori seridi (telefonda kaydirma cubugu yok).
// Alt: cinsiyet/grup kutulari - telefonda 2 sutun, tek kalan son kart tam
// genislik; masaustunde hepsi tek satir (lg:grid-flow-col + auto-cols-fr).
export function ShopByCategory({ strip, boxes }: { strip: StripCategoryItem[]; boxes: CollectionBox[] }) {
  if (strip.length === 0 && boxes.length === 0) return null;
  const oddLast = boxes.length % 2 === 1;

  return (
    <section data-nosnippet className="px-4 pb-section md:px-6 xl:px-9">
      <h2 className="mb-8 font-display text-3xl font-normal tracking-[-0.04em] md:mb-10 md:text-5xl">
        Ne <em className="font-accent italic font-normal">arıyorsun?</em>
      </h2>

      {strip.length > 0 && (
        <ul className="-mx-4 mb-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 [scrollbar-width:none] scroll-px-4 md:mx-0 md:mb-12 md:gap-6 md:px-0 lg:justify-between [&::-webkit-scrollbar]:hidden">
          {strip.map((c) => (
            <li key={c.slug} className="shrink-0 snap-start">
              <Link href={c.href} className="group flex w-[76px] flex-col items-center gap-2.5 md:w-28">
                <span
                  className={`relative flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full md:h-28 md:w-28 ${
                    c.image && !c.image.greyBackdrop ? "bg-line" : "bg-image-bg"
                  }`}
                >
                  {c.image ? (
                    <CardImage image={c.image} sizes="112px" />
                  ) : (
                    <span aria-hidden="true" className="font-accent text-3xl italic text-ink/60 md:text-4xl">
                      {c.name.charAt(0)}
                    </span>
                  )}
                </span>
                <span className="text-center text-xs leading-tight text-ink md:text-sm">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {boxes.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
          {boxes.map((b, i) => {
            const wide = oddLast && i === boxes.length - 1;
            return (
              <Link
                key={b.label}
                href={b.href}
                aria-label={b.count > 0 ? `${b.label}, ${b.count} ürün` : b.label}
                className={`group relative block overflow-hidden ${
                  b.image && !b.image.greyBackdrop ? "bg-line" : "bg-image-bg"
                } ${wide ? "col-span-2 aspect-[3/2] lg:col-span-1 lg:aspect-[3/4]" : "aspect-[3/4]"}`}
              >
                {b.image && (
                  <>
                    <CardImage
                      image={b.image}
                      sizes={wide ? "(min-width: 1024px) 20vw, 100vw" : "(min-width: 1024px) 20vw, 50vw"}
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
                  </>
                )}
                <span
                  className={`absolute bottom-3 left-3 font-display text-xl font-light md:bottom-5 md:left-5 md:text-2xl ${
                    b.image ? "text-cream" : "text-ink"
                  }`}
                >
                  {b.label}
                </span>
                {b.count > 0 && (
                  <span
                    className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] md:right-3 md:top-3 ${
                      b.image ? "bg-cream/90 text-ink" : "text-ink/60"
                    }`}
                  >
                    {b.count} ürün
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
