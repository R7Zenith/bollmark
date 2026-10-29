import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SEARCH_INDEX_TAG } from "@/lib/search";
import { CATALOG_TAG } from "@/lib/catalog";
import { MENU_TAG } from "@/lib/site-nav";

// Stok/fiyat gosteren listeler: arama indeksi, katalog, anasayfa, kombinler.
function revalidateListings() {
  // Arama indeksi (lib/search.ts) - expire:0 ile bir sonraki arama eski
  // indeksi degil guncel urun adini/fiyatini gorur.
  revalidateTag(SEARCH_INDEX_TAG, { expire: 0 });
  // Katalog girisleri ve kategori filtresi (unstable_cache).
  revalidateTag(CATALOG_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/urunler");
  // Kombin sayfalari urun fiyat/stok/gorselini gosteriyor (bkz. kombin/[id]/page.tsx).
  revalidatePath("/(site)/kombin/[id]", "page");
}

// Ürün verisi (yeni ürün, düzenleme, silme/arşiv, stok, görsel, Excel aktarımı)
// değiştiğinde vitrindeki statik/önbellekli sayfaları tazeler. Bu çağrı olmadan
// anasayfa "Yeni Gelenler" bölümü bir sonraki deploy'a kadar eski kalıyordu.
// slug verilirse yalnızca o ürün sayfası, verilmezse (toplu işlem) tüm ürün
// detay sayfaları geçersiz kılınır. Mega menu etiketi her vitrin sayfasinda
// oldugu icin (layout) bu cagri pratikte tum ISR sayfalarini tazeler.
export function revalidateCatalog(slug?: string) {
  revalidateListings();
  revalidateTag(MENU_TAG, { expire: 0 });
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

// Yalniz stok degisimi (Vega VaryasyonGuncelle): menu stoga bagli olmadigi icin
// silinmez, diger urunlerin sayfalarina dokunulmaz - eskiden her Vega stok
// degisimi tum urun sayfalarini yeniden urettirip Neon transferini sisiriyordu
// (bkz. NEON_TRANSFER_AZALTMA_PLANI.md oneri 1). Diger urunlerin "Benzer Urunler"
// bolumu en cok revalidate suresi (1 saat) kadar eski stokla kalabilir.
export async function revalidateProductStock(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      slug: true,
      // Renk sayfasi adresindeki etiketler (?renk=<etiket>, bkz. product-card.tsx).
      variants: { select: { options: { where: { value: { attribute: { isColor: true } } }, select: { value: { select: { value: true } } } } } }
    }
  });
  if (!product) return;
  revalidateListings();
  const productPath = encodeURI(`/urunler/${product.slug}`);
  revalidatePath(productPath);
  // Testle dogrulandi: renk sayfasinin etiketi /urunler/<encodeURI slug>/renk/<encodeURIComponent etiket>
  // (proxy.ts renk degerini encodeURIComponent ile yazar).
  const labels = new Set(product.variants.flatMap((v) => v.options.map((o) => o.value.value)));
  for (const label of labels) revalidatePath(`${productPath}/renk/${encodeURIComponent(label)}`);
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
