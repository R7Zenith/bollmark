# "Bunlar da hoşunuza gidebilir" — Cinsiyet ve Renk Düzeltme Planı

Tarih: 2026-10-14
Durum: devam ediyor — 1. ve 2. adım uygulandı (2026-10-14); 3. adım kullanıcı onayı bekliyor.
Not: kardeş kategoriden tamamlama yalnız `parentId` dolu (alt) kategorilerde çalışır;
üst seviye kategorilerde "kardeş" tüm üst kategoriler olacağı için uygulanmaz.

## Sorun

Ürün detay sayfasının altındaki "Bunlar da hoşunuza gidebilir" bölümünde:

1. **Cinsiyet karışıyor.** Kadın pantolonu sayfasında erkek pantolonu (ör. "Düz Paça
   Normal Bel Gabardin Pantolon - Martin Fit") çıkıyor, tersi de oluyor.
2. **Diğer renkler görünmüyor.** Önerilen ürünlerin başka renkleri varsa bunlar ne
   ayrı kart olarak ne de kart altında renk yuvarlakları (swatch) olarak gösteriliyor.
   Katalogda aynı ürünler renk başına ayrı kartla ve swatch'larla çıkıyor.

## Kök neden (kod incelemesi)

`src/lib/catalog.ts` → `getRelatedProducts`:

- Filtre yalnızca `categoryId`. **`gender` filtresi yok.** "Pantolon" gibi kategoriler
  kadın ve erkek ürünleri tarafından ortak kullanıldığı için iki cinsiyet karışıyor.
- `take: 4` sonra stokta olmayanlar JS'de eleniyor → bazen 4'ten az kart kalıyor.
- `images` ve `optionImages` `take: 1` ile çekiliyor; varyant renk bilgisi kartlara
  aktarılmıyor. Yani katalogda kullanılan `productToCatalogEntries` (renk başına kart,
  `colors` swatch'ları, `colorLabel`, `secondImage`, `isNew`, `lowStockCount`,
  `outOfStock`) burada **hiç kullanılmıyor**.

`src/app/(site)/urunler/[slug]/product-page.tsx` → `ProductCard`'a yalnızca
`productId, slug, name, fiyat, image, quickAddVariants, greyBackdrop` geçiliyor;
`colors`, `colorLabel`, `secondImage`, `isNew`, `lowStockCount` geçilmiyor.

## Çözüm

### 1. `getRelatedProducts`'ı yeniden yaz (`src/lib/catalog.ts`)

- İmza: `getRelatedProducts(product: { id; categoryId; gender; category?: { parentId } })`.
- Aday sorgusu:
  - `status: "PUBLISHED"`, `id: { not: product.id }`, `categoryId: product.categoryId`
  - **`gender`**: ürünün `gender`'ı doluysa yalnızca aynı cinsiyet. (Sitede "Unisex"
    gibi bir değer kullanılıyorsa onu da `in` ile dahil et — önce DB'deki gerçek
    `gender` değerlerini `SELECT DISTINCT` ile kontrol et, varsayım yapma.)
  - `gender` boşsa cinsiyet filtresi uygulanmaz (eski davranış).
- `include`'u `productToCatalogEntries`'in beklediği şekle getir (katalogdakiyle aynı):
  `images: { orderBy: position, take: 2 }`, `optionImages: { orderBy: position }`
  (take YOK — renk başına görsel gerekli), `variants: { include: variantOptionsInclude }`,
  `brand: { select: { name: true } }`.
- `orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "asc" }]`,
  `take: 24` (stoksuzlar elendikten sonra 4 kart kalsın diye geniş havuz).
- Sonuç: `products.flatMap(productToCatalogEntries).filter(e => !e.outOfStock)`.
- **Çeşitlilik:** aynı ürünün 4 rengi bütün bölümü kaplamasın. Önce her üründen 1
  giriş al (ilk tur), 4'e ulaşılmazsa ikinci turda aynı ürünlerin diğer renklerini
  ekle (round-robin). Toplam `RELATED_LIMIT = 4`.
- **Yedek (fallback):** 4'ten az kart çıkarsa, aynı cinsiyette **kardeş
  kategorilerden** (aynı `parentId`) tamamla. Yine de azsa olduğu kadar göster;
  asla karşı cinsiyetten tamamlama.
- Dönüş tipi `CatalogEntry[]` olsun (katalog ile aynı tip).

### 2. Ürün sayfasında kartı katalog gibi besle (`product-page.tsx`)

- `getRelatedProducts(product)` çağrısı yeni imzayla (product zaten `category` ve
  `gender` içeriyor).
- `ProductCard`'a katalog grid'inin geçtiği alanların tamamını geç: `colorLabel`,
  `colors`, `secondImage`, `outOfStock`, `lowStockCount`, `isNew`, `quickAddVariants`,
  `greyBackdrop`, `image ?? "/gorsel-yakinda.svg"`. Fiyat için mevcut
  `resolveProductDisplayPrice(automaticCampaigns, …)` korunur (entry'de `categoryId`,
  `brandId`, `gender`, `priceCents`, `compareAtCents` var — fonksiyonun beklediği
  alanları kontrol et).
- `key`: `${productId}-${colorLabel ?? "tek"}` (catalog-grid'deki `cardKey` ile aynı).
- Kart linki renkli girişlerde `?renk=<etiket>` ile açılmalı — ProductCard bunu
  `colorLabel`'dan zaten üretiyorsa ek iş yok; doğrula.

### 3. (Opsiyonel — kullanıcı onayına bağlı) Bu ürünün diğer renkleri

Kullanıcı "ürünün diğer renkleri" derken açık olan ürünün kendi diğer renklerini de
kastediyor olabilir. Onaylanırsa: bölümün başına, açık ürünün **şu an seçili olmayan**
renk girişlerini (stoklu olanlar) koy, kalan yeri benzer ürünlerle doldur. Onay
gelmeden uygulanmaz.

## Kapsam dışı

- Elle "benzer ürün" eşleştirme (admin paneli) — ayrı iş.
- Kişiselleştirme / görüntülenme geçmişine göre öneri.

## Doğrulama (localhost)

1. Kadın pantolon ürünü (ör. `/urunler/kemerli-denim-görünümlü-pantolon`): bölümde
   yalnızca kadın ürünleri, 4 kart, çok renkli olanlarda swatch satırı.
2. Erkek pantolon ürünü (ör. Martin Fit gabardin): yalnızca erkek ürünleri.
3. Çok renkli bir önerilen ürünün kartına tıkla → ürün sayfası o renk seçili açılmalı.
4. Hover'da ikinci görsele geçiş, "Yeni"/"Son X Adet" rozetleri katalogdakiyle aynı.
5. Aksesuar gibi az ürünlü bir kategoride bölüm boş/az kalıyorsa kardeş kategoriden
   aynı cinsiyetle tamamlandığını gör.
6. `npm run lint` ve `npx tsc --noEmit` temiz.
