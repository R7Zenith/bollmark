# Sepet sayfası: kampanya indirimini soldaki ürün listesinde satır satır da göster

## İstek (kullanıcı, 2026-09-23)

"birde sepet sayfasında kampanyayı sağ toplamda gösteriyor ama sol tarafta tek
tek ürünlerde göstermiyor her soldaki listede de göstersin tek tek ürünlerde"

Yani `/sepet` sayfasında şu an:
- **Sağ taraftaki özet kutusu** (`CouponField` + "İndirim (...)" satırı) kampanya/kupon
  indirimini TOPLAM tutar olarak gösteriyor.
- **Soldaki ürün listesi** (her satırda görsel, isim, renk/beden, birim fiyat, toplam)
  sadece ürünün MANUEL indirimini (`Product.compareAtCents`) üstü çizili gösteriyor
  (`line.compareAtCents` alanı) — otomatik kampanya (kategori bazlı %20 gibi) veya
  kupon indirimi satır bazında hiç yansımıyor.

İstenilen: soldaki her ürün satırında da, o satıra kampanya/kupon indirimi
uygulanmışsa, indirim görünsün (üstü çizili eski fiyat + indirimli fiyat gibi,
mevcut manuel indirim gösterimiyle tutarlı).

## Mevcut kod akışı (araştırıldı, dokunulmadı)

- `src/app/(site)/sepet/page.tsx`: soldaki liste `useCart()`'tan gelen `lines`
  (`CartLine[]`, `src/lib/cart.tsx`) üzerinden basılıyor. Her satırda sadece
  `line.priceCents` ve `line.compareAtCents` (manuel indirim) kullanılıyor.
- Kampanya/kupon indirimi ayrı bir akışta hesaplanıyor: `CouponField`
  (`src/components/coupon-field.tsx`) sepet değiştikçe `/api/kuponlar/dogrula`'ya
  istek atıyor, dönen **TOPLAM** `discountCents` + `appliedName`'i
  `onDiscountChange` ile `sepet/page.tsx`'e veriyor, orada sadece sağ özette
  tek satır olarak gösteriliyor. **Satır bazlı kırılım hiç yok.**
- Sunucu tarafında (`src/lib/coupons.ts`) aslında satır bazlı kırılım zaten
  hesaplanıyor: `computeCouponDiscount()` içindeki `lineDiscounts` ve
  `resolveBestDiscount()` içindeki `bestPerLine` Map'i — ama bu bilgi API
  yanıtında dışarı verilmiyor, sadece toplam `discountCents` dönüyor
  (`src/app/(site)/api/kuponlar/dogrula/route.ts`).

Not: Az önce raporlanan "aynı üründe 2 renk varyantı, kampanya sadece birine
uygulanıyor" hatasının düzeltilmesiyle (bkz. `KAMPANYA_AYNI_URUNDE_COKLU_VARYANT_INDIRIM_HATASI_PLANI.md`)
`CouponLine`'a `variantId` eklenip `lineDiscounts`/`bestPerLine` `variantId` ile
anahtarlanacak. Bu istenen özellik TAM OLARAK o `variantId` bazlı kırılımı
kullanacak — yani bu iki iş birlikte ele alınmalı, aynı alt yapı üzerine kurulmalı
(önce o bug fix'i yapılsın, sonra bu özellik onun üzerine eklensin).

## Önerilen tasarım

1. `resolveBestDiscount()` (`lib/coupons.ts`), toplam `discountCents`'e ek
   olarak satır bazlı kırılımı da dönsün: `lineDiscounts: { variantId: string; discountCents: number }[]`
   (bundle indiriminde de benzer bir satır bazlı pattern varsa — `lib/bundles.ts`/
   `resolveBundleDiscount` — mümkünse aynı şekli kullan, tutarlı olsun).
2. `/api/kuponlar/dogrula/route.ts` yanıtına bu `lineDiscounts` dizisini ekle.
3. `coupon-field.tsx`'teki `CouponResult` tipine `lineDiscounts` alanını ekle,
   `checkDiscount()` içinde API yanıtından bu alanı da `onDiscountChange`'e geçir.
4. `sepet/page.tsx`'te (hem mobil kart hem masaüstü satırı) her `line` için
   `coupon.lineDiscounts`'tan `line.variantId`'ye karşılık gelen indirimi bul,
   varsa:
   - Birim/satır toplam fiyatın üstünü çizili "eski fiyat" olarak göster
     (mevcut `line.compareAtCents` ile aynı görsel dil - `text-sale`,
     `line-through` sınıfları zaten var, aynı desen kullanılabilir).
   - İndirimli net fiyatı normal renkte göster.
   - Kampanya varsa (manuel indirimle çakışmıyorsa, zaten sunucu tarafında
     ikisi asla üst üste binmiyor - bkz. `coupons.ts`daki `manualDiscountBeatsCoupon`
     mantığı) küçük bir rozet/etiket ("Kampanya" veya `coupon.appliedName`)
     eklenmesi de düşünülebilir, opsiyonel.
   - Eğer bir satırda hem `compareAtCents` (manuel indirim) hem kampanya
     indirimi varsa: sunucu mantığına göre bu ikisi asla aynı anda pozitif
     olmaz (biri diğerini geçersiz kılar), o yüzden UI'da çakışma olmamalı -
     ama yine de hangisi varsa onu göstermek yeterli.
5. Aynı satır bazlı kırılım muhtemelen `/odeme` (checkout) sayfasında da
   faydalı olur (aynı liste orada da tekrarlanıyor olabilir) - bu isteğin
   kapsamı sepet sayfası ama tutarlılık için Claude Code'a ödeme sayfasını da
   kontrol edip varsa aynı deseni uygulaması söylenebilir.

## Claude Code için hazır prompt

```
BAĞLAM: src/app/(site)/sepet/page.tsx'teki sepet sayfasında, sağdaki özet
kutusu kampanya/kupon indirimini TOPLAM olarak gösteriyor ama soldaki ürün
listesinde (her satırda görsel/isim/fiyat) bu indirim hiç görünmüyor - sadece
manuel indirim (Product.compareAtCents, line.compareAtCents) satır bazında
üstü çizili gösteriliyor. İstenen: kampanya/kupon indirimi de satır bazında
görünsün.

ÖNEMLİ ÖN KOŞUL: Bu değişiklik, az önce ayrıca bildirilen şu bug fix'inin
ÜZERİNE kurulmalı - CouponLine tipine variantId eklenip lib/coupons.ts
içindeki computeCouponDiscount/resolveBestDiscount'un satır eşleştirmesi
productId yerine variantId ile yapılacak (bkz. proje klasöründeki
KAMPANYA_AYNI_URUNDE_COKLU_VARYANT_INDIRIM_HATASI_PLANI.md). O fix'i önce
uygula, SONRA bu özelliği o altyapı üzerine ekle - iki ayrı commit olabilir
ama sıralaması önemli.

YAPILACAKLAR:
1. lib/coupons.ts: resolveBestDiscount()'un döndürdüğü BestDiscountResult
   tipine satır bazlı kırılımı ekle, örn:
   lineDiscounts: { variantId: string; discountCents: number }[]
   (bestPerLine Map'i zaten variantId ile anahtarlanmış olacak - fix'ten
   sonra - bu Map'i doğrudan bu diziye çevirip sonuca ekle.)

2. src/app/(site)/api/kuponlar/dogrula/route.ts: response body'ye
   result.lineDiscounts'u ekle (mevcut discountCents, freeShipping,
   appliedName, message alanlarının yanına).

3. src/components/coupon-field.tsx:
   - CouponResult tipine lineDiscounts: { variantId: string; discountCents: number }[]
     ekle.
   - checkDiscount() içinde onDiscountChange çağrısına data.lineDiscounts ?? []
     ekle.

4. src/app/(site)/sepet/page.tsx:
   - coupon state'inden (coupon?.lineDiscounts) bir Map<string, number>
     (variantId -> discountCents) oluştur.
   - Hem mobil kart hem masaüstü satırı render'ında, her line için bu Map'ten
     line.variantId'ye karşılık gelen indirimi bul.
   - Varsa: satırın toplam fiyatını (line.priceCents * line.quantity) eski
     fiyat olarak üstü çizili göster (line.compareAtCents ile aynı görsel
     dili kullan: text-sale, line-through sınıfları), net (indirimli) fiyatı
     normal renkte göster. compareAtCents alanı doluysa (manuel indirim) onu
     önceliklendir - ikisi sunucu tarafında zaten asla aynı anda pozitif
     olmuyor ama UI'da hangisi varsa onu göster, ikisini toplama.
   - Mevcut tasarım diline (renkler, boşluklar, font boyutları) sadık kal,
     yeni bir bileşen/stil sistemi icat etme.

5. src/app/(site)/odeme/checkout-form.tsx içinde de aynı ürün listesi/fiyat
   gösterimi varsa (kontrol et), tutarlılık için aynı satır bazlı gösterimi
   oraya da ekle. Yoksa bu adımı atla.

6. TEST: Yerel dev sunucuda, kategori bazlı otomatik %20 kampanya aktifken
   sepete kapsam içi bir ürün ekle, soldaki satırda indirimin (üstü çizili
   eski fiyat + net fiyat) doğru göründüğünü, sağdaki toplamla tutarlı
   olduğunu doğrula. Ayrıca manuel indirimli bir ürünle de test edip iki
   gösterim biçiminin çakışmadığını kontrol et. npx tsc --noEmit ve
   npm run build hatasız tamamlanmalı.

7. Bu işten sonra DEPLOY_STATUS.md'ye not düş. Ben onaylayana kadar push
   etme, sadece yerel commit at.
```
