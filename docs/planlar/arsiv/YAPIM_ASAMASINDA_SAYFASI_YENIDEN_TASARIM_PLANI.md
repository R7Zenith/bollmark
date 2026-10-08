# "Yapım Aşamasında" Sayfası — Yeniden Tasarım (slink-nextjs demo-4 referansı)

Rota: `/yapim-asamasinda` (route group: `src/app/(gate)/`).
Referans: https://slink-nextjs.vercel.app/demo-4 — görsel dil, renk paleti, animasyon mantığı ve
sayfa yapısı birebir alınıp Bollmark marka metinleriyle uyarlandı.

Dosyalar:
- `src/app/(gate)/layout.tsx` — route group layout (html/body, metadata).
- `src/app/(gate)/yapim-asamasinda/page.tsx` — sunucu bileşeni: metadata, fontlar, lansman tarihi.
- `src/app/(gate)/yapim-asamasinda/coming-soon.tsx` — client bileşeni: tüm görsel/etkileşimli kısım.
- `src/app/(gate)/yapim-asamasinda/fonts/` — self-host edilen "General Sans" (Fontshare) woff2 dosyaları.

## 1. Sayfa yapısı

Tek sayfa, tek sütun, dikey ortalanmış:

1. Üstte küçük kalın "Bollmark" wordmark'ı, ana sayfaya link (`next/link`).
2. İki satırlık dev başlık "COMING" / "SOON" — harf harf giriş animasyonu (fade + rise, stagger).
3. Başlığın ortasından geçen, -8° eğik, limon-yeşil (`#d9df8c`) "Çok Yakında" şeridi — sonsuz
   döngüde kayan marquee, harf bazlı "dokuma" efektiyle bazı harflerin önünden bazılarının
   arkasından geçiyor.
4. "Lansmana kalan süre" etiketi + gerçek zamanlı GÜN/SAAT/DAKİKA/SANİYE geri sayımı
   (`NEXT_PUBLIC_LAUNCH_DATE` env değişkeninden okunuyor, tanımsızsa build anından +30 gün).
5. İnce ayraç çizgisi.
6. "Bollmark Hakkında" + kısa marka açıklaması.
7. Instagram linki (diğer sosyal platformlar kullanıcı isteğiyle eklenmedi).
8. Altta küçük gri copyright satırı.

Zemin krem (`#f1ede4`), metin neredeyse siyah (`#141414`), etiketler soluk gri (`#9a9690`),
hafif SVG grain/noise doku overlay'i. Başlık fontu self-host "General Sans" (Fontshare, 500/600
ağırlık — Google Fonts'ta karşılığı olmadığı için `next/font/local` ile barındırılıyor), gövde
fontu Poppins (`next/font/google`).

## 2. Harf bazlı "dokuma" efekti

Referansta şerit "COMING SOON" yazısının bazı harflerinin ÖNÜNDEN, bazılarının ARKASINDAN
geçiyor (ör. C arkada, O önde, M önde, I arkada...). Bunu elde etmek için:

- Her harf ayrı bir `<span className="letter front|back">` olarak render ediliyor
  (`WEAVE_ROWS` sabiti, `coming-soon.tsx`).
- `position:relative` + `z-index` sadece HARF seviyesinde veriliyor (satır/kelime seviyesinde
  değil) — `.letter.front { z-index:3 }` şeridin (`z-index:2`) önünde, `.letter.back { z-index:1 }`
  arkasında kalıyor. z-index yalnızca konumlandırılmış (`position != static`) elemanlarda işlev
  gördüğü için bu ayrım şart.
- Şeridin dikey konumu tam COMING/SOON dikişine hizalanıyor (`ribbon-wrap`'in `top` değeri,
  hero'nun `padding-top` + `h1 font-size × line-height` toplamından hesaplanıyor — hero kutusunun
  kaba `%50`'si DEĞİL, çünkü `padding-bottom` `padding-top`'tan büyük olduğu için o nokta dikişle
  çakışmıyordu). Bu sayede şerit her iki satırı da gerçekten kesiyor, sadece SOON'u değil.

## 3. Marquee (kayan şerit) — bulunan ve düzeltilen buglar

**a) Şerit köşelerde sivri/badem şeklinde kırpılıyordu.**
Sebep: -8° döndürülmüş uzun bir şeridin (`width: 130vw`) kırpma kutusu (`ribbon-wrap`) yalnızca
şeridin kendi (döndürülmemiş) yüksekliği kadar (~50px) ayrılmıştı. Ama `genişlik × sin(8°)`
formülü geniş ekranlarda ~220-300px'lik bir dikey sapma yaratıyor — kırpma kutusu bu sapmayı
karşılamayınca şerit ortadan dar bir mercek/badem şekline dönüşüyordu. Çözüm: `ribbon-wrap`
yüksekliği bu geometriye göre (`calc(16vw + 60px)`, `max-height:340px`) ölçeklendirildi, `ribbon`
`position:absolute` ile `ribbon-wrap` içinde ortalanıp döndürüldü.

**b) Şerit viewport kenarlarına tam yaslanmıyordu.**
`ribbon` genişliği `130vw` → `145vw`'ye çıkarıldı (üst sınır yok — bkz. §3.1, bu ilk çözümün
2K/4K'da nasıl yeniden bozulduğu ve nihai haliyle nasıl düzeltildiği için).

**c) z-index katman sırası çalışmıyordu (şerit her iki satırın da üstünde opak duruyordu).**
Sebep: z-index yalnızca konumlandırılmış (`position:relative/absolute/...`) elemanlarda işlev
görür; ilk versiyonda satırlar `position:static` idi. §2'de anlatılan harf bazlı
`position:relative` + `z-index` çözümüyle giderildi.

**d) Şerit metni bir süre sonra "sağdan bitip" boşluk bırakıyor, sonra dolduruyordu.**
Kök sebep: `ribbon` genişliği `vw` ile (pratikte) sınırsız büyürken, içindeki `ribbon-item`
metninin `font-size`'ı `clamp()` ile bir tavanda sabitleniyordu — yani şerit genişliği bir
noktadan sonra metin genişliğini geçiyordu. 1920px+ monitörlerde ölçülüp doğrulandı
(`seqWidth < ribbonWidth`). **İlk çözüm** (`ribbon`'a `max-width:2200px` + `MARQUEE_REPEATS` 8→24)
bu bugı giderdi AMA yeni bir bug açtı: 2K (2560px) gibi geniş monitörlerde artık şeridin
KENDİSİ viewport'tan dar kalıyor, sol/sağda ~188px krem boşluk bırakıyordu (kullanıcı kendi 2K
monitöründen ekran görüntüsüyle bildirdi). **Nihai çözüm:** `max-width` tamamen kaldırıldı
(şerit yine `vw` ile sınırsız büyüyor, her zaman kenara yaslanıyor), bunun yerine
`MARQUEE_REPEATS` çok daha agresif artırıldı (24 → 56) — 390px'den 3840px'e (4K) hatta 5120px'e
(ultra-wide/5K) kadar `seqWidth`'in `ribbonWidth`'i her zaman aştığı doğrulandı. Yani "genişliği
sınırla" yaklaşımı yerine "içeriği fazlasıyla besle" yaklaşımına geçildi — ikisi birbiriyle
çelişen iki farklı sorunu (kenar boşluğu vs. metin boşluğu) aynı anda çözebilen tek yol bu.

**e) Animasyon "durmuş" gibi görünüyordu.**
Kod tarafında `@keyframes csMarquee` + `animation: csMarquee 22s linear infinite` her zaman
doğru çalışıyordu (Playwright ile `transform` değerinin zamanla değiştiği doğrulandı). Kullanıcı
isteğiyle marquee artık `prefers-reduced-motion: reduce` durumunda bile duraklamıyor (yalnızca
başlığın tek seferlik giriş animasyonu erişilebilirlik için bu tercihe uyuyor).

Seamless loop tekniği: `ribbon-track` içinde `ribbon-seq` iki kez ardışık render ediliyor,
track'in toplam genişliği bir `ribbon-seq`'in tam 2 katı, `translateX(0) → translateX(-50%)`
animasyonu bu sayede dikişsiz döngü oluşturuyor (ikinci kopya `aria-hidden`).

**f) Mobilde şerit "COMING SOON"u orantısız kapatıyordu.**
Şeridin kalınlığı (`padding`) ve içindeki yazının `font-size`'ı sabit px/clamp değerleriyle
tanımlıydı, oysa başlığın (`h1`) font boyutu mobilde çok daha fazla küçülüyordu (clamp alt
sınırı 48px'e kadar iniyor). Sonuç: şerit mobilde başlığa göre ORANTISIZ kalın kalıyor, "COMING"
kelimesinin büyük kısmını (yalnızca "SOON" değil) kapatıyordu. Çözüm: `.cs` üzerinde
`--h1-size: clamp(48px, 13vw, 120px)` adında ortak bir CSS değişkeni tanımlandı; hem `h1`'in
`font-size`'ı hem `ribbon`'un `padding`'i (`clamp(3px, calc(var(--h1-size) * 0.045), 8px)`) hem
de `ribbon-item`'in `font-size`'ı (`clamp(11px, calc(var(--h1-size) * 0.16), 19px)`) artık AYNI
değişkene oranlı. Böylece şeridin kapladığı ORAN masaüstü ve mobilde aynı kalıyor — sabit piksel
değeri değil, başlığa göre göreli bir kalınlık.

## 3.1. "2K kenar boşluğu" düzeltmesinin kendi regresyonları

`MARQUEE_REPEATS`'i 24→56'ya çıkarıp `ribbon`'un `max-width`'ini kaldırdıktan (§3.d) sonra iki yeni
sorun ortaya çıktı — ikisi de kullanıcının kendi ekran görüntüleriyle bildirdi:

**g) Animasyon aşırı hızlı, okunmuyor hale geldi.**
`translateX(-50%)` her zaman TEK bir `ribbon-seq`'in tam genişliği kadar yol alır. Tekrar sayısı
24'ten 56'ya çıkınca kat edilen mesafe de aynı oranda (~2,3×) arttı, ama `animation-duration`
(22s) sabit bırakılmıştı — yani aynı sürede 2,3× daha fazla mesafe kat ediliyordu, göze çarpıcı
şekilde hızlanmış görünüyordu. Süre de aynı oranda büyütüldü: `22s × (56/24) ≈ 51s`. 1440px ve
2560px'de ölçülen piksel/saniye hızının (~168px/s) artık tutarlı olduğu doğrulandı.

**h) Yeşil şeridin kendisinde ince bir "kesik"/çatlak göründü (metinde değil, renkli bantta).**
Kullanıcı çok yakın bir kırpma ile bunu gösterdi; kendi Playwright/Chromium testlerimde (yazılım
tabanlı headless render) hiçbir şekilde tekrarlanamadı — bu genellikle donanım hızlandırmalı
(GPU) tarayıcılarda çok büyük, döndürülmüş, TEK RENK dolgulu katmanların bazen "tile seam"
(kompozisyon karosu dikişi) adı verilen bir artefaktla karşılaşmasıyla açıklanır. Kök neden
analizi: `ribbon` genişliği `145vw` idi, ama -8° döndürülmüş bir dikdörtgenin kırpma penceresini
(`ribbon-wrap`, en fazla 340px yükseklik) her noktada tam viewport genişliğinde kapsaması için
GEREKEN fazlalık trigonometriyle hesaplanınca sadece `Wt × (1 + (Hc/Wt) × tan(8°)) / cos(8°)`
yani ~%103-106 - `145vw` (%45 fazlalık) gereğinden ~8-10 kat daha büyüktü. Genişlik `120vw`'a
düşürüldü (hâlâ hesaplanan minimumun rahat üzerinde, 390-3840px arası tüm genişliklerde kenar
kaplamasının bozulmadığı ölçülerek doğrulandı) — hem daha küçük bir katman GPU dikiş riskini
azaltıyor hem de kenar kaplaması korunuyor. **Not:** Bu düzeltme sonrası kullanıcıdan henüz kendi
donanımında (asıl "kesik" burada görülmüştü) teyit beklenmektedir; kendi test ortamımızda sorunu
hiç gözlemleyemediğimiz için kör bir doğrulama yapılamadı.

## 4. Diğer düzeltmeler

- **Sayfa kenarlarında beyaz çerçeve:** `(gate)/layout.tsx` `globals.css`'i import etmediği için
  tarayıcının varsayılan `body { margin: 8px }` kuralı hiç sıfırlanmamıştı. `<body style={{margin:0}}>`
  ile giderildi.
- **Tipografi:** Başlık `font-weight:800` (Arial Black benzeri, çok kalın) → self-host General
  Sans `600` (semibold), harf aralığı `-0.015em`. Şerit metni TÜMÜ BÜYÜK HARF + `700-800` ağırlık
  → Title Case + `500` ağırlık (daha ince/zarif); şerit kalınlığı sabit px'ten başlığa oranlı
  bir değere geçirildi (bkz. §3.f).
- **Türkçe çeviriler:** "Launch in" → "Lansmana kalan süre", "Stay Tuned" → "Çok Yakında",
  "About Bollmark" → "Bollmark Hakkında".
- **Başlık metni seçimi:** "COMING SOON" ile "ÇOK YAKINDA" ekran görüntüsüyle karşılaştırıldı —
  ÇOK YAKINDA iki satırda dengesiz duruyordu (ÇOK çok kısa, YAKINDA çok uzun), COMING SOON iki
  satırda da tam genişlikte ve dengeli oturduğu için o kullanıldı.

## 5. Test yöntemi

Playwright (Node, proje bağımlılığı olarak eklenmedi — geçici scratchpad kurulumu) ile:
- Masaüstü (1440px) ve mobil (390px) ekran görüntüleri.
- `getComputedStyle(...).transform` değerinin zaman içinde değiştiği ölçülerek animasyonun
  gerçekten çalıştığı doğrulandı (statik ekran görüntüsü yeterli kanıt değil).
- `prefers-reduced-motion: reduce` emüle edilerek giriş animasyonunun durduğu, marquee'nin
  durmadığı doğrulandı.
- 390/1440/1920/2560/3440/3840/5120px genişliklerde hem `ribbon`'un viewport kenarlarını gerçekten
  aştığı (`getBoundingClientRect().left < 0` ve `.right > viewportWidth`) hem de `ribbon-seq`
  genişliğinin `ribbon` genişliğini her zaman aştığı (marquee boşluk bugı için) doğrulandı.
- Kullanıcının kendi 2K monitöründen paylaştığı ekran görüntüsüyle kenar boşluğu bugı gerçek
  donanımda da doğrulanıp aynı gün içinde düzeltildi.
- ESLint + `tsc --noEmit` her değişiklik turunda temiz geçti.

## 6. Bilinen sınırlamalar / sonraki adımlar

- Sosyal medya linklerinden yalnızca Instagram eklendi (kullanıcı isteğiyle).
- `NEXT_PUBLIC_LAUNCH_DATE` `.env.example` ve `.env.local`'a eklendi, gerçek lansman tarihi
  netleşince güncellenmeli.
- `MARQUEE_REPEATS` (56) ~5100px genişliğe kadar test edildi; bundan daha geniş bir ekran
  (ör. çoklu monitör birleşik genişlik) kullanılırsa tekrar sayısının yeniden gözden geçirilmesi
  gerekebilir.
