# Admin Paneli — Kategoriler Sayfası: Araştırma ve Öneriler

Bu belge, "kategoriler sayfası çok yalın ve kullanışsız" tespitine yanıt
olarak hazırlandı. Önce mevcut kodu (`kategoriler/page.tsx`, `category-row.tsx`,
`category-tree.ts`, Prisma şeması) inceledim, sonra Shopify'ın 2026'da
yenilenen Collections deneyimi, commercetools'un kategori yönetimi best
practice dokümantasyonu ve toplu işlem (bulk action) UX kaynaklarına
baktım. Sonunda somut, üç aşamalı bir öneri listesi var.

## 1) Şu an ne var, teknik olarak

- **Veri modeli** (`prisma/schema.prisma`): `Category` sadece
  `id, name, slug, parentId, sizeGuide, createdAt` alanlarına sahip.
  **Görsel, açıklama, SEO alanı (meta title/description), aktif/pasif
  durumu, manuel sıralama (`sortOrder`) yok.** Bir ürün tek bir kategoriye
  bağlanabiliyor (many-to-one) — çoklu kategori desteği yok.
- **Sayfa** (`app/(admin)/admin/kategoriler/page.tsx`): Next.js server
  action'larla `create/update/delete`. Sayfa `max-w-md` (≈448px) genişliğinde
  tek sütun — Ürünler/Siparişler sayfalarındaki geniş `DataTable` düzeninin
  aksine çok dar. "Yeni Kategori" formu ve tüm liste aynı dar sütunda üst
  üste.
- **Sıralama**: `category-tree.ts` kategori ağacını alfabetik (`localeCompare`)
  kuruyor. Yönetici, storefront'ta kategorilerin hangi sırayla görüneceğini
  **kontrol edemiyor** (isim değiştirmekten başka yolu yok).
- **Hiyerarşi gösterimi**: Gerçek bir ağaç bileşeni değil, düz bir liste
  üzerinde derinliğe göre soldan boşluk (`padding-left`) veriliyor.
- **Düzenleme**: `category-row.tsx`'te satıra tıklayınca satırın tamamı bir
  mini-forma dönüşüyor (ürün sayısı rozeti kayboluyor), kaydet/vazgeç var
  ama görsel, açıklama, SEO gibi ek alan yok çünkü şemada da yok.
- **Silme**: Kategoriye bağlı ürün ya da alt kategori varsa engelleniyor,
  ama "önce ürünleri başka kategoriye taşı" için panelden bir kısayol yok —
  yönetici ürünleri teker teker Ürünler sayfasından taşımak zorunda.
- **Eksik olan ama projede zaten hazır bileşenler**: `image-field.tsx`,
  `multi-image-field.tsx`, `search-input.tsx`, `bulk-action-bar.tsx`,
  `data-table.tsx`, `filter-bar.tsx` — bunların hepsi Ürünler/Siparişler
  sayfalarında kullanılıyor ama Kategoriler sayfasına hiç taşınmamış. Yani
  "yalın" görünmesinin sebeplerinden biri, panelin geri kalanında zaten var
  olan bileşenlerin burada kullanılmamış olması.

## 2) Sektör araştırması

**Shopify'ın 2026'da yenilenen Collections deneyimi** ([Shopify blog](https://www.shopify.com/enterprise/blog/collections-2026)):
ürünleri sürükle-bırakla yeniden sıralama, ızgara/liste görünümü arası
geçiş, fiyata/alfabetik/manuele göre sıralama seçenekleri, otomatik ve elle
seçili koleksiyonları aynı ekranda birleştirme — yönetici artık "ya tam
otomasyon ya tam manuel" seçmek zorunda kalmıyor, ikisini birden
kullanabiliyor.

**commercetools kategori yönetimi best practice'leri** ([kaynak](https://docs.commercetools.com/learning-model-your-product-catalog/categorization/best-practices-and-advanced-category-management)):
kategori ağacını sığ tutmak (çok derin iç içe geçme kötü UX), müşteri
odaklı sade isimlendirme, görünürlüğü belirli bir tarihte otomatik
aç/kapat edebilme (zamanlanmış yayın), kardeş kategoriler arasında tutarlı
alt kategori isimlendirmesi, bir ürünü çok fazla kategoriye eklememe.

**Toplu işlem (bulk action) UX kuralları** ([Eleken](https://www.eleken.co/blog-posts/bulk-actions-ux)):
görünür checkbox'lar, uygulanamayan işlemi tıklanabilir bırakıp belirsiz
sonuç vermek yerine devre dışı bırakıp nedenini açıklamak, seçime yakın
sabit araç çubuğu, yıkıcı işlemlerde onay + "geri al" bildirimi, başarı/
hata özetini şeffaf gösterme.

Genel e-ticaret pratiğinden (Magento/WooCommerce/BigCommerce) ayrıca:
kategori görseli (storefront'ta kategori kartında/menüde gösterilen
küçük resim), kategori başına SEO alanları (meta başlık/açıklama, "URL
anahtarı" zaten `slug` olarak var), kategori açıklaması (hem müşteri hem
arama motoru için), "öne çıkan kategori" işareti, ürün sayısına tıklayınca
o kategoriye filtrelenmiş ürün listesine gitme.

## 3) Somut öneriler — üç rota

Aşağıdaki üç rotayı bağımsız ya da sırayla uygulayabiliriz; her biri bir
sonrakinin önkoşulu değil ama mantıksal bir ilerleme var.

### Rota A — Hızlı kazanımlar (düşük efor, mevcut bileşenleri yeniden kullanarak)

1. Sayfa düzenini `max-w-md` dar sütundan, panelin geri kalanıyla tutarlı
   geniş bir düzene taşı (liste + sağda/altta "yeni ekle" formu, ya da
   `DataTable` tarzı tablo).
2. Kategoriye **görsel** ekle — şemaya `imageUrl`, formda mevcut
   `image-field.tsx` bileşenini kullan.
3. **Aktif/Pasif** alanı ekle — storefront'tan silmeden gizleyebilme.
4. **Arama kutusu** ekle (`search-input.tsx` zaten var, kategori adına göre
   filtrele).
5. Ürün sayısı rozetini tıklanabilir yap → Ürünler sayfasına o kategoriyle
   filtrelenmiş şekilde götür.
6. Silme akışını iyileştir: ürün/alt kategori bağlıysa engellemek yerine
   modal içinde "ürünleri şu kategoriye taşı ve sil" seçeneği sun.

### Rota B — Orta düzey: gerçek ağaç görünümü + ayrı detay sayfası

7. Kategori için ayrı bir detay sayfası (`/admin/kategoriler/[id]`) —
   Ürünler'deki detay sayfası paterniyle tutarlı; inline mini-form yerine
   görsel, açıklama, SEO gibi alanlara yer açar, liste sayfasını sadeleştirir.
2. **Manuel sıralama**: şemaya `sortOrder` ekleyip sürükle-bırak (`dnd-kit`)
   ile hem sıralama hem yeniden ebeveynleme (bir kategoriyi sürükleyip başka
   bir üst kategorinin altına taşıma).
3. **SEO alanları**: `metaTitle`, `metaDescription`, `description` (kategori
   sayfası açıklaması) — hem storefront hem arama motoru için.
4. **Toplu işlemler**: `bulk-action-bar.tsx` kullanarak çoklu seçim + toplu
   gizle/taşı/sil.

### Rota C — İleri düzey: akıllı koleksiyonlar + analitik

1. **Kural bazlı otomatik kategoriler** — Shopify'ın "akıllı koleksiyon"
   modeline benzer: "son 30 günde eklenenler", "belirli markaya/etikete
   sahip olanlar" gibi kurallarla ürünlerin otomatik dahil olması.
2. **Zamanlanmış görünürlük** — belirli tarihte otomatik yayına
   alma/gizleme (kampanya/sezon lansmanları için).
3. **Kategori bazlı performans** — görüntülenme/tıklama/satış kırılımı,
   Raporlar sayfasına entegre.
4. **Çoklu kategori desteği** — bir ürünün birden fazla kategoriye ait
   olabilmesi (şu an many-to-one). Bu, veri modelinde kırılma değişikliği
   ve migration gerektirir; en riskli/en yüksek eforlu madde.

## 4) Kaynaklar

- [Shopify — Introducing a brand new Collections experience (2026)](https://www.shopify.com/enterprise/blog/collections-2026)
- [commercetools — Best practices and advanced Category management](https://docs.commercetools.com/learning-model-your-product-catalog/categorization/best-practices-and-advanced-category-management)
- [Eleken — Bulk action UX: 8 design guidelines](https://www.eleken.co/blog-posts/bulk-actions-ux)
- [wecanfly — Shopify Product Categories UI/UX Guide (2026)](https://wecanflyagency.com/blog/shopify-product-categories-ui-ux-guide-for-ecommerce)
- [Web Shop Manager — The Definitive Guide to Ecommerce Category Trees](https://webshopmanager.com/how-to-build-ecommerce-category-tree/)
