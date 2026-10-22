import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/payment/crypto";
import { compressImage } from "@/lib/image-compress";
import { deleteR2Urls, isR2Url, uploadImage } from "@/lib/image-storage";
import {
  captionToAlt,
  INSTAGRAM_POST_COUNT,
  mediaImageUrl,
  parsePosts,
  type InstagramMedia,
  type InstagramPost
} from "@/lib/instagram-media";

// Anasayfa Instagram galerisinin otomatik beslemesi ("Instagram API with
// Instagram Login", bkz. ANASAYFA_ALT_BOLUM_YENILEME_PLANI.md Faz 3). Gunluk
// cron (api/cron/instagram) ve admin Ayarlar'daki "Şimdi çek" syncInstagram'i
// cagirir. Instagram'in gorsel adresleri zamanla gecersiz oldugu icin kareler
// R2'ye kopyalanir; hata olursa son basarili kareler yerinde kalir.

const GRAPH = "https://graph.instagram.com";
// Uzun omurlu token 60 gun gecerli; en az 24 saatlik token yenilenebilir.
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const TOKEN_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;
const MEDIA_FETCH_LIMIT = 12;

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok || data.error) {
    throw new Error(`Instagram API hatası (${res.status}): ${data.error?.message ?? "bilinmeyen hata"}`);
  }
  return data;
}

function getRow() {
  return prisma.instagramIntegration.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
}

// Admin token'i yapistirinca: once dogrulanir (kullanici adi okunur), sonra
// sifreli kaydedilir. Bitis tarihi ilk yenilemeye kadar tahmini (60 gun).
export async function saveInstagramToken(rawToken: string): Promise<{ username: string }> {
  const token = rawToken.trim();
  const me = await graphGet<{ username?: string }>("/me", { fields: "username", access_token: token });
  const now = new Date();
  await prisma.instagramIntegration.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      tokenEncrypted: encryptSecret(token),
      username: me.username ?? "",
      tokenRefreshedAt: now,
      tokenExpiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
      lastError: ""
    },
    update: {
      tokenEncrypted: encryptSecret(token),
      username: me.username ?? "",
      tokenRefreshedAt: now,
      tokenExpiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
      lastError: ""
    }
  });
  return { username: me.username ?? "" };
}

// Baglantiyi kaldirir; kareler ve R2 dosyalari yerinde kalir (galeri gorunmeye
// devam eder, yalniz guncellenmez).
export async function disconnectInstagram() {
  await prisma.instagramIntegration.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: { tokenEncrypted: "", tokenExpiresAt: null, tokenRefreshedAt: null, lastError: "" }
  });
}

async function refreshTokenIfDue(row: Awaited<ReturnType<typeof getRow>>, token: string): Promise<string> {
  if (row.tokenRefreshedAt && Date.now() - row.tokenRefreshedAt.getTime() < REFRESH_AFTER_MS) return token;
  const refreshed = await graphGet<{ access_token: string; expires_in: number }>("/refresh_access_token", {
    grant_type: "ig_refresh_token",
    access_token: token
  });
  const now = new Date();
  await prisma.instagramIntegration.update({
    where: { id: "singleton" },
    data: {
      tokenEncrypted: encryptSecret(refreshed.access_token),
      tokenRefreshedAt: now,
      tokenExpiresAt: new Date(now.getTime() + refreshed.expires_in * 1000)
    }
  });
  return refreshed.access_token;
}

async function copyToR2(media: InstagramMedia, sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Instagram görseli indirilemedi (${res.status}).`);
  const compressed = await compressImage(Buffer.from(await res.arrayBuffer()));
  return uploadImage({ folder: "instagram", nameHint: `instagram-${media.id}`, ...compressed });
}

export type InstagramSyncResult =
  | { ok: true; postCount: number; added: number }
  | { ok: false; skipped: "baglanti-yok" }
  | { ok: false; error: string };

export async function syncInstagram(): Promise<InstagramSyncResult> {
  const row = await getRow();
  if (!row.tokenEncrypted) return { ok: false, skipped: "baglanti-yok" };

  try {
    let token = decryptSecret(row.tokenEncrypted);
    // Yenileme basarisiz olsa da mevcut token hala gecerli olabilir - cekime devam.
    let refreshError = "";
    try {
      token = await refreshTokenIfDue(row, token);
    } catch (e) {
      refreshError = e instanceof Error ? e.message : String(e);
    }

    const { data } = await graphGet<{ data: InstagramMedia[] }>("/me/media", {
      fields: "id,media_type,media_url,thumbnail_url,permalink,caption",
      limit: String(MEDIA_FETCH_LIMIT),
      access_token: token
    });

    // Ayni paylasim tekrar indirilmez - onceki cekimdeki R2 adresi kullanilir.
    const previous = parsePosts(row.postsJson);
    const previousById = new Map(previous.map((p) => [p.id, p]));
    const posts: InstagramPost[] = [];
    let added = 0;
    for (const media of data) {
      if (posts.length >= INSTAGRAM_POST_COUNT) break;
      const source = mediaImageUrl(media);
      if (!source || !media.permalink) continue;
      const known = previousById.get(media.id);
      const imageUrl = known?.imageUrl ?? (await copyToR2(media, source));
      if (!known) added++;
      posts.push({ id: media.id, imageUrl, permalink: media.permalink, alt: captionToAlt(media.caption) });
    }

    await prisma.instagramIntegration.update({
      where: { id: "singleton" },
      data: { postsJson: JSON.stringify(posts), lastFetchAt: new Date(), lastError: refreshError }
    });
    const keep = new Set(posts.map((p) => p.imageUrl));
    await deleteR2Urls(previous.map((p) => p.imageUrl).filter((url) => !keep.has(url) && isR2Url(url)));
    if (added > 0 || posts.length !== previous.length) revalidatePath("/");
    return { ok: true, postCount: posts.length, added };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.instagramIntegration.update({ where: { id: "singleton" }, data: { lastError: error } });
    return { ok: false, error };
  }
}
