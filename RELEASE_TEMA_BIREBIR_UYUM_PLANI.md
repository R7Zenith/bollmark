# Release Teması Birebir Uyum Planı

Bu dosya, Shopify "Release" temasını (DigiFist, themes.shopify.com/themes/release)
referans alarak Bollmark'ı ona birebir yaklaştırmak için çıkarılan plandır. Canlı
demo (release-main.myshopify.com) tarayıcıyla gezilip computed style / CSS
seviyesinde ölçüldü — aşağıdaki değerler tahmini değil, demodan okunan gerçek
değerlerdir.

## 1. Header — mega menü davranışı (Playwright ile DOM/CSS ölçümüyle DÜZELTİLDİ — 12 Eylül 2026)

**Önceki değerlendirme YANLIŞTI.** Önceki not "Bollmark'ın mevcut GenderPanel/
AksesuarPanel yapısı zaten bu mantığa çok yakın, sadece küçük ayar yeter"
diyordu — bu, gerçek DOM/computed style ölçülmeden yapılmış yüzeysel bir
karşılaştırmaydı. release-main.myshopify.com Playwright ile açılıp `Shop`
mega menüsüne hover yapılarak ve `#Navigation-drawer-header` mobil çekmecesi
tıklanarak gerçek değerler çıkarıldı; aradaki fark küçük değil, **yapısal**.

### 1.1 Masaüstü — panel gerçek yapısı (1600px'de ölçüldü)

- Panel `position: absolute; inset-inline: 0; top: 64px` (header'ın hemen
  altında, TAM VİEWPORT genişliğinde — 1600px ekranda panel de 1600px).
  Üstte `border-top: 1px solid rgb(235,235,235)` tek ayraç çizgisi.
- **Açılma animasyonu gerçekten yok** — `display: none → block`, `transition`
  ölçülmedi (anlık). Bollmark'taki `openMenu` state mantığı bunun için zaten
  doğru yaklaşım.
- İç dolgu: `padding: 32px 36px` (dikey 32, yatay 36).
- **Panel tam olarak İKİYE bölünmüş, %50/%50 (764px / 764px, 1528px içerik
  genişliğinde), aralarında ekstra boşluk yok** — Bollmark'taki gibi "geniş sol
  link alanı + dar sağ görsel" değil, SOL YARI link grupları / SAĞ YARI 2
  promosyon görseli şeklinde net bir ikiye bölünme:
  - **SOL yarı**: `grid-template-columns: 376px 376px 0px` — yani sistem 3
    gruba kadar yer ayırıyor (şu an sadece "Featured" ve "Categories" dolu),
    grup sütunları arası boşluk `gap: 32px 12px`.
    - Grup başlığı ("Featured", "Categories"): **14px, font-weight 600,
      letter-spacing +0.28px, `text-transform: none` (BÜYÜK HARF DEĞİL, ilk
      harf büyük normal yazı)**, `margin-bottom: 16px`, renk `#111`, font
      Poppins.
    - Alt linkler (New, Bestsellers, Tops, Jeans...): **14px, font-weight
      400, `text-transform: uppercase` (BÜYÜK HARF)**, `letter-spacing:
      -0.56px` (negatif — büyük harfe rağmen sıkışık, "ucuz kurumsal" değil
      "sıkı/pahalı" bir his veriyor), `line-height: 21px`, satırlar arası
      `gap: 8px`, dikey liste (flex column).
    - **ÖNEMLİ FARK:** Bollmark'ta grup başlığı yok, tüm kategoriler tek
      düz liste halinde 2-4 sütuna otomatik bölünüyor (`chunkColumns`
      fonksiyonu). Release'de ise hep "Featured" ve "Categories" adında 2
      SABİT anlamsal grup var; kategori sayısı ne olursa olsun bu 2 grup
      yapısı korunuyor, "Featured" altında öne çıkan/kürasyonlu 3 link
      (New/Bestsellers/Basics), "Categories" altında ürün tipi listesi yer
      alıyor.
  - **SAĞ yarı**: 2 adet promosyon kartı yan yana (`display:flex; gap:24px`),
    her biri **370px genişlik, panel içeriğiyle aynı yükseklik (~493px,
    portre/dikey oranlı, `object-fit: cover` arka plan görseli)**. Kart
    içeriği ortalanmış (`align-center text-center justify-center`): küçük
    beyaz eyebrow etiketi (`SPOTLIGHT`, `SS26` — CSS'te `text-transform`
    YOK, metin HTML'de zaten büyük harf yazılmış, 14px normal weight) +
    altında büyük başlık (`Transient Echoes`, `Get ready for the sun` —
    **36px, font-weight 400, letter-spacing -1.44px, satır yüksekliği
    45px, RENK BEYAZ, AYNI Poppins ailesi** — görselde farklı/dekoratif bir
    yazı tipi gibi görünse de aslında sadece büyük boy + sıkı tracking'li
    Poppins; ayrı bir serif/script font YOK).
    - **ÖNEMLİ FARK:** Bollmark'ın `GenderPanel`'inde SADECE 1 görsel var
      (`heroImage`, `w-80` yani 320px, `lg:` altında tamamen gizli). Release
      DAİMA 2 görsel yan yana gösteriyor ve bunlar panelin `xl` altında değil
      DAHA GENİŞ bir kesimde (masaüstünün ana hali) görünür durumda.
      `AksesuarPanel`'de ise hiç görsel yok.

### 1.2 Mobil — gerçek etkileşim: ACCORDION DEĞİL, DRILL-DOWN (375-390px'de ölçüldü)

**Bu en kritik fark ve önceki planda hiç incelenmemişti.** Release'in mobil
menüsü Bollmark'taki `MobileAccordionSection` gibi "başlığın altında yerinde
açılan liste" değil — **çok seviyeli, yatay kaydırmalı bir "drill-down" (alt
menüye girip geri dönme) sistemi**:

- Çekmece tam ekran genişliğinde (`width: 390px` = viewport genişliğinin
  tamamı, Bollmark'taki gibi `w-[85%] max-w-sm` sağdan açılan dar panel
  DEĞİL), `position: fixed`, giriş/çıkışta
  `transition: transform 0.45s cubic-bezier(0.74,-0.01,0.26,1)` — hafif
  "overshoot" hissi veren özel bir easing kullanılıyor (Bollmark'ta
  transform animasyonu yok, `open`/`!open` ile anlık mount/unmount).
- **Seviye 0** (çekmece ilk açıldığında): düz liste — Home, `Shop ›`,
  `Pages ›`, `Product features ›`, Contact, `Presets ›`. Alt kategorisi olan
  öğelerin sağında sağa dönük ok (`›`) var.
- **Seviye 1** (`Shop`'a dokunulduğunda): TÜM PANEL yeni bir görünümle
  DEĞİŞİYOR — üstte geri oku + "SHOP" başlığı (`← SHOP`), altında yine düz
  liste: `Featured ›`, `Categories ›` (bunlar da accordion gibi yerinde
  AÇILMIYOR, kendi seviyelerine "girilerek" gösteriliyor), listenin altına
  masaüstündeki AYNI 2 promosyon görseli (SPOTLIGHT/Transient Echoes,
  SS26/Get ready for the sun) yan yana ekleniyor.
- **Seviye 2** (`Featured`'a dokunulduğunda, aynı mantıkla): muhtemelen New /
  Bestsellers / Basics düz liste + üstte `← FEATURED` geri oku (bu ekran
  ayrıca doğrulanmadı ama Seviye 1 ile birebir aynı `menu-panel` / geri
  butonu deseni izleniyor, DOM'da `data-menu="shop"` gibi her seviye için
  ayrı bir panel div'i var).
- **ÖNEMLİ FARK:** Bollmark'ın mevcut `MobileAccordionSection`'ı tek ekranda
  kalıp `ChevronIcon` 180° dönerek `<ul>`'u AŞAĞI AÇIYOR (accordion). Bu,
  Release'in davranışından tamamen farklı bir etkileşim modeli — "geri"
  kavramı yok, alt kategoriler asıl listeyi aşağı itiyor. Release'de ise geri
  navigasyonu var, her seviye kendi tam-genişlik ekranını kaplıyor ve
  masaüstündeki promosyon görselleri MOBİLDE DE (sadece Shop alt menüsünde)
  gösteriliyor — Bollmark'ın mobil menüsünde hiç görsel yok.
- Bollmark'ta çekmece sağdan `%85` genişlikte ve köşesi yuvarlak
  (`rounded-l-2xl`) açılıyor; Release'de tam genişlik, köşe yarıçapı yok.

### 1.3 Nav linki hover altı çizgi animasyonu

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

### 1.4 Sonraki adım için özet fark listesi

**Masaüstü (Adım 1 kapsamına eklenecek):**
1. `GenderPanel`/`AksesuarPanel`'e "Featured" (öne çıkan/kürasyonlu 3 link) ve
   "Categories" (tüm kategori listesi) diye 2 sabit grup başlığı eklenmeli;
   grup başlığı 14px/600/normal-case, alt linkler 14px/400/UPPERCASE/
   letter-spacing -0.56px.
2. Panel içeriği net %50/%50 sol-sağ ikiye bölünmeli (şu an sol taraf `flex-1`
   ile esnek, sağda tek 320px görsel var — bunun yerine sabit 2 sütunlu sağ
   blok, her biri panel yüksekliği kadar uzun, 2 farklı promosyon görseli).
3. `AksesuarPanel`'e de en az 1 promosyon görseli eklenmeli (şu an hiç yok).

**Mobil (yeni, önceki planda yoktu — ayrı bir adım olarak değerlendirilmeli):**
1. `MobileAccordionSection`'ın "yerinde açılan accordion" davranışı,
   "drill-down" (yeni panel + geri oku) davranışına çevrilmeli — bu, mevcut
   tek-seviye state yönetiminden (`openSection`) çok seviyeli bir panel
   yığınına (stack) geçiş gerektiren daha büyük bir refactor.
2. Mobil "Shop" alt menüsüne masaüstündeki ile aynı 2 promosyon görseli
   eklenmeli.
3. Çekmece genişliği/köşe stili tartışılmalı: Release'in tam-genişlik +
   köşesiz stiline mi geçilecek, yoksa Bollmark'ın mevcut sağdan-dar-yuvarlak
   çekmece tercihi mi korunacak — bu bir tasarım kararı, ölçüm bunu
   dayatmıyor sadece farkı gösteriyor.

Bu adım SADECE analiz — yukarıdaki hiçbir madde henüz kodda uygulanmadı.

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
- [x] **Adım 1a — Masaüstü mega menü (`GenderPanel`/`AksesuarPanel`) 1.1/1.4
      ölçümlerine göre yeniden yazıldı (12 Eylül 2026):** `chunkColumns`
      kaldırıldı, yerine sabit "Öne Çıkanlar" (sadece "Tüm Ürünler" — katalogda
      gerçek bir yeni/çok-satan sort parametresi olmadığı için uydurma param
      eklenmedi) + "Kategoriler" grupları geldi; grup başlığı 14px/600/
      normal-case, alt linkler 14px/400/UPPERCASE/-0.56px tracking + yeni
      `.nav-underline` hover'ı (`globals.css`'e eklendi); panel içi
      `grid-cols-2` ile net %50/%50 sol-sağ bölünüyor, sağda `imageUrl`'i
      olan kategorilerden en fazla 2 (Aksesuar'da 1) promosyon kartı —
      hiç görsel yoksa sağ yarı hiç render edilmiyor (placeholder
      eklenmedi). `npx tsc --noEmit` ve `npm run build` hatasız; localde
      Playwright ile 1280/1600px'de Kadın/Erkek/Aksesuar hover ekran
      görüntüleriyle DOĞRULANDI (grup başlıkları görünüyor, mevcut veride
      kategori `imageUrl` dolu olmadığı için sağ yarı bu ortamda hiç
      görünmüyor — bu, kodun değil verinin durumu). Commit henüz atılmadı,
      kullanıcı onayı bekleniyor.
- [ ] **Adım 1b — Mobil menü (`MobileMenu`/`MobileAccordionSection`)**
      Release'deki gerçek "drill-down" (geri oku ile çok seviyeli panel)
      davranışına çevrilmeli — bkz. 1.2. Bu adımda BİLİNÇLİ OLARAK
      dokunulmadı, ayrı bir prompt ile gelecek.
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
