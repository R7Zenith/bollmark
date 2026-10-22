import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { Clapperboard, Copy, Grid3x3 } from "lucide-react";
import { INSTAGRAM_POSTS } from "@/lib/instagram-posts";
import {
  formatInstagramCount,
  INSTAGRAM_POST_COUNT,
  type InstagramPost,
  type InstagramProfile
} from "@/lib/instagram-media";

// Instagram profil sayfasi gorunumu: halkali profil fotografi, kullanici adi,
// gonderi/takipci sayisi, "Takip et"; altinda "GÖNDERİLER" sekmesi ve 3
// sutunlu 3:4 izgara (Instagram'in guncel profil izgarasi), reel/album simgesi.
// Oncelik otomatik veri (lib/instagram.ts, gunluk cron): son basarili cekimde
// 6 kare varsa onlar, her biri kendi paylasimina gider. Yoksa yedek yol: profil
// adresi env'den, fotograflar public/instagram/ altindan (bkz.
// public/instagram/README.md); adres bos VEYA bir dosya eksikse bolum HIC
// render edilmez - stok fotografla sahte galeri doldurulmaz. Dosya kontrolu
// istek aninda fs ile yapilir; Vercel'de public/ islev paketine kendiliginden
// girmedigi icin next.config.mjs'de outputFileTracingIncludes ile eklendi.
function profileHandle(profileUrl: string): string | null {
  try {
    return new URL(profileUrl).pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

type GalleryPost = { key: string; image: string; alt: string; href: string; mediaType?: string };

function manualGallery() {
  const profileUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim();
  if (!profileUrl) return null;
  const allPresent = INSTAGRAM_POSTS.every((p) => existsSync(path.join(process.cwd(), "public", p.image)));
  if (!allPresent) return null;
  return {
    profileUrl,
    profile: null,
    posts: INSTAGRAM_POSTS.map((p): GalleryPost => ({ key: p.image, image: p.image, alt: p.alt, href: profileUrl }))
  };
}

export function InstagramGrid({
  autoPosts,
  autoProfile
}: {
  autoPosts: InstagramPost[];
  autoProfile: InstagramProfile | null;
}) {
  const auto =
    autoPosts.length >= INSTAGRAM_POST_COUNT && autoProfile
      ? {
          profileUrl: `https://www.instagram.com/${autoProfile.username}/`,
          profile: autoProfile,
          posts: autoPosts.slice(0, INSTAGRAM_POST_COUNT).map(
            (p): GalleryPost => ({ key: p.id, image: p.imageUrl, alt: p.alt, href: p.permalink, mediaType: p.mediaType })
          )
        }
      : null;
  const gallery = auto ?? manualGallery();
  if (!gallery) return null;
  const { profileUrl, profile, posts } = gallery;
  const username = profile?.username ?? profileHandle(profileUrl) ?? "";

  const followButton = (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 items-center justify-center rounded-lg bg-[#0095f6] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1877f2]"
    >
      Takip et
    </a>
  );

  return (
    <section className="px-4 pb-section md:px-6 xl:px-9">
      <div className="mx-auto max-w-[820px]">
        {/* Profil basligi - telefonda fotograf solda, ad + buton sagda (Instagram mobil). */}
        <header className="flex items-center gap-5 pb-6 md:gap-16 md:px-10 md:pb-10">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`@${username} Instagram profili`}
            className="shrink-0 rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[3px]"
          >
            <span className="relative block h-[80px] w-[80px] overflow-hidden rounded-full border-[3px] border-cream bg-line md:h-[140px] md:w-[140px]">
              {profile?.pictureUrl ? (
                <Image src={profile.pictureUrl} alt="" fill sizes="140px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-accent text-3xl italic text-ink/60">
                  {username.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
          </a>
          <div className="min-w-0 space-y-3 md:space-y-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-lg text-ink md:text-xl"
              >
                {username}
              </a>
              {followButton}
            </div>
            {profile && (profile.mediaCount != null || profile.followers != null) && (
              <ul className="flex gap-6 text-sm text-ink md:gap-10 md:text-base">
                {profile.mediaCount != null && (
                  <li>
                    <span className="font-semibold">{formatInstagramCount(profile.mediaCount)}</span> gönderi
                  </li>
                )}
                {profile.followers != null && (
                  <li>
                    <span className="font-semibold">{formatInstagramCount(profile.followers)}</span> takipçi
                  </li>
                )}
              </ul>
            )}
            {profile?.name && <p className="text-sm font-semibold text-ink">{profile.name}</p>}
          </div>
        </header>

        <div className="flex justify-center border-t border-line">
          <span className="-mt-px flex items-center gap-1.5 border-t border-ink py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">
            <Grid3x3 size={12} strokeWidth={2} />
            Gönderiler
          </span>
        </div>

        <ul className="grid grid-cols-3 gap-0.5 md:gap-1">
          {posts.map((post) => (
            <li key={post.key}>
              <a
                href={post.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-[3/4] overflow-hidden bg-line"
              >
                <Image
                  src={post.image}
                  alt={post.alt}
                  fill
                  sizes="(min-width: 820px) 273px, 33vw"
                  className="object-cover"
                />
                <span className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/25" />
                {post.mediaType === "VIDEO" && (
                  <Clapperboard
                    size={18}
                    aria-label="Reel"
                    className="absolute right-2 top-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  />
                )}
                {post.mediaType === "CAROUSEL_ALBUM" && (
                  <Copy
                    size={18}
                    aria-label="Albüm"
                    className="absolute right-2 top-2 -scale-x-100 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  />
                )}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
