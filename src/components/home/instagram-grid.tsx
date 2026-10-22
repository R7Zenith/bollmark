import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { INSTAGRAM_POSTS } from "@/lib/instagram-posts";
import { INSTAGRAM_POST_COUNT, type InstagramPost } from "@/lib/instagram-media";

// Oncelik otomatik kareler (lib/instagram.ts, gunluk cron): son basarili
// cekimde 6 kare varsa onlar gosterilir, her biri kendi paylasimina gider,
// profil adresi baglanan hesabin kullanici adindan. Yoksa yedek yol: profil
// adresi env'den, fotograflar public/instagram/ altindan (bkz.
// public/instagram/README.md); adres bos VEYA bir dosya eksikse bolum HIC
// render edilmez - stok fotografla sahte galeri doldurulmaz. Dosya kontrolu
// istek aninda fs ile yapilir; Vercel'de public/ islev paketine kendiliginden
// girmedigi icin next.config.mjs'de outputFileTracingIncludes ile eklendi.
function profileHandle(profileUrl: string): string | null {
  try {
    const first = new URL(profileUrl).pathname.split("/").filter(Boolean)[0];
    return first ? `@${first}` : null;
  } catch {
    return null;
  }
}

function manualGallery() {
  const profileUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim();
  if (!profileUrl) return null;
  const allPresent = INSTAGRAM_POSTS.every((p) => existsSync(path.join(process.cwd(), "public", p.image)));
  if (!allPresent) return null;
  return { profileUrl, posts: INSTAGRAM_POSTS.map((p) => ({ key: p.image, image: p.image, alt: p.alt, href: profileUrl })) };
}

export function InstagramGrid({ autoPosts, autoUsername }: { autoPosts: InstagramPost[]; autoUsername: string }) {
  const auto =
    autoPosts.length >= INSTAGRAM_POST_COUNT
      ? {
          profileUrl: autoUsername
            ? `https://www.instagram.com/${autoUsername}/`
            : (process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() ?? ""),
          posts: autoPosts
            .slice(0, INSTAGRAM_POST_COUNT)
            .map((p) => ({ key: p.id, image: p.imageUrl, alt: p.alt, href: p.permalink }))
        }
      : null;
  const gallery = auto ?? manualGallery();
  if (!gallery) return null;
  const { profileUrl, posts } = gallery;

  const handle = profileHandle(profileUrl);

  return (
    <section className="px-4 pb-section md:px-6 xl:px-9">
      <div className="mb-10 flex items-end justify-between md:mb-12">
        <h2 className="font-display text-3xl font-normal tracking-[-0.04em] md:text-5xl">
          Bizi <em className="font-accent italic font-normal">takip edin</em>
        </h2>
        {profileUrl && handle && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link-shrink-underline text-[10px] font-medium uppercase tracking-[0.1em] text-ink"
          >
            {handle}
          </a>
        )}
      </div>
      <ul className="grid grid-cols-3 gap-1 md:grid-cols-6 md:gap-2">
        {posts.map((post) => (
          <li key={post.key}>
            <a
              href={post.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-square overflow-hidden bg-line"
            >
              <Image
                src={post.image}
                alt={post.alt}
                fill
                sizes="(min-width: 768px) 16vw, 33vw"
                className="object-cover transition duration-500 ease-out group-hover:scale-105"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
