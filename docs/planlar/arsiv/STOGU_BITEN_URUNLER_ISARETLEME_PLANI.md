# Stoğu Biten Ürünleri Kartlarda İşaretleme — Araştırma ve Plan

## Sorun

Ana sayfada ("Öne Çıkanlar") ve ürünler/kategori listeleme sayfalarında, stoğu
tamamen bitmiş ürünler diğerleriyle aynı şekilde gösteriliyor — kullanıcı
tıklayıp ürün sayfasına gidene kadar stokta olmadığını anlamıyor.

## Kod incelemesi

- Stok, `ProductVariant.stock` alanında varyant (beden/renk kombinasyonu)
  bazında tutuluyor (`prisma/schema.prisma`), üründe genel bir stok alanı yok.
  Yani "ürün stokta yok" = o ürüne ait **tüm varyantların stock'u 0 veya altı**.
- Kartların kullandığı ortak bileşen `src/components/product-card.tsx`
  (`ProductCard`) — hem ana sayfa (`src/app/(site)/page.tsx`) hem de ürünler/
  kategori sayfası (`src/app/(site)/urunler/page.tsx`) bunu kullanıyor.
- Veri tarafında iki farklı fonksiyon var (`src/lib/catalog.ts`):
  - `getPublishedProducts()` — ana sayfa bunu kullanıyor, şu an `variants`
    hiç `include` edilmiyor, yani stok bilgisi ana sayfaya hiç gelmiyor.
  - `getCatalogEntries()` — ürünler sayfası bunu kullanıyor, `variants` zaten
    `include` ediliyor (renk gruplama için), stok bilgisini oradan çıkarmak
    kolay.
  - Çok renkli ürünlerde her renk ayrı kart olarak listeleniyor
    (`colorLabel` dolu) — bu yüzden "stokta yok" durumunu ürün bazında değil,
    **o karttaki renge ait varyantlar** bazında hesaplamak gerekiyor (örn.
    kırmızısı bitmiş ama mavisi duran bir ürünün sadece kırmızı kartı soluklaşmalı).

## Önerilen çözüm

1. `lib/catalog.ts` içine bir yardımcı fonksiyon eklensin:
   `isOutOfStock(variants: { stock: number }[]): boolean` →
   `variants.length > 0 && variants.every(v => v.stock <= 0)`.
2. `getPublishedProducts()`'ın `include`'ına `variants: { select: { stock: true } }`
   eklensin (ana sayfaya stok bilgisi gelsin).
3. `getCatalogEntries()`'de zaten elde olan `p.variants` kullanılarak, hem
   tek-renkli/varyantsız ürün girişi için hem de renk bazlı her giriş için
   (o renge ait `options` içeren varyantlar filtrelenerek) `outOfStock` alanı
   hesaplanıp `CatalogEntry` tipine eklensin.
4. `ProductCardData` tipine (`product-card.tsx`) `outOfStock?: boolean`
   eklensin; `true` ise kartın görsel alanının üzerine soluk/buzlu bir cam
   katmanı (`backdrop-blur` + yarı saydam beyaz/paper zemin) ve ortasında
   küçük bir "Stokta Yok" rozeti bindirilsin. Kart yine tıklanabilir kalsın
   (ürün sayfasına gitmeye devam etsin) — sitede zaten "tekrar stokta"
   bildirim aboneliği (`stok-bildirimi` API'si) var, kullanıcı ürün
   sayfasından bunu kullanabilsin.
5. Hem `src/app/(site)/page.tsx` hem `src/app/(site)/urunler/page.tsx` bu yeni
   `outOfStock` alanını `ProductCard`'a `product` prop'unda geçsin.

Bu şekilde davranış her iki listeleme yerinde de tutarlı olur (yalnızca ana
sayfaya özel yapmak, aynı bileşeni kullanan ürünler sayfasında tutarsızlık
yaratırdı).

## Claude Code'a verilecek prompt

```
Bollmark sitesinde stoğu tamamen bitmiş ürünler, ana sayfadaki "Öne Çıkanlar"
ve /urunler kategori listelemesinde diğer ürünlerle aynı şekilde, normal
görünüyor. Bu ürünlerin kartlarını görsel olarak işaretleyeceğiz.

Stok `ProductVariant.stock` alanında varyant bazında tutuluyor (üründe genel
bir stok alanı yok) — bir ürün/renk "stokta yok" sayılır ancak VE ANCAK ona
ait tüm varyantların stock'u 0 veya altındaysa.

### 1. src/lib/catalog.ts

- Dosyanın başına (veya uygun bir yere) küçük bir yardımcı fonksiyon ekle:

```ts
export function isOutOfStock(variants: { stock: number }[]): boolean {
  return variants.length > 0 && variants.every((v) => v.stock <= 0);
}
```

- `getPublishedProducts()`'ın Prisma sorgusundaki `include` bloğuna
  `variants: { select: { stock: true } }` ekle (şu an hiç variants
  çekilmiyor, ana sayfa stok bilgisine hiç sahip değil).

- `CatalogEntry` tipine `outOfStock: boolean;` alanı ekle.

- `getCatalogEntries()` içinde, `colorLabelByValueId.size <= 1` dalında
  (tek renkli/varyantsız ürün) entry push edilirken `outOfStock:
  isOutOfStock(p.variants)` ekle.

- Aynı fonksiyonun renk bazlı döngüsünde (`for (const [valueId, label] of
  colorLabelByValueId)`), her renk için SADECE o renge ait varyantları
  filtrele (`p.variants.filter(v => v.options.some(o => o.valueId ===
  valueId))`) ve `outOfStock: isOutOfStock(bufilteredVariants)` ile entry'ye
  ekle — böylece bir ürünün sadece stoğu biten rengi soluklaşsın, diğer
  renkleri etkilenmesin.

### 2. src/components/product-card.tsx

- `ProductCardData` tipine `outOfStock?: boolean;` ekle (yorum: "Doluysa bu
  ürünün/rengin tüm varyantlarının stoğu bitmiş, kart soluk bir cam katmanıyla
  işaretlenir").
- Görselin bulunduğu `relative aspect-[3/4] overflow-hidden bg-line` div'inin
  içine, `<Image>`'dan sonra (kalp butonundan ÖNCE, kalp/favori butonu her
  zaman üstte tıklanabilir kalsın) şunu ekle:

```tsx
{product.outOfStock && (
  <div className="absolute inset-0 flex items-center justify-center bg-paper/60 backdrop-blur-[2px]">
    <span className="border border-ink/20 bg-paper/85 px-3 py-1 text-xs uppercase tracking-wide text-ink/70">
      Stokta Yok
    </span>
  </div>
)}
```

- Kart yine bir `<Link>` içinde kalacak, yani tıklanınca ürün sayfasına
  gitmeye devam etsin (üründe "tekrar stokta haber ver" aboneliği zaten var,
  kullanıcı orada bunu görebilsin) — burada `pointer-events-none` KULLANMA,
  tıklamayı engelleme.

### 3. src/app/(site)/page.tsx

`ProductCard`'a geçilen `product` objesine `outOfStock: isOutOfStock(p.variants)`
ekle (yukarıda eklenen `isOutOfStock`'u `@/lib/catalog`'dan import et).

### 4. src/app/(site)/urunler/page.tsx

`ProductCard`'a geçilen `product` objesine `outOfStock: entry.outOfStock`
ekle (catalog.ts zaten hesaplayıp entry'ye koyuyor).

### Doğrulama

- `npm run lint` hatasız geçmeli.
- Admin panelinden bir ürünün TÜM varyantlarının stoğunu 0 yap, ana sayfada
  ve /urunler'de kartının üzerinde soluk cam + "Stokta Yok" rozetinin
  göründüğünü, karta tıklayınca yine ürün sayfasına gidebildiğini doğrula.
- Çok renkli bir üründe sadece bir rengin stoğunu 0 yap, /urunler sayfasında
  SADECE o renk kartının soluklaştığını, diğer renklerin normal göründüğünü
  doğrula.
- Stoğu olan normal bir ürünün kartının hiç etkilenmediğini doğrula.

Bitince kısa bir özet ve öncesi/sonrası ekran görüntüsü paylaş. Push etme,
onayımı bekle. İşin sonunda DEPLOY_STATUS.md'ye not düşmeyi unutma.
```

## Sonraki oturumda kontrol edilecek / kapsam dışı bırakılanlar

- Ürün detay sayfası (`urunler/[slug]` + `product-viewer.tsx`) bu planın
  kapsamında değil — orada zaten seçili varyantın stok durumu ayrıca ele
  alınabilir (varsa mevcut davranışı görmek için `product-viewer.tsx`
  incelenmeli). İstenirse ayrı bir plan olarak ele alınabilir.
- "Stokta Yok" rozetinin metni/tasarımı (renk, konum, büyüklük) tercihe göre
  kolayca değiştirilebilir — istenirse önce bir ekran görüntüsüyle onay
  alınabilir.
