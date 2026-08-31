import { del } from "@vercel/blob";

// Vercel Blob'a yuklenen dosyalarin url'leri hep bu host'ta biter.
// Kullanicinin elle yapistirdigi disaridan (Unsplash vb.) url'ler bu deseni
// tutturmaz, dolayisiyla yanlislikla silinmezler.
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

function isManagedBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/**
 * Verilen url listesinden sadece Vercel Blob'da barinanlari siler.
 * Bir urun/varyant guncellenirken veya silinirken artik kullanilmayan
 * gorsellerin depoda birikmesini onlemek icin kullanilir. Silme basarisiz
 * olsa bile (ag hatasi, zaten silinmis olma vb.) hatayi yutar - bu temizlik
 * asil islemi (urun kaydetme/silme) asla engellememeli.
 */
export async function deleteBlobUrls(urls: string[]): Promise<void> {
  const targets = Array.from(new Set(urls)).filter(isManagedBlobUrl);
  if (targets.length === 0) return;
  try {
    await del(targets);
  } catch (error) {
    console.error("Kullanilmayan blob gorselleri silinemedi (yoksayildi):", error);
  }
}
