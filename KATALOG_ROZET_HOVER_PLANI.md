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
- Beyaz dolgu + siyah ince kenarlık + siyah metin: **"LAST FEW"** — "son adetler" stok uyarısı.
- Rozetler her zaman görselin **sol üst köşesinde**, birden fazlaysa yatayda yan yana diziliyor (kırmızı/siyah/beyaz karışık olabiliyor, ör. "15% OFF" + "SOLD OUT" aynı kartta).
- Sağ üst köşede ayrı bir "hızlı sepete ekle" (+) ikonu var — favorilere ekleme rozetle karışmıyor.

**Hover davranışı:**
- Kartın üzerine gelince ürünün ikinci bir fotoğrafına yumuşak (soft) bir geçişle (crossfade/opacity) geçiliyor — ani değil, ~300ms transition.
- İkinci fotoğrafı olmayan ürünlerde hover'da hafif bir zoom/scale efekti var.

**Grid:** 4 sütun (masaüstü), kart arası ~32px boşluk — bu zaten Bollmark'ta birebir aynı.

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

## 4. Claude Code'a verilecek prompt

Aşağıdaki prompt doğrudan Claude Code'a kopyalanabilir:

---

Release Shopify temasının canlı demosunu (themes.shopify.com/themes/release/presets/release, "Jackets & Coats" kategorisi ve arama sonuçlarında "sale" araması) referans alarak katalog/ürün kartlarımızı (`src/components/product-card.tsx`, `src/lib/catalog.ts`, `src/app/(site)/urunler/page.tsx`) şu noktalarda güncelle:

1. **Hover'da ikinci fotoğraf**: `product-card.tsx`'teki `secondImage` mantığı zaten hazır ama hiç veri almıyor. `CatalogEntry` tipine (`lib/catalog.ts`) `secondImage: string | null` ekle, `getCatalogEntries()` içinde ürünün/seçili rengin galerisindeki 2. fotoğrafı (varsa `images[1]`, yoksa ilgili `optionImages`'ın 2. kaydı) bu alana doldur, `urunler/page.tsx`'te `ProductCard`'a geçir. 2. fotoğraf yoksa mevcut hafif büyüme (scale) efekti aynen kalsın.

2. **İndirim rozetini düzelt ve belirginleştir** (ÖNCE düzeltme, SONRA stil): Şu an rozet SADECE admin → Kampanyalar'dan tanımlanan otomatik yüzde indirimlerinde çıkıyor. Ürüne/varyanta admin panelinden doğrudan "Karşılaştırma fiyatı" (compareAtCents) girilerek yapılan indirimlerde rozet HİÇ ÇIKMIYOR — sadece üstü çizili eski fiyat görünüyor (bu muhtemelen bildirdiğim/gördüğünüz sorun). `product-card.tsx`'teki rozet koşulunu, otomatik kampanya indirimi yoksa `compareAtCents > priceCents` durumunda da (yüzdeyi `Math.round((1 - priceCents/compareAtCents) * 100)` ile hesaplayıp) rozeti göstersin şekilde güncelle — otomatik kampanya varsa o öncelikli kalsın. Bunu yaparken aynı anda rozetin görselini de Release'deki gibi dolgulu, yüksek kontrastlı, kısa metinli (`%X İNDİRİM` veya `-%X`) küçük bir etiket kutusuna çevir — rengi hem markanın mevcut "clay" tonuyla uyumlu (tam doygunlukta clay + krem metin) hem de gerçek bir indirim kırmızısı seçeneği olarak iki örnek üret, ikisini de göster, birini seçeceğim.

3. **Stok uyarısı rozeti**: Bir ürünün/rengin toplam stoğu düşükse (ör. ≤3 adet) sol üst köşede indirim rozetinin yanına, beyaz zemin + ince siyah kenarlık + siyah metinli "Son X Adet" rozeti ekle. Birden fazla rozet varsa (indirim + stok uyarısı) yan yana, aralarında küçük bir boşlukla dizilsin. Ürün tamamen stokta yoksa mevcut tam ekran "Stokta Yok" overlay'i öncelikli kalsın, bu rozet gösterilmesin.

4. **Başlık ve fiyat stili**: Ürün adını (`product-card.tsx`'teki `<h3>`) tamamen büyük harfe çevir (`uppercase` class'ı ekle, gerekirse `tracking` ince ayarı yap). İndirimli üründe gösterilen yeni/güncel fiyatı, indirim rozetiyle aynı vurgu renginde göster (şu an ikisi de `text-ink` siyah — sadece eski fiyat zaten gri üstü çizili kalıyor, ona dokunma). Çok varyantlı ürünlerde fiyat aralığı ("X TL'den başlayan") EKLEME — mevcut tek fiyat gösterimi aynen korunsun, bu bilinçli bir tercih.

Grid boşluklarına dokunma — zaten Release ile birebir uyumlu. Değişiklikleri yapmadan önce hangi ürünlerde/renklerde ikinci fotoğraf zaten kayıtlı olduğunu kontrol et, test için o ürünleri kullan.

---

## İlgili notlar
[[bollmark_release_theme_referans]], [[bollmark_release_birebir_plan]]
