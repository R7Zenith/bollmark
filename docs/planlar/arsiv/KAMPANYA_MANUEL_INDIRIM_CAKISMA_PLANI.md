# Kampanya İndirimi ile Ürün Bazlı Manuel İndirimin Çakışmaması — Araştırma ve Claude Code Promptu

## Sorunun tanımı

Bollmark'ta iki ayrı indirim mekanizması var, ikisi de bugün birbirinden habersiz çalışıyor:

1. **Ürün bazlı manuel indirim** — admin, ürün detay ekranından `Product.compareAtCents` (ve gerekirse `ProductVariant.compareAtCents`) alanını `priceCents`'ten yüksek girerek "eski fiyat üstü çizili, yeni fiyat" gösterimini elle oluşturuyor.
2. **Kampanya (otomatik/kodsuz)** — `Coupon` modelinde kod alanı boş, kategori/marka bazlı yüzde veya sabit tutar indirimi tanımlanıyor (`KAMPANYA_OTOMATIK_PLANI.md`'de tasarlanan `resolveBestDiscount` / `getApplicableAutomaticDiscountForProduct`).

Bugünkü tasarımda kampanya, ürünün kategori/markasına bakarak indirimi doğrudan `priceCents` üzerinden hesaplıyor — yani bir ürün zaten manuel indirimliyse (compareAtCents > priceCents) ve aynı zamanda kategorisi bir kampanyaya giriyorsa, kampanya indirimi bu ZATEN indirimli fiyatın üstüne bir daha uygulanma riski taşıyor (indirim üstüne indirim / iki ayrı "eski fiyat" gösterme karmaşası).

## Önerilen çözüm

### 1) Ortak bir "liste fiyatı" tanımı üzerinden karşılaştırma

Kampanya hesaplamasının tabanı `priceCents` değil, ürünün **liste fiyatı** olmalı: `esasFiyat = compareAtCents ?? priceCents`. Yani ürün zaten manuel indirimliyse, kampanya yüzdesi manuel indirim öncesi (üstü çizili) fiyat üzerinden hesaplanır — böylece kampanya, manuel indirimin üstüne binmiş olmaz, onunla aynı taban üzerinden yarışır.

Sonra iki aday satış fiyatı çıkar:
- **Manuel fiyat** = `priceCents` (zaten mevcut, admin'in elle girdiği).
- **Kampanya fiyatı** = `esasFiyat` üzerinden kampanya kuralı uygulanmış hâli (örn. %20 ise `esasFiyat * 0.8`).

İkisinden **düşük olan** (müşteriye daha faydalı olan) nihai satış fiyatı olarak seçilir; hangisi seçildiyse sadece onun rozeti/"eski fiyat" gösterimi ekranda görünür. İki indirim asla üst üste toplanmaz — sadece biri "kazanır". Eşitlik durumunda manuel indirimi öne al (admin'in o ürüne özel bilinçli kararı olduğu için) — istersen bunu tam tersine de çevirebiliriz, öncelik senin tercihin.

### 2) Kampanya oluşturma ekranına kapsam anahtarı

İkinci ihtiyacın — "ben gerçekten kampanyanın manuel indirimli üründe de geçerli olmasını istiyorsam" — bir **hariç tutma/dahil etme anahtarı** olarak çözülüyor, indirimlerin üst üste binmesi olarak değil:

- Yeni alan: `Coupon.includeManuallyDiscountedProducts` (Boolean, varsayılan `false`).
- **Varsayılan (kapalı):** Kampanya, `compareAtCents > priceCents` olan (yani zaten elle indirimli) ürünleri hesaba hiç katmaz — bu ürünlerde kampanya rozeti/işlemi görünmez, mevcut manuel indirim olduğu gibi kalır. Bu, "bilerek indirimli bıraktığım bir ürünü kampanya mantığı karıştırmasın" güvenli varsayılan.
- **Açıkken:** Kampanya bu ürünleri de değerlendirmeye alır, yukarıdaki (1) numaralı "en avantajlı fiyat kazanır" karşılaştırması devreye girer.

Kampanya oluşturma/düzenleme formunda, kategori/marka seçiminin yanına bir checkbox: **"Elle indirim yapılmış ürünlerde de bu kampanya geçerli olsun"** — açıklama metni: "Kapalıyken bu kampanya, üzerinde zaten indirim yaptığınız ürünlere dokunmaz. Açarsanız, ürünün mevcut indirimiyle bu kampanya karşılaştırılır ve müşteriye hangisi daha avantajlıysa o gösterilir (indirimler üst üste eklenmez)."

### 3) Neden bu iki katmanlı tasarım doğru

- Senin de belirttiğin genel kural ("normalde binmemeli, faydalı olan öne çıksın") her durumda geçerli olan varsayılan mantık.
- Checkbox, bunun ÜSTÜNE bir kapsam/eleme filtresi: bazı ürünlerde kampanyanın o ürüne hiç dokunmasını istemezsin (örn. zaten en düşük kâr marjıyla sattığın bir ürün), bazılarında da "olsun, hangisi iyiyse o görünsün" dersin. İkisi de aynı anda tutarlı çalışır.

## Claude Code Promptu

```
Bollmark e-ticaret admin panelinde, kampanya (otomatik/kodsuz Coupon) indirimi ile ürün
detayından elle girilen indirimin (Product.compareAtCents > priceCents) çakışmamasını
sağlayacağız. Şu an kampanya hesaplaması priceCents üzerinden çalışıyor ve zaten manuel
indirimli bir ürünün üstüne bir daha indirim uygulama riski var. Bunu düzelt:

### 1. Veri modeli
- prisma/schema.prisma → Coupon modeline `includeManuallyDiscountedProducts Boolean
  @default(false)` ekle. Yorum: "false iken bu kampanya, Product.compareAtCents >
  priceCents olan (zaten elle indirimli) ürünlere dokunmaz."
- Migration oluştur (npx prisma migrate dev), mevcut kayıtlar false ile dolsun (varsayılan
  zaten böyle çalışıyor, veri kaybı yok).

### 2. İndirim hesaplama (src/lib/coupons.ts)
`getApplicableAutomaticDiscountForProduct` (ve varsa sepet/checkout tarafında ürün bazlı
kampanya uygulayan diğer yardımcı fonksiyonlar) şu mantığa göre güncellensin:

1. `esasFiyat = product.compareAtCents ?? product.priceCents` (varyant bazında
   değerlendiriliyorsa aynı mantık variant.compareAtCents ?? variant.priceCents ??
   product alanları için de geçerli olsun — mevcut fallback zincirini koru).
2. Ürünün zaten manuel indirimli olup olmadığını `product.compareAtCents != null &&
   product.compareAtCents > product.priceCents` ile tespit et.
3. Eğer ürün manuel indirimliyse VE eşleşen kampanyanın `includeManuallyDiscountedProducts`
   alanı false ise: bu kampanyayı o ürün için tamamen ele, mevcut priceCents/compareAtCents
   aynen kullanılsın (kampanya rozeti/hesaplaması gösterilmesin).
4. Aksi halde (ürün manuel indirimli değil, ya da kampanya `includeManuallyDiscountedProducts:
   true`): kampanya indirimini `esasFiyat` üzerinden hesapla → `kampanyaFiyati`. Bunu mevcut
   `priceCents` (manuel fiyat) ile karşılaştır, DAHA DÜŞÜK olanı nihai satış fiyatı olarak
   döndür; hangisi seçildiyse dönüş tipinde onu belirten bir alan olsun (örn. `kaynak:
   "MANUEL" | "KAMPANYA"`), eşitlikte "MANUEL" kazansın.
5. Fonksiyonun dönüş tipini, ürün kartı/detay sayfasının "eski fiyat / yeni fiyat / rozet"
   gösterimini tek bir yerden besleyecek şekilde tasarla (örn. `{ finalPriceCents,
   originalPriceCents, badgeLabel, source }`) — hem product-card.tsx hem ürün detay sayfası
   hem sepet/checkout aynı fonksiyonu çağırsın, mantık iki yerde tekrarlanmasın.

Sepet/checkout tarafında zaten var olan `resolveBestDiscount` (kupon kodu vs otomatik
kampanya karşılaştırması) bu yeni ürün-bazlı fiyatın ÜSTÜNE, sepet toplamı seviyesinde
çalışmaya devam etsin — yani sıralama: önce her ürün satırı için (manuel indirim vs kampanya)
en avantajlı BİRİM fiyat belirlenir, sonra kupon kodu varsa o sepet toplamına ayrıca
uygulanıp uygulanmayacağına ("hangisi daha avantajlı") mevcut mantıkla karar verilir.

### 3. Admin formu (kampanya oluşturma/düzenleme)
`src/app/(admin)/admin/kampanyalar/page.tsx` ve `src/components/admin/coupon-row.tsx`:
kategori/marka seçiminin yakınına bir checkbox ekle:
"Elle indirim yapılmış ürünlerde de bu kampanya geçerli olsun"
Altına küçük açıklama metni: "Kapalıyken bu kampanya, üzerinde zaten indirim yaptığınız
ürünlere dokunmaz. Açarsanız, ürünün mevcut indirimiyle bu kampanya karşılaştırılır ve
müşteriye hangisi daha avantajlıysa o gösterilir." Form okuma/yazma (readCouponFields,
createCoupon/updateCoupon server action'ları) bu yeni boolean'ı FormData'dan okuyup
kaydetsin (checkbox işaretli değilse false).

### 4. Ürün kartı / ürün detay / sepet gösterimi
`src/components/product-card.tsx`, ürün detay sayfası ve sepet/checkout satırlarında,
fiyat gösterimini yeni ortak fonksiyondan gelen `{ finalPriceCents, originalPriceCents,
badgeLabel, source }` ile besle — kazanan kim olursa olsun (manuel indirim ya da kampanya)
tek bir "eski fiyat üstü çizili + yeni fiyat + rozet" bloğu render edilsin, iki ayrı
rozet/çizgili fiyat asla aynı anda gösterilmesin.

### 5. Audit log
Kampanya kaydı güncellenirken `includeManuallyDiscountedProducts` değiştiyse bunu mevcut
audit log pattern'ine (lib/audit-actions.ts) uygun şekilde detay metnine ekle (yeni bir
action tipi şart değil, mevcut kampanya güncelleme action'ının detail alanına not düşülebilir).

### Genel
Mevcut admin tasarım sistemini (Card, Badge, mevcut inputClass/labelClass) kullan, Türkçe
değişken/route isimlendirme convention'ını koru. Migration'ı çalıştır, `npm run build`
doğrula, sonra commit/push et. Deploy sonrası DEPLOY_STATUS.md'ye not düş.
```
