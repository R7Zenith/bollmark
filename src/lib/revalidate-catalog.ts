import { revalidatePath, revalidateTag } from "next/cache";
import { SEARCH_INDEX_TAG } from "@/lib/search";

// Ürün verisi (yeni ürün, düzenleme, silme/arşiv, stok, görsel, Excel aktarımı)
// değiştiğinde vitrindeki statik/önbellekli sayfaları tazeler. Bu çağrı olmadan
// anasayfa "Yeni Gelenler" bölümü bir sonraki deploy'a kadar eski kalıyordu.
// slug verilirse yalnızca o ürün sayfası, verilmezse (toplu işlem) tüm ürün
// detay sayfaları geçersiz kılınır.
export function revalidateCatalog(slug?: string) {
  // Arama indeksi (lib/search.ts) - expire:0 ile bir sonraki arama eski
  // indeksi degil guncel urun adini/fiyatini gorur.
  revalidateTag(SEARCH_INDEX_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/urunler");
  if (slug) {
    revalidatePath(`/urunler/${slug}`);
  } else {
    revalidatePath("/urunler/[slug]", "page");
  }
}
