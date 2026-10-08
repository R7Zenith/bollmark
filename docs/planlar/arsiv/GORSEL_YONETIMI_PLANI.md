# Görsel Yönetimi Yenileme Planı

Bu dosya, Claude Code'a bu proje üzerinde uygulanmak üzere hazırlanmış bir
uygulama talimatıdır. Mevcut plan dosyalarıyla aynı üslupta yazılmıştır
(bkz. `VARYANT_OZELLIKLERI_V2_PLANI.md`, `ADMIN_PANEL_PLAN.md`). Fazlar
sırasıyla uygulanmalı, her fazın sonunda `npx tsc --noEmit` + `npm run build`
hatasız geçmeli ve mümkün olduğunda gerçek DB'ye karşı uçtan uca test
yapılıp (geçici test verisi temizlenerek) sonuç bu dosyaya/DEPLOY_STATUS.md'ye
not düşülmeli.

## 1. Sorunlar (mevcut durum)

1. **Varyant görseli - URL girilemiyor**: Varyant Özellikleri V2 Faz C'de
   `variant-image-cell.tsx` baştan yazılırken, önceki serbest URL metin
   alanı tamamen kaldırıldı (`variant-editor.tsx` eski hali plana göre bu
   alanı "zorunlu tutulmadığı" gerekçesiyle silmişti). Şu an sadece
   bilgisayardan dosya yükleme var, kullanıcı hazır bir görsel URL'i
   yapıştıramıyor.
2. **Ürün genel görselleri de sadece URL**: `urunler/yeni` ve
   `urunler/[id]` sayfalarındaki "Görseller" kartı hâlâ eski usul, düz bir
   `<textarea>` (her satıra bir URL). PC'den yükleme seçeneği hiç yok.
3. **Mimari uyumsuzluk - görsel varyant bazında, olması gereken renk
   bazında**: Şu an her varyant satırı (Beden × Renk kombinasyonu) kendi
   `imageUrl` alanına sahip (`ProductVariant.imageUrl`, tekil). Giyimde
   asıl ihtiyaç, bir ürünün her **rengi** için (bedenden bağımsız) bir
   fotoğraf **seti** olmasıdır - örn. bir tişörtün Kırmızı, Sarı, Mavi
   renkleri için ayrı ayrı ve her biri için birden fazla fotoğraf.
   Varyant bazlı tekil görsel modeli hem gereksiz tekrar (M-Kırmızı ve
   L-Kırmızı için aynı fotoğrafı iki kez girmek) hem de "çoklu görsel"
   ihtiyacını karşılamıyor.

## 2. Hedef Mimari

### 2.1 Prisma şeması (`prisma/schema.prisma`)

- `VariantAttribute` modeline `isColor Boolean @default(false)` ekle.
  Hangi özelliğin "renk ekseni" olduğunu koda gömülü `"Renk"` string
  eşleşmesi yerine açıkça işaretlemek için (bkz. `src/lib/variant-attributes.ts`
  ve site tarafında `optionValue(v, "Renk")` kullanımları - onlar da
  ilerleyen bir fazda `isColor` alanına göre çalışacak şekilde
  güncellenebilir, ama zorunlu değil, geriye dönük uyumlu kalabilir).
- Yeni model ekle:

  ```prisma
  model ProductOptionImage {
    id        String                 @id @default(cuid())
    productId String
    product   Product                @relation(fields: [productId], references: [id], onDelete: Cascade)
    valueId   String                 // VariantAttributeValue.id (renk değeri, örn. "Kırmızı")
    value     VariantAttributeValue  @relation(fields: [valueId], references: [id], onDelete: Cascade)
    url       String
    position  Int                    @default(0)
    createdAt DateTime               @default(now())

    @@index([productId, valueId])
  }
  ```

  `Product` modeline `optionImages ProductOptionImage[]`,
  `VariantAttributeValue` modeline `optionImages ProductOptionImage[]`
  relation alanlarını ekle.

- `ProductVariant.imageUrl` alanını **kaldır**. Migration'da önce mevcut
  `imageUrl` dolu olan varyantları oku, varyantın rengi varsa (color
  attribute'a bağlı bir option'ı varsa) o değeri/ürünü kullanarak
  `ProductOptionImage` satırına taşı (aynı renk için birden fazla farklı
  `imageUrl` varsa hepsini ayrı satır olarak ekle, `position` sırasıyla),
  rengi olmayan varyantlarda görseli kaybetmemek için ürünün genel
  `images` listesine ekle. Taşıma tamamlandıktan sonra kolonu düşür. Bu
  migration'ı hem yerel hem prod DB'de dikkatli çalıştır (önce yerelde,
  sonucu raporla, sonra prod'da - tıpkı önceki fazlarda yapıldığı gibi).

### 2.2 Bileşenler

- **`src/components/admin/image-field.tsx` (yeni, ortak bileşen)**: Tek
  bir görsel için hem URL yapıştırma hem PC'den yükleme sunan küçük
  bileşen. Küçük önizleme + "Değiştir"/"Kaldır" + bir URL metin girişi
  (blur/enter'da `onChange` tetikler) + mevcut yükleme butonu bir arada.
  `variant-image-cell.tsx`'in yerini alır (veya onun içine URL alanı geri
  eklenir - ama ileride varyant görseli kalkacağı için doğrudan yeni ortak
  bileşeni yazmak daha temiz).
- **`src/components/admin/multi-image-field.tsx` (yeni)**: Birden çok
  görselden oluşan bir liste yönetir (`{ url: string }[]`): her satırda
  `ImageField`, yukarı/aşağı sıralama, silme, "Görsel Ekle" butonu (yeni
  boş satır açar, kullanıcı ister URL yapıştırır ister dosya yükler).
  İki yerde kullanılacak:
  1. Ürün genel görselleri ("Görseller" kartı) - state'i `\n` ile
     birleştirip mevcut gizli `images` input'una yazar (server tarafı
     `updateProduct`/`createProduct` içindeki `.split("\n")` mantığı
     **değişmeden** kalır).
  2. Renk bazlı galeri (aşağıda).
- **`variant-editor.tsx` güncellemesi**:
  - Tablodan **"Görsel" sütunu kaldırılır** (`VariantImageCell`
    kullanımı silinir), `VariantRow`/`SerializedVariant` tiplerinden
    `imageUrl` çıkarılır.
  - `AttributeOption` tipine `isColor: boolean` eklenir.
  - Yeni state: `colorImages: Record<valueId, { url: string }[]>`,
    başlangıç değeri `initialColorImages` prop'undan gelir.
  - Seçili satırlardan (rows) benzersiz renk `valueId`'leri türetilir
    (`isColor` olan attribute'un değerleri arasından, sadece o an
    tabloda kullanılanlar). "Varyant Oluştur" kutusunun altına, her aktif
    renk için başlık + `MultiImageField` içeren bir "Renk Görselleri"
    bölümü eklenir (renk yoksa bölüm hiç gösterilmez, tek bir bilgi notu
    çıkar: "Görsel eklemek için önce bir Renk özelliği tanımlayın").
  - Yeni gizli input: `colorImagesJson`, `JSON.stringify` ile
    `{ valueId: string; urls: string[] }[]` gönderir.

### 2.3 Sayfa/server action değişiklikleri

- `urunler/yeni/page.tsx` ve `urunler/[id]/page.tsx`:
  - `variantAttribute` sorgusuna `isColor` alanını dahil et.
  - "Görseller" kartındaki `<textarea name="images">` yerine
    `MultiImageField` kullan (hidden input adı `images` olarak kalsın,
    böylece server action'da değişiklik gerekmez).
  - `VariantEditor`'a `initialColorImages` prop'u geç (edit sayfasında
    `product.optionImages`'ı `valueId`'ye göre gruplayıp `position`'a göre
    sıralayarak; yeni ürün sayfasında boş obje).
  - `parseVariantsJson`'dan `imageUrl` alanını kaldır.
  - Yeni bir `parseColorImagesJson(raw)` yardımcı fonksiyonu ekle, form'dan
    gelen `colorImagesJson`'ı `{ valueId, urls }[]`'e çevirsin (boş/URL
    olmayan girişleri filtrelesin).
  - `createProduct`/`updateProduct` transaction'larında:
    - `ProductVariant.create` çağrılarından `imageUrl:` satırını kaldır.
    - Ürün oluşturulduktan/güncellendikten sonra (edit'te önce
      `tx.productOptionImage.deleteMany({ where: { productId } })`),
      `colorImages` listesindeki her `{ valueId, urls }` için
      `tx.productOptionImage.createMany({ data: urls.map((url, i) => ({
      productId, valueId, url, position: i })) })`.

### 2.4 Vitrin (storefront) tarafı

- `src/lib/catalog.ts`: `getProductBySlug` sorgusuna
  `optionImages: { include: { value: true }, orderBy: { position: "asc" } }`
  ekle.
- `src/app/(site)/urunler/[slug]/page.tsx` + `add-to-cart.tsx`: Şu an renk
  seçimi `AddToCart` (client) içinde tutuluyor, galeri ise server'da sabit
  render ediliyor - ikisini senkronlamak için yeni bir client bileşen
  gerekiyor (örn. `product-viewer.tsx`), rengi ortak state olarak tutup
  hem görsel galerisini hem beden/renk seçim + sepete ekle kısmını
  içersin. Seçili rengin `ProductOptionImage`'ı varsa galeri onu gösterir,
  yoksa ürünün genel `images`'ına düşer (fallback). Bu adım UI/UX açısından
  en riskli kısım - küçük ekranda da test edilmeli.

## 3. Uygulama Fazları (önerilen sıra)

- **Faz 1 - Şema**: `isColor` alanı + `ProductOptionImage` modeli +
  migration (mevcut `imageUrl` verisini taşıyıp kolonu düşürme). Yerelde
  `npx prisma migrate dev` ile doğrula, mevcut test ürünlerinde veri kaybı
  olmadığını kontrol et.
- **Faz 2 - Ortak görsel bileşenleri**: `image-field.tsx` (URL + upload)
  ve `multi-image-field.tsx`. Bağımsız, DB'siz test edilebilir (Storybook
  yoksa geçici bir sayfada/`npm run dev` ile elle).
- **Faz 3 - Ürün genel görselleri**: "Görseller" kartını
  `MultiImageField`'a geçir, server action değişmeden (`images` alanı
  aynı format). Uçtan uca test: hem URL yapıştırarak hem dosya yükleyerek
  görsel eklenip ürün kaydedildiğinde `ProductImage` tablosuna doğru
  yazıldığını doğrula.
- **Faz 4 - Renk bazlı varyant galerisi**: `variant-editor.tsx`'ten
  `imageUrl` sütununu kaldır, `colorImages` state + `colorImagesJson` +
  sayfa/server action değişiklikleri. Uçtan uca test: 2-3 renkli bir
  üründe her renge birden fazla görsel ekle (biri URL, biri upload),
  kaydet, DB'den geri oku, `ProductOptionImage` satırlarının doğru
  `valueId`/`position` ile geldiğini doğrula.
- **Faz 5 - Vitrin senkronizasyonu**: `product-viewer.tsx` ile renk
  seçimine göre galeri değişimi + fallback. Gerçek bir ürün üzerinde
  tarayıcıdan (veya `curl` ile HTML çıktısından) renk değiştirince doğru
  görsellerin geldiğini doğrula.
- **Faz 6 - Test/temizlik**: Tüm akışı tek seferde uçtan uca doğrulayan
  kabul testi (önceki fazların V2 planındaki Faz F'ye benzer şekilde),
  geçici test verisinin temizlenmesi, `DEPLOY_STATUS.md`'ye özet not.

## 4. Riskler / Dikkat Edilecekler

- Migration geri dönüşsüz (`imageUrl` kolonu düşecek) - prod DB'de
  çalıştırmadan önce mevcut varyant görsellerinin taşındığından emin ol,
  mümkünse önce yedek/rapor al.
- `isColor` alanı eklenince mevcut "Renk" adlı attribute'u otomatik
  `isColor: true` yapacak bir veri düzeltme adımı da migration'a dahil
  edilmeli (yoksa mevcut ürünlerde renk galerisi bölümü hiç görünmez).
- Bir üründe "Renk" özelliği tanımlı değilse (örn. sadece Beden kullanan
  ürünler) renk galerisi bölümü gizlenmeli, ürün genel görselleri tek
  kaynak olmaya devam etmeli - bu durumu Faz 4/5 testlerinde ayrıca
  doğrula.
- `@vercel/blob` üzerinden yüklenen görseller kalıcı - bir görsel
  kaldırılıp değiştirildiğinde eski Blob dosyasının silinip
  silinmeyeceğine karar ver (şu an `variant-image-cell.tsx`'te de bu
  yapılmıyor, kapsam dışı bırakılabilir ama not düşülsün).
