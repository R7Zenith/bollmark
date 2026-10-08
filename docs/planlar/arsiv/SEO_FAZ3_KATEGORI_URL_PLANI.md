# SEO Faz 3 — Temiz kategori URL'leri (uygulandı, 2026-09-30)

Kaynak: SEO_TEKNIK_DENETIM_VE_PLAN.md bölüm 2.4 ve 2.11. Tarih: 30 Eylül 2026.

## 1. Mevcut durum (kod ve canlı veri incelemesi)

- Tüm katalog tek sayfada: `/urunler?kategori=gomlek&cinsiyet=Erkek`. Canonical yok.
- Canlı veride cinsiyet değerleri şunlar: `Kadın` (88 ürün), `Erkek` (63), `Unisex` (3). Menüde `Çocuk` da var ama ürünü yok. 27 farklı cinsiyet+kategori kombinasyonunda ürün var.
- 42 kategori var. Aksesuar ağacı (Ayakkabı, Çanta, Çorap…) menüde cinsiyetsiz bağlanıyor.
- Üç kategori slug'ında Türkçe karakter var: `eşofman-altı`, `parfüm`, `dış-giyim`.
- Category modelinde `description`, `metaTitle` ve `metaDescription` alanları **zaten var** ve admin kategori sayfasında düzenlenebiliyor, ama mağaza tarafı bunları hiç kullanmıyor. Yeni alan (migration) gerekmiyor.
- **Hata:** `updateCategory` her kayıtta slug'ı addan yeniden üretiyor (`slugify` Türkçe karakterleri de koruyor). Admin "Gömlek" kategorisinin yalnızca açıklamasını kaydetse bile slug `gomlek` → `gömlek` olur. Mega menü kartları, anasayfa ve footer'daki sabit bağlantılar kırılır.
- Bağlantılar 10 dosyada elle `/urunler?…` olarak yazılmış: site-header, mega-menu-cards, site-footer, anasayfa, empty-category-state, ürün ve katalog breadcrumb'ları, catalog-grid ("Daha fazla göster"), sitemap, catalog-banner.

## 2. Hedef URL yapısı

| Sayfa | Yeni URL | Eski URL |
|---|---|---|
| Cinsiyet | `/kadin`, `/erkek`, `/unisex`, `/cocuk` | `/urunler?cinsiyet=Kadın` |
| Cinsiyet + kategori | `/kadin/elbise`, `/erkek/gomlek` | `/urunler?kategori=elbise&cinsiyet=Kadın` |
| Cinsiyetsiz kategori | `/kategori/ayakkabi`, `/kategori/aksesuar` | `/urunler?kategori=ayakkabi` |
| Tüm ürünler | `/urunler` (değişmez) | — |
| Arama | `/urunler?ara=…` (değişmez, noindex) | — |

Filtre, sıralama ve "göster" parametreleri yeni URL'de de sorgu olarak kalır (`/erkek/gomlek?sirala=fiyat-artan`).

## 3. Yapılacaklar

1. **`src/lib/catalog-url.ts` (yeni):** cinsiyet ↔ slug eşlemesi (`Kadın`↔`kadin` …) ve tek bir `catalogHref({ gender, category })` yardımcısı. Tüm bağlantılar bunu kullanır, elle URL yazılmaz.
2. **Ortak katalog bileşeni:** `urunler/page.tsx`'in render ve metadata mantığı `src/components/catalog-page.tsx` ve `src/lib/catalog-metadata.ts` dosyalarına taşınır. Yeni rotalar, `kategori`/`cinsiyet` değerini URL yolundan alıp aynı `getCatalogListing`'e verir. Filtre çekmecesi, sıralama ve "Daha fazla göster" aynen çalışır.
3. **Yeni rotalar:**
   - `src/app/(site)/[cinsiyet]/page.tsx`
   - `src/app/(site)/[cinsiyet]/[kategori]/page.tsx`
   - `src/app/(site)/kategori/[slug]/page.tsx`

   `[cinsiyet]` yalnız bilinen 4 cinsiyet slug'ını kabul eder, diğerleri 404 olur. Statik rotalar (hesap, sepet, odeme, sayfa, iletisim, urunler, admin, api, yapim-asamasinda, Servis) Next.js'te dinamik rotadan önce eşleştiği için çakışma olmaz. Kategori slug'ları hep `/kategori/` ya da bir cinsiyet altında durduğu için bir kategori slug'ının üst seviye bir rotayla çakışması mümkün değil. Bu yüzden ayrıca "rezerve kelime" uyarısı gerekmiyor.
4. **301 yönlendirme (`src/proxy.ts`):** `/urunler` isteğinde `kategori` ya da `cinsiyet` varsa ve `ara` yoksa, istek 301 ile yeni yola yönlendirilir. Diğer parametreler korunur.
5. **Araç çubuğu:** `catalog-toolbar.tsx` şu an kategori seçince `?kategori=` ekliyor. Bunun yerine yeni yola gidecek (`/erkek` → `/erkek/gomlek`), filtre parametreleri korunacak. `catalog-grid.tsx`'teki sabit `/urunler?…&goster=` adresi mevcut yolu kullanacak.
6. **Saydam header ve banner:** `hasCatalogBanner` yalnızca `/urunler` yolunu tanıyor. Yeni yolları da tanıyacak, yoksa header'ın banner üzerindeki saydam görünümü bozulur.
7. **Bağlantıların güncellenmesi:** site-header (masaüstü mega menü, mobil menü, arama önerileri), mega-menu-cards, footer, anasayfa koleksiyon kartları ve "Erkek" butonu, empty-category-state, ürün ve katalog breadcrumb'ları (görsel olan ve JSON-LD olan).
8. **Canonical:** Her katalog sayfasının canonical'ı kendi temiz yoludur. `sirala`, `goster` ve filtre parametreleri canonical'a girmez.
9. **Kategori SEO alanları (mevcut alanlar kullanılacak):**
   - `/kategori/{slug}`:
     - title: `metaTitle`, boşsa "{Kategori} Modelleri"
     - description: `metaDescription`, boşsa otomatik metin
   - `/{cinsiyet}/{kategori}`:
     - title: "{Cinsiyet} {Kategori} Modelleri"
     - description: kategorinin `metaDescription`'ı varsa o, yoksa otomatik metin
   - `description` (giriş metni) doluysa banner başlığının altında kısa bir paragraf olarak gösterilir. Şu an hiçbir kategoride dolu olmadığı için görünümde bir değişiklik olmaz.
   - Banner'daki H1: cinsiyet+kategori sayfasında "Erkek Gömlek" olur (şu an yalnızca "Gömlek" yazıyor).
10. **Admin kategori kaydı düzeltmesi (`category-actions.ts`):**
    - Güncellemede slug artık değişmez. Yalnızca yeni kategori oluşturulurken üretilir.
    - `slugify` Türkçe karakterleri ASCII'ye çevirir (ı→i, ş→s …) ve `&` gibi işaretleri temizler.
    - Mevcut üç Türkçe karakterli slug tek seferlik bir scriptle ASCII'ye çevrilir: `esofman-alti`, `parfum`, `dis-giyim`. Eski adreslere gelen istekler proxy'deki küçük bir eşleme listesiyle 301 alır.
11. **Sitemap:**
    - Eklenecekler: cinsiyet sayfaları, ürünü olan cinsiyet+kategori kombinasyonları (27 adet) ve ürünü olan `/kategori/{slug}` sayfaları.
    - Ürünü olmayan kategoriler sitemap'e girmez.
    - Ürün girişlerine ilk 5 görsel eklenir (görsel sitemap).
12. **robots.ts:** `?kategori=` artık kullanılmadığı için açıklama güncellenir. Kurallar değişmez.

## 4. Doğrulama

- `tsc`, `eslint`, açıklama testleri.
- `curl -I` ile üç kontrol:
  - `/urunler?kategori=gomlek&cinsiyet=Erkek` → 301 → `/erkek/gomlek`
  - `/urunler?cinsiyet=Kadın&sirala=fiyat-artan` → 301 → `/kadin?sirala=fiyat-artan`
  - `/urunler?kategori=parfüm` → 301 → `/kategori/parfum`
- Tarayıcıda kontrol:
  - mega menü (masaüstü ve mobil), filtre çekmecesi, kategori değişimi, "Daha fazla göster"
  - saydam header ve breadcrumb
  - boş kategori ekranı (`/cocuk`)
- Her sayfa türünde canonical, title ve BreadcrumbList kontrolü.
- Admin'de bir kategoriyi kaydedince slug'ın değişmediği kontrol edilir.

## 5. Kapsam dışı

- Kategori sayfası altında SSS bölümü (plandaki öneri). Kategori bazında gerçek soru-cevap içeriği yok; uydurma içerik eklenmeyecek.
- Ürün slug'larının değiştirilmesi ve yönlendirme tablosu (Faz 6).
