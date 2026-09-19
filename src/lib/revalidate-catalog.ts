import { revalidatePath } from "next/cache";

// Ürün verisi (yeni ürün, düzenleme, silme/arşiv, stok, görsel, Excel aktarımı)
// değiştiğinde vitrindeki statik/önbellekli sayfaları tazeler. Bu çağrı olmadan
// anasayfa "Yeni Gelenler" bölümü bir sonraki deploy'a kadar eski kalıyordu.
// slug verilirse yalnızca o ürün sayfası, verilmezse (toplu işlem) tüm ürün
// detay sayfaları geçersiz kılınır.
export function revalidateCatalog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/urunler");
  if (slug) {
    revalidatePath(`/urunler/${slug}`);
  } else {
    revalidatePath("/urunler/[slug]", "page");
  }
}
