# Yeni Gelenler (ve Çok Satanlar) kartlarında ikinci renk görünmüyor — plan

## Sorun

Ana sayfadaki "Yeni Gelenler" bölümünde (ekran görüntüsündeki FESKA erkek spor
ayakkabı örneği gibi) ürünün gerçekte 2 rengi olsa bile kartta sadece tek bir
görsel/renk gösteriliyor, renk seçme noktaları (swatch) hiç çıkmıyor.

## Kök neden

Sitede iki farklı ürün listeleme yolu var:

- **`/urunler` katalog sayfası** → `getCatalogEntries()` (`src/lib/catalog.ts`)
  kullanıyor. Bu fonksiyon çok renkli bir ürünü renk sayısı kadar ayrı
  `CatalogEntry`'e böler, HER girişe o ürünün **tüm renklerini** (`colors`
  dizisi: isim + hex + görsel) de ekler. `ProductCard` bileşeni
  (`src/components/product-card.tsx`, satır 279-300) bu `colors` dizisi
  1'den fazlaysa kartın altına küçük renk noktaları (swatch) çiziyor; bir
  noktaya tıklanınca kart görseli o renge geçiyor.

- **Ana sayfadaki "Yeni Gelenler" ve "Çok Satanlar" bölümleri** ise
  `getPublishedProducts()` + `toProductCardData()` (`src/lib/home-products.ts`,
  satır 10-22) kullanıyor. `toProductCardData` şu alanları dolduruyor:
  `productId, slug, name, priceCents, compareAtCents, image, priceResolution,
  outOfStock, quickAddVariants`.

  **`colors` alanı hiç set edilmiyor.** `ProductCardData.colors` boş
  kaldığı için `ProductCard` içindeki `colors.length > 1` koşulu hep `false`
  oluyor ve swatch satırı hiç render edilmiyor — kart sadece `firstImageUrl(p)`
  ile gelen tek (ilk) rengin fotoğrafını gösteriyor.

Yani bu bir görsel eksikliği değil, veri eksikliği: `ProductCard` bileşeni
renkleri göstermeye zaten hazır (katalog sayfasında çalışıyor), ama ana
sayfa kartına renk bilgisi hiç gönderilmiyor.

## Önerilen çözüm

`toProductCardData`'ya, `getCatalogEntries()` içindeki renk toplama mantığının
aynısını (varyantlardan `isColor:true` olan özelliğin değerlerini toplayıp,
hex'i olanları `colors` dizisine çevirme — bkz. `catalog.ts` satır 174-192)
uygulayıp sonucu `colors` alanına yazmak. Böylece:

- Ana sayfa hâlâ ürün başına **tek kart** gösterir (Yeni Gelenler'in kompakt
  slider yapısı bozulmaz, "Çok Satanlar"ın ürün bazlı satış sıralaması da
  etkilenmez — katalog sayfasındaki gibi renk başına ayrı kart/giriş
  YARATILMAZ).
- Ama kartın altında katalog sayfasındakiyle aynı renk noktaları çıkar,
  kullanıcı sayfadan çıkmadan diğer rengi önizleyebilir — ekran
  görüntüsündeki sorun (ikinci rengin hiç görünmemesi) çözülür.

Alternatif (daha kapsamlı) seçenek: Yeni Gelenler'i de katalog gibi renk
başına ayrı kart gösterecek şekilde `getCatalogEntries` tabanlı bir listeye
geçirmek. Bu, aynı üründen iki kart çıkmasına (ör. carousel'de 8 yerine daha
az farklı ürün görünmesine) yol açar; "Çok Satanlar" tarafında da satış
sayısı ürün bazlı tutulduğu için ek bir eşleme gerekir. Bu yüzden ilk seçenek
(swatch ekleme) daha az riskli ve mevcut tasarımla tutarlı.

## Claude Code için prompt

```
src/lib/home-products.ts içindeki toProductCardData fonksiyonunu incele.
Şu an ProductCardData.colors alanını hiç doldurmuyor, bu yüzden ana
sayfadaki "Yeni Gelenler" ve "Çok Satanlar" kartlarında çok renkli
ürünlerin diğer renkleri (swatch noktaları) hiç görünmüyor — sadece ilk
rengin fotoğrafı gösteriliyor.

src/lib/catalog.ts içindeki getCatalogEntries fonksiyonunda (satır ~174-192)
aynı sorun için zaten çalışan bir renk toplama mantığı var: ürünün
varyantlarından isColor:true olan özelliğin değerlerini topluyor, hex kodu
olanları colors dizisine ({name, hex, imageUrl}) çeviriyor.

Bunu toProductCardData'nın da kullanabileceği ortak bir yardımcı fonksiyona
çıkar (ör. catalog.ts içinde export edilen bir buildColorSwatches(product)
fonksiyonu), getCatalogEntries onu kullansın, toProductCardData da
product.colors alanını bu fonksiyonla doldursun.

Not: Ana sayfada ürün başına tek kart kalmaya devam etmeli (katalog
sayfasındaki gibi renk başına ayrı kart YARATMA) — sadece colors alanı
dolsun ki ProductCard bileşeni (zaten var olan) swatch noktalarını
gösterebilsin. "Çok Satanlar" sekmesindeki ürün bazlı satış sıralaması
(pickBestsellers, soldByProductId) etkilenmemeli.

Değişiklikten sonra localhost'ta ana sayfada birden fazla rengi olan bir
ürünü kontrol et, swatch noktalarının kartın altında göründüğünü ve
tıklayınca görselin değiştiğini doğrula. DEPLOY_STATUS.md'ye not düş.
```
