import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { INSTAGRAM_POSTS } from "@/lib/instagram-posts";

// Profil adresi env'den gelir; adres bos VEYA dizideki fotograflardan biri
// public/instagram/ altinda yoksa bolum HIC render edilmez - sayfa bos kare
// gostermesin, stok fotografla sahte galeri de doldurulmaz (bkz.
// public/instagram/README.md). Dosya kontrolu istek aninda fs ile yapilir;
// Vercel'de public/ islev paketine kendiliginden girmedigi icin
// next.config.mjs'de outputFileTracingIncludes ile eklendi.
function profileHandle(profileUrl: string): string | null {
  try {
    const first = new URL(profileUrl).pathname.split("/").filter(Boolean)[0];
    return first ? `@${first}` : null;
  } catch {
    return null;
  }
}

export function InstagramGrid() {
  const profileUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim();
  if (!profileUrl) return null;
  const allPresent = INSTAGRAM_POSTS.every((p) => existsSync(path.join(process.cwd(), "public", p.image)));
  if (!allPresent) return null;

  const handle = profileHandle(profileUrl);

  return (
    <section className="px-4 pb-section md:px-6 xl:px-9">
      <div className="mb-10 flex items-end justify-between md:mb-12">
        <h2 className="font-display text-3xl font-normal tracking-[-0.04em] md:text-5xl">
          Bizi <em className="font-accent italic font-normal">takip edin</em>
        </h2>
        {handle && (
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
        {INSTAGRAM_POSTS.map((post) => (
          <li key={post.image}>
            <a
              href={profileUrl}
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
