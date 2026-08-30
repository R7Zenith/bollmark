# Bollmark - Ürün Varyantı Yönetimi Yenileme Planı (taslak)

Bu dosya, admin panelindeki ürün detay sayfasında varyant (beden/renk) yönetimini
elden geçirmek için çıkarılan plandır. Netleşince bu dosya Claude Code'a okutulup
adım adım uygulanacak (`ADMIN_PANEL_PLAN.md` ile aynı çalışma şekli). Henüz kod
değişikliği yapılmadı.

## Mevcut durumun sorunu

Şu an `src/app/(admin)/admin/urunler/[id]/page.tsx` içinde varyantlar tek bir
metin kutusuna "Beden,Renk,SKU,Stok" formatında satır satır CSV olarak
yazılıyor (`urunler/yeni/page.tsx`'te de aynı desen var). Bunun sonuçları:

- Varyant eklemek/silmek/düzenlemek elle metin düzenlemek demek, satır
  ekleme/silme butonu yok.
- Varyantın kendi fiyatı veya indirimi yok - tüm varyantlar `Product.priceCents`
  / `Product.compareAtCents` alanlarını paylaşıyor (schema.prisma).
- Varyanta özel görsel yok.
- Toplu işlem (birden fazla varyanta aynı anda zam/indirim/stok uygulama) yok.

## Araştırma özeti (Shopify + İdeasoft admin panelleri)

**Shopify:** Varyantlar bir tabloda listeleniyor; satıra tıklayınca açılan
detay sayfasında fiyat, indirim öncesi fiyat (compare-at), SKU, stok, görsel
ayrı ayrı düzenlenebiliyor. Ürün sayfasından checkbox ile çoklu seçim yapılıp
"Bulk edit" ile birden fazla varyantın fiyatı/stoğu/görseli tek seferde
değiştirilebiliyor (tablo/spreadsheet görünümlü ayrı bir toplu düzenleme aracı).

**İdeasoft (Türkiye pazarında yaygın e-ticaret altyapısı):** Her varyant kendi
fiyatını, stoğunu, görselini ve barkodunu ayrı ayrı taşıyor; ana ürünün fiyatı
değişse bile varyant fiyatları otomatik güncellenmiyor (bilinçli tasarım -
varyant fiyatı bağımsız). Varyant listesinde sütun bazlı inline düzenleme var;
birden fazla ürüne toplu zam/indirim için ayrı bir "Çoklu Ürün Güncelleme" aracı
sunuluyor.

**Ortak desen:** Gerçek bir tablo UI'ı (metin kutusu değil), satır ekle/sil
butonları, her satırda inline düzenlenebilir alanlar (fiyat/indirim/stok/görsel
ayrı ayrı), checkbox ile çoklu seçim ve toplu aksiyon.

## Karar verilenler (kullanıcıdan alındı)

- **Varyant fiyatı: opsiyonel override.** Varyantın fiyat alanı boş bırakılırsa
  ürünün genel fiyatı (`Product.priceCents`) kullanılır; doldurulursa o varyant
  için geçerli olur. İndirim öncesi fiyat da aynı mantıkla opsiyonel override
  (boşsa ürünün `compareAtCents`'i, o da yoksa indirim gösterilmez).
- **Varyant görseli eklenecek.** Her varyant satırına opsiyonel bir görsel URL
  alanı eklenir (örn. kırmızı renk için kırmızı ürün fotoğrafı).
- **Toplu işlem bu fazda yapılacak.** Varyant tablosunda checkbox ile çoklu
  seçim + seçilenlere zam/indirim/stok güncelleme aksiyonu bu fazın kapsamında.

## 1) Veritabanı şeması değişiklikleri (Prisma migration gerekli)

`ProductVariant` modeline eklenecek alanlar (`prisma/schema.prisma`):

```prisma
model ProductVariant {
  id             String   @id @default(cuid())
  size           String
  color          String
  sku            String   @unique
  stock          Int      @default(0)
  priceCents     Int?     // opsiyonel - bos ise Product.priceCents kullanilir
  compareAtCents Int?     // opsiyonel - bos ise Product.compareAtCents kullanilir
  imageUrl       String?  // opsiyonel varyant gorseli
  productId      String
  product        Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  orderItems     OrderItem[]

  @@unique([productId, size, color])
}
```

Efektif fiyat/indirim için ortak bir yardımcı fonksiyon eklenir (örn.
`src/lib/variant.ts`):

```ts
export function effectivePrice(product: { priceCents: number }, variant?: { priceCents: number | null }) {
  return variant?.priceCents ?? product.priceCents;
}
export function effectiveCompareAt(product: { compareAtCents: number | null }, variant?: { compareAtCents: number | null }) {
  return variant?.compareAtCents ?? product.compareAtCents ?? null;
}
```

**Kritik nokta:** Sepete ekleme (`src/lib/cart.tsx`, `src/components/add-to-cart.tsx`)
ve sipariş oluşturma (`src/app/(site)/api/orders/route.ts`) şu an muhtemelen
sadece `Product.priceCents` okuyor. Bu akışlar `effectivePrice` kullanacak
şekilde güncellenmezse, varyant fiyatı sadece admin panelinde görünür ama
müşteri siparişe hâlâ eski/genel fiyattan öder - **bu yüzden Faz D (aşağıda)
atlanmamalı.**

## 2) Admin ürün detay sayfası - Varyant tablosu (yeni bileşen)

Yeni bir client bileşeni: `src/components/admin/variant-editor.tsx` ("use client").
Mevcut `data-table.tsx`/`Badge`/`BulkActionBar` bileşenleriyle aynı tasarım
sistemini kullanır.

- **Sütunlar:** [checkbox] · Beden · Renk · SKU · Stok · Fiyat (TL, opsiyonel,
  placeholder "Varsayılan: {ürün fiyatı} TL") · İndirim Fiyatı (TL, opsiyonel)
  · Görsel URL (opsiyonel) · [Sil ikonu]
- **"+ Varyant Ekle" butonu** altta, tıklanınca tabloya boş bir satır ekler
  (React state - `useState<VariantRow[]>`).
- Her satırın sonunda çöp kutusu ikonu ile satır silinir (state'ten çıkarılır).
- Form gönderilirken state, gizli bir `<input type="hidden" name="variantsJson">`
  alanına `JSON.stringify` edilerek server action'a taşınır - şu anki CSV satır
  formatı (`"Beden,Renk,SKU,Stok"`) tamamen kaldırılır.
- Checkbox ile seçilen satırlar, mevcut `BulkActionBar` bileşeni tetiklenerek
  üstte "3 seçili: [%İndirim Uygula] [Stok Ekle/Çıkar] [Sil]" şeklinde bir çubuk
  gösterir; yüzde/miktar girişi küçük bir inline input/modal ile alınır ve
  seçili satırların ilgili alanlarını client tarafında günceller (kaydetmek
  için yine "Kaydet" ile forma gönderilir - ayrı bir API çağrısı şart değil,
  tek form submit yeterli).
- `urunler/yeni/page.tsx` (yeni ürün ekleme) de aynı bileşeni kullanacak şekilde
  güncellenir (şu an orada da aynı CSV textarea deseni var).

## 3) Server action / API değişiklikleri

- `updateProduct` server action (`urunler/[id]/page.tsx`): `variantsJson` alanını
  parse edip doğrular (sayısal alanlar, negatif olmayan stok, `size`+`color`
  kombinasyonunun tekil olması - schema'daki `@@unique` zaten bunu DB seviyesinde
  garanti ediyor ama kullanıcıya anlamlı hata mesajı için önceden kontrol iyi olur).
  Parse/validasyon hatasında mevcut desene uyularak `?hata=` query param'ı ile
  geri dönülür.
- Aynı validasyon `urunler/yeni/page.tsx`'teki create action'a da eklenir.
- Sepete ekleme ve sipariş oluşturma akışları (yukarıdaki "Kritik nokta")
  `effectivePrice`/`effectiveCompareAt` kullanacak şekilde güncellenir.
- Toplu güncelleme: mevcut `src/app/api/admin/urunler/bulk/route.ts` deseni
  örnek alınarak (veya aynı dosyaya eklenerek) varyant id listesi + değişiklik
  gövdesi (`{ priceCents?, compareAtCents?, stockDelta? }`) kabul eden bir
  server action/endpoint eklenir.

## 4) Site tarafına (müşteri) etkisi - bu fazda kapsam dışı ama not düşülüyor

- Ürün listesi/kartlarında fiyat aralığı gösterimi (ör. "150 TL - 220 TL"
  varyantlar arasında fark varsa) - **ileride**, bu fazda zorunlu değil.
- Ürün detay sayfasında (`urunler/[slug]/page.tsx`) renk/beden seçilince
  fiyatın ve görselin dinamik güncellenmesi - **ileride**. Bu fazın önceliği:
  admin panelinde doğru veri girişi + sipariş tutarının doğru hesaplanması
  (Faz D). Site tarafı dinamik fiyat gösterimi ayrı bir iş olarak planlanabilir.

## 5) Uygulama fazları (Claude Code ile yapılacak sıra)

1. **Faz A - Şema:** `ProductVariant`'a `priceCents`/`compareAtCents`/`imageUrl`
   eklenir, migration (`npm run db:push`) çalıştırılır, `effectivePrice`/
   `effectiveCompareAt` yardımcıları eklenir.
2. **Faz B - Admin UI:** `VariantEditor` bileşeni yazılır; ürün düzenle ve yeni
   ürün ekleme sayfalarındaki CSV textarea kaldırılıp bu bileşenle değiştirilir.
3. **Faz C - Toplu işlem:** Checkbox seçimi + `BulkActionBar` entegrasyonu +
   toplu güncelleme (fiyat/indirim/stok) server action'ı.
4. **Faz D - Sipariş akışı düzeltmesi (kritik):** Sepet ve sipariş oluşturma
   varyant fiyatını doğru okuyacak şekilde güncellenir; bu olmadan varyant
   fiyatlandırması müşteri tarafında hiç yansımaz.
5. **Faz E - Test:** Yerelde `npm run dev` ile: varyant ekleme/silme/düzenleme,
   boş fiyat alanının ürün fiyatına düşmesi, toplu indirim uygulama, ve en
   önemlisi - varyant fiyatı farklı bir üründen sipariş oluşturulduğunda doğru
   tutarın hesaplandığı doğrulanır.

Her faz kendi içinde test edilip commit'lenir (önce yerelde `npm run dev` ile
kontrol, sonra push -> Vercel otomatik deploy).

## 6) Açık noktalar / ileride (kapsam dışı, not olarak duruyor)

- Site tarafında varyant seçince fiyat/görsel dinamik güncellenmesi.
- Ürün listesinde fiyat aralığı gösterimi.
- Barkod alanı (İdeasoft'ta var, Bollmark'ta şu an planlanmıyor - istenirse
  ayrı bir iş olarak eklenir).

## 7) Plan durumu

**Kararlar netleşti, plan uygulamaya hazır.** Bir sonraki adım: bu dosyanın
Claude Code'a okutulup Faz A'dan başlanarak uygulanması.
