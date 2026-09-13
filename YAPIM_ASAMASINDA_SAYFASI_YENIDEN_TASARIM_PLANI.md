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
`ribbon` genişliği `130vw` → `145vw`'ye çıkarıldı, geniş monitörlerde sınırsız büyümesini önlemek
için `max-width:2200px` eklendi (aşağıdaki (d) maddesiyle bağlantılı).

**c) z-index katman sırası çalışmıyordu (şerit her iki satırın da üstünde opak duruyordu).**
Sebep: z-index yalnızca konumlandırılmış (`position:relative/absolute/...`) elemanlarda işlev
görür; ilk versiyonda satırlar `position:static` idi. §2'de anlatılan harf bazlı
`position:relative` + `z-index` çözümüyle giderildi.

**d) Şerit metni bir süre sonra "sağdan bitip" boşluk bırakıyor, sonra dolduruyordu.**
Kök sebep: `ribbon` genişliği `vw` ile (pratikte) sınırsız büyürken, içindeki `ribbon-item`
metninin `font-size`'ı `clamp()` ile bir tavanda sabitleniyordu — yani şerit genişliği bir
noktadan sonra metin genişliğini geçiyordu. 1920px+ monitörlerde ölçülüp doğrulandı
(`seqWidth < ribbonWidth`). Çözüm: `ribbon`'a `max-width:2200px` eklendi VE tekrar sayısı
(`MARQUEE_REPEATS`) 8'den 24'e çıkarıldı. 390px'den 2560px'e kadar test edilip her genişlikte
`seqWidth > ribbonWidth` olduğu (yani sarma anında hiç boşluk kalmadığı) doğrulandı.

**e) Animasyon "durmuş" gibi görünüyordu.**
Kod tarafında `@keyframes csMarquee` + `animation: csMarquee 22s linear infinite` her zaman
doğru çalışıyordu (Playwright ile `transform` değerinin zamanla değiştiği doğrulandı). Kullanıcı
isteğiyle marquee artık `prefers-reduced-motion: reduce` durumunda bile duraklamıyor (yalnızca
başlığın tek seferlik giriş animasyonu erişilebilirlik için bu tercihe uyuyor).

Seamless loop tekniği: `ribbon-track` içinde `ribbon-seq` iki kez ardışık render ediliyor,
track'in toplam genişliği bir `ribbon-seq`'in tam 2 katı, `translateX(0) → translateX(-50%)`
animasyonu bu sayede dikişsiz döngü oluşturuyor (ikinci kopya `aria-hidden`).

## 4. Diğer düzeltmeler

- **Sayfa kenarlarında beyaz çerçeve:** `(gate)/layout.tsx` `globals.css`'i import etmediği için
  tarayıcının varsayılan `body { margin: 8px }` kuralı hiç sıfırlanmamıştı. `<body style={{margin:0}}>`
  ile giderildi.
- **Tipografi:** Başlık `font-weight:800` (Arial Black benzeri, çok kalın) → self-host General
  Sans `600` (semibold), harf aralığı `-0.015em`. Şerit metni TÜMÜ BÜYÜK HARF + `700-800` ağırlık
  → Title Case + `500` ağırlık (daha ince/zarif), şerit kalınlığı (`padding`) `10px → 8px`.
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
- 390/1440/1920/2560px genişliklerde `ribbon-seq` genişliğinin `ribbon` genişliğini her zaman
  aştığı (marquee boşluk bugı için) doğrulandı.
- ESLint + `tsc --noEmit` her değişiklik turunda temiz geçti.

## 6. Bilinen sınırlamalar / sonraki adımlar

- Sosyal medya linklerinden yalnızca Instagram eklendi (kullanıcı isteğiyle).
- `NEXT_PUBLIC_LAUNCH_DATE` `.env.example` ve `.env.local`'a eklendi, gerçek lansman tarihi
  netleşince güncellenmeli.
- Ribbon `max-width:2200px` ile sınırlandığı için çok geniş (ultra-wide, 3440px+) monitörlerde
  şerit artık tam kenardan kenara uzanmayabilir — bu, marquee boşluk bugını önlemek için bilinçli
  bir denge.
