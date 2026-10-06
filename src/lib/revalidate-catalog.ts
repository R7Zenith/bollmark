import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SEARCH_INDEX_TAG } from "@/lib/search";
import { CATALOG_TAG } from "@/lib/catalog";

// Ürün verisi (yeni ürün, düzenleme, silme/arşiv, stok, görsel, Excel aktarımı)
// değiştiğinde vitrindeki statik/önbellekli sayfaları tazeler. Bu çağrı olmadan
// anasayfa "Yeni Gelenler" bölümü bir sonraki deploy'a kadar eski kalıyordu.
// slug verilirse yalnızca o ürün sayfası, verilmezse (toplu işlem) tüm ürün
// detay sayfaları geçersiz kılınır.
export function revalidateCatalog(slug?: string) {
  // Arama indeksi (lib/search.ts) - expire:0 ile bir sonraki arama eski
  // indeksi degil guncel urun adini/fiyatini gorur.
  revalidateTag(SEARCH_INDEX_TAG, { expire: 0 });
  // Katalog girisleri, kategori filtresi ve mega menu (unstable_cache).
  revalidateTag(CATALOG_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/urunler");
  // Testle dogrulandi (CPU_KULLANIMI_AZALTMA_PLANI.md Test 4): onbellek etiketi
  // yolun %XX kacisli halidir, Turkce karakterli slug ham verilirse eslesmez;
  // desen yolunda da route grubu "(site)" yazilmazsa hicbir sayfa eslesmez.
  if (slug) {
    revalidatePath(encodeURI(`/urunler/${slug}`));
  } else {
    revalidatePath("/(site)/urunler/[slug]", "page");
  }
  // Renk secili ic rota (proxy.ts ?renk= rewrite'i) - tum renk sayfalari.
  revalidatePath("/(site)/urunler/[slug]/renk/[renk]", "page");
}

// Odeme onayi (stok dustu) ve iade (stok geri eklendi) sonrasi siparisteki
// urunlerin sayfalarini tazeler. Best-effort: hata asla firlatilmaz, odeme/iade
// akisini bozmaz (render icinden cagrilirsa revalidate hata verir, yutulur).
export async function revalidateOrderProducts(orderId: string) {
  try {
    const items = await prisma.orderItem.findMany({
      where: { orderId },
      select: { product: { select: { slug: true } } }
    });
    for (const slug of new Set(items.map((item) => item.product.slug))) revalidateCatalog(slug);
  } catch (error) {
    console.error("Katalog tazeleme başarısız (yoksayıldı):", error);
  }
}
