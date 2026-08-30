# Bollmark - Varyant Yönetimi V2 Planı (Profesyonelleştirme)

Bu dosya, tamamlanan ilk varyant yönetimi fazının (bkz. `VARYANT_YONETIMI_PLANI.md`)
ardından, giyim firması ihtiyaçlarına göre ortaya çıkan eksiklikleri kapatmak için
çıkarılmıştır. Kararlar kullanıcıyla (mağaza sahibi) birlikte netleştirildi.
Claude Code'a okutulup adım adım uygulanacaktır. Henüz kod değişikliği yapılmadı.

## Kapsam (4 madde, hepsi bu fazda yapılacak)

1. Varyant tablosunun dar/scrollbar sorunu (responsive düzeltme)
2. Beden/Renk artık serbest metin değil, önceden tanımlı "Varyant Özellikleri"
   havuzundan kutucukla seçilecek
3. Her varyanta barkod alanı eklenecek (SKU'dan ayrı)
4. Varyant görseli artık sadece URL değil, bilgisayardan doğrudan yüklenebilecek
   (Vercel Blob ile)

## Araştırma özeti

Ticimax / Akıllı Ticaret tarzı Türkiye pazarı sistemlerinde "Varyant Özellikleri"
mağaza genelinde bir kere tanımlanır (örn. Beden özelliği → S/M/L/XL değerleri,
Renk özelliği → Siyah/Beyaz/Lacivert değerleri, renk için hex kodu opsiyonel).
Ürün düzenlerken bu havuzdan çoklu seçim yapılır, seçilen kombinasyonlar (örn.
3 beden x 4 renk) otomatik varyant satırlarına dönüşür. Shopify da aynı "option +
values → otomatik kombinasyon üretimi" mantığını kullanıyor; barkod SKU'dan ayrı,
kendi alanı olarak tutuluyor; varyant görseli dosya olarak yükleniyor, URL yapıştırma
değil. Bollmark zaten Vercel'de barındığı için dosya yükleme için ek servis
gerekmeden Vercel Blob (@vercel/blob) kullanılabilir.

## Kararlar (kullanıcıdan alındı)

- Kapsamın tamamı bu fazda yapılacak (parçalı değil).
- Renk özelliği için hex renk kodu da eklenecek (admin panelinde küçük bir renk
  yuvarlağı gösterimi için).
- Barkod alanı opsiyonel (her varyantta olmak zorunda değil, boş bırakılabilir).

## 1) Veritabanı şeması değişiklikleri (Prisma migration gerekli)

Yeni iki model - mağaza genelinde tek sefer tanımlanan özellik havuzu:

```prisma
// Beden, Renk gibi varyant özellik tipleri (magaza genelinde tanimli)
model VariantAttribute {
  id        String                  @id @default(cuid())
  name      String                  @unique // "Beden", "Renk"
  position  Int                     @default(0)
  values    VariantAttributeValue[]
  createdAt DateTime                @default(now())
}

// Bir ozelligin alabilecegi degerler (S, M, L / Siyah, Beyaz ...)
model VariantAttributeValue {
  id           String            @id @default(cuid())
  attributeId  String
  attribute    VariantAttribute  @relation(fields: [attributeId], references: [id], onDelete: Cascade)
  value        String            // "M", "Siyah"
  hexColor     String?           // sadece Renk gibi ozellikler icin opsiyonel, ornek "#111111"
  position     Int               @default(0)
  variantLinks ProductVariantOption[]

  @@unique([attributeId, value])
}
```

`ProductVariant`'ın `size`/`color` alanları kaldırılıp yerine çoka-çok bir ara
tablo (`ProductVariantOption`) geçer — bu, ileride "Beden/Renk" dışında üçüncü
bir özellik (örn. "Kalıp") eklenmek istenirse şema değişikliği gerektirmeden
çalışır (Shopify'ın genel çözümüyle aynı yaklaşım):

```prisma
model ProductVariantOption {
  id        String                  @id @default(cuid())
  variantId String
  variant   ProductVariant          @relation(fields: [variantId], references: [id], onDelete: Cascade)
  valueId   String
  value     VariantAttributeValue   @relation(fields: [valueId], references: [id])

  @@unique([variantId, valueId])
}

model ProductVariant {
  id             String   @id @default(cuid())
  sku            String   @unique
  barcode        String?  // opsiyonel, SKU'dan ayri, kasa/etiket icin
  stock          Int      @default(0)
  priceCents     Int?
  compareAtCents Int?
  imageUrl       String?
  options        ProductVariantOption[]
  productId      String
  product        Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  orderItems     OrderItem[]
}
```

Not: eski `@@unique([productId, size, color])` kalkar; tekillik artık aynı
ürün + aynı `options` kombinasyonu üzerinden uygulama katmanında (server action
validasyonunda) kontrol edilir.

### Veri taşıma (migration script)

Mevcut varyantlardaki serbest metin `size`/`color` değerleri kaybolmamalı:

1. Tüm `ProductVariant` satırları taranır, distinct `size` değerleri
   "Beden" attribute'una, distinct `color` değerleri "Renk" attribute'una
   `VariantAttributeValue` olarak eklenir (varsa hex kodu boş bırakılır,
   kullanıcı sonradan admin panelinden girer).
2. Her varyant için ilgili `VariantAttributeValue` kayıtlarına
   `ProductVariantOption` satırları oluşturulur.
3. Script tek seferlik çalıştırılıp (`npm run` script veya `scripts/` altına
   geçici bir dosya) sonuçlar DEPLOY_STATUS.md'ye kaydedilir.

## 2) Admin - "Varyant Özellikleri" tanım ekranı

Yeni sayfa: `/admin/ayarlar/varyant-ozellikleri` (mevcut Ayarlar bölümünün
yanına, `sidebar.tsx`'e link eklenir).

- Özellik listesi (Beden, Renk, ...) + "Özellik Ekle" formu.
- Her özelliğin altında değer listesi (S, M, L, ... / Siyah, Beyaz, ...),
  sürükle-bırak veya yukarı/aşağı ok ile sıralama (`position`).
- Renk özelliğinin değerlerinde ek bir hex renk input'u (`<input type="color">`
  + metin fallback) — küçük bir renk yuvarlağı önizlemesi ile.
- Değer silme: o değeri kullanan varyant varsa uyarı gösterilir (silme
  engellenmez ama onay istenir - `window.confirm` mevcut desenle tutarlı).

## 3) Admin - Ürün düzenleme sayfası: yeni VariantEditor akışı

`variant-editor.tsx` yeniden tasarlanır:

- Üstte, tanımlı her özellik için bir "kutucukla çoklu seçim" (checkbox grubu
  veya chip/tag seçici) gösterilir: "Beden: [ ]S [x]M [x]L [ ]XL",
  "Renk: [x]Siyah [x]Beyaz". Renk seçeneklerinde küçük renk yuvarlağı.
- "Varyantları Oluştur" butonuna basınca, seçilen değerlerin kartezyen
  kombinasyonu (Shopify mantığı: 2 beden x 2 renk = 4 satır) otomatik olarak
  tabloya satır ekler; zaten var olan kombinasyonlar tekrar eklenmez, mevcut
  stok/fiyat/barkod verileri korunur.
- Tablo sütunları: Beden · Renk (artık salt-okunur etiket, seçim yukarıdan
  yapılıyor) · SKU · **Barkod** · Stok · Fiyat · İndirim Fiyatı · Görsel ·
  Sil.
- Serileştirme (`serializeVariantRows`) artık `optionValueIds: string[]` ve
  `barcode` alanlarını da taşır.

### Tablo responsive düzeltmesi (scrollbar sorunu)

- `data-table.tsx`'teki `overflow-x-auto` + `min-w-max` yapısı varyant
  editöründe yeniden ele alınır: az kullanılan/uzun alanlar (İndirim Fiyatı,
  Görsel) geniş ekranda göründüğü gibi kalır, dar ekranda (`lg` altı) her satır
  bir kart görünümüne döner (etiket: değer şeklinde alt alta) — böylece yatay
  kaydırmaya gerek kalmaz.
- Alternatif/daha basit seçenek (kullanıcıyla teyit edilecek): sadece admin
  panelin içerik alanı genişliği artırılır (sidebar daraltılabilir hale
  gelir) ve sütun genişlikleri sıkılaştırılır - Claude Code uygulama sırasında
  hangisinin daha iyi göründüğüne karar verip gösterecek.

## 4) Görsel yükleme - Vercel Blob entegrasyonu

- `@vercel/blob` paketi eklenir, Vercel projesinde Blob store oluşturulup
  `BLOB_READ_WRITE_TOKEN` env değişkeni Vercel'e ve yerel `.env`'e eklenir
  (DEPLOY_STATUS.md'deki env yönetim deseniyle tutarlı - hem ev hem dükkan
  PC'sinde senkron olmalı).
- Varyant satırındaki "Görsel URL" text input'u, "Görsel Yükle" dosya seçici +
  küçük önizleme thumbnail ile değiştirilir (URL alanı, ileri kullanıcılar
  için opsiyonel olarak yine de bırakılabilir).
- Sunucu tarafı: server action veya `/api/admin/upload` route, gelen dosyayı
  Vercel Blob'a yükler, dönen URL `imageUrl` alanına yazılır. Dosya
  tipi/boyutu kontrolü (örn. sadece jpg/png/webp, max ~5MB) eklenir.
- Aynı bileşen ürün genel görselleri (`ProductImage`) için de kullanılabilir
  hale getirilebilir - bu fazda zorunlu değil, ama bileşen öyle tasarlanır ki
  ileride oraya da bağlanabilsin.

## 5) Uygulama fazları (Claude Code ile yapılacak sıra)

1. **Faz A - Şema:** `VariantAttribute` / `VariantAttributeValue` /
   `ProductVariantOption` eklenir, `ProductVariant.barcode` eklenir,
   `size`/`color` kaldırılır, migration + veri taşıma scripti çalıştırılır
   (`npm run db:push` + script).
2. **Faz B - Varyant Özellikleri admin sayfası:** CRUD ekranı, hex renk
   picker.
3. **Faz C - Görsel yükleme:** Vercel Blob entegrasyonu, upload endpoint,
   `VariantEditor`'da dosya seçici.
4. **Faz D - VariantEditor yeniden tasarım:** kutucukla çoklu seçim +
   otomatik kombinasyon üretimi + barkod sütunu + responsive tablo düzeni.
5. **Faz E - Sipariş/sepet akışı kontrolü:** `effectivePrice` mantığı
   `optionValueIds` ile çalışmaya devam ediyor mu doğrulanır (schema
   değişikliği fiyat okuma akışını bozmamalı, ama regresyon testi şart).
6. **Faz F - Test:** yerelde `npm run dev` ile özellik ekleme, varyant
   kombinasyon üretimi, barkod girme, dosya yükleme, toplu indirim/stok ve
   gerçek bir sipariş senaryosu uçtan uca doğrulanır.

Her faz kendi içinde test edilip commit'lenir (önce yerelde `npm run dev` ile
kontrol, sonra push -> Vercel otomatik deploy). Detaylı kayıt her fazın
ardından `DEPLOY_STATUS.md`'ye eklenir (mevcut proje deseniyle tutarlı).

## 6) Kapsam dışı (bu fazda yapılmayacak, not olarak duruyor)

- Site tarafında (müşteri) varyant seçince fiyat/görsel dinamik güncellenmesi.
- Ürün listesinde fiyat aralığı gösterimi.
- Pazaryeri (Trendyol/Hepsiburada) entegrasyonu / SKU şablonu senkronizasyonu.

## 7) Plan durumu

**Kararlar netleşti, plan uygulamaya hazır.** Bir sonraki adım: bu dosyanın
Claude Code'a okutulup Faz A'dan başlanarak uygulanması.
