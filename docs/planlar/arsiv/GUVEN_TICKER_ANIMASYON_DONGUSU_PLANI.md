# Güven Rozeti "Ticker" Animasyonu — Döngü Hatası Kök Neden Analizi ve Çözüm Önerisi

## Şikayet

Ürün sayfasında "Ücretsiz kargo ve teslimat / Güvenli online ödeme" satırının kayarak değiştiği ticker animasyonu tuhaf davranıyor: iki kez oynuyor, sonra kayboluyor, uzun bir süre sonra tekrar geliyor. Referans alınan Shopify "Release" temasında (`black-puffer-edge` ürün sayfası) böyle bir sorun yok, temiz ve sürekli akıyor.

## Araştırma yöntemi

- Referans sayfa (`release-main.myshopify.com/products/black-puffer-edge`) tarayıcı konsolundan canlı CSS kuralları ve `Element.getAnimations()` ile incelendi.
- Bollmark canlı sitesinde (`bollmark.com`) aynı yöntemle bir ürün sayfasındaki `.trust-ticker__rows` elemanının gerçek çalışan animasyonu ölçüldü (`getAnimations()`, `getComputedStyle`).
- İki tarafın kaynak kodu (`src/components/product-viewer.tsx`, `src/app/globals.css`) satır satır karşılaştırıldı.

## Bulgular

1. **HTML yapısı ve normal (5.9s) keyframe'ler birebir doğru.** `product-viewer.tsx`'teki `.trust-ticker` / `.trust-ticker__rows` yapısı ve `globals.css`'teki `trustTickerSwap` keyframe'i (`0% → 32% → 50% → 82% → 100%`, `translateY(0/-100%/-200%)`), Release'in canlı `textSwap` keyframe'i ile birebir aynı. Normal koşulda ikisi de kusursuz, sonsuz, dikişsiz döngü yapar — bu kısımda hata yok.

2. **Kök neden: `prefers-reduced-motion: reduce` durumunda eklenen 20 saniyelik "yavaşlatma" kuralı.** `globals.css` içinde şu blok var:

   ```css
   @media (prefers-reduced-motion: reduce) {
     .trust-ticker__rows {
       animation-duration: 20s;
     }
   }
   ```

   Test tarayıcısında (ve büyük ihtimalle kullanıcının kendi Windows makinesinde — Windows'ta "Windows'ta animasyonları göster" ayarı kapalıysa Chrome/Edge bunu `prefers-reduced-motion: reduce` olarak bildirir) bu medya sorgusu **true** dönüyor. Sonuç: ticker'ın süresi 5.9s yerine **20 saniyeye** çıkıyor.

   `getAnimations()` ile ölçülen gerçek değerler:
   - `computedAnimationDuration: "20s"`
   - Keyframe yüzdeleri aynı kaldığı için: mesaj1 **6.4 saniye** sabit duruyor (`0%→32%` = 20s'nin %32'si), sonra ~3.6 saniyede mesaj2'ye kayıyor, mesaj2 **6.4 saniye** sabit duruyor, sonra ~3.6 saniyede mesaj1'in kopyasına kayıp döngü baştan başlıyor.
   - Kullanıcının tarif ettiği "iki kere oynuyor, sonra uzun süre kayboluyor, sonra tekrar geliyor" hissi tam olarak bu: iki hızlı geçiş (kayma anları) + aralarda 6+ saniyelik "donmuş gibi duran" uzun bekleme — normal 5.9s'lik akışta bu bekleme sadece ~1.9s olduğu için fark edilmiyordu, 20s'de rahatsız edici şekilde uzuyor.

3. **Referans site (Release) bu davranışı hiç uygulamıyor.** Aynı test tarayıcısında (`prefers-reduced-motion: reduce = true` olduğu halde) Release'in kendi ürün sayfası ticker'ı **her zaman 5.9 saniyede** çalışmaya devam ediyor — `prefers-reduced-motion` medya sorgusuna hiç bakmıyor. Release'in CSS'inde gördüğümüz `.no-animation` sınıfı OS ayarına otomatik bağlı değil, ayrı bir mekanizmayla (muhtemelen tema ayarından) tetikleniyor. Yani Bollmark'a bu iş için eklenen "5.9s → 20s" fallback'i, Release'de karşılığı olmayan, bizim eklediğimiz ekstra bir davranış — ve tam da hatalı görünen kısım bu.

4. Bir önceki denemede (kod içi yorumda belirtilmiş) `animation: none` kullanılmış ve bu `overflow: hidden`'ı da etkisiz kılıp 4 satırı üst üste sabit gösterdiği için geri alınmış, yerine bu 20s yavaşlatması konmuş. Ama o eski hata `animation:none` değil, o denemedeki başka bir yan etkiden kaynaklanıyor olmalı — `overflow: hidden` ayrı bir CSS kuralı (`.trust-ticker`) olduğu için `animation: none` tek başına onu bozmaz; animasyon durunca eleman sadece `transform`'suz (yani `translateY(0)`, ilk mesaj) haliyle kalır ve `overflow: hidden` yine de fazlalık satırları gizler.

## Önerilen çözüm

`prefers-reduced-motion: reduce` durumunda ticker'ı **20 saniyeye yavaşlatmak yerine tamamen durdurup ilk mesajda sabitlemek** — hem görsel "bozukmuş gibi" hissi ortadan kalkar hem de gerçek erişilebilirlik hedefine (hareketi azaltmak, sadece yavaşlatmak değil — WCAG 2.3.3) daha uygun olur:

```css
@media (prefers-reduced-motion: reduce) {
  .trust-ticker__rows {
    animation: none;
  }
}
```

`.trust-ticker` üzerindeki `overflow: hidden; height: 22px;` zaten sabit kaldığı için bu, sadece ilk mesajı (`translateY(0)` = ilk satır) sabit ve okunaklı gösterir, diğer satırlar `overflow: hidden` ile gizli kalır — eski denemede yaşanan "4 satır üst üste görünme" riski burada yok, çünkü o zaman sorun muhtemelen `overflow` kuralının da yanlışlıkla kaldırılmasından kaynaklanıyordu, sadece `animation`'ın kaldırılmasından değil.

Alternatif (daha minimal, ama erişilebilirlik açısından daha zayıf): medya sorgusunu tamamen silip Release gibi her durumda sabit 5.9s'de bırakmak. Bunu önermiyoruz çünkü gerçek "reduce motion" kullanıcıları için hareketi tamamen kaldırmak daha doğru bir pratik.

## Claude Code'a verilecek prompt

```
src/app/globals.css içinde ürün sayfasındaki güven rozeti ticker'ında
(`.trust-ticker__rows`, `trustTickerSwap` animasyonu) bir hata var: kullanıcı
"animasyon iki kez oynuyor, sonra kayboluyor, uzun süre sonra tekrar geliyor"
diye bildirdi. Kök nedeni bulundu: `@media (prefers-reduced-motion: reduce)`
bloğunda `animation-duration: 20s` yapılıyor (satır ~143-147). Keyframe
yüzdeleri aynı kaldığı için 20s'de her mesaj ~6.4 saniye sabit duruyor, bu da
"donmuş/kaybolmuş" hissi veriyor. Test tarayıcısında ve büyük ihtimalle
kullanıcının kendi makinesinde `prefers-reduced-motion: reduce` true
döndüğü için bu kod yolu tetikleniyor. Referans Shopify "Release" teması
(release-main.myshopify.com) bu durumda hiç yavaşlatma yapmıyor, ticker'ı
hep 5.9s'de sabit tutuyor.

Şunu değiştir: `@media (prefers-reduced-motion: reduce) { .trust-ticker__rows
{ animation-duration: 20s; } }` kuralını kaldır, yerine ticker'ı tamamen
durdurup ilk mesajda sabitleyen bir kural koy:

@media (prefers-reduced-motion: reduce) {
  .trust-ticker__rows {
    animation: none;
  }
}

`.trust-ticker` üzerindeki `overflow: hidden; height: 22px;` kuralına
dokunma — animasyon durunca eleman `transform` uygulanmamış haliyle
(ilk satır, ilk mesaj) kalacak ve fazla satırlar zaten `overflow: hidden`
ile gizlenmiş olacak.

Değişiklikten sonra:
1. `npx tsc --noEmit` hatasız tamamlanmalı.
2. Bir ürün detay sayfasını Playwright ile aç, DevTools Protocol üzerinden
   `prefers-reduced-motion: reduce` emülasyonunu açıp kapatarak iki durumu
   da doğrula: normal durumda ticker sorunsuz 5.9s'de akmalı, reduced-motion
   açıkken tek bir mesajda sabit durmalı (hareket etmemeli, kaybolmamalı).
3. DEPLOY_STATUS.md'ye bu işin notunu düş.
```
