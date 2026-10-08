# Kampanya: Aynı ürünün 2 farklı renk varyantı sepette olunca indirim sadece birine uygulanıyor

## Bildirilen sorun (kullanıcı, 2026-09-23)

"kampanya ekledim ayakkabılarda %20 indirim diye, sitede de 2 ayakkabı ekli yani
tek model ama 2 farklı renk, iki rengide sepete ekliyorum ama sadece 1 tanesine
kampanya uygular gibi indirim yapıyor halbuki ikisinede uygulaması lazım"

Yani: tek `Product` kaydı (tek model), 2 farklı `ProductVariant` (renk).
Sepete her iki renk de ayrı satır olarak ekleniyor. Kampanya toplam indirimi,
her iki satırın da tam indirimini yansıtmıyor — sanki sadece bir satır indirim
almış gibi.

## Kod incelemesiyle doğrulanan kök neden

`src/lib/coupons.ts` → `resolveBestDiscount()` içinde, otomatik (kodsuz)
kampanyaların sepet satırı bazında en avantajlısını seçme mantığı **satırları
`productId` ile anahtarlıyor**:

```ts
const bestPerLine = new Map<string, { coupon: ...; discountCents: number }>();
...
for (const { productId, discountCents: lineShareCents } of lineDiscounts) {
  const current = bestPerLine.get(productId);
  if (!current || lineShareCents > current.discountCents) {
    bestPerLine.set(productId, { coupon, discountCents: lineShareCents });
  }
}
```

`computeCouponDiscount()` sepetteki her satır (`CouponLine`) için ayrı bir
`lineDiscounts` girdisi üretiyor, ama `CouponLine` tipinde **sadece
`productId` var, `variantId` yok** (bkz. `coupons.ts` satır 8-20). Aynı ürünün
(aynı `productId`) iki farklı varyantı (iki renk) sepette iki ayrı satır olarak
bulunduğunda, `lineDiscounts` dizisinde bu iki satır için de `productId` aynı
olduğundan, `bestPerLine` Map'i bunları **tek bir anahtara çöktürüyor** ve
sadece indirimi daha yüksek olan satırı tutuyor — diğer satırın indirimi
tamamen kayboluyor.

Bu döngü hem `/api/kuponlar/dogrula` (sepet/ödeme sayfasındaki anlık önizleme)
hem de `src/app/(site)/api/orders/route.ts` (siparişin gerçek/bağlayıcı
hesaplaması) tarafından çağrılan `resolveBestDiscount()` içinde olduğu için,
sorun sadece görsel değil — **gerçek sipariş tutarında da** aynı şekilde eksik
indirim uygulanıyor.

Aynı zafiyet `computeCouponDiscount()`'un FIXED (sabit tutar) dalındaki
`lineDiscounts` üretiminde de var (satır bazlı pay dağıtımı yine `productId`
kullanıyor), ama oradaki toplam `discountCents` zaten satır bazlı değil tüm
`matchingLines` toplamından hesaplandığı için (FIXED dalı `discountCents`'i
`bestPerLine`'a değil doğrudan `matchingLines` toplamına dayandırıyor) o kısım
etkilenmiyor — sorun özellikle PERCENT tipi otomatik kampanyaların
`resolveBestDiscount` içindeki satır-bazlı "en iyi kampanya" seçiminde.

Özetle: **"ayakkabılarda %20"** gibi kategori/marka/cinsiyet bazlı, kodsuz,
PERCENT tipi bir otomatik kampanya, sepette **aynı ürünün birden fazla satırı**
(farklı renk/beden varyantı) olduğunda sadece bir satıra uygulanıyor.

## Önerilen çözüm

`CouponLine` tipine sepetteki satırı **benzersiz** tanımlayan bir alan eklenmeli
(örn. `variantId`, ya da `productId + variantId` birleşimi) ve `computeCouponDiscount`
ile `resolveBestDiscount` içindeki tüm `Map`/gruplama anahtarları `productId`
yerine bu benzersiz satır kimliğini kullanmalı. Böylece aynı ürünün farklı
varyantları ayrı satırlar olarak doğru şekilde değerlendirilir, her biri kendi
indirimini alır.

Kapsamlı test: sepete aynı ürünün 2 farklı renk varyantını ekleyip kategori
bazlı otomatik %20 kampanyanın ikisine de tam uygulandığını hem
`/api/kuponlar/dogrula` önizlemesinde hem de gerçek sipariş oluşturmada
(`orders/route.ts`) doğrulamak gerekiyor. Ayrıca aynı ürünün aynı varyantının
sepette tek satırda quantity>1 olarak durduğu normal senaryonun (regresyon)
bozulmadığından emin olunmalı.

## Claude Code için hazır prompt

```
BAĞLAM: src/lib/coupons.ts içindeki resolveBestDiscount() fonksiyonunda bir
bug var. Otomatik (kodsuz) kampanyaların sepet satırı bazında en avantajlısını
seçtiği `bestPerLine` Map'i, CouponLine'ın sadece `productId` alanını anahtar
olarak kullanıyor. CouponLine'da varyant/satır kimliği yok. Sonuç: sepette AYNI
ürünün (aynı productId) birden fazla satırı varsa (örn. aynı model, 2 farklı
renk varyantı iki ayrı sepet satırı olarak eklenmiş), bestPerLine bu satırları
tek anahtara çöktürüyor ve sadece indirimi yüksek olan satırı tutuyor — diğer
satır hiç indirim almıyor. Bu hem /api/kuponlar/dogrula (anlık önizleme) hem de
src/app/(site)/api/orders/route.ts (gerçek sipariş tutarı) için resolveBestDiscount
çağrısında geçerli, yani gerçek siparişlerde de eksik indirim uygulanıyor.

YAPILACAKLAR:
1. src/lib/coupons.ts içinde CouponLine tipine sepet satırını benzersiz
   tanımlayan bir alan ekle (örn. `variantId: string`). Bu alanı dolduran her
   iki çağrı sitesini de güncelle:
   - src/app/(site)/api/kuponlar/dogrula/route.ts (lines.push(...) kısmı)
   - src/app/(site)/api/orders/route.ts (resolvedLines.push(...) kısmı, zaten
     variantId'yi tutuyor - CouponLine'a geçirilirken eklenmesi yeterli)
2. computeCouponDiscount() içindeki lineDiscounts üretimini (hem PERCENT hem
   FIXED dalı) productId yerine bu yeni benzersiz satır kimliğiyle döndür.
3. resolveBestDiscount() içindeki bestPerLine Map'ini ve bestByCoupon
   toplamasını da aynı benzersiz satır kimliğiyle anahtarla (productId değil).
4. Nihai adımda (sipariş satırlarını oluştururken / indirim toplamını
   raporlarken) hâlâ productId'ye ihtiyaç varsa, Map değerine productId'yi de
   ekleyerek koru - sadece anahtar değişsin, mevcut productId tabanlı diğer
   kullanımlar (örn. UI'da hangi ürüne rozet gösterilecek) bozulmasın.
5. Regresyon: aynı ürünün AYNI varyantının sepette tek satırda quantity>1
   olarak durduğu normal senaryo (en yaygın durum) davranışı değişmemeli -
   indirim yine miktarla orantılı doğru hesaplanmalı.
6. TEST: Yerel dev sunucuda, kategori bazlı (örn. "Ayakkabı") kodsuz %20
   PERCENT otomatik kampanya varken, aynı model bir ürünün 2 farklı renk
   varyantını sepete ekleyip:
   - /api/kuponlar/dogrula önizlemesinde toplam indirimin HER İKİ satırı da
     kapsadığını (her iki satırın priceCents * quantity * %20 toplamı kadar)
     doğrula.
   - Gerçek sipariş oluşturma akışında (orders/route.ts, mock/test ortamında)
     aynı doğrulamayı yap.
   - npx tsc --noEmit ve npm run build hatasız tamamlanmalı.
7. Bu işten sonra DEPLOY_STATUS.md'ye her zamanki gibi not düş. Ben onaylayana
   kadar push etme, sadece yerel commit at.
```

## Not

Bu oturumda (Claude/Cowork tarafında) koda dokunulmadı, sadece kaynak
dosyalar (coupons.ts, use-automatic-discount.ts, cart-lines.ts,
kuponlar/dogrula/route.ts, orders/route.ts) okunup kök neden doğrulandı.
Uygulama Claude Code ile yapılacak.
