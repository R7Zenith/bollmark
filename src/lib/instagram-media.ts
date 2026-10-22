// Instagram API yanitlarini anasayfa karelerine ceviren saf yardimcilar (DB/ag
// yok, bkz. instagram-media.test.ts). Senkronizasyonun kendisi lib/instagram.ts.

export type InstagramPost = { id: string; imageUrl: string; permalink: string; alt: string };

// graph.instagram.com/me/media alanlarindan kullanilanlar.
export type InstagramMedia = {
  id: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  caption?: string;
};

export const INSTAGRAM_POST_COUNT = 6;
const DEFAULT_ALT = "Bollmark Instagram paylaşımı";
const ALT_MAX = 120;

// Videoda media_url video dosyasidir - kapak gorseli thumbnail_url. Albumde
// media_url ilk karenin gorseli. Gorseli olmayan paylasim atlanir.
export function mediaImageUrl(media: InstagramMedia): string | null {
  const url = media.media_type === "VIDEO" ? media.thumbnail_url : media.media_url;
  return url && /^https:\/\//.test(url) ? url : null;
}

// Alt metin: aciklamanin ilk cumlesi; hashtag, mention ve emoji/sembol temizlenir.
export function captionToAlt(caption: string | undefined): string {
  const text = (caption ?? "")
    .split(/\n/)[0]
    .replace(/[#@][\p{L}\p{N}_.]+/gu, "")
    .replace(/[^\p{L}\p{N}\s.,!?'"%:;()&-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = text.split(/(?<=[.!?])\s/)[0].trim();
  if (sentence.length < 3) return DEFAULT_ALT;
  return sentence.length > ALT_MAX ? `${sentence.slice(0, ALT_MAX - 1).trimEnd()}…` : sentence;
}

// Kayitli kareler (InstagramIntegration.postsJson); bozuk kayit atilir.
export function parsePosts(raw: string): InstagramPost[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is InstagramPost =>
        !!p &&
        typeof p === "object" &&
        typeof (p as InstagramPost).id === "string" &&
        typeof (p as InstagramPost).imageUrl === "string" &&
        typeof (p as InstagramPost).permalink === "string" &&
        typeof (p as InstagramPost).alt === "string"
    );
  } catch {
    return [];
  }
}
