# Release Teması Birebir Uyum Planı

Bu dosya, Shopify "Release" temasını (DigiFist, themes.shopify.com/themes/release)
referans alarak Bollmark'ı ona birebir yaklaştırmak için çıkarılan plandır. Canlı
demo (release-main.myshopify.com) tarayıcıyla gezilip computed style / CSS
seviyesinde ölçüldü — aşağıdaki değerler tahmini değil, demodan okunan gerçek
değerlerdir.

## 1. Header — mega menü davranışı (önceki prompt'ta eksik kalan kısım)

Önceki header prompt'u sadece logo ortalama (grid yapısı) ile ilgiliydi. Bu bölüm
hover ile açılan menünün DAVRANIŞINI tarif ediyor:

- Menü öğesine (`Shop` gibi) mouse ile gelindiğinde, header'ın hemen altında
  (`inset-block-start: 100%`), TAM SAYFA GENİŞLİĞİNDE beyaz bir panel açılıyor.
  Üstte ince bir ayraç çizgisi (`border-block-start`) var.
- **Açılma animasyonu YOK** — panel `display: none` → `display: block` ile anlık
  beliriyor/kayboluyor (kaydırma/fade efekti yok). Karmaşık bir animasyon
  eklemeye gerek yok, tek ihtiyaç doğru `hover` tetikleyicisi.
- Panel içeriği 2 bölgeden oluşuyor: SOL tarafta düz metin link sütunları
  (örn. "Featured" başlığı altında NEW/BESTSELLERS/BASICS, "Categories" başlığı
  altında TOPS/JEANS/SHORTS/T-SHIRTS/...), SAĞ tarafta 2 adet yan yana
  promosyon görseli (üzerine bindirilmiş küçük etiket + başlık yazısı, örn.
  "SPOTLIGHT / Transient Echoes").
- Bollmark'ın mevcut `GenderPanel`/`AksesuarPanel` yapısı zaten bu mantığa çok
  yakın (tam genişlik, kategori linkleri + sağda görsel) — sadece sol tarafı
  "Featured/Categories" gibi 2 gruba ayırmak ve panel açılışını anlık
  (transition olmadan, sadece `openMenu` state'i ile) tutmak yeterli.

### 1.1 Nav linki hover altı çizgi animasyonu

Ölçüldü: klasik "arka plan gradient büyütme" tekniği kullanılıyor.

```css
.nav-underline {
  background-image: linear-gradient(currentColor, currentColor);
  background-repeat: no-repeat;
  background-position: 0 100%;
  background-size: 0% 1px;
  transition: background-size 0.4s ease;
}
.nav-underline:hover { background-size: 100% 1px; }
```

Bollmark'ın `DesktopNav` linklerine uygulanacak (uygulandı — bkz. sohbet
geçmişindeki prompt).

## 2. Ürün listeleme (katalog) sayfası

Ekteki ekran görüntüsünde de görülüyor: sayfa neredeyse kenardan kenara, boşluk
minimal kullanılmış. Ölçülen değerler (1610px geniş ekranda):

- Sayfa kenar boşluğu (gutter): ~36px her iki yanda (~%2.2 — yani ekranın
  neredeyse tamamı grid için kullanılıyor, Bollmark'taki `max-w-7xl` + `px-6`
  kombinasyonundan daha dar bir yan boşluk).
- Kartlar arası boşluk (gap): 32px.
- Masaüstünde 4 sütun.
- Üstte "Filters" dropdown solda, "Showing X of Y products" ortada/solda,
  sağda sıralama dropdown'u — tek satırda.
- Kart üzerinde rozet (LAST FEW / NEW / SALE gibi) sol üst köşede küçük dolgu
  etiketler olarak duruyor.

**Bollmark'a uygulanacak:** `urunler/page.tsx` içindeki container genişliğini
daralt (yan boşluğu `px-6`'dan `px-9`/`px-2` gibi ekran genişliğine göre daha
dar bir orana çek), grid gap'i 32px'e sabitle, üstteki "Filters/Showing/Sort"
satırını tek satırda solda-ortada-sağda 3 parçalı hale getir.

## 3. Ürün detay sayfası — piksel bazlı ölçümler

Ekteki ekran görüntüsüyle birebir eşleşen ölçümler:

- Galeri (sol) / bilgi paneli (sağ) oranı: yaklaşık **%56 / %44** (901px /
  1595px konteyner genişliğinde ölçüldü). Bollmark'ın mevcut oranı bundan
  farklıysa buna çekilmeli.
- Galeri 2 sütun (ön görsel + arka görsel yan yana), her ikisi de dikdörtgen
  portre oranında, aralarında ince boşluk.
- "Add to cart" butonu: yükseklik **46px**, `border-radius: 50px` (tam hap),
  siyah dolgu (`rgb(17,17,17)`), yazı boyutu ~10px BÜYÜK HARF + harf aralığı.
- "Buy it now" butonu: aynı yükseklik/hap şekli, ama dolgu yok (outline,
  `background: transparent`, siyah border).
- Beden seçim kutucukları: **28x28px KARE** (yuvarlak/hap değil!), 1px düz
  siyah border, köşe yarıçapı 0 (keskin köşe). Bollmark'taki mevcut pill-grid
  bunun yerine kare/keskin köşeli chip'e çevrilmeli.
- Rozetler (LAST FEW / NEW / SALE): fiyatın üstünde küçük dolgu etiketler,
  yan yana.
- **Güven rozeti animasyonu** (kullanıcının bahsettiği "Secure online
  payment / Free delivery" animasyonu): Bu bir dikey "ticker" efekti.
  Teknik detay: 3 satır (ikon+metin) üst üste bindirilmiş, dış kapsayıcı
  `overflow: hidden` ve `height: 22px` (tek satır yüksekliği). İçerideki
  satır grubu şu keyframe ile hareket ediyor:
  ```css
  @keyframes textSwap {
    0%   { transform: translateY(0); }      /* 1. satır görünür, bekle */
    32%  { transform: translateY(0); }
    50%  { transform: translateY(-100%); }  /* 2. satıra kay, bekle */
    82%  { transform: translateY(-100%); }
    100% { transform: translateY(-200%); }  /* 3. satıra kay */
  }
  ```
  `animation: 5.9s ease-in-out infinite;` — yani her ~2 saniyede bir satır
  değişiyor, yumuşak geçişle. Bu tam olarak Claude Code'a verilecek CSS.
- "You may also like" — tek satır, küçük ürün görseli + isim/fiyat + "Quick
  add" linki (ayrı bir sayfaya gitmeden sağ panelde ek ürün önerisi).

## 4. Ana sayfa hero görseli — marka referansı araştırması

Koton, Dilvin ve Quzu'nun kendi sitelerine bakıldı (görüntüler doğrudan
kopyalanamaz — bunlar bu markaların kendi çekim/kampanya fotoğrafları,
telifli; başka bir markanın ticari kampanya görselini kendi sitende
kullanmak telif hakkı ihlali olur, bunu net şekilde belirtmek isterim).
Ama üçünün de "mood"u net:

- **Koton:** sıcak tonlar (bordo, kahve, ahşap), stüdyo + günlük ortam
  karışımı, ticari/indirim odaklı kompozisyon.
- **Dilvin:** en "quiet luxury" olan — krem/bej tonlar, gün ışığında sokak
  stili editoryal çekim, şık ama sade duruş, aksesuar detay çekimleri.
- **Quzu:** daha karanlık/edgy, Y2K-sokak stili, genç/soğuk ton.

Bollmark'ın mevcut renk paleti (ink/clay/stone, sıcak nötr) Dilvin'in
yönüne en yakın duruyor. Bu yüzden hero görseli için de o yönü öneriyorum.

**Somut öneri — telifsiz (Unsplash, ticari kullanım serbest) 2 aday:**

1. https://unsplash.com/photos/OVKQzZnrok8 — iki model, nötr tonlarda kombin,
   temiz stüdyo/editoryal çekim, geniş format (hero için ideal, yatay).
2. https://unsplash.com/photos/0gS2Ia5a-Pw — bej/kahverengi kaban, gün
   ışığında sokak stili, Dilvin'in moduna çok yakın (dikey format, mobil
   hero için de uygun).

Bunlar gerçek stok fotoğraf, ücretsiz ve ticari kullanım için uygun — ama
"gerçek bir markaya benzemek" için en doğru uzun vadeli çözüm hâlâ kendi
ürün fotoğrafçılığın: dükkanındaki birkaç parçayı bu ışık/pozla (doğal ışık,
nötr arka plan, rahat duruş) çekmek, bu şekilde hem telif sorunu kalmaz hem
de gerçekten Bollmark'ın kendi kimliği oluşur. Şimdilik yukarıdaki 2 görseli
placeholder olarak kullanıp ilerleyen dönemde kendi çekimle değiştirmeyi
öneriyorum.

**Not:** Koton/Dilvin/Quzu'nun kendi kampanya fotoğraflarını doğrudan indirip
Bollmark'ın (ticari) sitesinde kullanmak telif hakkı ihlali olur — "geçici,
sonra değiştiririz" gerekçesi bunu değiştirmiyor. Bu yüzden karar: yukarıdaki
2 Unsplash görseli (ücretsiz, ticari kullanıma açık, atıf gerektirmiyor)
geçici hero placeholder'ı olarak kullanılacak — uygulandı (bkz. sohbet
geçmişindeki prompt).

## Uygulama Sırası (sıralı ilerliyoruz — her adım tek tek Claude Code'a veriliyor)

- [x] Adım 0a — Logo header'a eklendi (logo.png/logo-white.png). Dosya
      okunarak DOĞRULANDI (11 Eylül 2026).
- [x] Adım 0b — Font: Poppins + Cormorant italik vurgu, zemin #fdfcfb
      (beyaza yakın), hap buton, ayrı "sale" rengi. Dosya okunarak
      DOĞRULANDI (11 Eylül 2026) — tailwind.config.ts ve globals.css'te
      gerçekten bu değerler var.
- [x] Adım 0c — Header 3 sütunlu grid (logo tam ortada). Kullanıcının attığı
      ekran görüntüsüyle DOĞRULANDI — logo artık gerçekten ortada.
- [x] Adım 0d — Header ikon/nav stili. `site-header.tsx`: `DesktopNav`
      linkleri artık `text-[10px] font-normal uppercase tracking-[1.4px]`;
      Kadın/Erkek/Aksesuar linklerinin yanına `ChevronIcon` (12px) eklendi,
      `openMenu === tab.key` olduğunda 180° dönüyor; "Hikayemiz" üst menüden
      kaldırıldı, `site-footer.tsx`'teki Kurumsal listesine (`/#hikaye`)
      eklendi (mobil menüdeki "Hikayemiz" dokunulmadan kaldı); sağda "Giriş
      Yap" yazısı + "Sepet" hap butonu yerine `SearchIcon`/`AccountIcon`/
      `CartIcon` (yeni eklenen SVG bileşenleri) kompakt satırı geldi, sepet
      ikonunda `totalCount` clay renkli rozet olarak duruyor - hepsi
      `currentColor` kullandığı için saydam/katı header renk geçişini
      otomatik takip ediyor. Bu değişiklikler `xl:` (1280px) ve üstünde
      devrede; altında (tablet/mobil) eski Sepet hap butonu + hamburger
      birebir korundu, `MobileMenu`'ye dokunulmadı. Dosya okunarak ve
      1024/1280/1400px + mobil (420px) ekran görüntüleriyle DOĞRULANDI (12
      Eylül 2026) — chevron hover'da döndüğü, sepet rozetinin gerçek sepete
      eklemeyle güncellendiği ve footer linkinin göründüğü tek tek test
      edildi.
- [ ] **Adım 1 — Nav linki hover altı çizgi animasyonu (`.nav-underline`),
      mega menü animasyonsuz açılış kontrolü, hero görseli geçici Unsplash
      placeholder. Prompt verildi ama HENÜZ UYGULANMADI.**
- [ ] Adım 2 — Ürün listeleme (katalog) sayfası: kenar boşluğu daraltma,
      32px grid gap, Filters/Showing/Sort tek satır düzeni. Prompt verildi
      ama HENÜZ UYGULANMADI.
- [ ] Adım 3 — Ürün detay sayfası piksel ölçüleri: galeri/bilgi oranı %56/%44,
      buton 46px+50px radius, beden chip 28x28 kare, güven rozeti ticker
      animasyonu (`@keyframes textSwap`).
- [ ] Adım 4 — (varsa) kalan ince ayarlar / genel görsel kontrol.

**Not:** Bir adımı [x] olarak işaretlemeden önce ya dosyayı tekrar okuyup
gerçekten uygulandığını doğrula, ya da kullanıcının "bitti/uyguladım"
dediğini bekle — tahmin ederek işaretleme.

Sıradaki iş: Adım 0c'nin gerçekten uygulanıp uygulanmadığını kontrol et,
sonra sırayla Adım 1 → 2 → 3 → 4 şeklinde ilerle. Her adım uygulanıp
kontrol edildikten sonra bir sonrakine geçilecek.
