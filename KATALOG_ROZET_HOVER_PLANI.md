# Katalog Kartı: Release Teması Uyumu — Rozetler, Fiyat/Başlık, Hover Fotoğraf Değişimi

Kaynak: https://themes.shopify.com/themes/release/presets/release (canlı demo, "Jackets & Coats" kategorisi ve arama sonuçları üzerinde incelendi).
Karşılaştırılan dosyalar: `src/components/product-card.tsx`, `src/lib/catalog.ts`, `src/app/(site)/urunler/page.tsx`, `src/app/globals.css`.

## 1. Release demosunda görülenler

**Başlık/fiyat (Just arrived, Jackets & Coats gridleri):**
- Ürün adı TÜMÜ BÜYÜK HARF, biraz daha kalın (ör. "MOCHAMIST BOUCLÉ BLISS COAT").
- Fiyat hemen altında, TL cinsinden ("4,016.00TL").
- İndirimli üründe: üstü çizili eski fiyat (gri) + yanında turuncu/kırmızımsı yeni fiyat aralığı ("FROM 3,726.00TL - 4,300.00TL").
- Varyant bilgisi ("Available in 1 color and 6 size") gri, küçük punto, fiyatın altında.

**Rozetler (sol üst köşe, yan yana istiflenebiliyor):**
- Kırmızı dolgu + beyaz metin, küçük dikdörtgen/hap: **"15% OFF"** — otomatik indirim yüzdesi.
- Siyah dolgu + beyaz metin, aynı boyut: **"PRE-ORDER"**, **"SOLD OUT"** — stok/satış durumu etiketleri.
- Beyaz dolgu + siyah metin, **kenarlıksız** (ilk bakışta ince kenarlıklı sanılıyor ama değil — sadece açık gri görsel zemine karşı kontrastı öyle görünüyor): **"LAST FEW"** — "son adetler" stok uyarısı.
- Rozetler her zaman görselin **sol üst köşesinde**, birden fazlaysa yatayda yan yana diziliyor (kırmızı/siyah/beyaz karışık olabiliyor, ör. "15% OFF" + "SOLD OUT" aynı kartta).
- Sağ üst köşede ayrı bir "hızlı sepete ekle" (+) ikonu var — favorilere ekleme rozetle karışmıyor.

**Tam ölçülmüş CSS değerleri (canlı demo `release-main.myshopify.com`'dan `getComputedStyle` ile doğrudan okundu — tahmin değil):**

| Öğe | font-size | font-weight | letter-spacing | line-height | text-transform | renk | diğer |
|---|---|---|---|---|---|---|---|
| Ürün başlığı (`.product-card__title`) | 12px | 600 | 0.48px | 15px | uppercase | `#111111` | font: Poppins |
| Fiyat, normal (`.product-card__price`) | 12px | 400 | 0.48px | — | uppercase (kapsayıcıdan miras) | `#111111` | — |
| Fiyat, indirimde eski fiyat (`s`, üstü çizili) | 12px | 400 | 0.48px | — | uppercase | `#111111` (siyah — renk değişmiyor, sadece çizgi) | `text-decoration: line-through` |
| Fiyat, indirimde yeni fiyat (`ins`) | 12px | 400 | 0.48px | — | uppercase | **`rgb(194, 81, 81)`** — kırık/toprak kırmızısı, parlak kırmızı DEĞİL | — |
| Varyant bilgisi ("Available in X size") | 12px | 400 | normal | — | none | `rgba(17,17,17,0.5)` yani **%50 opaklıkta siyah** | — |
| Rozet (hem indirim hem "last few", ortak taban stil) | 10px | 500 | 1.4px | 12.5px | uppercase | — | `border-radius: 4px`, `padding: 6px 8px`, kenarlık YOK |
| İndirim rozeti zemin/metin | — | — | — | — | — | zemin **`rgb(239,45,45)`** (parlak kırmızı), metin beyaz | — |
| "Last few" rozeti zemin/metin | — | — | — | — | — | zemin beyaz, metin `#111111`, kenarlıksız | — |

Not: "indirimli yeni fiyat" ile "indirim rozeti zemin rengi" Release'de FARKLI iki kırmızı tonu (fiyat metni daha soluk/toprak `rgb(194,81,81)`, rozet zemini daha parlak `rgb(239,45,45)`) — birebir aynı renk değiller, bu bilinçli bir kontrast tercihi gibi duruyor.

**Hover davranışı:**
- Kartın üzerine gelince ürünün ikinci bir fotoğrafına yumuşak (soft) bir geçişle (crossfade/opacity) geçiliyor — ani değil, ~300ms transition.
- İkinci fotoğrafı olmayan ürünlerde hover'da hafif bir zoom/scale efekti var.

**Grid:** 4 sütun (masaüstü) — kart arası boşluk ve kenar payı **DÜZELTME (aşağıya bkz. §3.4): önceki notlarda "32px, birebir aynı" denmişti, bu YANLIŞMIŞ — gerçek değer 24px, Bollmark'ta hâlâ 32px kullanılıyor.**

## 2. Bollmark'ta şu an ne var (product-card.tsx / catalog.ts / urunler/page.tsx)

İyi haber: altyapının büyük kısmı **zaten kodda mevcut**, sadece görsel stil ve bir veri eksiği var:

- ✅ Hover'da ikinci fotoğrafa geçiş **zaten kodlanmış** (`secondImage` alanı varsa crossfade, yoksa scale — Release ile birebir aynı mantık). Eksik olan: `CatalogEntry` / `ProductCardData` tipinde `secondImage` alanı **tanımlı değil**, `getCatalogEntries()` bu alanı hiç doldurmuyor ve `urunler/page.tsx` `ProductCard`'a `secondImage` **hiç geçmiyor**. Yani kod hazır ama veri hiçbir zaman gelmediği için bütün kartlarda sadece "hafif büyüme" efekti çalışıyor, ikinci fotoğraf hiçbir yerde görünmüyor.
- ⚠️ İndirim rozeti var ama Release'deki gibi **kırmızı dolgulu, dikkat çekici bir kutu değil** — şu an `bg-clay/10 text-clay` (soluk, çerçevesiz, düşük kontrast) ve metni "%20 İndirim" şeklinde (Release: "20% OFF" tarzı kısa/vurgulu).
- ❌ "LAST FEW / SOLD OUT / PRE-ORDER" tarzı **stok durumu rozeti hiç yok**. Bollmark'ta sadece stok tamamen bitince tüm görselin üstüne bulanık bir "Stokta Yok" katmanı biniyor — küçük köşe rozeti olarak "Son X Adet" gibi bir uyarı yok.
- ➖ Ürün başlığı Bollmark'ta normal harf büyüklüğünde (`text-sm text-ink`, tümü büyük harf değil) — Release'de tamamen büyük harf. **Kullanıcı onayı: büyük harfe çevrilecek.**
- ➖ İndirimli fiyat Bollmark'ta siyah/ink renginde (sadece eski fiyat gri üstü çizili) — Release'de yeni fiyat turuncu/kırmızımsı vurgu renginde. **Kullanıcı onayı: vurgulu renk yapılacak.**
- ➖ Release'de çok varyantlı ürünlerde "X TL - Y TL" fiyat aralığı gösteriliyor — **kullanıcı onayı: eklenmeyecek, tek fiyat gösterimi korunacak.**

## 2.1 Bulunan asıl sorun: indirim rozeti bazı ürünlerde hiç çıkmıyor

Kod incelendiğinde şu ortaya çıktı: Bollmark'ta **iki ayrı indirim mekanizması** var ve rozet sadece birine bağlı:

1. **Otomatik kampanya indirimi** (admin → Kampanyalar, kod girilmeden kategori/marka bazlı otomatik %): `product-card.tsx`'teki kırmızımsı/soluk rozet SADECE bu türden bir indirim varsa (`automaticDiscountPercent`) görünüyor.
2. **Ürünün/varyantın kendi "Karşılaştırma fiyatı" (eski fiyat / compareAtCents)** alanı — admin ürün düzenleme ekranında bu alanın açıklaması bile "**Boş = indirim gösterilmez**" diyor, yani mağaza sahibine indirim göstereceği izlenimi veriyor. Ama `product-card.tsx`'e bakıldığında bu alan sadece üstü çizili eski fiyatı gösteriyor — **rozet bu durumda hiç render edilmiyor**, çünkü rozetin koşulu (`discountPercent`) sadece 1 numaralı otomatik kampanya alanına bakıyor.

Yani: eğer indirim, bir ürüne/varyanta admin panelinden doğrudan "Karşılaştırma fiyatı" girilerek yapıldıysa (kampanya oluşturmadan), müşteri üstü çizili eski fiyatı görür ama köşede hiçbir rozet çıkmaz — bildirdiğiniz sorun büyük ihtimalle bu. Kampanya üzerinden verilen indirimlerde ise rozet zaten çalışıyor.

## 3. Önerilen değişiklikler (öncelik sırasıyla)

1. **Hover'da ikinci fotoğraf** (en yüksek etki, altyapı hazır): `CatalogEntry` tipine `secondImage` eklenip `getCatalogEntries()` içinde rengin/ürünün galerisindeki 2. fotoğraf (`images[1]` ya da `optionImages` içindeki 2. kayıt) bu alana doldurulmalı, `urunler/page.tsx` bunu `ProductCard`'a geçmeli. Kod tarafında `product-card.tsx`'e dokunmaya gerek yok.
2. **İndirim rozetini hem düzeltmek hem belirginleştirmek**: (a) Rozetin koşulu sadece otomatik kampanya indirimine değil, ürünün/varyantın "Karşılaştırma fiyatı" (compareAtCents) alanına da bakmalı — ikisinden hangisi varsa rozet ona göre yüzdeyi hesaplayıp göstermeli (otomatik kampanya varsa o öncelikli, yoksa compareAtCents'ten hesaplanan yüzde kullanılmalı). (b) Görsel olarak da `bg-clay/10 text-clay` yerine dolgulu (solid) arka plan + beyaz metin, köşeleri hafif yuvarlak küçük bir "hap/etiket" kutusu. Marka paletiyle uyumlu olması için ya mevcut `clay` rengini tam doygunlukta (opacity kaldırılmış) kullanmak ya da gerçek bir "indirim kırmızısı" tanımlamak — ikisi de makul, Claude Code'a ikisini de deneyip göstermesini söylemek en sağlıklısı.
3. **Stok durumu rozeti eklemek**: "Son X Adet" (Last few) tarzı beyaz/kenarlıklı bir etiket, düşük stokta (ör. toplam stok ≤ 3) otomatik görünsün. "SOLD OUT" zaten tam ekran overlay ile karşılanıyor, ayrıca köşe rozeti gerekmeyebilir — bu noktada karar kullanıcıya bırakılabilir.
4. Rozetler birden fazla olduğunda (ör. hem indirim hem "son adet") sol üst köşede yan yana dizilecek şekilde (`flex gap-1.5`) düzenlenmeli.
5. **Başlık ve fiyat stilini güncellemek**: Ürün adı tamamen büyük harfe (`uppercase`) çevrilecek; indirimli üründe yeni fiyat da (şu anki siyah/ink yerine) indirim rozetiyle aynı vurgu renginde gösterilecek. Fiyat aralığı ("X TL'den başlayan") eklenmeyecek — tek fiyat gösterimi korunacak.

## 3.1 Bulunan asıl sorun: başlık puntosu neden tutmuyor + fiyatta ₺ işareti

**Başlık puntosu:** `product-card.tsx`'te başlık `<h3 className="text-sm text-ink">` — yani genel amaçlı `text-sm` Tailwind class'ını kullanıyor. Ama `globals.css`'te şu override var:

```css
.storefront .text-sm {
  font-size: 0.9375rem; /* 15px */
  line-height: 1.375rem;
}
```

Bu override, mağazadaki genel gövde metni/etiketlerin okunurluğunu artırmak için bilerek eklenmiş (yorum satırında da öyle yazıyor) — ama ürün başlığı da aynı `text-sm` class'ını paylaştığı için **istemeden** bu büyütülmüş boyuta (15px) çekiliyor. Release'de ise başlık 12px, `font-weight: 600`, `letter-spacing: 0.48px` — yani hem Bollmark'ta 3px daha büyük hem de kalınlık/harf aralığı hiç ayarlanmamış (henüz uygulanmadığı için normal 400 ağırlıkta). Sonuç: iki site yan yana konunca başlık "tutmuyor" gibi görünüyor, çünkü aslında iki farklı şey karışmış — biri kasıtlı global okunurluk artışı, diğeri eksik/gelecek bir değişiklik.

**Çözüm:** Ürün başlığına `text-sm` yerine kendine ait, `.storefront .text-sm` override'ından etkilenmeyecek özel bir boyut vermek gerekiyor (ör. Tailwind'in `text-[12px]` gibi keyfi değer sözdizimi + `tracking-[0.48px] font-semibold uppercase leading-[15px]`) — böylece genel gövde metni okunurluk ayarından bağımsız, Release'deki tam değerlere sabitlenmiş olur.

**Fiyatta ₺ işareti:** `lib/format.ts`'teki `formatPrice()`, `Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" })` kullanıyor — bu, tarayıcının kendi TRY para birimi sembolünü (₺) otomatik ekliyor. Release'de ise sembol yok, sabit metin olarak "TL" ekleniyor. Düzeltme basit: `style: "currency"` yerine düz sayı formatlayıp sonuna elle `" TL"` eklemek (Türkçe biçimde binlik/ondalık ayıraçlar aynı kalabilir, sadece sembol yerine metin).

## 3.2 Bulunan asıl sorun: ürün BAŞLIĞI neden Release'e göre daha koyu/kalın duruyor

(Not: bir önceki incelemede bunu yanlışlıkla fiyat metnine de genelleştirmiştim — kullanıcı sadece ürün başlığından bahsetmişti, aşağıdaki analiz sadece başlığa ait. Fiyat metninde ayrıca fark ettiğim bir font-weight farkı var ama o ayrı bir konu, aşağıda §3.3'te ayrı not olarak duruyor, ana prompt'a dahil edilmedi.)

Şaşırtıcı olan şu: Release'in gerçek başlık ağırlığı (600) Bollmark'ınkinden (şu an hiç ağırlık class'ı yok, yani tarayıcı varsayılanı 400) daha YÜKSEK. Yani salt font-weight rakamına bakılırsa Bollmark'ın daha ince görünmesi beklenir — ama tam tersi oluyor. Sebebi ağırlık değil, **punto (font-size)**:

- Başlık `<h3 className="text-sm text-ink">` genel `text-sm` class'ını kullanıyor, bu da `globals.css`'teki `.storefront .text-sm { font-size: 0.9375rem }` (15px, gövde metni okunurluğu için bilerek eklenmiş genel bir override) tarafından büyütülüyor.
- Release'de başlık 12px. Bollmark'ta 15px — yaklaşık %25 daha büyük.
- Aynı (hatta daha düşük) font-weight'te bile, harf gövdesinin (stroke) mutlak piksel kalınlığı punto büyüdükçe artıyor — göz bunu "daha kalın/koyu" olarak algılıyor. Release küçük (12px) puntoyla bilinçli olarak ince/zarif bir görünüm hedefliyor; Bollmark'taki okunurluk amaçlı genel büyütme, başlık için tam tersi bir izlenim veriyor.

Yani sorun aslında zaten §2 ve §3'te tespit edilen "başlık text-sm'e bağımlı, ondan kendine özel bir sınıfa ayrılması lazım" maddesiyle aynı kök nedene dayanıyor — punto küçülüp Release'in gerçek 12px/600 değerine sabitlenince bu "koyuluk" hissi de düzelecek (600 ağırlık normalde daha koyu olsa da, küçük puntoda mutlak stroke kalınlığı Bollmark'ın şu anki 15px/400'ünden daha ince kalacak).

## 3.4 Bulunan asıl sorun: katalog fotoğrafları arasındaki boşluk ve genişlik

Haklıydınız — ama sebep, daha önceki bir incelemede yanlış ölçülmüş bir sayıymış. `release-main.myshopify.com`'a gerçek masaüstü genişliğinde (1440px viewport) girip `getComputedStyle` ile ölçtüm:

| Viewport | Sütun sayısı | Kenar boşluğu (sayfa kenarı) | Fotoğraflar arası boşluk (gap) | Tek fotoğraf genişliği |
|---|---|---|---|---|
| 1440px (masaüstü) | 4 | 36px | **24px** | 320px |
| 414px (mobil) | 2 | 16px | **16px** | 183px |

Bollmark'ın kodunda (`urunler/page.tsx`): `className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-4"` — yani `gap-8` (Tailwind'de 32px) kullanılıyor, hem masaüstünde hem mobilde. Kenar boşluğu (`px-4 md:px-6 xl:px-9`) masaüstünde (1280px+) 36px'e denk geliyor ve bu Release ile zaten aynı — sorun kenar boşluğunda değil, **sadece fotoğraflar arası boşlukta**.

Yani: masaüstünde Bollmark 32px boşluk kullanıyor, Release'in gerçeği 24px — 8px fazla. Bu fazlalık hem fotoğrafları "daha uzak" gösteriyor hem de aynı sayfa genişliğinden 3 boşluk daha az çıkarıldığı için her fotoğrafı biraz daha "dar" yapıyor (Bollmark'ta hesapla ~318px, Release'de 320px — küçük ama; asıl büyük fark mobilde: Bollmark 32px'e karşı Release'in 16px'i, yani TAM İKİ KAT fazla boşluk kullanıyoruz mobilde).

Önceki bir incelemede (RELEASE_TEMA_BIREBIR_UYUM_PLANI.md) bu boşluk "32px, zaten aynı" olarak not edilmiş — o ölçüm hatalıymış, bu ölçüm doğrudan şimdi tekrar doğrulandı.

**Düzeltme:** `urunler/page.tsx`'teki grid class'ını `gap-8` yerine masaüstünde 24px'e (`md:gap-6`), mobilde 16px'e (`gap-4`) çevirmek gerekiyor — yani `className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6"`. Aynı grid başka sayfalarda da (ana sayfa öne çıkanlar, benzer ürünler vb.) kullanılıyorsa oralarda da aynı düzeltme yapılmalı.

## 3.3 Ayrı not (prompt'a dahil edilmedi): fiyat metninde de benzer bir ağırlık farkı var

Bu, sormadığınız ama incelerken fark ettiğim bir şey — dahil etmedim, isterseniz ayrıca ekleriz: `product-card.tsx`'teki fiyat her zaman `font-medium` (500), Release'de fiyat her zaman `font-weight: 400`. `product-viewer.tsx`'teki (ürün detay) indirimli fiyat da hem 14px hem `font-medium` (Release: 12px/400). İsterseniz bunu da ayrı bir madde olarak prompt'a ekleyebilirim.

## 4. Claude Code'a verilecek prompt

Aşağıdaki prompt doğrudan Claude Code'a kopyalanabilir:

---

Release Shopify temasının canlı demosunu (themes.shopify.com/themes/release/presets/release, "Jackets & Coats" kategorisi ve arama sonuçlarında "sale" araması) referans alarak katalog/ürün kartlarımızı (`src/components/product-card.tsx`, `src/lib/catalog.ts`, `src/app/(site)/urunler/page.tsx`) şu noktalarda güncelle:

1. **Hover'da ikinci fotoğraf**: `product-card.tsx`'teki `secondImage` mantığı zaten hazır ama hiç veri almıyor. `CatalogEntry` tipine (`lib/catalog.ts`) `secondImage: string | null` ekle, `getCatalogEntries()` içinde ürünün/seçili rengin galerisindeki 2. fotoğrafı (varsa `images[1]`, yoksa ilgili `optionImages`'ın 2. kaydı) bu alana doldur, `urunler/page.tsx`'te `ProductCard`'a geçir. 2. fotoğraf yoksa mevcut hafif büyüme (scale) efekti aynen kalsın.

2. **İndirim rozetini düzelt ve belirginleştir** (ÖNCE düzeltme, SONRA stil): Şu an rozet SADECE admin → Kampanyalar'dan tanımlanan otomatik yüzde indirimlerinde çıkıyor. Ürüne/varyanta admin panelinden doğrudan "Karşılaştırma fiyatı" (compareAtCents) girilerek yapılan indirimlerde rozet HİÇ ÇIKMIYOR — sadece üstü çizili eski fiyat görünüyor (bu muhtemelen bildirdiğim/gördüğünüz sorun). `product-card.tsx`'teki rozet koşulunu, otomatik kampanya indirimi yoksa `compareAtCents > priceCents` durumunda da (yüzdeyi `Math.round((1 - priceCents/compareAtCents) * 100)` ile hesaplayıp) rozeti göstersin şekilde güncelle — otomatik kampanya varsa o öncelikli kalsın.

   Rozetin görselini Release'in canlı demosundan `getComputedStyle` ile ölçülen şu tam değerlerle uygula: `font-size: 10px`, `font-weight: 500`, `letter-spacing: 1.4px`, `line-height: 12.5px`, `text-transform: uppercase`, `border-radius: 4px`, `padding: 6px 8px`, kenarlık yok. Zemin/metin rengi için iki seçenek üret (ikisini de göster, birini seçeceğim): (a) Release'in gerçek rengi `rgb(239,45,45)` zemin + beyaz metin, (b) markanın mevcut "clay" tonu tam doygunlukta zemin + krem metin.

3. **Stok uyarısı rozeti**: Bir ürünün/rengin toplam stoğu düşükse (ör. ≤3 adet) sol üst köşede indirim rozetinin yanına "Son X Adet" rozeti ekle — Release'deki "last few" rozetiyle AYNI taban stil (`font-size: 10px`, `font-weight: 500`, `letter-spacing: 1.4px`, `border-radius: 4px`, `padding: 6px 8px`, uppercase), ama zemin BEYAZ + metin `#111111`, kenarlıksız (Release'de bu rozetin görünürdeki ince çerçeve hissi aslında kenarlıktan değil, açık gri ürün fotoğrafı zeminine karşı oluşan kontrasttan geliyor — gerçek CSS'te border yok, bizde de olmasın). Birden fazla rozet varsa (indirim + stok uyarısı) yan yana, aralarında küçük bir boşlukla dizilsin. Ürün tamamen stokta yoksa mevcut tam ekran "Stokta Yok" overlay'i öncelikli kalsın, bu rozet gösterilmesin.

4. **Başlık ve fiyat stili** — Release'den ölçülen tam değerlerle:
   - Ürün adı (`product-card.tsx`'teki `<h3>`): `text-transform: uppercase`, `font-weight: 600` (şu an muhtemelen 400/normal), `font-size: 12px`, `letter-spacing: 0.48px`, `line-height: 15px`.
   - Fiyat (indirimsiz durumda, normal): `font-size: 12px`, `font-weight: 400`, `letter-spacing: 0.48px`, renk `#111111` — muhtemelen zaten yakın, birebir hizala.
   - İndirimli üründe eski fiyat (üstü çizili): renk **değişmesin**, siyah (`#111111`) kalsın, sadece `line-through` — Release'de de böyle, sandığımızın aksine gri değil.
   - İndirimli üründe yeni/güncel fiyat: renk `rgb(194,81,81)` (kırık/toprak kırmızısı — indirim rozetinin parlak kırmızısından FARKLI, daha soluk bir ton, bilerek böyle) yap. Bu marka paletindeki "clay" tonuna göz kırpıyor, o rengi kullanmak da bir seçenek — Claude Code ikisini karşılaştırıp göstersin.
   - "Available in X size" tarzı varyant bilgisi metni: `font-size: 12px`, `font-weight: 400`, renk `rgba(17,17,17,0.5)` (%50 opaklıkta siyah) — muhtemelen zaten yakın, birebir hizala.
   - Çok varyantlı ürünlerde fiyat aralığı ("X TL'den başlayan") EKLEME — mevcut tek fiyat gösterimi aynen korunsun, bu bilinçli bir tercih.

5. **Başlık puntosu düzeltmesi**: `product-card.tsx`'teki başlık (`<h3 className="text-sm text-ink">`), genel `text-sm` class'ını kullandığı için `globals.css`'teki `.storefront .text-sm { font-size: 0.9375rem; }` (15px, gövde metni okunurluğu için bilerek eklenmiş genel bir override) tarafından büyütülüyor — bu yüzden 4. maddedeki 12px hedefiyle çakışıyor. Başlığa bu global override'dan etkilenmeyecek kendine özel bir class ver (ör. Tailwind keyfi değer sözdizimiyle `text-[12px] tracking-[0.48px] leading-[15px] font-semibold uppercase`), `text-sm`'i kaldır. `globals.css`'teki `.storefront .text-sm` override'ına dokunma — o kasıtlı, sadece başlığın ona bağımlı olmasını kes.

6. **Fiyatta ₺ yerine TL**: `lib/format.ts`'teki `formatPrice()` şu an `Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" })` kullanıyor, bu da tarayıcının ₺ sembolünü otomatik ekliyor. Bunun yerine sayıyı düz Türkçe formatta (binlik nokta, ondalık virgül) formatlayıp sonuna elle `" TL"` ekle — Release'deki gibi sembol değil, yazı olarak "TL" görünsün. Bu fonksiyon tüm sitede (katalog, ürün sayfası, sepet, admin vb.) kullanıldığı için tek yerden düzelmesi her yere yansıyacak, ayrıca kontrol et.

7. **Poppins font dosyasına 600 ağırlığını ekle**: `(site)/layout.tsx`'teki `Poppins({ weight: ["400", "500"] })` çağrısına `"600"` ağırlığını da ekle. 4. maddedeki başlık için istenen `font-semibold`/600 ağırlık, bu ağırlık font dosyasında hiç yüklenmediği için şu an en yakın mevcut ağırlığa (500) düşüyor — gerçek 600 görünmesi için font dosyasının da bu ağırlığı içermesi lazım. (Not: başlığın Release'e göre "koyu/kalın" durmasının asıl sebebi ağırlık değil punto farkı — 4 ve 6. maddelerdeki punto düzeltmesi zaten bunu çözecek, bu madde sadece 600 ağırlığın gerçekten render edilebilmesi için teknik bir ön koşul.)

8. **Grid boşluğunu düzelt**: `urunler/page.tsx`'teki katalog grid'i şu an `gap-8` (32px, hem masaüstü hem mobil) kullanıyor. Release'in gerçek (canlı demodan ölçülmüş) değerleri: masaüstünde (1280px+) 24px, mobilde 16px. Class'ı `grid-cols-2 gap-4 md:grid-cols-4 md:gap-6` olacak şekilde güncelle (`gap-4`=16px, `gap-6`=24px). Kenar boşluğuna (`px-4 md:px-6 xl:px-9`) dokunma, o zaten doğru. Aynı grid deseni ana sayfa/benzer ürünler gibi başka yerlerde de kullanılıyorsa oraları da aynı şekilde güncelle.

Değişiklikleri yapmadan önce hangi ürünlerde/renklerde ikinci fotoğraf zaten kayıtlı olduğunu kontrol et, test için o ürünleri kullan.

---

## İlgili notlar
[[bollmark_release_theme_referans]], [[bollmark_release_birebir_plan]]
