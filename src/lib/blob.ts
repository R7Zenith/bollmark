import { deleteR2Urls, isR2Url } from "@/lib/image-storage";

/**
 * Verilen url listesinden sadece R2'de (bkz. image-storage.ts) barinanlari siler.
 * Kullanicinin elle yapistirdigi disaridan (Unsplash vb.) url'ler R2 host'unu
 * tutturmaz, dolayisiyla yanlislikla silinmezler.
 * Bir urun/varyant guncellenirken veya silinirken artik kullanilmayan
 * gorsellerin depoda birikmesini onlemek icin kullanilir. Silme basarisiz
 * olsa bile (ag hatasi, zaten silinmis olma vb.) hatayi yutar - bu temizlik
 * asil islemi (urun kaydetme/silme) asla engellememeli.
 */
export async function deleteBlobUrls(urls: string[]): Promise<void> {
  const unique = Array.from(new Set(urls));
  await deleteR2Urls(unique.filter(isR2Url));
}
