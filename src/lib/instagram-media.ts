// Instagram API yanitlarini anasayfa karelerine ceviren saf yardimcilar (DB/ag
// yok, bkz. instagram-media.test.ts). Senkronizasyonun kendisi lib/instagram.ts.

// mediaType: galeride reel/album simgesi icin (eski kayitlarda yok).
export type InstagramPost = { id: string; imageUrl: string; permalink: string; alt: string; mediaType?: string };

// Galerinin profil basligi. pictureSource: Instagram'daki profil fotografinin
// adres yolu (sorgu parametresiz) - degismediyse R2'ye tekrar kopyalanmaz.
export type InstagramProfile = {
  username: string;
  name: string;
  pictureUrl: string | null;
  pictureSource: string;
  followers: number | null;
  mediaCount: number | null;
};

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

// Kayitli profil (InstagramIntegration.profileJson); kullanici adi yoksa null.
export function parseProfile(raw: string): InstagramProfile | null {
  try {
    const p = JSON.parse(raw) as Partial<InstagramProfile> | null;
    if (!p || typeof p.username !== "string" || !p.username) return null;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      username: p.username,
      name: typeof p.name === "string" ? p.name : "",
      pictureUrl: typeof p.pictureUrl === "string" && p.pictureUrl ? p.pictureUrl : null,
      pictureSource: typeof p.pictureSource === "string" ? p.pictureSource : "",
      followers: num(p.followers),
      mediaCount: num(p.mediaCount)
    };
  } catch {
    return null;
  }
}

// Instagram'in Turkce profil sayilari gibi: 9.999'a kadar tam ("1.234"),
// sonrasi "12,3 B" / "1,2 Mn" (tek ondalik, ,0 yazilmaz).
export function formatInstagramCount(n: number): string {
  const short = (value: number, unit: string) =>
    `${(Math.floor(value * 10) / 10).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${unit}`;
  if (n >= 1_000_000) return short(n / 1_000_000, "Mn");
  if (n >= 10_000) return short(n / 1_000, "B");
  return n.toLocaleString("tr-TR");
}
