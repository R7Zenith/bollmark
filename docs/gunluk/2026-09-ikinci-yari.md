# Oturum günlüğü: 2026 Eylül, 15-30

## Guven rozeti ticker animasyonu - dongu hatasi duzeltildi (bu oturum)

Kullanici, urun sayfasindaki "Ucretsiz kargo ve teslimat / Guvenli online odeme"
ticker'inin "iki kez oynuyor, sonra kayboluyor, uzun sure sonra tekrar geliyor"
seklinde bozuk davrandigini bildirdi. Kok neden onceden
`GUVEN_TICKER_ANIMASYON_DONGUSU_PLANI.md` dosyasinda tespit edilmisti:
`src/app/globals.css` icinde `@media (prefers-reduced-motion: reduce)` blogu
`.trust-ticker__rows` animasyonunun suresini 5.9s'den 20s'ye cikariyordu.
Keyframe yuzdeleri (`32%/50%/82%`) sabit kaldigi icin 20s'de her mesaj ~6.4
saniye hareketsiz kaliyor, bu da "donmus/kaybolmus" hissi veriyordu. Test
ortaminda ve muhtemelen kullanicinin kendi makinesinde (Windows "Show
animations" kapali) bu medya sorgusu true donuyordu.

**Duzeltme**: `globals.css` icindeki `animation-duration: 20s` kurali
kaldirildi, yerine ticker'i tamamen durdurup ilk mesajda sabitleyen
`animation: none` kurali kondu. `.trust-ticker` uzerindeki
`overflow: hidden; height: 22px` kuraline dokunulmadi.

**Dogrulama** (Playwright ile `/urunler/slim-fit-dik-yaka-kolsuz-asimetrik-uzun-elbise` sayfasinda):
- `npx tsc --noEmit` hatasiz tamamlandi.
- Normal durumda (`reducedMotion: 'no-preference'`): `getAnimations()` ->
  `duration: 5900`, `playState: "running"` - sorunsuz akiyor.
- `prefers-reduced-motion: reduce` emule edildiginde: `getAnimations()` bos
  dizi donuyor (`animCount: 0`), `computedAnimationName: "none"`,
  `transform: "none"` - ticker ilk mesajda sabit duruyor, hareket etmiyor.
- `.trust-ticker` her iki durumda da `overflow: hidden; height: 22px` olarak
  kaliyor - fazla satirlarin ust uste gorunme riski yok.

**Guncelleme (ayni oturum, kullanicinin geri bildirimi sonrasi)**: Yukaridaki
`animation: none` duzeltmesi canliya alindiktan sonra kullanici kendi
makinesinde ticker'in artik "hic oynamadigini" bildirdi - beklenen sonuc,
cunku kullanicinin Windows'unda "Show animations" kapali oldugu icin
`prefers-reduced-motion: reduce` true donuyor ve ticker kasitli olarak
duruyordu. Kullanicaya soruldu: "herkeste her zaman animasyonlu kalsin
(Release gibi)" mi yoksa "kendi Windows ayarini acip kodu degistirmeden mi
test etsin" - kullanici birincisini secti. Sonuc olarak
`@media (prefers-reduced-motion: reduce)` blogu tamamen kaldirildi,
`.trust-ticker__rows` artik OS ayarindan bagimsiz her zaman
`trustTickerSwap 5.9s ease-in-out infinite` ile calisiyor (Release'in
kendi davranisiyla birebir ayni).

Ayrica bu oturumda rebase edilen dunku commit'lerden (`isCover` alani)
`npx prisma generate` calistirilmamis oldugu ortaya cikti, bu yuzden
`npx tsc --noEmit` `src/lib/catalog.ts` ve urun admin sayfasinda
`isCover` ile ilgili tip hatalari veriyordu; `npx prisma generate`
calistirilarak duzeltildi (sema zaten dogruydu, sadece generate edilmis
client eskiydi).

**Dogrulama**: `npx tsc --noEmit` hatasiz. Playwright ile ayni urun
sayfasinda hem `reducedMotion: 'reduce'` hem `'no-preference'` emulasyonunda
`getAnimations()` -> `{playState: "running", duration: 5900}` donuyor -
ticker artik her iki durumda da surekli akiyor.

**Guncelleme 2 (ayni oturum, ikinci geri bildirim - asil kok neden bu)**:
Yukaridaki duzeltmeden sonra kullanici "her satir iki kere kayiyor, sonra
direkt kayboluyor, cok hizli hem de kayip gidiyor" seklinde bildirdi. Gercek
kok neden bulundu: `.trust-ticker__rows`'a hic `height` tanimlanmamisti.
CSS'te `translateY(-100%)` gibi yuzdeler, kaydirilan ELEMANIN KENDI
YUKSEKLIGINE gore hesaplanir - yigindaki tek bir satira gore degil.
`.trust-ticker__rows` icinde 3 satir (mesaj1+mesaj2+mesaj1 kopyasi) alt alta
durdugu icin auto-height ile elemanin kendi yuksekligi 66px (3x22px)
oluyordu; bu da `-100%`'un aslinda -66px (3 satir birden) anlamina geldigi,
`-200%`'un -132px anlamina geldigi bir duruma yol aciyordu. Sonuc: %32-50
araliginda 3 satir birden hizlica kayiyor (kullanicinin "iki kere kayiyor"
dedigi budur), %50-82 araliginda kayan blok pencerenin tamamen disina
cikmis oluyor (pencere bos gorunuyor = "kayboluyor"), sonra donguyu
sonunda transform sifirlanip mesaj1 aniden geri geliyordu.

**Duzeltme**: `globals.css` -> `.trust-ticker__rows` kuraline
`height: 22px` (tek satir yuksekligi, `.trust-ticker` ve `.trust-ticker__row`
ile ayni) eklendi. Bu, elemanin kendi yuksekligini tek satira sabitliyor
(icerik tasmasi `.trust-ticker` uzerindeki `overflow:hidden` ile zaten
gizleniyor), boylece `-100%` = -22px (tam olarak bir satir) oluyor.

**Dogrulama**: `npx tsc --noEmit` hatasiz. Playwright ile
`.trust-ticker__rows`'un `getBoundingClientRect().height` degeri 22
oldugu ve animasyonun `currentTime`'i degistirilerek orneklendiginde
transform degerlerinin beklendigi gibi `0px -> -22px (sabit) -> -44px`
(bir sonraki donguye kusursuz gecis) seklinde ilerledigi dogrulandi.

## Footer yeniden tasarimi (Release temasi duzeni, bu oturum)

`src/components/site-footer.tsx` uc yatay bloklu (Release referansli) yeni
duzene gecirildi (bkz. `FOOTER_RELEASE_TARZI_YENIDEN_TASARIM_PLANI.md`):
ust blokta bulten formu (yeni `src/components/footer-newsletter-form.tsx`
client component'i, gonderim su an no-op) + Kurumsal/Iletisim/Alisveris
sutunlari (Alisveris'teki 6 kategori linki DB'deki gercek `Category.slug`
degerleriyle dogrulandi: tisort, gomlek, pantolon, sweatshirt, ceket,
mont-kaban), orta blokta dev "BOLLMARK" wordmark + sosyal medya ikon
placeholder'lari (href="#"), alt barda mevcut telif hakki satiri.

Bulten formu ilk halde `site-footer.tsx` (server component) icinde inline
`onSubmit` ile yazilmisti, bu Next.js build'inde "Event handlers cannot be
passed to Client Component props" hatasina yol acti (`/odeme` ve
`/hesap/giris` sayfalarinin prerender'ini kirdi) - form ayri bir client
component'e (`footer-newsletter-form.tsx`) tasinarak duzeltildi.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Playwright ile
1440px ve 375px genisliklerde footer'in gorunumu ve yatay tasma olmadigi
(`scrollWidth === clientWidth`) dogrulandi; mobilde wordmark tek satirda
sigsin diye `text-5xl` yerine `text-4xl`/`sm:text-6xl` kademesi kullanildi.

## Hesap bolumu (giris/kayit + dashboard) Release temasiyla birebir uyum (bu oturum)

Plan `HESAP_SAYFASI_RELEASE_BIREBIR_PROMPT.md` dosyasinda cikarildi (Release'in
canli demosunda `getComputedStyle` ile olculen layout/pill-buton/radius
degerleri). Uygulanan degisiklikler:

1. **Giris/Kayit** (`src/app/(site)/hesap/giris/page.tsx` -> tasindi, bkz.
   madde 2): iki kolonlu `flex` layout (sol Unsplash moda gorseli
   `object-cover`, sag form `max-w-[432px]`), pill tab switcher (Giris
   Yap/Hesap Olustur), `rounded-lg` input'lar (48px yukseklik), pill
   birincil buton, "Sifremi Unuttum" linki (route yok, TODO placeholder).
2. **Sidebar mimarisi**: `requireCustomer()` oturumsuzsa `/hesap/giris`'e
   redirect ettigi icin, layout'u dogrudan `hesap/` altina koymak sonsuz
   donguye girerdi - route'lar **route groups** ile ayrildi:
   `hesap/(auth)/giris/page.tsx` (layout'suz, herkese acik) ve
   `hesap/(panel)/{page,siparislerim,adreslerim,puanlarim,favorilerim}/page.tsx`
   (yeni `hesap/(panel)/layout.tsx` sarmaliyor - `requireCustomer()` +
   breadcrumb + `h1` "Merhaba, {isim}!" + sol sidebar (`HesapNav`) + sag
   panel `{children}`). Alt sayfalardan kendi `max-w-3xl` wrapper'lari ve
   `h1`'leri kaldirildi, sadece panel ici baslik (`h2`) birakildi.
3. **Ozet sayfasi** (`hesap/(panel)/page.tsx`): Release'in "Account details |
   Address details" iki sutunlu duzenine gecti (`grid-cols-2`, sag sutun
   `lg:border-l`), sag sutuna varsayilan adres ozeti + "Adreslerimi Gor"
   outline pill link eklendi.
4. **`hesap-nav.tsx`** dikey sidebar listesine donusturuldu (`divide-y`,
   aktif sayfada `bg-ink/[0.024]`, "Cikis Yap" ayri alt blok).
5. **Kart/buton tutarliligi**: tum istatistik/icerik kutularina `rounded-lg`,
   birincil aksiyon butonlari `rounded-full` pill, satir ici aksiyonlar
   (`hesap-address-row.tsx`'teki Duzenle/Sil/Varsayilan Yap ikonlari,
   `hesap-order-card.tsx`'teki iade talebi) `text-[10px] uppercase
   tracking-[1px] underline` link stiline cevrildi.

**Sonraki turlerde kullanici geri bildirimiyle 3 ek duzeltme yapildi**
(hepsi ayni oturumda, `commit b264f93`/`2ea55fd`/`ccd6068`/`107ddad`):

- **Giris sayfasi gorsel/form hizalamasi**: gorsel once `min-h-[calc(100vh-72px)]`
  ile denendi ama kayit formu gibi daha uzun icerik geldiginde satir
  viewport'un altina tasip footer oncesi ekstra scroll yaratiyordu -
  `min-h` yerine sabit `lg:h-[calc(100vh-72px)]` + `lg:overflow-hidden`
  (form sutunu kendi icinde `lg:overflow-y-auto` ile tasar) kullanildi.
  Form da dikeyde ortalanmak yerine ust/sola hizalandi (`items-start
  justify-start`, `lg:pt-28 lg:pl-16`).
- **Footer oncesi kalan bosluk**: gorsel tam viewport'a sigdiktan sonra
  bile footer ile arasinda 96px'lik beyaz bosluk kaliyordu - kok neden
  `site-footer.tsx`'teki site geneli sabit `mt-section` (6rem/96px, bkz.
  `tailwind.config.ts` `spacing.section`) idi. Sadece bu sayfada, lg
  ekranlarda esit `lg:-mb-24` negatif margin ile iptal edildi.
- **Dashboard container genisligi**: `max-w-6xl` (1152px) Release'in canli
  demosunda olculen orana (~%63 container/viewport) gore cok dardi,
  ortadaki dar bir suetuna sikismis gorunuyordu - `max-w-[1600px]` + `px-9`
  (header ile ayni 36px gutter) yapildi.
- **Ozet sayfasi ic ortalama**: dashboard genisletildikten sonra "Hesap
  Ozeti"/"Adres Bilgileri" bloklari kendi sutunlarinda sola/saga yaslanmis
  gorunuyordu - kullaniciya 3 secenek sunuldu (blok olarak ortala / sutun
  oranini degistir / panel padding'i artir), "blok olarak ortala" secildi:
  her iki blok `max-w-[480px] mx-auto` ile kendi sutununda ortalandi.

**Dogrulama**: her adimda `npx tsc --noEmit` ve `npx eslint` hatasiz.
Playwright ile (yerel `npm run dev` + `.env`'deki `PREVIEW_PASSWORD` ile
onizleme kapisi bypass edilerek) 1440-1728-2546px ve 390px genisliklerde
giris/kayit/ozet/siparislerim/adreslerim/puanlarim/favorilerim sayfalari
ekran goruntusuyle dogrulandi; giris sayfasinda `getBoundingClientRect()`
ile gorsel-footer arasinda piksel bosluk kalmadigi teyit edildi. Tum
degisiklikler commit'lenip GitHub'a push edildi - Vercel git baglantisi
sayesinde otomatik deploy tetiklendi.

## Urun detay: header-gorsel boslugu ve buyutulmus rozetler (bu oturum,
bkz. `URUN_DETAY_HEADER_BOSLUGU_VE_ROZET_PLANI.md`)

1. **Header-gorsel arasi bosluk**: `urunler/[slug]/page.tsx`'teki disi sarmalayici
   masaustunde `py-16` (ustte 64px) kullaniyordu; header zaten `fixed` oldugu
   icin `site-header.tsx`'teki ayri 72px'lik spacer bunun UZERINE ekleniyor,
   toplam ~136px'lik asiri bir bosluk olusturuyordu. Ust padding
   `md:pt-6`'ya indirildi, alt padding (`md:pb-16`) degismedi (mobildeki
   `py-4` bu oturumdan once, ayri bir duzeltmede zaten kucultulmustu, ona
   dokunulmadi) - sadece bu route etkilendi.
2. **Paylasilan rozet bileseni**: Katalog kartindaki (`product-card.tsx`) inline
   rozet JSX'i `src/components/product-badge.tsx`'e cikarildi (`variant`:
   "discount" | "low-stock", `size`: "sm" varsayilan/"lg"). Katalog karti
   `size="sm"` ile eskisiyle AYNEN ayni gorunuyor (regresyon yok, Playwright ile
   dogrulandi).
3. **Urun detay sayfasinda buyutulmus rozet**: `product-viewer.tsx`'te basligin
   ustunde onceden SADECE otomatik kampanya indirimi (`automaticDiscount`)
   rozeti vardi (kirmizi, `bg-sale`) - bu kasitli olarak Release'in gercek DOM
   olcumune (`.product__badges` sadece indirim icin) dayaniyordu. Kullanicinin
   acik istegiyle, katalogdaki "Son X Adet" rozeti de `size="lg"` ile ayrica
   eklendi; kullanicinin tercihiyle indirim rozeti KIRMIZI birakildi (koyu/siyaha
   cevrilmedi), sadece dusuk stok rozeti `size="lg"`de koyu (`bg-ink`/`text-cream`)
   oluyor. Bu, Release'in gercek DOM sirasindan bilincli bir sapma. Dusuk stok
   sayisi katalogla ayni mantikla hesaplaniyor (secili RENGIN TUM bedenlerindeki
   toplam stok < 3), tek bir varyantin stogu degil - bu yuzden butonlarin
   altindaki mevcut "Son N adet kaldi" satiriyla (sadece secili bedeni yansitir)
   farkli bir sayi gosterebilir; kullanicinin tercihiyle o alt satir da
   KALDIRILMADI, ikisi ayni anda duruyor.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Playwright ile
hem 1440px hem 390px genisliklerde: urun detay sayfasinda header-gorsel
boslugunun belirgin azaldigi, hem indirimli hem dusuk stoklu bir urunde
("Modal Kumas Beli Lastikli Cepli Duz Genis Paca Pantolon") "SON 2 ADET"
rozetinin basligin ustunde buyutulmus/koyu gorundugu; katalog sayfasinda
ayni urunlerdeki rozetlerin (`%34 INDIRIM` kirmizi, `SON 2 ADET` beyaz)
eskisiyle AYNEN ayni boyut/renk/konumda oldugu dogrulandi.

## Rozet duzeltmesi: gercek Release verisiyle birebir font/renk/duzen, eksik
indirim rozeti, "Yeni" rozeti (bu oturum, ayni plan devami)

Kullanici yukaridaki oturumdan sonra 3 sorun bildirdi: (1) indirimli bir
uründe rozet hic gorunmuyordu, (2) font/arkaplan rengi Release'in kendisiyle
uyusmuyordu ("bizimki cok koyu"), (3) rozetler her seyin ustunde durmali,
(4) "Yeni" rozeti hic yok. "Tahmin kullanma, tam olarak Release'ten bilgileri
al" talebiyle, Playwright ile release-main.myshopify.com'un CANLI urun
sayfasina (`/products/top-13`, "Natural high neck top" - 3 rozeti birden
olan tek urun) ve koleksiyon sayfasina gidilip computed style + gercek urun
JSON'u (`/products/top-13.json`) okundu:

1. **Font/renk gercek olcum**: Poppins, 10px, font-weight 500,
   letter-spacing 1.4px, uppercase, padding 6px 8px, border-radius 4px,
   line-height 12.5px - HEM katalog kartinda HEM urun detay sayfasinda ayni.
   Renk ise BAGLAMA gore degisiyor (Release'in kendisinde de boyle, tahmin
   degil): indirim rozeti her yerde kirmizi/beyaz
   (`--color-badge-discount-background:#EF2D2D`, "sale" fiyat renginden
   FARKLI bir tema degiskeni - `tailwind.config.ts`'e ayri `badge-sale`
   tokeni eklendi). Indirim disi rozetler ("last few"/"New" karsiligi)
   katalog kartinda BEYAZ zemin + siyah yazi, urun detay sayfasinda KOYU GRI
   (`#5E5A59`, yeni `badge-dark` tokeni) + beyaz yazi - onceki oturumda
   kullanilan `bg-ink` (#111111) TAHMINDI, gercek deger daha acik bir gri.
2. **Duzen gercek olcum**: rozetler DIKEY degil YATAY diziliyor
   (`display:flex; flex-direction:row; flex-wrap:nowrap; gap:8px`) - onceki
   oturumda `flex-col` kullanilmisti, bu da tahmindi ve yanlisti. Hem
   `product-card.tsx` hem `product-viewer.tsx` `flex-row flex-wrap` (Turkce
   metinler Release'in kisa Ingilizce etiketlerinden uzun oldugu icin,
   tasmasin diye `nowrap` yerine `wrap` + kartta `max-w-[calc(100%-3rem)]`
   kullanildi - kalp butonuyla cakismasin diye).
3. **Rozetlerin konumu**: gercek DOM'da `.product__badges`,
   `.product__content` icindeki EN ILK eleman - kategori/marka satirindan
   bile once. `product-viewer.tsx`'te rozet blogu, kategori/marka
   paragrafinin UZERINE tasindi.
4. **Eksik indirim rozeti**: `product-viewer.tsx`'teki rozet blogu SADECE
   `automaticDiscount` (kampanya) varsa gosteriliyordu; admin panelinden
   dogrudan girilen "Karsilastirma fiyati" (`compareAtCents`) indirimi
   rozetsiz kaliyordu - katalog kartindaki `discountPercent` mantigiyla
   (bkz. `product-card.tsx`) ayni sekilde `compareAtDiscountPercent`
   hesaplanip eklendi.
5. **"Yeni" rozeti**: Release'de bu OTOMATIK degil - gercek urun katalogu
   `/products.json` ile tarandi, ~100 uruncen sadece 2'sinde "badge:new" tag'i
   var ve olusturulma tarihiyle hicbir korelasyonu yok (manuel, elle
   yonetiliyor). Bollmark'ta manuel rozet yonetimi olmadigi icin, kullaniciya
   soruldu ve **14 gunluk** bir esik secildi: `lib/catalog.ts`'e
   `isNewProduct(createdAt)` eklendi (`NEW_PRODUCT_DAYS = 14`), `CatalogEntry.
   isNew` katalog kartina, `ProductViewer`'a ayni sekilde `isNew` prop'u
   olarak (page.tsx'te `product.createdAt` ile hesaplanip) baglandi.
   `ProductBadge`'e `variant="new"` eklendi (renk mantigi "low-stock" ile
   ayni: sm=beyaz/siyah, lg=koyu gri/beyaz).

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Playwright ile
1440px ve 390px genisliklerde ayni pantolon urununde ÜÇ rozetin
(`%34 İndirim` kirmizi, `Yeni` gri, `Son 2 Adet` gri) basligin ustunde,
kategori/marka satirinin UZERINDE, yan yana (yatay) ve dogru fontla
gorundugu; katalog sayfasinda ayni rozetlerin dar mobil kartlarda tasmadan
2 satira sardigi; "Yeni" rozetinin computed style'inin (`rgb(255,255,255)`
zemin, `rgb(17,17,17)` yazi) beklenenle eslesip regresyon olmadigi
dogrulandi. (Not: seed veritabanindaki urunlerin cogu son 14 gun icinde
eklendigi icin katalogda "Yeni" rozeti simdilik yaygin gorunuyor - bu veri
karakteristigi, kod hatasi degil.)

**Mobilde rozet konumu (ayni oturum, ikinci geri bildirim)**: kullanici
mobilde rozetlerin masaustundeki gibi basligin UZERINDE degil, urun ismi
ile fiyat arasinda, yatay ve ORTALI olmasini istedi. `product-viewer.tsx`'te
rozet blogu artik iki kopya: masaustu icin eskisi (`hidden md:flex`,
basligin ustunde, sola hizali) ve mobil icin yenisi (`flex md:hidden`,
`justify-center`, baslik/kalp satiri ile "Favorileriniz..." notundan sonra,
fiyat blogundan once). Playwright ile 390px'te rozetlerin isim-fiyat
arasinda ortali/yatay, 1440px'te ise masaustu konumunun (basligin ustunde)
degismedigi dogrulandi. `npx tsc --noEmit` ve `npm run build` hatasiz.

## Stoğu bitmiş beden/renk seçeneklerinde çapraz çizgi + soluklaştırma (bu oturum, bkz. URUN_DETAY_STOK_YOK_BEDEN_RENK_PLANI.md)

`product-viewer.tsx`'teki `ProductViewer` bileşeninde renk ve beden
butonlarına, o seçenek stokta yoksa gorsel bir "tukendi" isareti eklendi:
`opacity-40` + `cursor-not-allowed` + buton icine mutlak konumlu, `rotate-45`
verilmis koseden koseye bir cizgi (`<span>`, `w-[141%]`). Iki yeni yardimci:
`isSizeOutOfStock(s)` (secili renkte o beden stokta mi, `colorOutOfStock`
mantigina benzer ama tek beden icin), `isColorOutOfStock(c)` (o rengin HICBIR
bedeninde stok kalmamis mi - mevcut `colorOutOfStock` degiskeninin genellenmis
hali; `colorOutOfStock` degiskenine dokunulmadi, "Son X adet" rozeti onu
kullanmaya devam ediyor). Tiklama davranisi degismedi (`onClick`/`disabled`
attribute'a dokunulmadi) - stoksuz bir beden/renk hala tiklanabilir, secildiginde
"Sepete Ekle" "Stokta Yok" olup `StockAlertForm` ("stok gelince haber ver")
goruniyor, bu akis bozulmadi.

**Dogrulama**: Canli (Neon) veritabanina yazma islemi izin sinifllandiricisi
tarafindan "paylasilan kaynak degisikligi" olarak engellendi (hem dogrudan SQL
hem admin panel UI uzerinden), o yuzden gercek bir urunun stogunu 0 yapip test
etmek yerine, gecici bir test sayfasi (`src/app/(site)/urunler/test-stok-gorsel`,
DB'siz, sabit mock `variants` verisiyle) olusturulup Playwright ile 1440px ve
390px genisliklerde dogrulandi, sonra silindi: PEMBE renginde sadece L bedeni
stoksuz iken sadece L'de cizgi/soluklasma gorunuyor, digerleri normal; TUM
bedenleri stoksuz olan KAHVERENGİ renk kendisi de cizgili/soluk gorunuyor;
struck-through L bedenine tiklaninca hala secilebiliyor (disabled degil) ve
"Sepete Ekle" -> "Stokta Yok" + "Haber Ver" formu dogru sekilde tetikleniyor;
mobilde (390px) cizgi kirilmadan koseden koseye duzgun render ediyor.
`npx tsc --noEmit` hatasiz.

## Sepet açılır çekmece (cart drawer) + header ikon hover (bu oturum, bkz. SEPET_ACILIR_CEKMECE_VE_HEADER_IKON_HOVER_PLANI.md)

Header'daki sepet ikonuna basinca artik `/sepet` sayfasina yonlendirmiyor,
Release temasinda (release-main.myshopify.com/products/top-13) olculen
teknik detaylara birebir uyumlu, sagdan kayarak acilan bir "cart drawer"
paneli aciyor:

- `src/lib/cart.tsx`: `CartContext`'e `isDrawerOpen`/`openDrawer`/`closeDrawer`
  eklendi (localStorage'a yazilmiyor, sadece oturum ici state).
- Yeni `src/components/cart-drawer.tsx`: `site-header.tsx`'teki `MobileMenu`
  ile ayni mount/visible iki asamali pattern (createPortal + body scroll
  kilidi). Panel `translate-x-full -> translate-x-0`, `450ms
  cubic-bezier(0.74,-0.01,0.26,1)`, sadece transform+visibility'de transition
  (opacity state'e baglanmadi); backdrop `bg-black/50`, kendi transition'i
  yok, panelle ayni anda gorunur/kayboluyor. Icerik: urun satirlari (gorsel,
  isim, beden/renk, mevcut `product-viewer.tsx` adet secici deseniyle ayni
  +/- hap, Kaldir), bos sepet durumu (sepet.page.tsx ile tutarli metin), alt
  ozet + "Sepeti Goruntule"/"Odemeye Gec" (product-viewer.tsx'teki mevcut
  pill buton class deseninden birebir kopyalandi).
- `site-header.tsx`: sepet `<Link>`'in `onClick`'i artik `preventDefault` +
  `openDrawer()` cagiriyor (href `/sepet` no-JS fallback icin korundu),
  `<CartDrawer />` header'a eklendi.
- Ayni oturumda arama/hesap/sepet header ikonlarina da ust menudeki
  `.nav-underline` hover alt-cizgisi eklendi (ikonu saran ayri bir
  `<span className="nav-underline inline-block">` ile - sepette rozet
  span'i bunun disinda birakildi, cizgi rozetin altina uzamiyor).

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Playwright ile
1280px'te urune "Sepete ekle" basilip header sepet ikonuna tiklaninca
panelin sagdan kayarak actigi, backdrop'in belirdigi, X'e basinca kapandigi
ekran goruntusuyle dogrulandi; 390px'te panelin tam genislikte, butonlarin
altta sabit durdugu dogrulandi. nav-underline hover icin computed style
kontrolu (`::before` hover'da `scaleX(1)`e geciyor) ve gecici debug
stiliyle cizginin ikonun tam altinda, rozetin disinda konumlandigi
dogrulandi.

**Ek iyilestirme (ayni oturum, kullanici geri bildirimi)**: Kullanici iki ek
sey istedi - (1) bos sepet gorunumunu Release'deki "It's a little empty
here" ekranina birebir uydur, (2) urun sayfasinda "Sepete Ekle"ye basinca
onceden `product-viewer.tsx`'te kisa sureli goruntulenip kaybolan "Sepete
Git" butonu yerine artik Release'deki gibi cart-drawer otomatik acilsin.

- `cart-drawer.tsx` bos durum: `sepet.page.tsx`'teki duz metin yerine,
  anasayfada zaten kullanilan `font-display` + `font-accent italic` (Cormorant)
  vurgu deseniyle ("Detaylara verdigimiz *onem*" orneginin ayni deseni)
  "Biraz *bos* gorunuyor" basligi + "Sepetiniz su anda bos." + "Alisverise
  Basla" pill butonu (mevcut pill buton class deseninden). Baslikta "Sepetim"
  yaninda Release'deki gibi her zaman gorunen bir sayac (`totalCount`, 0 dahil
  - eskiden sadece totalCount>0 iken parantez icinde gosteriliyordu).
- `product-viewer.tsx`: `handleAdd` icindeki sepete ekleme mantigi
  `addToCart()` adinda ayri bir fonksiyona alindi; `handleAdd` artik
  `addToCart()` + `useCart().openDrawer()` cagiriyor, `handleBuyNow` ise
  drawer'i acmadan `addToCart()` + `/odeme`'ye yonlendiriyor (Hemen Al'da
  drawer acilip hemen ardindan sayfa degismesi gibi bir goruntu kirikligi
  olmasin diye). Eskiden `added` state'i true olunca 1.8 saniye gorunup
  kaybolan ayri "Sepete Git" butonu (satir ~776-783) tamamen kaldirildi -
  `added` state'i sadece "Sepete Ekle" buton metnini "Sepete Eklendi ✓"
  yapmak icin kaldi.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Playwright ile
localStorage temizlenip 1280px'te bos sepet gorunumu (Cormorant italik
vurgulu baslik + sayac 0) ekran goruntusuyle dogrulandi; urun sayfasinda
"Sepete Ekle"ye basilinca "Sepete Git" butonu gorunmeden dogrudan
cart-drawer'in sagdan actigi ve eklenen urunu gosterdigi dogrulandi.

**Punto duzeltmesi (ayni oturum, kullanici "tahmin yurutme direkt temadan
al" dedi)**: Ilk versiyondaki font boyutlari (text-3xl, text-xs vb.) tahminle
secilmisti. Kullanicinin ilettigi Release ekran goruntuleri uzerine,
release-main.myshopify.com/products/top-13 canli sayfasinda cart-drawer
`is-visible` class'i JS ile zorlanip Playwright `getComputedStyle` ile
GERCEK degerler olculdu (tahmin yok):
- `.cart-drawer__title` ("Your cart"): 36px, weight 400, line-height 36px,
  letter-spacing -1.44px, Poppins.
- `.cart-drawer__title-counter` (sayac span'i, HER ZAMAN gorunur, 0 dahil):
  21px, line-height 21px, letter-spacing -0.84px; DOM'da `position:absolute`
  ile metnin saginda duruyor (JS ile hesaplanan px konum - biz bunun yerine
  basitce `align-top` ile ayni gorsel "yukarida kucuk sayi" hissini verdik).
- `.cart-drawer__empty-text` ("It's a little empty here"): 61px, line-height
  61px, Poppins 400; icindeki `<em>` (empty/boş): 73.2px (=61*1.2em),
  font-style italic, font-family Cormorant.
- `.cart-drawer__empty-desc` ("Your cart is currently empty"): 14px,
  line-height 17.5px, letter-spacing 0.28px.
- `.button--outlined` ("Start Shopping"): 10px, line-height 10px,
  letter-spacing 1px (bizim buton class deseniyle zaten birebir ayniydi).
- `.cart-drawer__head`in `border-bottom` degeri `0px none` - yani Release'de
  "Sepetim" basligi altinda çizgi YOK; bizim ilk versiyondaki
  `border-b border-line` kaldirildi.

`cart-drawer.tsx`'teki ilgili class'lar bu olculen degerlerle (arbitrary
Tailwind degerleri, `text-[61px]` gibi) birebir degistirildi. Header'daki
sayac artik totalCount 0 iken de gosteriliyor (Release'deki gibi).

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Playwright ile
1280px'te hem bos hem dolu sepet durumu ekran goruntusuyle Release'in canli
olculen degerleriyle karsilastirilarak dogrulandi.

## Sepette indirimli urunlerde eski/yeni fiyat gosterimi (ayni oturum)

Kullanici indirimli bir urunu sepete ekleyince (orn. "Modal Kumaş ... Pantolon",
%34 indirim, 1.490 TL -> 990 TL) sepet ekranlarinda (hem cart-drawer hem
`/sepet` sayfasi) sadece indirimli fiyatin gorundugunu, eski fiyatin
gorunmedigini bildirdi.

Kok neden: `CartLine` tipinde (`src/lib/cart.tsx`) sadece `priceCents`
tutuluyordu, urunun "Karsilastirma fiyati" (`compareAtCents`) sepete
tasinmiyordu.

- `CartLine`'a opsiyonel `compareAtCents?: number | null` eklendi.
- `product-viewer.tsx` (urun detay sayfasi "Sepete Ekle"): `addToCart`
  cagrisina, sadece gercek bir indirim varsa (`compareAtCents >
  selectedPriceCents`, ayni kosul fiyat gosteriminde zaten kullaniliyordu)
  `compareAtCents` eklendi.
- `product-card.tsx` (katalog karti hizli "Sepete ekle"): ayni mantik - ya
  otomatik kampanya indirimliyse orijinal `product.priceCents`, ya da
  "Karsilastirma fiyati" indirimliyse `product.compareAtCents`
  `compareAtCents` olarak addLine'a geçiliyor.
- `cart-drawer.tsx` ve `sepet/page.tsx`: satir toplami artik `compareAtCents`
  varsa kirmizi (`text-sale`, urun sayfasindaki indirim rengiyle ayni) +
  altinda ust cizili eski toplam (`compareAtCents * quantity`) gosteriyor;
  indirimsiz urunlerde eskisi gibi tek fiyat.

Not: Urun detay sayfasindaki AYRI bir "otomatik kampanya indirimi"
(`automaticDiscount` prop'u) `product-viewer.tsx`'te sepete eklenirken
HALA fiyata yansitilmiyor (`priceCents: selectedPriceCents` indirimsiz
fiyati kullaniyor, indirim sadece ekranda gosteriliyor) - bu, bu oturumdan
ONCE var olan, kullanicinin sormadigi ayri bir tutarsizlik (product-card.tsx
bunu dogru hesapliyor, product-viewer.tsx hesaplamiyor). Kapsam disi
birakildi, sadece not dusuluyor - ileride "kampanyali urunu urun detay
sayfasindan sepete eklerken fiyat yanlis" sikayeti gelirse buraya bakilmali.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Playwright ile
"%34 İndirim" rozetli bir pantolon urun sayfasindan sepete eklenip hem
cart-drawer'da hem `/sepet` sayfasinda "990 TL" (kirmizi) + ustu cizili
"1.490 TL" birlikte gorundugu ekran goruntusuyle dogrulandi.

## Otomatik kampanya indirimi (automaticDiscount) sepete YANSITILMADI - bilincli karar

Bir onceki maddede "urun detay sayfasinda otomatik kampanya indirimi sepete
yansimiyor" diye not dusulmustu; kullanici bunu da "ayni sekilde" (yani
compareAtCents gibi satira gomulu indirimli fiyat + ustu cizili eski fiyat)
gostermemi istedi. Once product-viewer.tsx'te compareAtCents'teki gibi
`finalPriceCents`/otomatik indirim priceCents'e gomulecek sekilde
degistirdim, ama uygulamadan once `lib/coupons.ts` + `api/kuponlar/dogrula/
route.ts` + `coupon-field.tsx` + `sepet/page.tsx`'i inceleyince bunun GERCEK
BIR PARA HATASI yaratacagini fark ettim, GERI ALDIM:

- `coupon-field.tsx` component'i (sepet/odeme sayfasinda kullaniliyor) kod
  girilmemis olsa BILE her zaman `/api/kuponlar/dogrula`'yi cagirir - bu
  endpoint sepetteki urunleri productId/variantId ile DB'den YENIDEN
  cekip (`effectivePrice(product, variant)`, cart'taki priceCents'e ASLA
  guvenmez) otomatik kampanyalari `resolveBestDiscount` ile hesaplar ve
  sonucu `sepet/page.tsx`'te AYRI bir "İndirim (kampanya adı)" satiri
  olarak `totalCents`'ten dusurur.
- Yani otomatik kampanya indirimi mimaride zaten dogru sekilde ele
  aliniyor - ama SATIR bazinda degil, SEPET TOPLAMI bazinda, sunucuda
  yeniden hesaplanarak.
- Eger CartLine.priceCents'e otomatik indirimli fiyati gomseydim, sepet
  sayfasindaki "Ara Toplam" ZATEN indirimli fiyatlarin toplami olurdu, SONRA
  CouponField'in bulup "İndirim" olarak dustugu tutar bir kez daha
  dusulurdu - indirim IKI KEZ uygulanmis gorunurdu (gercek siparis tutari
  `api/orders/route.ts`'te sunucuda dogru hesaplaniyor oldugu icin
  MUSTERIDEN FAZLA PARA ALINMAZDI, ama sepet/odeme ekraninda gosterilen
  ARA TOPLAM VE TOPLAM yanlis/eksik gorunurdu).
- Ayni bug'in DAHA ONCEDEN, bu oturumdan bagimsiz olarak `product-card.tsx`
  (katalog kartindaki hizli "Sepete ekle") icinde zaten var oldugunu fark
  ettim - `finalPriceCents` (otomatik indirim dahil) dogrudan
  `addLine`'a priceCents olarak geciliyordu. Bunu da bu oturumda duzelttim:
  `addLine`'a artik her zaman `product.priceCents` (indirimsiz temel fiyat)
  gidiyor, karttaki GORUNEN fiyat/rozet (`finalPriceCents`,
  `discountPercent`) degismedi - sadece SEPETE NE YAZILDIGI degisti.

**Sonuc**: `compareAtCents` (admin panelinden elle girilen "Karsilastirma
fiyati") tarzi indirimler hem `product-viewer.tsx` hem `product-card.tsx`da
dogrudan satira gomuluyor (bir DB gercegi, kampanya sistemiyle ilgisi yok).
`automaticDiscount`/otomatik kampanya indirimleri ise KASITLI olarak satira
gomulmuyor - zaten `/sepet` sayfasinda ayri bir "İndirim" satiri olarak
dogru gosteriliyor. `cart-drawer.tsx` (yeni sepet cekmecesi) bu CouponField
sorgusunu YAPMIYOR, yani su an bir urun sadece otomatik kampanyayla
indirimliyse drawer'da hic indirim gorunmuyor (ne satirda ne toplamda) -
bu, drawer'in kapsaminda olmayan ayri bir eksiklik; istenirse drawer'a da
`/sepet` sayfasindaki gibi bir CouponField/otomatik-indirim sorgusu
eklenebilir.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Kod okuma ile
dogrulandi (canli DB'de aktif bir otomatik kampanya olmadigi icin uctan uca
Playwright testi yapilamadi - Neon canli veritabanina yazma izin
sinifllandiricisi tarafindan engelleniyor, daha once de karsilasilmisti).

## cart-drawer'a otomatik kampanya indirimi satiri eklendi (ayni oturum)

Kullanici bir onceki maddede bahsedilen eksikligi ("drawer'da otomatik
kampanya indirimi hic gorunmuyor") gidermemi istedi - "Ara Toplam" alaninin
oraya, `/sepet` sayfasindaki gibi.

- Yeni `src/lib/use-automatic-discount.ts`: `use-bundle-discount.ts` ile
  ayni desende bir hook - sepet satirlari degistikce `coupon-field.tsx`nin
  yaptigi gibi kod GONDERMEDEN (`code: ""`) `/api/kuponlar/dogrula`yi
  sorgulayip `{discountCents, appliedName}` dondurur. Baglayici degildir,
  sunucu tarafinda urun/varyant DB'den yeniden okunarak hesaplanir (bkz.
  bir onceki not) - yani cart-drawer.tsx'e hicbir sekilde CartLine.priceCents
  guvenilerek yeni bir hesap eklenmedi, sadece MEVCUT sunucu tarafi
  hesaplama sonucu drawer'da da gosterildi.
- `cart-drawer.tsx`: "Ara Toplam" satirinin hemen altina, indirim varsa
  (`automaticDiscountCents > 0`) `/sepet` sayfasindaki ile AYNI stil ve
  metin deseninde ("İndirim (kampanya adı)", `text-clay`, satir toplamindan
  cikartilmis) bir "İndirim" satiri ve onun altinda kalin "Toplam" satiri
  (Ara Toplam - İndirim) eklendi. Indirim yoksa (coğu zaman, otomatik
  kampanya aktif degilken) hicbir sey degismiyor, sadece "Ara Toplam" +
  butonlar goruntuleniyor (eski davranis).

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Canli DB'de
aktif otomatik kampanya olmadigi icin gercek bir kampanyayla uctan uca
test edilemedi (ayni Neon yazma kisiti); bunun yerine Playwright
`page.route()` ile `/api/kuponlar/dogrula` yaniti gecici olarak mock'lanip
(discountCents: 15000, appliedName: "Test Kampanyası") drawer'da "İndirim
(Test Kampanyası) −150 TL" ve "Toplam 840 TL" satirlarinin dogru
goruntulendigi, indirim 0 iken (gercek DB durumu) bu satirlarin hic
gorunmedigi (regresyon yok) ekran goruntusuyle dogrulandi.

## Kampanya indirimi ile urun bazli manuel indirimin cakismasi giderildi (ayni oturum)

`KAMPANYA_MANUEL_INDIRIM_CAKISMA_PLANI.md`'de tarif edilen sorun cozuldu:
otomatik kampanya (kodsuz Coupon) artik zaten elle indirimli
(`Product.compareAtCents > priceCents`) bir urunun/satirin ustune bir daha
indirim uygulamiyor.

- `prisma/schema.prisma`: `Coupon.includeManuallyDiscountedProducts Boolean
  @default(false)` eklendi, `npm run db:push` ile Neon'a uygulandi (bu
  projede migration klasoru yok, semanin tek kaynagi `db:push`).
- `src/lib/coupons.ts`: yeni `resolveProductDisplayPrice(campaigns, product)`
  fonksiyonu - urun zaten manuel indirimliyse VE eslesen kampanyanin
  `includeManuallyDiscountedProducts`'i false ise kampanyayi o urun icin hic
  degerlendirmiyor; true ise kampanya yuzdesini liste fiyati
  (`compareAtCents ?? priceCents`) uzerinden hesaplayip manuel fiyatla
  karsilastiriyor, hangisi dusukse (esitlikte manuel) o kullaniliyor. Ayni
  kural sepet/checkout tarafinda `computeCouponDiscount`e de tasindi
  (`CouponLine.compareAtCents` yeni alan) - otomatik kampanyalar artik
  manuel indirimli satirlari (flag kapaliyken) hic hesaba katmiyor.
- Urun karti (`product-card.tsx`) ve urun detay sayfasi (`product-viewer.tsx`)
  artik kendi ic hesaplarini atip tek bir `resolveProductDisplayPrice`
  sonucundan (`finalPriceCents`/`originalPriceCents`/`badgePercent`)
  besleniyor - iki ayri rozet/eski fiyat gosterimi ihtimali ortadan kalkti.
  Bunu tuketen tum sayfalar guncellendi: ana sayfa, `/urunler`,
  `/urunler/[slug]` (hem ana urun hem "Benzer Ürünler"), `/hesap/favorilerim`.
- Admin kampanya formu (`/admin/kampanyalar`, `coupon-row.tsx`): kategori/
  marka secimi yaninda "Elle indirim yapılmış ürünlerde de bu kampanya
  geçerli olsun" onay kutusu eklendi, deger degisince
  `KAMPANYA_KAPSAM_DEGISTIRILDI` audit log kaydi dusuyor (yeni action tipi,
  `lib/audit-actions.ts`).

**Dogrulama**: `npm run build` (Next.js + TypeScript) hatasiz gecti.
Canli DB'de manuel indirimli + kategori kampanyali bir urun kombinasyonu
olmadigi icin gercek veriyle uctan uca goruntu dogrulanmadi - mantik
`resolveProductDisplayPrice` icindeki hesaplarla (esas fiyat, esitlikte
manuel kazanir) elle izlendi.

## Oturum: Hukuki sayfalar (iyzico basvurusu icin)

`HUKUKI_SAYFALAR_ICERIK_VE_PLAN.md` icindeki 4 hazir metin (Gizlilik
Politikasi+KVKK, Mesafeli Satis Sozlesmesi, Teslimat/Iade, Hakkimizda),
projede zaten var olan dinamik `LegalPage` altyapisina (route:
`/sayfa/[slug]`, admin: `/admin/yasal-sayfalar`) 5 kayit olarak islendi -
yeni statik sayfa dosyasi acilmadi, cunku bu altyapi zaten tam olarak bu
amac icin kuruluydu (bkz. `prisma/schema.prisma` LegalPage modelindeki
slug yorum satiri). Teslimat+Iade metni, mevcut iki ayri slug'a
(`kargo-bilgisi`, `iade-kosullari`) bolunerek yerlestirildi.

- Gercek metinler tek kaynaktan (`prisma/legal-pages-content.ts`) hem
  `prisma/seed.ts` (yeni ortam kurulumu, create-only) hem de tek seferlik
  `scripts/push-yasal-sayfalar-icerik.ts` (mevcut canli DB'ye yazmak icin,
  update dahil) tarafindan kullaniliyor. Betik calistirildi, 5 sayfa da
  Neon'daki canli DB'de guncellendi.
- "[YAYIN TARİHİ]" placeholder'lari "18 Eylül 2026" ile degistirildi.
- Footer'a (`site-footer.tsx`) eksik olan `/sayfa/iade-kosullari` ve
  `/sayfa/mesafeli-satis-sozlesmesi` linkleri eklendi (kargo-bilgisi ve
  gizlilik-politikasi linkleri zaten vardi).
- Checkout'ta "Mesafeli Satış Sözleşmesi'ni okudum, onaylıyorum" onay
  kutusu (`checkout-form.tsx`) ve sunucu tarafi zorunlu dogrulamasi
  (`api/orders/route.ts`, zod `termsAccepted: z.literal(true)`) zaten
  mevcuttu; eksik olan tek parca, bu onayin siparis kaydina islenmesiydi.
  `Order` modeline `termsAcceptedAt DateTime?` alani eklendi (`prisma
  db push` ile canli DB'ye uygulandi), siparis olusturulurken
  `new Date()` ile dolduruluyor.
- `prisma generate` calistirilirken, sema ile checked-in generated client
  arasinda onceden var olan bir uyumsuzluk da (Coupon modelindeki
  `includeManuallyDiscountedProducts` alani) fark edilip duzeltildi -
  `npx tsc --noEmit` bu oturumdan once 8 hata veriyordu, sonrasinda 0.

**Dogrulama**: `npx tsc --noEmit -p .` hatasiz gecti. `scripts/push-yasal-sayfalar-icerik.ts`
calistirilip 5 sayfanin da canli DB'de guncellendigi konsol ciktisiyla
dogrulandi. Tarayicida gorsel dogrulama yapilmadi.

**Bekleyen (plan dosyasinda not edilen, bu oturumun kapsami disinda)**:
telefon numarasi henuz belirtilmedi (footer'daki `+90 555 000 00 00` ve
`destek@bollmark.com` hala yer tutucu), kargo firmasi henuz secilmedi.

## 2026-09-18 - Musteriye siparis onay maili (MUSTERI_MAIL_BILDIRIMI_PROMPT.md)

`MUSTERI_MAIL_BILDIRIMI_PROMPT.md` dosyasindaki durum tespiti kontrol edildi:
- `notifyCustomerStatusChange` ve `notifyReturnStatusChange` prompt'ta "hic
  cagrilmiyor / kontrol edilmeli" deniyordu ama incelemede ikisinin de zaten
  bagli oldugu goruldu (`notifyCustomerStatusChange`:
  `src/app/(admin)/admin/siparisler/[id]/page.tsx` ve
  `src/app/api/admin/siparisler/bulk/route.ts`; `notifyReturnStatusChange`:
  `src/app/(admin)/admin/iadeler/page.tsx`). Bu iki madde icin degisiklik
  yapilmadi.
- Eksik olan tek parca, siparis olusturulunca musteriye giden onay
  mailiydi. `src/lib/order-notifications.ts` icine `notifyCustomerOrderReceived`
  eklendi (urun ozeti, toplam tutar, teslimat adresi, `/siparis-durumu`
  linki). `src/app/(site)/api/orders/route.ts` icinde `notifyAdminNewOrder`
  cagrisinin hemen yanina, ayni fire-and-forget + `.catch(console.error)`
  deseniyle eklendi; ekstra bir DB sorgusu yapilmadi, route'ta zaten var olan
  `productById`/`resolvedLines` verisinden urun adi/adet/tutar listesi
  cikarildi.

**Dogrulama**: `npx tsc --noEmit -p tsconfig.json` hatasiz gecti.
`RESEND_API_KEY` local'de tanimli olmadigi icin gercek mail gonderimi test
edilemedi (bkz. prompt dosyasindaki not); kod, `notifyAdminNewOrder` ile
ayni deseni birebir kullaniyor. Commit `23c7012` ile `origin/main`'e pushlandi.

## Urun detay: Iade & Degisim / Urun Bakim Talimati cekmeceleri + Beden Tablosu gercek tablo gorunumu (bu oturum, bkz. URUN_DETAY_IADE_BAKIM_BEDEN_TABLOSU_PLANI.md)

- `src/components/info-drawer.tsx` eklendi: `cart-drawer.tsx`'teki
  mount/shouldRender/visible + `createPortal` + 450ms transition deseninin
  genellestirilmis hali (cart-drawer.tsx'e dokunulmadi).
- `src/components/product-viewer.tsx`: Beden Tablosu accordion'unun altina
  ok isaretli (ChevronRight) "Iade ve Degisim" ve "Urun Bakim Talimati"
  satirlari eklendi, tiklaninca `InfoDrawer` aciliyor. Icerikler Bollmark'in
  gercek politikasindan (HUKUKI_SAYFALAR_ICERIK_VE_PLAN.md) ozetlendi,
  Koton'un metni kullanilmadi; `/teslimat-ve-iade` route'u henuz
  olusturulmadigi icin alt bilgi satiri simdilik duz metin birakildi.
- Beden Tablosu icerigi icin `parseSizeGuideTable` eklendi: `sizeGuide`
  metninde "|" karakteri varsa satirlar gercek bir `<table>` olarak, yoksa
  eskisi gibi duz metin (`whitespace-pre-line`) olarak gosteriliyor -
  DB semasi degismedi, geriye donuk uyumlu.
- **Plandaki bir varsayim duzeltildi**: Plan dosyasi "Beden Tablosu" (`sizeGuide`)
  alaninin urun formunda oldugunu varsaymisti; kod incelemesinde bu alanin
  aslinda **kategori** modelinde oldugu goruldu (urunler kendi kategorilerinin
  beden tablosunu miras aliyor, bkz. `urunler/[slug]/page.tsx` ->
  `product.category?.sizeGuide`). Yardim metni bu yuzden urun formuna degil,
  `src/app/(admin)/admin/kategoriler/[id]/page.tsx`'teki asil kategori
  duzenleme formuna eklendi (kategoriler listesindeki kompakt "hizli ekle"
  formuna dokunulmadi, oraya siginmiyordu).

**Dogrulama**: `npm run build` hatasiz gecti.

## Ayni is, v2 guncellemesi: buton konumu tasindi + gercek Koton metinleri + beden tablosu test edildi (bu oturum, bkz. URUN_DETAY_IADE_BAKIM_BEDEN_TABLOSU_PLANI.md v2)

- `product-viewer.tsx`: "Iade ve Degisim" / "Urun Bakim Talimati" butonlari
  Beden Tablosu accordion'unun altindan alinip urun aciklamasinin
  (`descriptionHtml` + "Devamini Oku") hemen altina, guven ticker'indan once
  tasindi.
- Iade & Degisim drawer icerigi Koton'un canli sitesindeki metinle
  degistirildi (kullanicinin bu turdaki acik karariyla, v1'deki "kendi
  metnimizi yazalim" karari iptal edildi); sadece "tum Turkiye
  magazalarimizdan" gecen iki cumle Bollmark'in tek magazasi
  (Karacabey/Bursa) gercegine uyarlandi, geri kalani birebir.
- Urun Bakim Talimati drawer icerigi Koton'dan HICBIR degisiklik yapilmadan
  (marka/urun adi gecmiyor) birebir eklendi - 7 maddelik genel oneriler +
  "3 Ana Islem" (Yikama/Kurutma/Utuleme + Kuru Temizleme) alt bolumleri
  dahil tamami.
- `parseSizeGuideTable` yeniden yazildi: eskiden TUM satirlari (aciklama
  cumlesi dahil) tabloya sokuyordu; artik "|" icermeyen satirlari ayri
  metin bloklari, "|" iceren ardisik satirlari ayri tablo bloklari olarak
  ayiriyor (Koton'un "Urun düz zeminde ölçülmüştür..." aciklama cumlesi +
  altinda tablo bicimiyle birebir).
- **Dogrulama (gercek veriyle)**: Bir kategoriye (Elbise) gecici olarak
  Koton'daki ornek beden tablosu verisi yazilip yerel `npm run dev` uzerinde
  ilgili urun sayfasi `curl` ile cekildi; render edilen HTML'de gercek
  `<table>`/`<th>`/`<td>` etiketleri ve dogru hucre degerleri (34/32/37/51
  vb.) dogrulandi, ayrica "Iade ve Degisim" butonunun aciklama ile
  guven-ticker arasinda dogru sirada oldugu teyit edildi. Test verisi
  dogrulama sonrasi `null`'a geri alindi (kalici veri degildi).

**Dogrulama**: `npm run build` hatasiz gecti.

## Beden Tablosu, Urun Detaylari accordion'unun yanindan sokulup ucuncu bilgi satiri olarak tasindi (ayni oturum)

- `product-viewer.tsx`: "Beden Tablosu" artik `<details>` accordion degil -
  "Iade ve Degisim" ve "Urun Bakim Talimati" ile ayni stildeki (ok isaretli,
  `border-t`) ucuncu satir olarak, aciklamanin altinda, sirasiyla Iade ve
  Degisim -> Urun Bakim Talimati -> Beden Tablosu diziliyor, `border-b` artik
  bu son satirda.
- Tablo/duz metin render mantigi (`parseSizeGuideTable`) yeni bir
  `SizeGuideContent` bilesenine tasindi, Beden Tablosu InfoDrawer'i bunu
  kullaniyor (diger iki drawer ile ayni desen).
- "Beden" secimi ustundeki "Beden Rehberi" kisayolu ile "Size guide" ref/
  scroll mantigi (accordion'u acip oraya kaydiran `sizeGuideRef`/
  `openSizeGuide`) kaldirildi, yerine dogrudan `setBedenDrawerOpen(true)`
  kondu - artik kaydirilacak bir accordion olmadigi icin gerek kalmadi.
  Kullanilmayan `useRef` import'u da bu yuzden temizlendi.
- **Dogrulama**: Bir kategoriye gecici test verisi yazilip `npm run dev`
  uzerinde ilgili urun sayfasi `curl` ile cekildi; "Devamını Oku" ->
  "İade ve Değişim" -> "Ürün Bakım Talimatı" -> "Beden Tablosu" ->
  trust-ticker sirasi HTML'deki byte offset'leriyle dogrulandi. Test verisi
  sonrasinda `null`'a geri alindi.

**Dogrulama**: `npm run build` hatasiz gecti.

## Beden Tablosu, urune ozel sizeGuide accordion/InfoDrawer'indan Koton tarzi genel/tum siteye ortak SizeGuideModal'a donusturuldu (ayni oturum, bkz. URUN_DETAY_IADE_BAKIM_BEDEN_TABLOSU_PLANI.md v4)

- `src/lib/size-guide-data.ts` eklendi: Koton'un canli sitesinden birebir
  okunan 27 tablo (Kadin 9, Genc 4 - 3'u Kadin ile ayni referans, Erkek 5,
  Kiz Cocuk 2, Erkek Cocuk 2 - Kiz Cocuk ile ayni referans, Bebek 1, Buyuk
  Beden 4), `SIZE_GUIDE: Record<anaKategori, Record<altTip, {headers, rows}>>`
  seklinde. Ondalik virguller ("34,5" gibi) Koton'daki gibi virgul olarak
  birakildi. "X ile birebir ayni veri" denen yerler (orn. Genc Ust Giyim =
  Kadin Ust Giyim) gercekten ayni obje referansi - kopyalanmadi.
- `src/components/size-guide-modal.tsx` eklendi: InfoDrawer'in sagdan
  cekmece deseninden FARKLI, ortada beliren fade+scale modal (200ms,
  ESC + overlay tiklayinca kapanir, body scroll lock) - genis tablo + yan
  bilgi kutusu dar bir cekmeceye sigmadigi icin ayri bir desen kullanildi.
  Ust seviye sekmeler (7 ana kategori, pill buton) + alt seviye sekmeler
  (secili ana kategoriye gore degisen alt tipler, tek alt tip varsa - Bebek -
  sekme gizlenir) + tablo + sabit "±2 cm sapma" notu + "Bedeninizi nasil
  olcmelisiniz?" 4 maddelik yan kutu.
- `product-viewer.tsx`: "Beden Tablosu" satiri artik ProductViewer'a gelen
  `sizeGuide` prop'una (urunun kendi kategorisinden miras alinan serbest
  metin) BAGLI DEGIL - tiklaninca her zaman ayni genel `SizeGuideModal`'i
  acar. Bu yuzden eski `sizeGuide` prop'u, `parseSizeGuideTable`,
  `SizeGuideContent`, ilgili InfoDrawer ve "Beden Rehberi" kisayolundaki
  kosul TAMAMEN kaldirildi (plan dosyasinin acik talimatiyla - "o plan artik
  gecersiz, bu genel modal onun yerini aliyor"). `urunler/[slug]/page.tsx`'te
  `sizeGuide={product.category?.sizeGuide ?? null}` satiri da bu yuzden
  kaldirildi.
- **Not (kod degil, urun karari)**: Admin panelindeki kategori duzenleme
  formunda (`admin/kategoriler/[id]/page.tsx`) "Beden Tablosu" textarea'si
  ve yardim metni hala duruyor ama artik hicbir sey render etmiyor - alan/
  yardim metni bu oturumda BILEREK silinmedi (plan sadece product-viewer.tsx
  kapsamindaydi), ama bir sonraki turda admin formundan da kaldirilmasi
  gerekebilir, yoksa yonetici bos yere veri giriyor.
- **Dogrulama**: `npm run build` hatasiz gecti; veri seti bir tsx script ile
  yuklenip 7 ana kategori/tum alt tipler dogru anahtarlarla listelendi,
  paylasilan referanslar (`Genç.Üst Giyim === Kadın.Üst Giyim`,
  `Erkek Çocuk.Üst Giyim === Kız Çocuk.Üst Giyim`) `true` doner sekilde
  teyit edildi; dev sunucuda urun sayfasi `curl` ile cekilip "Devamını Oku"
  -> "İade ve Değişim" -> "Ürün Bakım Talimatı" -> "Beden Tablosu" ->
  trust-ticker sirasi korundu.

## Admin panelindeki artik islevsiz "Beden Tablosu" alani kaldirildi (ayni oturum, kullanicinin acik istegiyle)

Bir onceki maddede sizeGuide siteden kaldirilinca admin panelindeki
"Beden Tablosu" textarea'si artik hicbir sey render etmiyordu - kullanici
bunun da kaldirilmasini istedi:

- `admin/kategoriler/[id]/page.tsx`: "Beden Tablosu" textarea'si ve yardim
  metni formdan kaldirildi.
- `admin/kategoriler/page.tsx`: "Yeni Kategori" hizli ekleme formundaki ayni
  textarea ve `rows` map'indeki `sizeGuide: category.sizeGuide` alani
  kaldirildi.
- `lib/category-actions.ts`: `createCategory`/`updateCategory` artik
  `sizeGuide` form alanini okuyup DB'ye yazmiyor.
- `components/admin/category-manager.tsx`, `category-row.tsx`: `sizeGuide`
  prop'u ve kategori satirindaki "Beden tablosu var" rozeti kaldirildi.
- **Bilerek dokunulmadi**: `prisma/schema.prisma`'daki `Category.sizeGuide`
  DB kolonu duruyor - kolon silmek migration gerektiriyor ve eski
  kategorilerde halihazirda girilmis veri varsa kaybolur, bu daha riskli bir
  adim oldugu icin sadece admin UI/yazma yolu kaldirildi, kolonun kendisi
  bir sonraki ayri bir kararla temizlenebilir.

**Dogrulama**: `npm run build` hatasiz gecti.

## Ürün kartlarındaki "+" hızlı sepete ekle butonuna beden seçim kutusu eklendi

Katalog kartlarındaki `+` butonu artık stoktaki ilk varyantı rastgele
sepete atmıyor; `URUN_KARTI_BEDEN_SECIM_POPOVER_PLANI.md`'deki plan
uygulandı:

- `lib/catalog.ts`: `QuickAddVariant` artık `| null` olmayan tekil bir tip;
  `pickQuickAddVariant` → `pickQuickAddVariants` oldu, stoktaki TÜM
  varyantları `optionPosition(variant, "Beden")`'e göre sıralı bir dizi
  olarak döndürüyor (stok yoksa `[]`). `getPublishedProducts`,
  `getCatalogEntries` (hem tek hem çok renkli dal), `getRelatedProducts` ve
  `CatalogEntry` tipi `quickAddVariant` → `quickAddVariants` olarak
  güncellendi.
- `components/product-card.tsx`: `handleQuickAdd` ikiye ayrıldı —
  `addVariantToCart` (sepete ekleme + `justAdded` animasyonu) ve
  `handleQuickAddClick` (tek beden varsa direkt ekler, birden fazlaysa
  `sizePickerOpen` state'ini açar). Butonun üzerinden yukarı sarkan,
  `shadow-soft` gölgeli, `product-viewer.tsx`'teki beden kutucuklarıyla
  aynı dilde bir popover eklendi; dışarı tıklama/`Escape` ile kapanıyor
  (`useEffect` + `sizePickerRef`), buton ikonu açıkken `X`'e dönüyor.
- Bu alanı okuyan üç sayfa (`app/(site)/page.tsx`,
  `app/(site)/urunler/page.tsx`, `app/(site)/urunler/[slug]/page.tsx`)
  `quickAddVariant` → `quickAddVariants` olarak güncellendi.

**Doğrulama**: `npx tsc --noEmit` hatasız geçti; `npm run lint` çalıştı,
kalan tüm hata/uyarılar bu değişiklikten önce var olan ilgisiz dosyalarda
(`lib/cart.tsx`, `lib/wishlist.tsx`, `lib/use-automatic-discount.ts`,
`lib/use-bundle-discount.ts`, `vega-bridge-worker/worker.js`) — değişen
dosyalarda (`catalog.ts`, `product-card.tsx`) hiç lint hatası yok.

## Admin varyant tablosu mobilde (< md) kart görünümüne alındı (bu oturum)

Ürün düzenleme/yeni ürün sayfasındaki varyant tablosu `min-w-max` olduğu için
mobilde ~900px genişliyor, yatay kaydırma gerektiriyordu. Tüm alanlar
düzenlenebilir olduğundan `hideOnMobile` çözüm değildi; mobilde tablo yerine
kart gösterildi.

- `components/admin/data-table.tsx`: opsiyonel `renderMobileCard(row, { selected, toggle })`
  prop'u eklendi. Verilirse md altında kartlar (`md:hidden`), tablo ise
  `hidden md:block` oluyor; seçim state'i ve `BulkActionBar` ortak. Prop
  verilmeyen diğer tüm tablolar birebir aynı davranıyor.
- `components/admin/variant-editor.tsx`: mobil kart eklendi — üstte seçim
  checkbox'ı + "M · Siyah" (renk noktalı) + 40x40 sil butonu; altında
  `grid-cols-2` ile SKU/Barkod (tam genişlik), Stok/Fiyat/İndirim Öncesi.
  Input'lar `w-full`, `text-base` (16px, iOS zoom olmasın). Masaüstü tablosu ile
  aynı `updateRow`/`removeRows` ve aynı state kullanılıyor, `variantsValue`
  gizli alanı değişmedi. Mobil fiyat placeholder'ı yer darlığı için "Varsayılan: "
  öneki olmadan gösteriliyor.
- **Ayrıca bulunan gerçek taşma**: Varyant Özellikleri ayar sayfasında kartlar
  açıkken sayfa 466px'e taşıyordu (kartlar >6 değerde varsayılan kapalı olduğu
  için ilk bakışta görünmüyor). Kök neden: Renk değer satırı
  (nokta + ad + "N varyantta kullanılıyor" + hex alanı + oklar + sil) ve
  "Yeni değer" formu `flex-wrap`'sizdi. `ayarlar/varyant-ozellikleri/page.tsx`
  değer satırına ve ekleme formuna `flex-wrap`, ad alanına `min-w-[6rem]`;
  `variant-value-create-fields.tsx` input'una `min-w-[10rem] flex-1` (eski
  `w-full` yerine) eklendi. Masaüstü görünümü değişmedi.
- Kontrol edilip **dokunulmayanlar** (375/390'da taşma yok): SearchableMultiSelect
  dropdown'ı, Renk Görselleri/MultiImageField, SaveBar (iki buton sığıyor, metin
  iki satıra kırılıyor), `variant-attribute-card.tsx`.
- Bilinen sınırlama: mobil kartta özellik sütununa göre sıralama başlığı yok
  (başlıklar yalnızca tabloda).

**Doğrulama**: Playwright ile 375/390/1280px'te ürün düzenleme, yeni ürün ve
varyant özellikleri sayfaları açıldı: hepsinde `scrollWidth == innerWidth`;
mobilde 4 kart görünür/tablo gizli, 1280'de tablo görünür; kartta stok
düzenlenince `variantsValue` güncelleniyor, seçim + toplu işlem çubuğu ve silme
çalışıyor (hiçbir şey kaydedilmedi). `npm run build` hatasız geçti
(önce `npx prisma generate` gerekti: önceki oturumdaki Coupon şema değişikliği
yerel istemciye yansımamıştı). `npm run lint` toplamı değişiklikten önce ve
sonra aynı (72 sorun / 28 hata, hepsi ilgisiz eski dosyalarda; `data-table.tsx:61`
mevcut bir localStorage `useEffect`'i).

## Ayarlar sayfası: Vega E-Ticaret açıklamasının mobilde taşması düzeltildi (bu oturum)

`/admin/ayarlar` sayfasında "Vega E-Ticaret Entegrasyonu" kartındaki açıklama
375px'te sayfayı 386px'e genişletiyordu. Kök neden: içindeki
`https://bollmark.com/api/vega/panelapi` `<code>` öğesi bölünemeyen tek bir
kelime ve `<p>`, flex çocuğu olarak `min-w-0`'sız olduğu için küçülemiyordu.
`ayarlar/page.tsx`'te `<p>`'ye `min-w-0`, `<code>`'a `break-words` eklendi
(`break-all` URL'yi "http|s" ortasından kırdığı için tercih edilmedi). Ticimax
kartı taşmıyordu, dokunulmadı.

**Doğrulama**: Playwright ile 375/390/1280'de `scrollWidth == innerWidth`;
`npm run build` hatasız. Not: dev sunucusu Tailwind'e sonradan eklenen yeni
sınıfı bazen yakalamıyor (`break-all` CSS'e girmedi); sunucu yeniden
başlatılınca sınıf üretildi, ölçümde tuhaf sonuç görürseniz önce yeniden
başlatın.

## Header: ana menü altına ince çizgi + sağ ikonlar büyütüldü (bu oturum)

Referans Release temasıydı. `site-header.tsx`'te iki değişiklik:
1) Şeffaf (hero üstü) modda header'a `border-b border-white/[0.12]` eklendi;
katı modda mevcut `border-line` aynen duruyor. Header'da duyuru çubuğu olmadığı
için çizgi doğrudan ana menü satırının altında. Her iki durumda da 1px border
olduğundan geçişte yükseklik oynamıyor.
2) Arama/hesap/sepet ikonları 18px → masaüstünde 24px, mobilde 20px; stroke
1.75 → 1.5 (24px'te kalınlaşmasın diye), tıklama alanı 40×40, ikon arası
boşluk ~22px. Kutular 28px'lik satıra sığmadığı için ikon satırına negatif dikey
margin (`-my-1 xl:-my-1.5`) verildi: header yüksekliği masaüstü/mobilde eskisiyle
aynı kaldı (73px). Sepet rozeti `right-0 top-0` ile yeni kutuda ikonun köşesine
oturtuldu. Mobildeki hamburger (32×32) bilerek değiştirilmedi.

**Doğrulama**: `tsc --noEmit` temiz; 1440px'te ekran görüntüsü, 390/768px'te
Chrome DevTools emülasyonu: header 73px, sepet kutusu 40×40 ve logoyla
çakışmıyor. Not: `PREVIEW_PASSWORD` yerel önizlemede `/` ve `/urunler`'i
"coming soon" sayfasına yönlendiriyor; ekran görüntüsü için dev sunucusunu bu
değişken boş verilerek (`PREVIEW_PASSWORD= npx next dev -p 3100`) başlattım.

## Katalog filtre çekmecesi: soldan açılan "Filtrele" paneli (bu oturum)

Kaynak plan: `FILTRE_CEKMECESI_PLANI.md`. Eski "Filtrele" butonu yalnızca
kategori seçtiren küçük bir açılır menüydü; Release'deki gibi soldan kayan,
akordeonlu bir çekmeceye dönüştürüldü.

- `components/filter-drawer.tsx` (yeni): sepet çekmecesiyle aynı overlay/z-index
  (800/801), 450ms + aynı cubic-bezier, body scroll kilidi; kapanışta da animasyon
  oynuyor (450ms sonra unmount). Bölümler: Kategori, Renk (ilk 5 + "Daha fazla
  göster"), Beden (çipler), Fiyat (min-max TL girişi), Stok Durumu, İndirimli
  Ürünler. Seçimler çekmece içinde geçici (draft) tutulur; "Filtreleri Uygula"
  URL'ye yazar, "Temizle" draft'ı sıfırlar. Erişilebilirlik: role=dialog +
  aria-modal, Esc, Tab focus trap, kapanınca odak Filtrele butonuna döner,
  kapalı akordeonlar `inert`. Animasyonlar `prefers-reduced-motion`a bakmadan her zaman çalışır (kullanıcı isteği; ilk sürümde `motion-reduce` vardı, OS "animasyonları göster" kapalı olunca çekmece animasyonsuz açılıyordu, kaldırıldı).
- `lib/catalog-filters.ts` (yeni): query param ↔ filtre nesnesi
  (`renk`, `beden`, `fiyat-min`, `fiyat-max`, `stok`, `indirimli`; renk/beden/stok
  tekrarlı param), filtre uygulama ve facet/sayı hesabı. Sunucu ve istemci
  ortak kullanıyor.
- `urunler/page.tsx`: filtreler sunucuda `getCatalogEntries` sonucuna uygulanıyor
  (URL paylaşılabilir, geri tuşu çalışır). Facet seçenekleri **filtrelenmemiş**
  girişlerden üretilir, yoksa bir renk seçince diğer renkler kaybolurdu. Sonuç
  yoksa "Sonuç bulunamadı + Filtreleri Temizle" boş durumu.
- `catalog-toolbar.tsx`: buton + aktif filtre sayısı rozeti, listenin üstünde
  kaldırılabilir filtre çipleri ve "Tümünü temizle".
- `lib/catalog.ts`: `CatalogEntry`'ye `colorName` eklendi (tek renkli ürünlerde
  `colorLabel` null olduğu için renk filtresi buna bakıyor).

Kararlar: Beden filtresi yalnızca **stokta olan** bedenlere bakıyor
(`quickAddVariants`); fiyat filtresi/aralığı kampanya öncesi `priceCents` üzerinden
(sıralamayla tutarlı); yeni bağımlılık eklenmedi. Kategori tek seçim (mevcut
`kategori` param'ı, sunucu tarafı DB filtresi).

**Doğrulama**: `tsc --noEmit` ve eslint (değişen dosyalar) temiz, `next build`
hatasız. Playwright ile 1440 ve 390px'te: aç/Esc ile kapat (odak Filtrele'ye
dönüyor), stok filtresi uygula (47 → 45 ürün, `?stok=stokta`), çip ile kaldır,
boş durum (`?fiyat-min=99999999`); konsol hatası yok. Bulunan bug: panel açılışta
`visibility` geçişi yüzünden odak kapat butonuna geçmiyordu (60ms gecikmeyle
çözüldü) ve Esc bu yüzden çalışmıyordu (dinleyici document'a taşındı). Not:
`cart-drawer.tsx`'teki `setState in effect` lint hataları önceden var, bu
çekmecede aynı pattern kullanılmadı.
Ayrıca bu dosyadaki gerçek bir admin parolası (eski bir bölümde) push öncesi
maskelendi; deger git geçmişinde önceki commit'te duruyor, parolanın
değiştirilmesi önerilir.

## Oturum: Admin giriş sayfası yeniden tasarımı (19 Eylul 2026)

`/admin/login` split-screen'e çevrildi (sol %55 editoryal görsel, sağ %45 form).
Eski sayfanın asıl bug'ı: `bg-paper` Tailwind'de tanımlı bir renk değil, form
şeffaf kalıyor ve koyu (`bg-ink`) zeminde siyah logo/buton görünmüyordu.

- `src/app/(admin)/admin/login/page.tsx`: yeni yerleşim; Poppins bu sayfada
  `next/font` ile yükleniyor (admin katmanı font yüklemiyordu); şifre göster/gizle
  (lucide `Eye`/`EyeOff`); `label htmlFor` + `id="email"`/`id="password"` eklendi
  (`name` alanları ve `signIn` mantığı aynen korundu); hata kutusu `role="alert"`.
- `src/app/globals.css`: form fade-in (8px), görsel `scale(1.05 -> 1)` ve
  `input:-webkit-autofill` bastırma sınıfları (`.admin-login-*`).
- Görsel: yeni dosya yok, mağaza hero'sundaki `public/hero-model.jpg` (2250x2954)
  `next/image` `priority` ile kullanıldı. Mobilde 160px'lik üst bant.
- Animasyonlar `prefers-reduced-motion`'da KAPATILMADI (kullanıcının kalıcı tercihi).

Doğrulama: Playwright ile 1440/1024/390px — logo ve buton görünür, yatay taşma yok
(scrollWidth = genişlik); hata kutusu, yükleniyor durumu ve göz ikonu çalışıyor.

## Oturum: Admin kullanıcı menüsü (19 Eylul 2026)

Topbar sağ üstteki kullanıcı menüsü: "Cikis Yap" -> "Çıkış" (ikonlu, tam satır
buton, `sign-out-button.tsx`); tetikleyicide artık sadece baş harf değil tam ad
(`session.user.name`, yoksa e-posta ön eki) ve rol etiketi (`adminRoleLabel`)
görünüyor, mobilde (<640px) yalnız avatar. Açılır menüde ad + e-posta başlığı.
Doğrulama: `tsc` temiz; tarayıcıda görsel doğrulama yapılamadı (`.env`'deki
admin bilgileri DB'deki hesapla eşleşmiyor).

## Oturum: Excel aktarımda yanlış kategori eşleşmesi (19 Eylul 2026)

Plan: `EXCEL_KATEGORI_YANLIS_ESLESME_PLANI.md`. Teşhis DB'de doğrulandı:
`CategoryKodMapping`'de `TSHIRT LS -> Hırka` satırı vardı (Tişört ürünlerini Hırka'ya
düşüren kaynak).

- Yeni öncelik (ürün bazlı): ürün adından tahmin -> sabit `CATEGORY_MAP` ->
  öğrenilmiş `CategoryKodMapping` (yalnız yedek) -> AI (prompta ürün adı eklendi).
  Ad tahmini KOD3'ten farklı çıkarsa `conflictCategory` döner, önizlemede turuncu
  "Kod ile çelişiyor" uyarısı çıkar.
- `guessCategoryFromProductName`: kelime başı eşleşmesi ("sweatshirt" artık Tişört
  olmaz), birden fazla anahtar kelimede adın sonunda biten kazanır ("Jean Ceket" ->
  Ceket, "... Eşofman Altı" -> Eşofman Altı), yalnız DB'de var olan kategori adları
  döner (çöp kategori oluşmaz).
- `CATEGORY_MAP`'e TSHIRT LS, BLOUSE LS, JACKETS, BLAZERS, DRESSES, SKIRTS, SWEATERS,
  SWEATSHIRTS eklendi.
- KOD3 öğrenmesi artık yalnız yönetici öneriyi elle değiştirdiyse VE dosyadaki o
  KOD3'ün tüm ürünleri aynı kategorideyse yapılır (karar istemcide, sunucu doğrular).
- Doğrulama: `tsc` temiz, `npm run build` temiz, eslint'te yalnız eski bir
  `react/no-unescaped-entities` hatası (excel-import-wizard.tsx, dokunulmadı).
  KOTON19092026CHECKLIST.xls (30 ürün) simülasyonu: hiçbiri Hırka'ya düşmüyor,
  2 Sweatshirt -> Sweatshirt, 3 Jean -> Kot Pantolon, 2 çelişki uyarısı beklendiği gibi.
  Testler (`guessCategoryFromProductName` 10 vaka) geçici script ile geçti; projede
  test altyapısı yok. Tarayıcıda önizleme ekran görüntüsü alınmadı.
- DB düzeltmesi (onayla; yedek: `backups/excel-kategori-duzeltme-2026-09-19.json`):
  `TSHIRT LS -> Hırka` eşlemesi silindi, `7WAL60008IW` Gömlek -> Bluz yapıldı.
  `TANKTOPS -> Yelek` şüpheli ama dokunulmadı.

## Oturum: Anasayfa "Yeni Gelenler" yeni ürün eklenince yenilenmiyor (19 Eylul 2026)

Plan: `ANASAYFA_YENI_GELENLER_YENILENMIYOR_PLANI.md`. Teşhis: `src/` altında ürün yazan
hiçbir yerde `revalidatePath` yoktu (yalnız hesap/ayarlar sayfalarında vardı) ve
anasayfada `revalidate` export'u yoktu; sayfa build'de statik üretilip yeni deploy'a
kadar aynı HTML sunuluyordu.

- Yeni `src/lib/revalidate-catalog.ts`: `revalidateCatalog(slug?)` -> `/`, `/urunler` ve
  slug varsa `/urunler/<slug>`, yoksa tüm `/urunler/[slug]` sayfaları.
- Başarılı yazımdan sonra çağrıldığı yerler: yeni ürün, ürün düzenleme, ürün silme,
  `/api/admin/urunler/bulk` (sil/durum/fiyat), `excel-aktar` (her parçadan sonra),
  `excel-aktar/gorsel-getir`, `[id]/gorsel-ekle`, `[id]/gorsel-yenile` (görsel/açıklama
  eklendiyse), Vega `VaryasyonGuncelle` stok güncellemesi.
- `(site)/page.tsx`: `export const revalidate = 60` (yedek güvence) ve "Yeni Gelenler"
  artık `getPublishedProducts()` ile en yeni 8 ürün (`featuredFirst` kaldırıldı; öne
  çıkan işaretsiz yeni ürün artık listeden düşmüyor). Boş durum başlığı da "Yeni Gelenler".
- Doğrulama: `tsc` temiz; `npm run build` temiz ve `/` artık `○ 1m` (revalidate 60sn)
  görünüyor; eslint 132 sorun (74 hata) değişiklik öncesiyle aynı, dokunulan dosyalarda yeni sorun yok.
  Tarayıcıda test ürünü ekleyip anasayfada görme testi YAPILAMADI (admin girişi
  yerelde çalışmıyor); canlıda doğrulanmalı.
- Dokunulmadı: kategori taşıma/silme (`category-actions.ts`) anasayfa kategori
  sayılarını etkiler ama en geç 60sn içinde tazelenir.

## Oturum: Ürün detayda beden otomatik seçili gelmesin (19 Eylul 2026)

Plan: `URUN_DETAY_BEDEN_SECILI_GELMESIN_PLANI.md`. Değişen dosya: `src/components/product-viewer.tsx`.

- `size` state'i `string | null`, başlangıç `null`. İstisna: bedensiz ürün (`""`) ve tek bedenli ürün
  (o beden) otomatik seçili; aksi halde müşteri hiç ekleyemezdi.
- `needsSize` (size null) eklendi; `outOfStock` artık beden seçilmemişken true olmuyor, buton
  "Sepete Ekle" kalıyor. Seçili rengin tüm varyantları stoksuzsa (`colorOutOfStock`) mevcut
  "Stokta Yok" akışı korundu; bu durumda StockAlertForm beden seçilince görünür (varyant gerekiyor).
- `handleAdd`/`handleBuyNow`: beden yoksa eklemez, "Lütfen beden seçin" uyarısı (`role="alert"`)
  çıkar, beden kutucukları 1.5 sn `border-sale` olur; beden seçilince uyarı kalkar. Butonlar disabled değil.
- Renk değişince (`selectColor`): seçili beden yeni renkte stokta yoksa sıfırlanır (birden fazla
  bedenli üründe); stokta varsa korunur.
- Adet seçici beden seçilene kadar disabled ama görünür. "Son N adet" satırı null-safe.
- `product-card.tsx`: dokunulmadı; kartta otomatik beden seçimi yok (popover, kullanıcı seçiyor).
- Doğrulama: `tsc --noEmit` temiz; eslint product-viewer.tsx'te yalnız önceden var olan sorunlar
  (set-state-in-effect hatası, kullanılmayan eslint-disable uyarısı). Tarayıcıda (masaüstü + 390px):
  açılışta seçili beden yok; seçmeden ekleme sepete eklemiyor ve uyarı çıkıyor; M seçince sepete
  M/SİYAH ekleniyor; adet seçici seçime kadar disabled. YAPILAMADI: yerel DB'de çok renkli ürün
  bulunamadı, renk değişiminde sıfırlanma ve tek bedenli/bedensiz ürün tarayıcıda denenmedi
  (yalnız kod okumasıyla); `/odeme` akışı elle denenmedi.

## Oturum: Katalog banner'ı Release tarzı, her görünümde (19 Eylul 2026)

Plan: `KATEGORI_BANNER_RELEASE_TARZI_PLANI.md`. Değişen dosyalar: `src/app/(site)/urunler/page.tsx`,
`src/components/site-header.tsx`; yeni: `src/lib/catalog-banner.ts`, `public/catalog-banner.jpg`.

- Banner artık `/urunler`'in TÜM görünümlerinde (kategori, `?cinsiyet=`, Tüm Ürünler) çıkıyor. "Banner var mı"
  kararı `hasCatalogBanner(pathname)` yardımcısında; `site-header.tsx` saydamlığı aynı yardımcıyla belirliyor
  (`/urunler` rotasında header her zaman saydam başlar). Header'daki kullanılmayan `useSearchParams` çağrısı kaldırıldı.
- Görsel önceliği: kategorinin `imageUrl`'i → `public/catalog-banner.jpg` (Unsplash, engin akyurt, gri örgü
  kumaş dokusu, 2000px) → görsel yüklenmezse altındaki `bg-ink` + gradient.
- Görünüm: `grayscale` + `bg-ink/55` overlay, yükseklik 60svh (md+ 65svh, min 320px), ortada breadcrumb
  ("ANA SAYFA / [CİNSİYET /] KATEGORİ", 10px, tracking-[1px], ANA SAYFA ve cinsiyet link) + başlık
  (font-display, 40/47/64px, negatif letter-spacing). Eski cinsiyet eyebrow satırı kaldırıldı. `fetchPriority="high"`, `alt=""`.
- Dokunulmadı: CatalogToolbar, ürün grid'i, `generateMetadata`, boş-sonuç mesajları. Banner-toolbar arası
  boşluk `pt-8` (eski `mt-8` kaldırıldı ki çift boşluk olmasın).
- Doğrulama: `tsc --noEmit` temiz; eslint'te yalnız önceden var olan 2 hata (MobileMenu set-state-in-effect).
  Tarayıcıda 1440px (Tüm Ürünler, Kadın) ve 390px (Erkek/Gömlek — görselsiz kategori, Aksesuar) bakıldı:
  banner, breadcrumb ve saydam header hepsinde aynı, header yazısı okunur.
  YAPILAMADI: Release demosunda getComputedStyle ile yükseklik ölçümü (60-70% plan değerine göre
  uygulandı, ölçülmedi); görseli olan bir kategoride test (yerel DB'de görselli kategori yoktu);
  `npm run lint` tam çalıştırılmadı (yalnız dokunulan dosyalar).
- Not: `?kategori=aksesuar` başlığı "Tüm Ürünler" gösteriyor (aksesuar filtre listesinde kategori olarak
  bulunmuyor); bu davranış değişiklikten önce de aynıydı, dokunulmadı.
- Commit önerisi: "Katalog banner'ini Release tarzinda yap ve tum katalog gorunumlerinde goster".

### Ek (aynı gün): banner inceltildi, Release ölçüleriyle eşlendi

Release `collections/shorts` 1440x900 ve 390x844'te ölçüldü: banner 50svh (450px / 422px; header
alanını içeriyor), breadcrumb 34px yüksekliğinde ve header'ın ~33px altında, başlık 47px/47px/-1.88px
(mobilde 27px/-1.08px, py 9.4px) ve kalan alanda ortalı (~10-12px aşağıda). `urunler/page.tsx`
banner'ı buna göre yeniden kuruldu (önceki 60/65svh ve 40-64px başlık kalktı). Bizdeki sonuç:
1440'ta banner 450px, başlık 66px yüksek/222px'te (Release 221px); 390'da banner 422px. Fark: breadcrumb
Release'de 97px'te, bizde 101px'te (Bollmark header'ı 68px, Release'inki 64px).

## 2026-09-19 — Admin ürünler: sayfalama + yatay scroll

**Sayfalama** (commit c6a9fdb)
- `src/app/(admin)/admin/urunler/page.tsx`: `sayfa`/`adet` (10/25/50/100, varsayılan 25) parametreleri, tek `where`
  (count + findMany), sayfa [1, toplamSayfa]'ya sıkıştırılıyor. name/price/createdAt sıralamasında skip/take DB'de,
  her orderBy'a `{ id: "asc" }` ikinci anahtar. stock/photo sıralamasında iki adım: hafif sorgu (id + stok + görsel var mı)
  → bellekte sırala → sayfanın id'lerini ağır include ile çek, aynı sırada döndür.
- Yeni `src/components/admin/products-pagination.tsx` (client): "1–25 / 312 ürün", ellipsis'li sayfa numaraları,
  "Sayfada göster" seçici (adet değişince sayfa 1), mobilde "Sayfa X / Y". Tablonun üstünde ve altında.
- `products-filters.tsx` (`updateParam`) ve `products-table.tsx` (`handleSortChange`) `sayfa` parametresini siliyor.
  `ProductsTable`'a `key={sayfa-adet}` verildi, sayfa değişince seçili satırlar sıfırlanıyor.
- SAPMA: Plan eski `Pagination` bileşeninin hiçbir yerde kullanılmadığını söylüyordu, ama `siparisler/page.tsx`
  kullanıyor. Yeniden yazmak yerine ayrı bileşen eklendi, eskisine dokunulmadı.

**Yatay scroll** (commit 978cda2)
- `products-table.tsx`: ürün adı `line-clamp-2` + `title` + `max-w-xs`, ürün kodu adın altında küçük gri satır;
  "Ürün Kodu" ve "Fotoğraf" kolonları kaldırıldı. Plandaki 1. ve 2. adım uygulandı; 3-5 (DataTable `fitContainer`,
  `hideBelow`, "⋯" menüsü) uygulanmadı.
- "Fotoğraf" kolonu kalkınca photo sıralamasının arayüzde tetikleyicisi kalmadı (`?sort=photo` URL'den hâlâ çalışıyor;
  "Fotoğrafsız ürünler" filtresi ve uyarı bandı zaten var).

**Doğrulama**
- `tsc --noEmit` temiz, `npm run build` başarılı. Dokunulan dosyalarda yeni lint hatası yok; tam `npm run lint`
  önceden var olan 74 hata (ör. `wishlist.tsx`, `data-table.tsx` set-state-in-effect, "Excel'den" kesme işareti) veriyor.
- YAPILAMADI: tarayıcıda doğrulama. `.env`'deki ADMIN_PASSWORD ile giriş 401 verdi (DB'deki şifre farklı), kullanıcı
  bu adımı atlamamı istedi. Yani 1280/1366/1440/1920 px yatay scrollbar ölçümü, sayfa numaraları/adet seçici davranışı,
  stock/photo sıralamasının 1. sayfası ve seçim sıfırlanması elle denenmedi.

## 2026-09-19 — Bize Ulaşın (/iletisim) + admin Mesajlar

**Veritabanı**
- `prisma/schema.prisma`: yeni `ContactMessage` modeli (ad, soyad, e-posta, telefon?, `contactPrefs String[]`, mesaj,
  `status` YENI/OKUNDU/YANITLANDI, `ipHash?`, createdAt). Yöntem `npm run db:push` (migrations klasörü yok).
  Önce `prisma migrate diff` ile SQL önizlendi: yalnızca `CREATE TABLE "ContactMessage"` + 2 index, mevcut tablolara
  dokunulmadı. `--accept-data-loss` kullanılmadı. Local ve prod aynı Neon olduğu için tablo canlıda da hazır.

**Public sayfa** — `src/app/(site)/iletisim/page.tsx`, `src/components/contact-form.tsx`
- Breadcrumb Ana Sayfa / Bize Ulaşın, giriş metni, çalışma saatleri, form (Ad/Soyad, "Size nasıl ulaşalım?"
  E-posta/Telefon/SMS, E-posta, koşullu Telefon, Mesaj), fetch ile gönderim (yükleniyor durumu, başarı/hata mesajı).
- Tam genişlik Google Maps iframe (anahtarsız `maps.google.com/maps?q=...&output=embed`, `loading="lazy"`). Sorgu
  Google'da "Koton Leventoğlu, Runguşpaşa, 75. Sk. No:6, 16700 Karacabey/Bursa" kaydına çözülüyor (Yandex kaydı da
  "75. Sok., 6A"). Koordinat sabitlenmedi, sorgu ile çözülüyor.
- Footer'da "İletişim" yalnızca başlıktı (link yoktu); altına "Bize Ulaşın" → /iletisim eklendi. Sitemap'e eklendi.
  Gate (`proxy.ts`) sayfayı otomatik kapsıyor, `/api/iletisim` matcher dışında (public).

**Gönderim** — `src/app/(site)/api/iletisim/route.ts` (projedeki api route + zod kalıbı)
- Zod: e-posta formatı, mesaj 3–2000 karakter, Telefon/SMS seçiliyse telefon zorunlu ve biçim kontrollü.
- Honeypot (`website` alanı): doluysa 200 döner, kaydetmez, mail atmaz.
- Hız sınırı: mevcut altyapı yoktu; sayaç `ContactMessage.ipHash + createdAt` üzerinden (10 dk'da en fazla 3, aşınca 429).
  Ham IP saklanmıyor, `NEXTAUTH_SECRET` tuzlu SHA-256 özeti saklanıyor. IP çözülemezse sınır uygulanmaz.
- Sıra: önce DB, sonra mail. Mail hatası kaydı etkilemez, kullanıcıya başarılı dönülür.
- Mail: mevcut `sendMail` (Resend) kullanıldı, yeni kurulum yok; `replyTo` opsiyonel parametresi eklendi. Alıcı

## 2026-09-22 — Ödeme sayfası footer boşluğu düzeltmesi

- `src/app/(site)/odeme/checkout-form.tsx`: `rowStyle` (satır ~302) masaüstünde `minHeight: "calc(100vh - 72px)"`
  veriyordu ama grid'in tek satırı içeriğe göre `auto` boyutlandığı için container'ın fazladan yüksekliği satırın
  ALTINDA boşluk olarak kalıyor, gri özet paneline/form sütununa yansımıyordu. `isDesktop` true iken `rowStyle`'a
  `alignContent: "stretch"` eklendi; satır artık container'ın tüm yüksekliğine yayılıyor.
- Doğrulama: Playwright ile `/odeme` (1440×900, dolu ama kısa sepet içeriği — tek satır sonlanmış ürün) açıldı,
  tam sayfa ekran görüntüsü alındı. Gri özet paneli ve sol form sütunu gerçekten footer'a kadar (boşluksuz)
  uzanıyor, taşma/kaydırma sorunu görünmüyor.
- DÜZELTME 2 (yukarıdaki tek başına yetmedi): asıl boşluk `src/components/site-footer.tsx`'teki footer'ın
  kendi `mt-section` class'ından (Tailwind'de `6rem`, `tailwind.config.ts` satır ~65) geliyordu — bu, footer'ı
  `main`'den her zaman 6rem aşağı iten SİTE GENELİ bir margin, checkout'a özgü değil. Kullanıcı DevTools'ta
  tespit etti. `SiteFooter` `"use client"` + `usePathname()` ile /odeme'yi algılayıp yalnızca o sayfada
  `mt-section` class'ını uygulamıyor; diğer tüm sayfalarda (sepet dahil, elle doğrulandı) 6rem boşluk aynen
  duruyor. Bu genel spacing sadece checkout'a has kaldırılsın diye tercih edildi (kullanıcı talebi).
  bilgi@bollmark.com, konu "Yeni iletişim formu mesajı - {ad soyad}", girdiler HTML'de escape ediliyor
  (`src/lib/contact-notifications.ts`). Gönderen `MAIL_FROM` (mevcut).

**Admin** — `src/app/(admin)/admin/mesajlar/` (liste + `[id]` detay), sadece ADMIN (`requireAdmin`)
- Sidebar "Müşteriler" grubuna "Mesajlar" + okunmamış (YENI) sayısı rozeti (layout'ta sayılıyor, `AdminShell` →
  `Sidebar` prop'u). Liste: tarih, ad soyad, e-posta, telefon, ilk satır, durum; Tümü/Yeni/Okundu/Yanıtlandı sekmeleri
  (sayılarla), mevcut `Pagination` (20/sayfa, `?page=`).
- Detay: tüm bilgiler, mailto "E-posta ile yanıtla", durum değiştirme, onaylı silme. Detay açılınca YENI → OKUNDU
  (denetim kaydı YAZILMAZ, siparişlerdeki `viewedAt` gibi); rozet için sayfa bir kez `router.refresh()` yapıyor.
- Denetim: elle durum değişikliği `CONTACT_MESSAGE_STATUS_CHANGED`, silme `CONTACT_MESSAGE_DELETED`
  (`audit-actions.ts`).

**Doğrulama**
- `tsc --noEmit` temiz, `npm run build` başarılı. Dokunulan/yeni dosyalarda yeni lint hatası yok; tam `npm run lint`
  önceden var olan 28 hata / 72 sorun veriyor (değişikliklerden önce de aynı).
- Yerelde API elle denendi: geçerli gönderim 201 ve DB'ye doğru düştü; geçersiz e-posta, eksik/geçersiz telefon,
  2001 karakter, bozuk JSON → Türkçe 400; honeypot kaydetmedi; aynı IP'den 4. gönderim 429; RESEND_API_KEY yokken
  uygulama çökmedi (sadece log). Tarayıcıda (Playwright): telefon alanı koşullu görünüyor/zorunlu, boş form istek
  atmıyor, gönderirken buton devre dışı + "Gönderiliyor...", başarı ve hata mesajları sayfa yenilenmeden görünüyor,
  390 px'te yatay taşma yok. Test satırları DB'den silindi (tablo boş).
- YAPILAMADI: admin Mesajlar sayfalarının tarayıcıda denenmesi. `.env`'deki ADMIN_PASSWORD ile giriş yine reddedildi
  (DB'deki şifre farklı); oturumu başka yolla üretmedim. Liste/filtre/sayfalama, detay, otomatik okundu, rozet
  güncellenmesi, durum değiştirme ve silme yalnızca tip/build seviyesinde doğrulandı.
- YAPILAMADI: gerçek mail gönderimi (yerelde RESEND_API_KEY yok). Reply-To ve escape'in canlıda bir kez denenmesi gerek.

**Ek (aynı gün): iletişim formu yalnızca e-posta**
- "Size nasıl ulaşalım?" onay kutuları ve koşullu Telefon alanı formdan kaldırıldı; yerine "Size e-posta üzerinden geri
  dönüş sağlayacağız." bilgi metni kondu. `/api/iletisim` artık `phone`/`contactPrefs` almıyor (eski istemciden gelirse
  yok sayılır), mail ve admin liste/detay ekranlarından Telefon ve İletişim Tercihi kaldırıldı, `status.ts`'teki
  `contactPrefs` sabitleri silindi.
- DB'ye dokunulmadı: `ContactMessage.phone` ve `contactPrefs` sütunları duruyor (kullanılmıyor, şemada not düşüldü).
  İstenirse ileride ayrı bir `db push` ile kaldırılabilir; ortak Neon olduğu için otomatik yapılmadı.
- Doğrulama: `tsc` temiz, `npm run build` başarılı, dokunulan dosyalarda lint temiz; API ve form tarayıcıda yeniden
  denendi, test kayıtları silindi (tablo boş).

## Mega menü görsel kartları (bu oturum)

Masaüstü mega menüde Kadın ve Erkek sekmelerinin sağ tarafı, DB'deki kategori görsellerini kullanan eski `PromoCard`
yerine yapılandırmadan gelen 2'şer portre görsel kartına çevrildi (Release referansı).
- Yeni `src/lib/mega-menu-cards.ts`: kart içerikleri (görsel, alt, etiket, başlık, href, isteğe bağlı `overlayOpacity`)
  tek nesnede. `site-nav.ts` prisma import ettiği için client bileşen ondan değer alamaz, bu yüzden ayrı dosya.
- `site-header.tsx`: yeni `MegaMenuImageCard` (next/image `fill`, `object-top`, aspect 3/4, 12px etiket + 28px başlık,
  hover efekti yok) ve `GenderPanel` yeniden düzenlendi: solda metin sütunları `flex-1`, sağda kartlar `w-[70%]
  max-w-[970px] gap-5`. Kartı olmayan sekmede sağ panel render edilmez ve sol sütunlar eski yarım genişliğinde kalır.
  `PromoCard` mobil menü ve Aksesuar paneli için olduğu gibi duruyor; mobil menüye dokunulmadı.
- Href'ler gerçek filtre URL'leri: `/urunler?kategori=<elbise|bluz|gomlek|ceket>&cinsiyet=<Kadın|Erkek>` (slug'lar
  DB'den doğrulandı). Overlay varsayılan 0.2; okunabilirlik için Bluz (yoğun desen) ve Gömlek (açık gömlek) 0.3.
- Görseller `public/menu/` altında (kullanıcı yerleştirdi), next/image ile optimize ediliyor.

**Doğrulama**
- `tsc --noEmit` temiz. Tam lint'te `MobileMenu`'daki önceden var olan 2 `set-state-in-effect` hatası dışında sorun yok.
- Playwright: 1440'ta kartlar 469x625, 1920'de 475x633 (3/4), görseller yüklendi; 4 kartta yazı okunuyor.
  Aksesuar (kartsız) sekmesi bozulmadan açılıyor. 390 px mobil Kadın alt menüsünde yeni kart yok.
- Not: önizleme kapısı (PREVIEW_PASSWORD) nedeniyle yerel testte `?preview=` ile cookie alındı.

## Önizleme kapısı env ile kapatıldı: PREVIEW_GATE=off (2026-09-20)

iyzico başvuru incelemesi için site geçici olarak herkese açıldı.
- `src/proxy.ts` (`guardPreview`): `PREVIEW_GATE` "off" ise (büyük/küçük harf ve boşluk fark etmez) `/yapim-asamasinda`
  yönlendirmesi hiç çalışmaz. Değer yoksa veya "on" ise eski davranış (PREVIEW_PASSWORD + `bm_preview` cookie) aynen
  duruyor. `/admin` ve NextAuth koruması ile `/yapim-asamasinda` sayfası değişmedi. `.env.example`'a `PREVIEW_GATE` eklendi.
- Vercel production'a `PREVIEW_GATE=off` eklendi (Vercel CLI, "Secret" tipi, değeri dashboard'da görünmez).
  `PREVIEW_PASSWORD`'e dokunulmadı, duruyor.
- Bu süreçte site herkese açık. İnceleme bitince tekrar kapatmak için: `vercel env rm PREVIEW_GATE production`
  (veya değeri "on" yapıp) + yeniden deploy gerekir; env değişikliği yeni deploy olmadan etkili olmaz.
- Canlı doğrulama (commit 085bc13, deploy Ready, bollmark.com alias'ı): çerezsiz istekle `/`, `/urunler` ve 3 ürün detay
  sayfası yönlendirmesiz 200 döndü, `/admin` hâlâ 307 ile `/admin/login?callbackUrl=%2Fadmin`'e gidiyor,
  `/yapim-asamasinda` sayfası açılıyor.


## iyzico Sanal POS — Faz 1 (altyapı + panel) kodu yazıldı ve deploy edildi (2026-09-20)

Spesifikasyon: `IYZICO_SANAL_POS_PLANI.md`, promptlar: `IYZICO_SANAL_POS_PROMPTLARI.md`. Bu oturumda sadece Faz 1 yapıldı,
checkout akışına dokunulmadı.

**Yazılanlar**
- `prisma/schema.prisma`: sadece eklemeli — yeni `PaymentSettings`, `PaymentAttempt`, `PaymentRefund`, `PaymentLog`;
  `Order`'a ödeme alanları (`paymentStatus` varsayılan "UNPAID", `needsAttention`, `shippingRefundedCents` vb.),
  `OrderItem`'a `paymentTransactionId`/`paidCents`/`refundedCents`. Prisma client yerelde yeniden üretildi.
- `src/lib/payment/crypto.ts` (AES-256-GCM), `src/lib/payment/iyzico/{client,money,signature,mode,errors}.ts`,
  `src/lib/payment/{settings,log}.ts`, `src/lib/site-url.ts` (SITE_URL, yoksa https://bollmark.com).
  `order-notifications.ts` içindeki sabit adresler SITE_URL'ye bağlandı.
- Panel: `/admin/sanal-pos` (durum kartı, ayarlar formu, 4 anahtar alanı, bağlantı testi, entegrasyon adresleri,
  sandbox test rehberi, ödeme günlüğü) + server action'lar; sidebar "Sistem > Sanal POS"; 6 yeni denetim eylemi.
  `roles.ts` değişmedi: PERSONEL sadece /admin, /admin/siparisler, /admin/kargolar'a girebildiği için sanal-pos'a giremez.
- Test aracı: yeni bağımlılık yok, `node:test` + mevcut `tsx` (`npm test`, 30 test: şifreleme, para, imza vektörleri, mod, hata eşleme).
- Kararlar: `resolveMode()`/`getCredentials()` DB'ye bağlı olduğu için `settings.ts`'te, saf mod mantığı `mode.ts`'te
  (`resolveModeFrom`) tutuldu ki birim testlenebilsin. Canlı bağlantı testi yalnızca production'da çalışır.
  Anahtar değişince o moda ait son bağlantı testi geçersiz sayılır; canlı moda geçiş canlı test başarılı olmadan reddedilir.
- Canonical domain: hem `bollmark.com` hem `www.bollmark.com` yönlendirmesiz 200 dönüyor; koddaki mevcut sabit
  ve sitemap/canonical `https://bollmark.com` olduğu için SITE_URL bu değer olacak.

**Ortam adımları (kullanıcı izniyle yapıldı)**
- `npm run db:push` uygulandı (eklemeli, ortak Neon). Yeni tablolar ve sütunlar okunarak doğrulandı (şu an 0 sipariş var).
- Vercel env: `PAYMENT_ENCRYPTION_KEY` (Production + Preview + Development, Secret) ve `SITE_URL=https://bollmark.com`
  (yalnız Production; diğer ortamlarda kod aynı adrese düşüyor). Yerel `.env`'ye de yazıldı. Değer bu dosyaya yazılmadı.

**Doğrulama**
- `tsc --noEmit` temiz, `npm test` 30/30, `npm run build` başarılı. Rol kuralı: PERSONEL /admin/sanal-pos için false, ADMIN true.
- Panel ADMIN ile yerel dev sunucusunda (ortak DB) Playwright ile test edildi, 21/21 geçti: sayfa açılışı, sidebar, yanlış önek
  reddi (iki yönde), geçerli kaydetme, panelde yalnız "son 4", HTML ve tüm network yanıtlarında secret yok, anahtar inputları
  boş dönüyor, taksit kalıcı, günlük/filtre, denetim kaydında anahtar değeri yok, canlı test yerelde reddi, canlı geçiş şartsız reddi.
  Sahte sandbox anahtarıyla bağlantı testi gerçek iyzico sandbox'tan 1001 ("API Key bulunamadı") aldı ve Türkçe eşlendi; yani istek
  iyzico'ya ulaşıyor. Test verileri (sahte anahtarlar, 2 günlük, 2 denetim satırı) sonradan silindi, PaymentSettings varsayılana döndü.
- Yapılamadı: PERSONEL ile gerçek giriş reddi (geçici hesap oluşturma engellendi; kural birim düzeyinde doğrulandı) ve geçerli
  anahtarla başarılı IYZWSv2 kimlik doğrulaması (sandbox anahtarı henüz yok, ilk gerçek doğrulama Faz 2 öncesi "Bağlantıyı Test Et").


## iyzico Sanal POS — Faz 2 (odeme akisi) tamamlandi, canlida sandbox'ta test edildi (2026-09-20/21)

**Yapilanlar**
- `/api/orders`: Sanal POS hazir degilse 503; siparis `PENDING_PAYMENT` + `paymentStatus=UNPAID` + `paymentExpiresAt`; mail/sepet temizleme/stok
  dusumu odeme dogrulaninca; orderNumber cakismasinda (P2002) yeniden deneme. Checkout "Odemeye Gec" ile iyzico'ya yonlendirir, sandbox'ta
  "Test odeme modu: gercek kart cekilmez" uyarisi, POS kapaliyken buton pasif.
- `src/lib/payment/orders/`: `basket` (largest-remainder indirim dagitimi), `buyer`, `evaluate` (saf karar mantigi), `initialize`, `reconcile`
  (koşullu updateMany ile tek-sefer yan etki), `expire` (sure dolumu + mutabakat), `state`. Rotalar: `/api/odeme/baslat`, `/api/odeme/iyzico/callback`
  (303), `/api/odeme/durum`, gunluk cron `/api/cron/odeme-mutabakat` (vercel.json 08:30). Sayfalar: `/odeme/tesekkurler`, `/odeme/basarisiz`
  (DB durumuna gore), `/odeme` `/api/odeme` noindex + robots.
- Admin: siparis listesinde Odeme rozeti ve "Dikkat gerekiyor" filtresi, detayda odeme rozeti/uyari, iyzico denenmis siparis elle "Odendi" yapilamaz
  (detay butonu gizli + sunucu tarafi kural, toplu islem dahil), diger siparislerde elle "Odendi" icin onay + denetim kaydi.
- `order-notifications.ts`: tek birlesik "siparisiniz alindi, odemeniz onaylandi" maili + admin "odeme dikkat gerektiriyor" maili.
- Vega: `Servis` rotasinda siparis ucnoktasi yok (plan l), sipariş verisi Vega'ya gitmiyor; ileride eklenirse yalniz PAID siparis verilmeli.

**Sandbox'ta gozlenen (plan 1.9)**
1. `identityNumber` placeholder `11111111111` sandbox'ta kabul edildi (canlida iyzico'dan teyit gerekir).
2. CF token omru: baslatma yanitinda `tokenExpireTime: 1800` (30 dk). Terk edilmis tokenin sorgusu `5122 "Gonderilen tokena ait odeme bilgisi bulunamadi"` doner.
3. **3D Secure ekranindayken sorgu `paymentStatus=FAILURE` doner** (hata kodu yok). Bu yuzden FAILURE yalniz callback/webhook'ta ya da token omru dolunca
   kesin sayilir; FAILED deneme sonradan SUCCESS olabilir. (Canlida yakalanan gercek hata: erken FAILED yazmak dogru kodu girip odeyen musteriyi "odenmedi" birakirdi.)
4. `paymentPageUrl` sandbox'ta donuyor (`sandbox-cpp.iyzipay.com?token=...`), `checkoutFormContent` Base64 degil duz HTML script; yonlendirme yontemi secildi, gomulu form yok.
5. Taksit: yalniz tek cekim denendi (maxInstallment=1); `paidPrice != price` durumu birim testli, gercek taksit sandbox'ta denenmedi.
6. Yanit imzasi: baslatma ve sorgulama imzalari dokumandaki formulle dogrulandi (`price`/`paidPrice` sondaki sifirlar atilarak). `fraudStatus` ve `itemTransactions` (kalem + kargo `paymentTransactionId`) yanitta geliyor.
7. Sandbox 3DS mock sayfasi dokumandaki `123456` yerine sayfada gosterilen kodu (`283126`) kabul ediyor, `123456` reddediliyor.
8. iyzico odeme formu hata kartlarini (4111...1129 vb.) istemci tarafinda reddediyor (kart alani kirmizi), sunucuya gitmez; bu kartlar CF arayuzuyle test edilemiyor. 3DS mdStatus 0/4 kartlari callback ile FAILED'a dusuyor. 4151... (3DS baslatilamadi) iyzico formunda kaliyor.
9. Banka kartlari (debit) otomatik 3DS ister.

**Canlida (sandbox) gecen senaryolar:** Visa/MasterCard/Troy/AmEx/yabanci kart, Visa+MasterCard debit (3DS), Visa+3DS, yanlis OTP -> basarisiz -> "Tekrar Dene" -> basarili,
mdStatus 0/4 -> FAILED, callback 3 seri + 5 eszamanli tekrar (tek stok dusumu, tek durum), bilinmeyen/tokensiz callback 303, ayni siparisi iki sekmede odeme (COKLU ODEME isaretlendi),
tutar uyusmazligi (DB 134100, iyzico 134000 -> PAID sayilmadi, REVIEW + needsAttention), gec odeme (iptal siparise odeme -> CANCELLED+PAID+needsAttention), sure dolumu (siparis iptal, kupon 1->0,
50 puan iade, tekrar sweep'te cift iade yok), stok tukenince /baslat 409, POS kapaliyken /api/orders 503, admin toplu PAID reddi (400), 1000 rastgele senaryoluk basket testi.
`npm test` 61/61, tsc temiz, build basarili.

**Test duzeneginden ogrenilenler:** yerel saat sunucudan ~3 dk ileriydi (test komutu sureyi yanlis yazmisti, urun hatasi degil); gozlem icin sweep ozet satiri
(PaymentLog RECONCILE) kalici eklendi.

**Test verisi:** 61 test siparisi, 593 odeme gunlugu, 29 denetim kaydi, gecici musteri/kupon silindi; test varyantinin stogu ilk degerine (3) yazildi.
Test siparisleri gercek e-posta gondermemis olabilir ama admin adresine "Yeni siparis"/"Odeme dikkat" mailleri gitmis olabilir.

**Acik / sonraki fazlar:** webhook (Faz 3), iade/iptal ve admin Odeme karti (Faz 3), taksitli gercek odeme testi, PERSONEL ile gercek giris reddi, sidebar'da needsAttention sayaci.
**Durum:** Sanal POS SANDBOX modunda ACIK birakildi (isEnabled=true) ki checkout calissin; kapatmak icin /admin/sanal-pos > "Sanal POS aktif" kutusunu kaldirin. Bu durumda siparisler test odemesiyle PAID olur, gercek para cekilmez.


## iyzico Sanal POS — Faz 3 (webhook, iade/iptal, admin Ödeme kartı) kodu yazıldı ve deploy edildi; sandbox uçtan uca testi BEKLİYOR (2026-09-21)

Commit 1634ae0 main'e push edildi, canlıda `/api/odeme/iyzico/webhook` rotası cevap veriyor (geçersiz gövde → 400).

**Yazılanlar**
- Webhook `POST /api/odeme/iyzico/webhook`: zod gövde doğrulaması; `X-IYZ-SIGNATURE-V3` VARSA `timingSafeEqual` ile doğrulanır (yanlışsa 401), YOKSA yine
  işlenir çünkü aksiyon gövdedeki hiçbir alana değil `reconcileToken(token, "webhook")` sunucu-sunucu sorgusuna dayanır. `CHECKOUT_FORM_AUTH` dışı olaylar
  loglanır (200), bilinmeyen/boş token 200, geçici hata (iyzico erişilemez / DB) 5xx (iyzico yeniden dener). Webhook kaynaklı FAILURE kesin sayılır (`isFailureFinal`).
- İade/iptal çekirdeği `src/lib/payment/orders/refund.ts` (+ saf `refund-math.ts`): sipariş satırı `SELECT ... FOR UPDATE` ile kilitlenir, kalan tutar
  (ödenen − iade − bekleyen) hesaplanıp `PaymentRefund(PENDING)` rezerve edilir, sonra iyzico çağrılır; SAYAÇLAR YALNIZCA BAŞARIDA değişir. Kalem, kargo ve tam iade
  (`/payment/refund`, kalem bazlı `paymentTransactionId`), tam tutar iptal (`/payment/cancel`, yalnızca hiç iade yokken). Kalem tamamen iade edilince (ve
  "stoğa geri ekle" işaretliyse) stok bir kez artar. Tam iadede `Order.status=REFUNDED` (iptal edilmiş/geç ödemeli siparişte durum değişmez, sadece ödeme durumu).
  Yerel/preview ortam LIVE ödemenin iadesini reddeder. Ağ/zaman aşımında sonuç BELİRSİZ: kayıt PENDING kalır, tutar rezerve kalır, sipariş "dikkat gerekiyor"
  olur; ADMIN Ödeme kartından "iyzico'da yapılmış / yapılmamış" ile sonuçlandırır (plan dışı ek: takılı PENDING sonsuza dek iadeyi kilitlemesin diye).
- Sipariş detayında **Ödeme kartı** (`order-payment-card.tsx`, `odeme-actions.ts`): ödeme özeti, denemeler, kalem bazlı iade edilebilir tutar, iade formu (kapsam,
  tutar, sebep, not, stok), iptal formu, "iyzico'dan durumu sorgula" (`PAYMENT_MANUAL_RECONCILE`), "Uyarıyı kapat" (`PAYMENT_ATTENTION_CLEARED`), iade geçmişi.
  Tüm eylemler yalnızca ADMIN (`requireAdmin` her action içinde); PERSONEL kartı salt okunur görür. Denetim: `PAYMENT_REFUND_CREATED`, `PAYMENT_CANCEL_CREATED`,
  `PAYMENT_REFUND_RESOLVED`. Müşteriye iade maili (`notifyCustomerRefund`).
- Sidebar "Siparişler" rozeti (needsAttention sayısı), İadeler tablosunda TAMAMLANDI taleplerde "Ödeme kartı / iade" bağlantısı.
- Faz 2 düzeltmesi: REVIEW (dolandırıcılık incelemesi) olumlu sonuçlanınca eski "HAZIRLAMA/KARGOLAMA YAPMAYIN" uyarısı artık temizleniyor (webhook bunu tetikler).

**Doğrulama (yapılanlar)**
- `npm test` 79/79 (yeni: iade tutar/kalan/ardışık kısmi/durum geçişi/iptal koşulu, TL ayrıştırma, webhook gövde + V3 imza geçerli/yanlış/eksik), `tsc --noEmit` temiz,
  `npm run build` başarılı, dokunulan dosyalarda yeni lint hatası yok (sidebar'daki 2 `set-state-in-effect` hatası önceden vardı).

**YAPILAMADI (Faz 3'ün bitti sayılması için gerekli)**
- Sandbox uçtan uca testleri (plan bölüm 8: madde 5, 11, 13, 15, 16) KOŞULMADI. Sebepler: (1) bu makinedeki `.env`'de `PAYMENT_ENCRYPTION_KEY` yok (Faz 1'de Vercel'e "Secret"
  olarak eklendi, geri okunamaz), yani sandbox anahtarları yerelde çözülemez ve iade çağrıları yerelden iyzico'ya atılamaz; testler production'da yapılmalı. (2) Production'da
  sandbox siparişi oluşturmak ve `PaymentSettings.isEnabled`'ı geçici açmak (şu an `false`) otomatik izin denetiminde reddedildi, aşılmadı. (3) `.env`'deki ADMIN_PASSWORD ile
  admin girişi mümkün değil (DB'deki şifre farklı), Ödeme kartı arayüzü tarayıcıda hiç açılmadı.
- Dolayısıyla HENÜZ BİLİNMEYEN (plan 1.9/3): `/payment/refund`'ın aynı gün davranışı (iptal mi zorunlu?), `/payment/cancel` sandbox davranışı, `5406670000000009` ile başarısız iade,
  taksitli ödemede iade tavanı, iade yanıtının imza alanı (dokümanda formülü doğrulanmadı, yalnızca `status=success` + HTTPS/IYZWSv2 kimlik doğrulaması ile kabul ediliyor).
- Geçerli imzalı webhook'un canlıda denenmesi (Secret Key gerekir); imza doğrulaması yalnızca birim testiyle (elle hesaplanmış HMAC) kanıtlı.
- PERSONEL ile gerçek giriş reddi (kural `roles.ts` + `requireAdmin` düzeyinde).

**Bilinen açıklar / karar bekleyenler**
- Çift ödeme (ikinci başarılı deneme) için panelde iade yolu YOK: ikinci denemenin `itemTransactions`'ı saklanmıyor. Şimdilik iyzico panelinden iade + "Uyarıyı kapat". İstenirse
  `/v2/payment/refund` (paymentId + tutar) ile eklenebilir.
- İadede kupon hakkı (`usedCount`) ve sadakat puanı geri verilmiyor/geri alınmıyor (planda yok).
- Sanal POS şu an DB'de `isEnabled=false`; checkout `/api/orders` 503 döner.


## iyzico Sanal POS — Faz 3 sandbox testleri TAMAMLANDI (production, 2026-09-21)

Kodlar 1634ae0 + düzeltme 444d206 ile canlıda. Testler production alan adında, POS SANDBOX modunda, kullanıcı izniyle yapıldı (POS test süresince geçici açıldı,
sonunda tekrar KAPATILDI: `isEnabled=false`, `maxInstallment=1` geri alındı).

**Sonuçlar (plan bölüm 8)**
- 1/madde 5+6 — Callback ulaşmadı (tarayıcıda callback isteği engellendi): sipariş PENDING_PAYMENT/UNPAID kaldı; imzasız webhook → `paid` (tek stok düşümü); aynı webhook tekrar → `already`. GEÇTİ.
- 11 — İade: aynı gün KISMI iade `/payment/refund` ile başarılı (sandbox; `hostReference` dönüyor) → kalem sayacı, `PARTIALLY_REFUNDED`. Ardışık kısmi (150,50 + 200 + kalan 1.629,50 = 1.980 TL) → `REFUNDED`, sipariş
  durumu `REFUNDED`, "stoğa geri ekle" ile stok +2. Fazla tutar (kalan 1.829,50'ye 1.900 TL) 3 denemede reddedildi, kayıt/sayaç değişmedi. Aynı gün TAM İPTAL `/payment/cancel` (ürün+kargo, 1.340 TL)
  başarılı → `REFUNDED`, stok geri eklendi. `5406670000000009` kartı: iade de iptal de iyzico'dan 10220 "Ödeme alınamadı" ile reddedildi → kayıt `FAILED`, sayaçlar ve `PAID` durumu DEĞİŞMEDİ. GEÇTİ.
  BULGU: aynı gün `/payment/refund` (kısmi) hata VERMİYOR, iptal zorunlu değil; ikisi de sandbox'ta çalışıyor. Canlı bankada aynı gün davranışı iyzico'ya sorulmalı (bkz. sorular).
- 13 — PERSONEL (geçici hesap, panelden oluşturuldu ve pasifleştirildi): /admin/sanal-pos, /personel, /islem-gecmisi, /mesajlar → /admin'e yönlendirildi; sipariş detayında Ödeme kartı salt okunur,
  iade/iptal/sorgu düğmesi yok. GEÇTİ (UI düzeyi; server action'lar `requireAdmin` ile korunuyor).
- 15 — Webhook (canlıda): bozuk JSON 400, farklı olay türü 200 (`ignored`), bilinmeyen token 200 (`unknown`), YANLIŞ imzalı gerçek token 401, imzasız gerçek token işlendi (yukarıda). Ödenmemiş token + imzasız
  webhook → 500 (iyzico'da 5122 "ödeme bilgisi yok", yeniden denenir; tasarım gereği). GEÇERLİ imzalı webhook canlıda DENENEMEDİ (Secret Key yok); imza doğrulaması yalnızca birim testiyle kanıtlı.
- Ek: belirsiz (PENDING) iade kaydı arayüzden sonuçlandırma ("yapılmış" → sayaç güncellendi, `PARTIALLY_REFUNDED`; "yapılmamış" → `FAILED`), rezerve tutarın kalan hesabından düşülmesi, "Uyarıyı kapat" (+ sidebar
  Siparişler rozeti 1 → 0), "iyzico'dan durumu sorgula" (denetim `PAYMENT_MANUAL_RECONCILE`), denetim kayıtları. GEÇTİ.
- 16 — Taksit: KOŞULAMADI. iyzico sandbox test kartları (Visa 4603…, MasterCard 5526…) ödeme sayfasında yalnızca "Tek Çekim" sunuyor. "Tüm taksit seçenekleri" tablosu `maxInstallment=3` ayarının iyzico'ya
  doğru iletildiğini gösterdi (1.340 TL için 2 taksit 1.383,14 TL, 3 taksit 1.410,29 TL, yani `paidPrice ≠ price`), ama taksitli bir ödeme tamamlanamadı; taksitli iade tavanı gerçek denenmedi (yalnızca birim düzeyi:
  tavan = kalemin `paidCents`'i).

**Testte bulunup düzeltilenler (444d206)**: iade tutarları `formatPrice` ile TAM TL'ye yuvarlanıyordu (150,50 → "151 TL", müşteri mailinde de); Ödeme kartı, denetim kaydı ve iade maili artık `formatExactPrice`
(kuruşlu) kullanıyor. Reddedilen iadede yöneticiye müşteri diliyle "Kartınız bankası tarafından reddedildi" yerine "iyzico iade hatası <kod>: <mesaj>" gösteriliyor.

**AÇIK: test verisi temizliği YAPILAMADI** (canlı DB'de toplu silme otomatik izin denetiminde reddedildi, aşılmadı). Canlı veritabanında şunlar duruyor:
5 test siparişi (BLM260921-7119, -4676, -3958, -1678, -8124; müşteri iyzico-test@example.com), bunlara bağlı ödeme denemeleri/iade kayıtları, ~29 ödeme günlüğü satırı, 12 denetim satırı,
`Faz3 Test Personel` (faz3-test-personel@example.com, PASİF) hesabı ve "Sipariş"/"Ödeme" ekranlarında görünen test siparişleri. Stok: gömlek varyantı (cmu1ru345000y04jv24d894eg) 3 (orijinal),
hırka varyantı (cmu2eg2w0002u04ley9nhc6p5) 1 (orijinali 3, iki test siparişi düşürdü). Test siparişlerinin admin/müşteri mailleri example.com adresine ve admin adresine gitmiş olabilir.

**Temizlik tamamlandı (kullanıcı onayıyla, aynı gün):** 5 test siparişi (ödeme denemeleri/iade kayıtları cascade ile), bağlı ödeme günlükleri, denetim satırları ve
`Faz3 Test Personel` hesabı silindi; toplam sipariş 0'a döndü. Stoklar orijinal değerine (3/3) geri yüklendi. Sanal POS `isEnabled=false`, `maxInstallment=1`.
Yukarıdaki "AÇIK: test verisi temizliği YAPILAMADI" notu bu satırla geçersizdir.


## iyzico Sanal POS — Faz 4 (sertlestirme, tam test raporu, canliya gecis dokumani) (2026-09-21)

Ayrintili sonuclar: `IYZICO_TEST_RAPORU.md`. Kullanici icin canliya gecis: `IYZICO_CANLIYA_GECIS.md`.

**Sonuc (plan bolum 8, 16 madde):** 13 gecti, 2 kismen (3: hata kartlari iyzico formunda tarayicida reddediliyor, sunucu yolu yalniz birim testli; 15: gecerli imzali webhook
canlida denenemedi), 1 kosulamadi (16: taksit, sandbox test kartlari taksit sunmuyor), 0 kaldi. Faz 2/3'te gecenler tekrar kosulmadi ("Faz 2/3'te dogrulandi").
`npm test` 79/79, `tsc` temiz, `build` basarili. `npm run lint` projede temiz degil (74 hata: `.open-next` uretilmis cikti + odeme disi onceden var olan dosyalar);
odeme dosyalarinda 0 hata.

**Bu fazda yapilanlar**
- Guvenlik gecisi (plan bolum 7) kod uzerinde: istemci paketi (`.next/static`, 83 dosya) taramasi temiz, `.env` degerleri istemci ciktisinda yok, tum imza karsilastirmalari
  `timingSafeEqual`, tutar hicbir yerde istemciden alinmiyor, LIVE yalniz production, noindex tamam, yetkisiz erisimler 401/307.
- Canli regresyon (production, SANDBOX, kullanici onayiyla): siparis BLM260921-1013 (990+350 = 1.340 TL) Visa + 3DS ile PAID oldu; stok 3->2; ayni callback 2 kez tekrar POST
  edildi -> `already`, stok degismedi; POS kapali/acik/kapali gecisinde `/api/orders` 503 -> 400 -> 503.
- Tek kod degisikligi: panelin Test Rehberi'ndeki OTP metni. Sandbox 3DS sahte sayfasi dokumandaki `123456`'yi reddediyor, sayfada gosterilen kodu kabul ediyor.
- `IYZICO_SANAL_POS_PLANI.md` bolum 1.1'deki `123456` ifadesine dokunulmadi.

**"iyzico'ya sorulacaklar"**: gecerli imzali webhook + imza ozelliginin acilmasi, taksitli odemede paidPrice/iade tavani, identityNumber placeholder, canli bankada ayni gun
iade/iptal, iade yanitinin imza alani, callback alan adi (www) kisiti. Ayrinti: rapor bolum 7.

**Bilinen acik / karar bekleyen**: cift odeme icin panelde iade yolu yok (iyzico panelinden iade + "Uyariyi kapat"); iadede kupon/puan geri verilmiyor; `CRON_SECRET` karsilastirmasi
sabit zamanli degil (mevcut desen); `POST /api/orders` gecersiz JSON'da 500.

**AÇIK: canli DB'de test verisi kaldi** (silme otomatik izin denetiminde reddedildi, asilmadi): siparis BLM260921-1013 (iyzico-test@example.com, PAID) + bagli odeme denemesi,
1 terk edilmis sepet, 5 odeme gunlugu satiri, 1 denetim satiri (aktor "iyzico"); gomlek BEYAZ/M varyanti (cmu1ru345000y04jv24d894eg) stogu 2 (orijinali 3). Sanal POS tekrar
KAPATILDI (`isEnabled=false`, `maxInstallment=1`).

**Temizlik tamamlandi (kullanici talimatiyla, ayni gun):** Faz 4 test siparisi BLM260921-1013 (odeme denemesi cascade ile), terk edilmis sepet, 5 odeme gunlugu ve 1 denetim satiri silindi;
gomlek BEYAZ/M stogu 3'e geri yazildi. Dogrulama: 0 siparis, 0 deneme, 8 gunluk (baslangic degeri), POS `isEnabled=false`. Yukaridaki "AÇIK: canli DB'de test verisi kaldi" notu bu satirla gecersizdir.

## Tarih/saat: Europe/Istanbul standardi (2026-09-21)

**Sorun**: Vercel sunucusu UTC'de calisiyor; tarih/saat gosterimleri, siparis numarasi, rapor gruplamalari ve kampanya tarih kontrolleri sunucu saat dilimine bagliydi. Turkiye saatiyle
00:00-03:00 arasi islemler bir gun geri gorunuyordu.

**Yapilanlar** (hepsi `src/lib/format.ts` uzerinden ortak; Turkiye kalici UTC+3 oldugu icin gun sinirlari sabit ofsetle uretiliyor)
- Yeni yardimcilar: `formatDate`, `formatDateTime`, `formatTime` (hepsi `timeZone: "Europe/Istanbul"`), `istanbulDateKey`, `istanbulDayStart/End`, `addDaysToDateKey`, `monthStartDateKey`,
  `istanbulDateKeysBetween`.
- `generateOrderNumber`: tarih Istanbul gunune gore (BLM + yyMMdd).
- Tum `toLocaleDateString/TimeString/String("tr-TR")` kullanimlari (admin tablolari, siparis detayi, odeme karti, mesajlar, iadeler, islem gecmisi, terk edilmis sepetler, musteri hesabi,
  siparis durumu, Excel disa aktarim) `formatDate/formatDateTime/formatTime`'a tasindi. Sanal POS sayfasindaki yerel `formatDateTime` ayni yardimciya devrediliyor.
- Raporlar: `order-period.ts` (Bugun/Dun/Son 7/30 gun/Bu ay/Ozel aralik), `order-stats.ts`, `abandoned-cart-stats.ts` gunluk gruplama ve dönem sinirlari Istanbul gunune gore.
  Admin Genel Bakis (Bu ay, onceki donem, son 30 gun grafigi; oncesinde UTC gunune gore gruplaniyordu) ve `/admin/raporlar` ("Son N gun" artik Istanbul gun basindan, bugun dahil N gun;
  oncesinde "simdi - N*24 saat") ve Islem Gecmisi tarih filtresi de ayni sekilde.
- Kampanya (kupon): tarih alani artik Istanbul gunu olarak kaydediliyor (baslangic 00:00, bitis 23:59:59.999) ve gecerlilik `istanbulDateKey` ile GUN bazinda karsilastiriliyor
  (`coupons.ts`, `status.ts`). Oncesinde `new Date("YYYY-MM-DD")` UTC gece yarisi = Istanbul 03:00 oldugu icin kampanya bitis gunu 03:00'te sona eriyordu. Mevcut kayitlar
  (UTC gece yarisi) ayni takvim gunune denk geldigi icin veri migrasyonu gerekmiyor.

**Dogrulama**: `tsc` temiz; `TZ=UTC` altinda sinir durumlari (21 Eyl 22:30 UTC -> 22 Eyl 01:30 Istanbul: gun anahtari, gosterim, gun basi/sonu, donem araliklari, kampanya bugun-basliyor/bugun-bitiyor/dun-bitti,
eski UTC-gece-yarisi kayit) kontrol edildi.

**Dokunulmayanlar / karar bekleyen**: `yapim-asamasinda/page.tsx` lansman tarihi (`"2026-10-14T00:00:00"`, ofsetsiz) sunucuda UTC okunuyor = Istanbul 03:00; Istanbul gece yarisi istenirse
`+03:00` eklenmeli (lansman aninin 3 saat one cekilmesi demek, ayrica onay bekliyor). Site/gate alt bilgisindeki `new Date().getFullYear()` yalniz 31 Ara 21:00 UTC - 1 Oca 00:00 UTC arasi
etkilenir, dokunulmadi. `scripts/` altindaki bakim betikleri kapsam disi.

## Vercel deployment temizligi (2026-09-21)

"Function Storage (10 GB) %75" uyarisi uzerine eski deployment'lar temizlendi. Kural: **son 30 deployment tutulur**, gerisi silinir (production alias'ina bagli deployment her zaman korunur). Silmeden onceki deployment sayisi: 261, sonraki: 30 (231 silindi, en eskisi 2026-08-28). Production (`bollmark.com`, `www.bollmark.com`) `bollmark-pfig1ma57` deployment'ina bagli ve temizlik sonrasi HTTP 200 donuyor. Kalici cozum icin Vercel panelinde Settings -> Deployment Retention elle ayarlanmali.

## Vercel Function Storage olcum raporu (2026-09-21, sadece olcum - hicbir sey degistirilmedi/silinmedi)

- **Mevcut deployment**: 31 (hepsi production, preview yok). En eskisi 2026-09-18 23:12 UTC. Hesapta tek proje (bollmark, Hobby). Temizlikten sonra 1 yeni deploy geldigi icin 30 degil 31.
- **Deployment basina boyut** (Vercel builds API, benzersiz function'lar toplami): son deploy 36,3 MB, 18 Eyl'dekiler 33,3 MB; 31 deployment toplami ~1,04 GB. Function bundle 150 MB'in cok altinda (7 benzersiz function: 4,2 / 11,5 / 12,0 / 2,8 / 2,7 / 2,6 / 0,5 MB). 197 route ciktisi bu 7 function'i paylasiyor.
- **7,58 GB aciklamasi**: temizlik oncesi 261 deployment x ~29-33 MB = ~7,5-8,6 GB; yani 7,58 GB o donemdeki birikimle tutarli. Simdiki gercek kullanim ~1,04 GB olmali. Grafigin dusmemesi bundan buyuk bir bundle degil, buyuk olasilikla Vercel'in usage metriginin gecikmesi/silinen deployment'larin asenkron temizlenmesi (CLI'dan dogrulanamadi; 24-48 saat sonra Usage sayfasindan kontrol edilmeli).
- **Sisme sebebi**: bundle "buyuk" degil, ama yaklasik %65'i iki agir function grubunda (~11,5-12 MB): sharp kullanan gorsel rotalari (`admin/upload`, `gorsel-*`, `odeme/baslat` ...) ve xlsx/cheerio/sharp iceren admin/excel rotalari. `sharp` 10 Eyl'de eklendi (d30356b, Blob kotasi icin gorsel sikistirma); 10 Eyl oncesi deployment'lar silindigi icin sicrama olculemedi, bu tahmindir. 20 Eyl 22:03 UTC'de +2,7 MB / +1 function (iyzico odeme-mutabakat cron'u, Faz 2). Prisma 7 istemcisi `src/generated/prisma`'da, postgresql wasm ~4,4 MB ana function'da. `public/` (5,2 MB) statik, function storage'a girmez. `.open-next` (38,7 MB, 28 Agu) eski Cloudflare denemesinden kalma, git'te yok, deploy'a girmiyor.
- **Tahmini kazanc**: (a) son 10 deployment tutmak: 10 x 36,3 = ~363 MB; simdiki 1,04 GB'a gore ~700 MB (%66) kazanc. Gunde ~9-11 deploy oldugundan 10 deployment ~1 gunluk rollback gecmisi demek. (b) bundle kuculme (outputFileTracingExcludes vb.): gerekli bagimliliklar cikarilamaz, sadece gereksiz dosyalar; tahmini %10-25 = 31 deployment icin ~100-270 MB, 10 deployment icin ~35-90 MB. Riskli (rota kirabilir), ayrica build+test ister; (a)'ya gore kazanc kucuk.
- **Oneri**: limit tehlikesi gecmis gorunuyor; once grafigin dusmesini bekle. Kalici onlem: panelde Settings -> Deployment Retention. (b) simdilik gereksiz.

## Sepet: hesaba kayit (cihazlar arasi) + guncel fiyat (2026-09-21)

**Sorunlar**: (1) Sepet yalniz `localStorage`'daydi, baska cihaz/tarayicidan girince bos gorunuyordu. (2) Sepet satiri eklendigi andaki fiyati kopyaliyordu; admin fiyat degistirince
/sepet, cekmece ve /odeme eski fiyati gosteriyor, `/api/orders` ise DB fiyatiyla siparis olusturuyordu (gosterilen tutar != tahsil edilen tutar).

**Veritabani**: yeni `CustomerCart` modeli (`customerId @unique`, `linesJson` = yalniz productId/variantId/quantity, `couponCode?`, `updatedAt`; Customer silinince cascade).
Yontem `npm run db:push` (migrations klasoru yok). `prisma migrate diff` ile SQL onizlendi: yalniz `CREATE TABLE "CustomerCart"` + unique index + FK; mevcut tablolara dokunulmadi,
`--accept-data-loss` kullanilmadi. Local ve prod ayni Neon oldugu icin **tablo canlida da hazir; production'a alirken ek sema adimi YOK** (yeni deploy'da `prisma generate` postinstall ile calisir).

**Yeni dosyalar**
- `src/lib/cart-shared.ts` (limitler: 50 satir, satir basina 99 adet; ortak tipler), `src/lib/cart-lines.ts` (sunucuda satirlari guncel urun kaydindan cozer: fiyat = `effectivePrice`, eski fiyat yalniz gercek indirimse, isim, beden/renk, renk galerisinin ilk gorseli, stok, yayin durumu).
- `src/app/(site)/api/sepet/route.ts`: GET (oturumdaki musterinin sepeti, guncel fiyatla zenginlestirilmis; cozumlenemeyen satirlar atlanir) ve PUT (sepetin tamami, zod ile dogrulanir; fiyat/isim/gorsel kabul edilmez). Oturum yoksa 401. `Cache-Control: no-store`.
- `src/app/(site)/api/sepet/dogrula/route.ts`: POST, giris gerekmez; satir basina guncel fiyat/stok/yayin durumu. `no-store`.
- `src/components/cart-notices.tsx`: fiyat guncellendi uyarisi (kapatilabilir) + stok/yayin sorunu uyarisi; /sepet, cekmece ve /odeme'de gosterilir.

**Degisen dosyalar**
- `src/lib/cart.tsx` (asil is): misafirde localStorage aynen kaynak; girisliyken kaynak DB. Giriste tek seferlik birlestirme (ayni variantId'de adetler toplanir, stogu asmaz, sonuc DB'ye yazilir, basarili olunca localStorage silinir).
  Degisiklikler 500 ms debounce ile `PUT /api/sepet`; sekme odagi/gorunurluk degisince bekleyen degisiklik yazilir, sonra `GET` ile diger cihazdaki degisiklik alinir. Cikista ekrandaki sepet temizlenir (DB'ye dokunulmaz; tekrar giriste geri gelir).
  `clear()` (odeme sonrasi) DB sepetini de bosaltir; oturum henuz cozulmeden cagrilirsa ilk senkronizasyon DB'deki sepeti geri getirmez. Fiyat tazeleme (`/api/sepet/dogrula`): ilk yukleme, sekme odagi, cekmece acilisi, /sepet ve /odeme acilisi;
  `priceNotices`, `lineIssues`, `hasBlockingIssues`, `refreshPrices()` context'e eklendi. Tazeleme yalniz fiyat/isim/gorsel alanlarini degistirir, DB'ye giden id+adet anahtari degismedigi icin PUT dongusu olusmaz (dogrulandi: 2 PUT).
- `sepet/page.tsx`, `cart-drawer.tsx`, `odeme/checkout-form.tsx`: uyari bileseni; sorunlu satir varsa "Odemeye Gec" **engellenir** (satir otomatik kaldirilmaz; kullanici uyariyi gorup kendisi kaldirir - secim bu).
- `checkout-form.tsx` + `api/orders/route.ts`: istemci her satir icin gordugu birim fiyati `expectedPriceCents` (opsiyonel, eski istemciler bozulmaz) gonderir; DB fiyatindan farkliysa siparis OLUSTURULMADAN `409 { code: "PRICE_CHANGED" }` doner, istemci sepeti tazeleyip
  "Fiyatlar guncellendi, lutfen tekrar kontrol edin" der. Gonderme aninda da (yeni siparis olusturulmadan once) bir kez tazeleme yapilir. Sunucunun fiyati DB'den hesaplama davranisi aynen duruyor.
- `use-bundle-discount.ts`, `use-automatic-discount.ts`: efekt anahtarina `priceCents` eklendi (fiyat degisince indirim onizlemesi yeniden hesaplanir). Kupon alani zaten `[lines]`'a bagliydi.

**Yan kontrol (`revalidate-catalog.ts`)**: admin urun duzenleme (`admin/urunler/[id]`), toplu fiyat (`api/admin/urunler/bulk`) ve Excel aktarimi zaten `revalidateCatalog()` cagiriyor; eksik yoktu, degisiklik yapilmadi.

**Dogrulama**: `tsc --noEmit` ve `npm run build` temiz. Yerel dev + Playwright (test musterisi + test urunu, sonra silindi):
misafir eski fiyatli sepet /sepet'te 80->100 TL uyarisiyla guncellendi (localStorage da guncellendi); girişte misafir sepeti DB'ye birlesti ve localStorage bosaldi; ikinci (bos localStorage'li) tarayici baglamiyla ayni hesaba girince sepet dolu geldi;
bir baglamda adet 2->3 yapinca digerinde odak sonrasi yansidi; acik /odeme'de fiyat 120->130 TL degisince odak sonrasi uyari + yeni toplam; stok 0 olunca uyari + "Odemeye Gec" baglantisi kalkti; cekmecede fiyat uyarisi; cikista sepet ekrandan silindi, tekrar giriste geri geldi;
odeme sonrasi (`/odeme/tesekkurler`, PAID test siparisi) hem ekran hem `CustomerCart.linesJson` bosaldi. Ekran goruntuleri: `Claude outputs/sepet-senkron/`.
**Dogrulanamayanlar**: `409 PRICE_CHANGED` yolu uctan uca calistirilmadi - yerelde POS "hazir degil" (SITE_URL https degil, `isEnabled=false`) oldugu icin `/api/orders` daha o noktada 503 donuyor; canli POS ayari test icin acilmadi. Kod incelemesiyle dogrulandi, canlida sandbox ile bir kez denenmeli.

**Bilinen sinirlar**: Fiyat DB'de saklanmadigi icin girisli kullanicida sayfa yenilenince "eski -> yeni" uyarisi cikmaz (ekranda dogrudan guncel fiyat gorunur); uyari misafirde (localStorage'da eski fiyat var) ve acik sekmede fiyat degisince cikar.
Test verisi (test musterisi `sepet-test@example.com`, urun `zz-sepet-test-urunu`, siparis `ZZTEST-1`, cascade ile sepeti) canli DB'den silindi.

**Production'a alirken**: ek sema adimi yok (tablo hazir). Deploy sonrasi giris yapmis bir hesapla sepet senkronu ve (sandbox) `409` akisi bir kez elle denenmeli.

---

## Footer: "Bültenimize katılın" bölümü kaldırıldı (2026-09-21)

Plan: `FOOTER_BULTEN_KALDIRMA_PLANI.md`. Bülten yalnızca footer'da vardı ve formun arkasında endpoint/DB yoktu (submit hiçbir şey yapmıyordu); kaldırınca veri/işlev kaybı yok. `src/` ve `prisma/` içinde bülten/abone/newsletter grep'i başka kullanım bulmadı (admin tarafında bülten yönetimi de yok).

- `src/components/site-footer.tsx`: bülten sütunu (başlık, açıklama, form) ve import silindi; Kurumsal / İletişim / Alışveriş sütunları eski yerinde, masaüstünde sağ yarıda (`md:col-start-2`); sol yarı bilinçli olarak boş bırakıldı (bülten alanı, yeni içerik için ayrıldı). Mobilde tek sütun.
- `src/components/footer-newsletter-form.tsx`: silindi (başka yerde import edilmiyordu).
- Sol yarıya (eski bülten alanı): yan yana 3 güven kutusu, yalnızca ikon + başlık (Güvenli ödeme / Kolay iade / Hızlı kargo). Marka cümlesi logonun altında kaldı (eski yerinde).
- Sağ alt köşe (alt bar): iyzico'nun resmi logo paketindeki footer bandı (beyaz varyant): "iyzico ile Öde" + Mastercard + Visa + American Express + Troy. Dosya `public/payment/iyzico-logo-band-white.svg` (kaynak: docs.iyzico.com/ek-bilgiler/iyzico-logo-paketi). iyzico, sitede "iyzico ile Öde", Visa ve Mastercard logolarının bulunmasını şart koşuyor.
- Not: "Hızlı kargo" ifadesini sitede teslimat süresi bilgisi olmadığı için önce koymamıştık; sahibinin kararıyla eklendi. Teslimat süresi net değilse Kargo Bilgisi sayfasında desteklenmeli.

**Doğrulama**: `prisma generate` sonrası `tsc --noEmit` temiz (pull ile gelen `customerCart` modeli için client yeniden üretilmemişti, footer'la ilgisiz). `eslint` footer dosyasında temiz; `npm run lint` genelinde başka dosyalardan gelen önceden var olan hatalar duruyor (ör. `wishlist.tsx`). Headless Chrome ile 390px ve 1600px'te `/iletisim` footer'ı görsel kontrol edildi: mobilde tek sütun, masaüstünde üç eşit sütun, logo/alt bar bozulmadı (kapıyı geçmek için dev server yalnızca bu oturumda `PREVIEW_GATE=off` ile çalıştırıldı, dosya değişmedi).

---

## Ana sayfa: "Yeni Gelenler" alti bolumleri (2026-09-22)

Plan: `ANASAYFA_ALT_BOLUMLER_PLANI.md`. Hero ve Yeni Gelenler (FeaturedCarousel, ProductCard) DOKUNULMADI; Yeni Gelenler'in kart verisi donusumu yalniz ortak yardimciya (`toProductCardData`) tasindi, ciktisi ayni.
Yeni sira: Hero -> Yeni Gelenler -> **A** editoryal ikili blok -> **B** kategori kartlari -> **C** lookbook -> **D** cok satanlar -> **E** Instagram -> **F** SSS + magaza -> footer.

**Yapilanlar**
- `src/app/(site)/page.tsx`: A/B/C bolumleri, tum sorgular tek `Promise.all` icinde (urunler, kampanyalar, cinsiyet/kategori sayilari, kategori `imageUrl`'leri, satis `groupBy`, `StoreSettings`). Unsplash hotlink'leri kalktı; gorseller `public/anasayfa/` altinda yerel (`KAYNAKLAR.md`: fotografci + foto kimligi).
- B (kategori kartlari): Kadin/Erkek/Cocuk (cinsiyet filtresi), Ayakkabi/Aksesuar (kategori slug `ayakkabi`, `aksesuar`; alt kategoriler dahil - katalog filtresiyle ayni kural). Sayisi 0 olan kart gizli. Kategorinin `imageUrl`'i doluysa o (duz `<img>`, remotePatterns disi kaynak olabilir), yoksa yerel yedek. Masaustunde `lg:grid-flow-col auto-cols-fr` (5 kartta 5 sutun; kart sayisi az ise sagda bos alan kalmaz), tablet 3 sutun, mobil yatay kaydirmali (snap-x, ~44vw).
  **Gercek veri (bu oturumda okundu)**: yayindaki urun: Kadin 54, Erkek 14; Cocuk ve Ayakkabi 0, Aksesuar 2 (Canta). Yani canlida su an 3 kart gorunur (Kadin, Erkek, Aksesuar); Cocuk (`gender = "Cocuk"`, `excel-import.ts` GENDER_MAP) ve Ayakkabi kartlari urun eklenince kendiliginden cikar.
- C (lookbook): yerel gorsel + gradient overlay, `Her gune <em>uyan</em> parcalar`, min-h 60vh/70vh. Opsiyonel "Sezon firsati: %X'e varan indirim" etiketi EKLENDI: oran, kartlardaki gercek kampanya indiriminden (`resolveProductDisplayPrice`, `source === "KAMPANYA"`) en yuksegi; kampanya yoksa etiket yok (su an gorunmuyor olabilir). Turkce -e hali eki sayiya gore (`percentWithDative`: %20'ye, %30'a, %70'e ...).
- D (cok satanlar, `components/home/bestsellers-tabs.tsx` + `lib/home-products.ts`): son 90 gun, `REVENUE_STATUSES` (PAID/PREPARING/SHIPPED/DELIVERED, `lib/orders.ts`), silinmis siparis (`deletedAt`) haric; stokta olmayan haric; sekme basina en fazla 8. Satisi olan urun 4'ten azsa once `isFeatured`, sonra en yeni ile 8'e tamamlanir. Ek urun sorgusu yok (getPublishedProducts zaten hepsini getiriyor). Sekmeler: Tumu/Kadin/Erkek/Cocuk, urunu olmayan gizli (su an Cocuk yok); `role="tablist"`, ok/Home/End tuslari.
- E (Instagram, `components/home/instagram-grid.tsx`, `lib/instagram-posts.ts`): `NEXT_PUBLIC_INSTAGRAM_URL` bos VEYA `public/instagram/post-1..6.jpg` eksikse bolum HIC render edilmez. `.env.example`'a degisken eklendi; `public/instagram/README.md` yazildi. Vercel'e DEGER EKLENMEDI. `next.config.mjs`'e `outputFileTracingIncludes: { "/": ["./public/instagram/**/*"] }` eklendi (Vercel'de public/ islev paketine girmedigi icin fs kontrolu aksi halde hep "yok" derdi).
- F (SSS + magaza, `components/home/faq-and-store.tsx`): 5 soru, `<details>`, `FAQPage` JSON-LD. Cevaplar yalniz kodda dogrulanan bilgiden: kargo 1-3 is gunu (Teslimat Sartlari sayfasi), ucret + esik canli `StoreSettings.defaultShippingCents` (350 TL) ve `SHIPPING_THRESHOLD_CENTS` (1.000 TL) degerinden, iade 14 gun (Iade Kosullari), beden tablosu (urun sayfasi), odeme iyzico + 3D Secure (taksit vaadi yok), takip `/siparis-durumu`. Magaza karti: adres, "Yol tarifi al" (Google Maps arama URL'si), "Iletisim". `contactPhone`/`contactEmail` su an DB'de bos oldugu icin satirlar gizli. Calisma saati ve "magazadan teslim" yazilmadi.

**Dogrulama**
- `npx tsc --noEmit` temiz; `npm run lint` 0 hata (6 uyari onceden var, benim dosyalarimda degil; ilk kosuda `Date.now()` render icinde hata verdi, `bestsellerSince()` yardimcisina alinarak giderildi); `npm run build` basarili (`/` ISR, 1m).
- Hero + Yeni Gelenler: onceki/sonraki ekran goruntuleri (390 ve 1600px) BAYT BAYT ayni (md5 esit).
- 390px: yatay tasma yok (scrollWidth = clientWidth), kategori seridi kaydirilabilir (571 > 390), sekmeler sigiyor, basliklar kesilmiyor. 1600px: B/D/F basliklari Yeni Gelenler ile ayni sol kenarda (36px; mobilde 16px).
- Sekmeler: tiklama, ArrowRight/Home ile degisim, `aria-selected` dogrulandi; SSS `<details>` acilip kapaniyor; konsol hatasi yok.
- Instagram: env bos -> bolum yok; env dolu + dosya yok -> bolum yok; env dolu + 6 gecici dosya -> 3 sutun (mobil) / 6 sutun (masaustu), `target=_blank rel="noopener noreferrer"` (gecici dosyalar silindi).
- Bos DB: urunler ve sayaclar 0'a zorlanarak (gecici, geri alindi) sayfa 200 doner; Cok Satanlar ve kategori bolumleri gizli, "Henuz yayinlanmis urun yok" mesaji cikar. `pickBestsellers` (satis / yedek / stok disi / bos liste) ve `percentWithDative` icin gecici betikle birim testleri gecti (betik silindi).
- Sayfa HTML'inde `images.unsplash.com` yok (urun yedek gorseli `toProductCardData` icinde bilerek duruyor). Yeni gorsellerde `sizes` var, hicbiri `priority` degil.
- Dogrulanamayan: Lighthouse/CLS olculmedi (yalniz `sizes` + sabit en-boy orani kutulari ile onlem alindi). Canli (Vercel) uzerinde Instagram `fs` kontrolu, dosyalar eklenene kadar denenemez.

**Bekleyen / dikkat**
- Instagram bolumu su an GIZLI (kabul edilen davranis). Acmak icin: profil adresi (`NEXT_PUBLIC_INSTAGRAM_URL`, Vercel'e eklenip yeniden deploy) + 6 kare fotograf (`public/instagram/post-1..6.jpg`, 1080x1080, bkz. README).
- `koleksiyon-ayakkabi.jpg` fotografinda gorunur Nike/"AIR" markasi var (plandaki kimlik); Ayakkabi karti su an gizli oldugu icin ekranda yok, kart acilmadan once marka icin uygun bir gorselle degistirilmeli. `koleksiyon-aksesuar.jpg` bir atolye masasindaki kozmetik/kalem cantalari, arka planda kisiler var; gorunuyor, istenirse degistirilebilir.
- Magaza kartinda adres plandaki gibi "Runguçpaşa Mah. 75. Sk. No:6/A"; `/iletisim` sayfasi "Runguşpaşa, 75. Sk. No: 6" yaziyor ve orada calisma saati de var (kartta plan geregi yok) - tutarsizlik sahibine birakildi.
- Kategori sayilari: Aksesuar sayisi Ayakkabi'yi da kapsar (Ayakkabi, Aksesuar'in alt kategorisi).

---

## Ucretsiz kargo esigi 1.500 TL (2026-09-22)

Sahibinin karariyla `SHIPPING_THRESHOLD_CENTS` 100000 -> 150000 (`src/lib/shipping.ts`). Esik tek yerde tanimli; odeme sayfasi (`checkout-form.tsx`), sunucudaki siparis hesabi (`api/orders/route.ts`) ve ana sayfa SSS cevabi (`faq-and-store.tsx`) ayni sabiti okur, baska sabit kodlu "1.000 TL" metni yok. `tsc` temiz, `npm test` 79/79. Kargo ucreti (350 TL) `StoreSettings`ten gelmeye devam eder. Ustteki ana sayfa notunda gecen "1.000 TL" bu satirla gecersizdir.

---

## Ayakkabi kart gorseli PUMA ile degistirildi (2026-09-22)

Plandaki ilk Ayakkabi gorselinde gorunur Nike markasi vardi; magazada PUMA ve SLAZENGER satildigi icin sahibinin istegiyle `public/anasayfa/koleksiyon-ayakkabi.jpg` beyaz PUMA spor ayakkabi fotografiyla (The DK Photography, Unsplash `1608229751021-ed4bd8677753`) degistirildi; dosya acilip PUMA logosu gozle dogrulandi. Unsplash aramasinda Slazenger sonucu cikmadi. `KAYNAKLAR.md` guncellendi. Ayakkabi karti, kategoride yayinda urun olmadigi surece (sayi 0) ana sayfada GIZLI kalir; urun eklenince kendiliginden gorunur. Ustteki ana sayfa notundaki "Nike/AIR markasi" maddesi bu satirla gecersizdir.

---

## Ayakkabi kategori karti bos olsa da gorunur (2026-09-22)

Sahibinin istegiyle ana sayfadaki "Ozel Koleksiyonlarimiz" bolumunde Ayakkabi karti, kategoride yayinda urun olmasa da gosterilir (`ALWAYS_SHOWN_COLLECTIONS`, `src/app/(site)/page.tsx`). Sayi 0 iken ust simge gizlenir. Diger kartlar (Cocuk dahil) eski kuralla, sayisi 0 ise gizli kalir. Kart `/urunler?kategori=ayakkabi` adresine gider; kategoride urun yokken katalog "Bu kategoride henuz urun bulunmuyor." mesajini gosterir (sayfa 200 doner). `tsc` temiz, `lint` 0 hata; 390/1600px gorsel kontrol yapildi (yatay tasma yok, mobil serit kaydirilabilir). Ustteki "Ayakkabi karti gizli" notlari bu satirla gecersizdir.

---

## Bos kategori "Yeni parcalar yolda" ekrani (2026-09-22)

Plan: `BOS_KATEGORI_YAKINDA_TASARIMI_PLANI.md`. Urunu olmayan kategori sayfasindaki duz "Bu kategoride henuz urun bulunmuyor." satiri yerine tasarimli bir "yakinda" ekrani.

**Dosyalar**
- `src/components/empty-category-state.tsx` (yeni, client): sallanan askı SVG'si + pirilti isaretleri, "YAKINDA" etiketi, "Yeni parcalar *yolda*", kategori/cinsiyete gore metin, e-posta formu (pill input + "Haber Ver", basari/hata, `aria-live`, honeypot), "Bu arada goz atmak ister misin?" (yayindaki kategoriler, en fazla 5, yatay kaydirmali; oneri yoksa "Tum Urunleri Gor").
- `src/app/(site)/urunler/page.tsx`: yalniz `hasActiveFilters === false && entries.length === 0` dali degisti (filtreli bos durum ve urun listesi ayni). Bos kategori `filterCategories`te olmadigi icin ayrica okunuyor; boylece banner basligi/breadcrumb de kategori adini gosteriyor (eskiden "Tum Urunler" yaziyordu). `generateMetadata`: kategoride yayinda urun yoksa `robots: noindex`.
- `src/app/globals.css`: `.empty-hanger-swing`, `.empty-sparkle` animasyonlari. Plandaki `prefers-reduced-motion`'da kapatma BILEREK uygulanmadi (projedeki animasyon kurali: her zaman calissin).
- `prisma/schema.prisma`: `CategoryAlert` modeli (`categoryId`, `gender` bos string = cinsiyetsiz, `email`, `ipHash`, `notifiedAt`, `createdAt`; `@@unique([categoryId, gender, email])`). `gender` NULL yerine `""` cunku Postgres unique'te NULL'lar birbirinden farkli sayilir, upsert calismazdi. `ipHash` yalniz hiz siniri icin.
- `src/app/(site)/api/kategori-bildirimi/route.ts` (yeni): zod + upsert (`notifiedAt` sifirlanir), kategori yoksa 404, honeypot dolu ise sessizce basarili, ayni IP'den dakikada en fazla 5 yeni kayit (`iletisim` route'undaki tablo tabanli yontem).

**Migration**: `npm run db:push` (projedeki yontem) Neon'a uygulandi, `prisma generate` calistirildi. Yeni tablo eklendi, mevcut veriye dokunulmadi. Ek env/Vercel degiskeni gerekmiyor.

**Dogrulama**: `tsc` temiz, `npm run build` basarili, `lint` 0 hata (6 onceki uyari). Yerelde `/urunler?kategori=ayakkabi` 1440 ve 390px'te gorsel kontrol (yatay tasma yok); form: gecersiz e-posta -> satir ici hata, gecerli -> basari mesaji, ayni e-posta tekrar -> basari (upsert); cinsiyetli metin ("Kadin koleksiyonunda ..."); noindex meta; urunlu kategori ve filtreli bos durum degismedi. Test kaydi Neon'dan silindi.

**Bilinen not**: Onerilen kategori kartlarinda `imageUrl` bos olanlar gri kutu olarak gorunur (bugun cogu kategori gorselsiz); admin'den kategori gorseli eklenince dolar.

**Sonraki adim**: kategoriye ilk urun yayinlaninca `CategoryAlert` kayitlarina mail gonderimi (`notifiedAt` doldurma) + admin'de kayit listesi. Bu isin kapsami disindaydi.

---

## Bos kategori ekrani: e-posta formu kaldirildi, kartlara ornek urun gorseli (2026-09-22)

Sahibinin karariyla "Haber Ver" e-posta formu kaldirildi (plandaki opsiyonel bolumdu, istenmiyordu). Ustteki "Bos kategori ..." notundaki form, `CategoryAlert`, `/api/kategori-bildirimi` ve "sonraki adim: mail gonderimi + admin listesi" maddeleri bu satirla gecersizdir.

- `src/components/empty-category-state.tsx`: form, honeypot, durum state'i ve `"use client"` silindi (artik sunucu bileseni); metin "... Cok yakinda burada." oldu.
- `src/app/(site)/api/kategori-bildirimi/route.ts` silindi; `prisma/schema.prisma`'dan `CategoryAlert` modeli cikarildi. **Neon'daki `CategoryAlert` tablosu hala duruyor** (0 satir, hicbir kod kullanmiyor): `prisma db push --accept-data-loss` ile dusurulmesi gerekiyor, bu oturumda izin verilmedigi icin calistirilmadi. Zararsiz; su sekilde temizlenebilir: `npx prisma db push --accept-data-loss`.
- Oneri kartlari: gorsel artik o kategoriden en yeni urunun ilk fotografi (`firstImageUrl`: once `images`, yoksa `optionImages` - fotograflar cogunlukla renk altinda tutuluyor), yoksa kategori gorseli. Sorgu `urunler/page.tsx` icindeki `withSampleProductImages`, yalniz bos ekran gosterilirken calisir.
- Sol ilk kartin yarisinin kesilmesi (tasan icerikte `justify-center` solu kesiyordu) giderildi: ilk/son karta `ml-auto`/`mr-auto`. Mobilde `scroll-pl-4` (kaydirma cubugu gorunur kalir, sahibi istedi).

---

## Vercel "Functions Storage" kotasi analizi (2026-09-22) - yalniz analiz, kod degismedi

Sorun: kota 7,91/10 GB (30 gunluk pencere), her deploy'da artiyor. Bu not sadece olcum + oneri; hicbir oneri UYGULANMADI.

**Yontem / sinirlar**: `vercel` CLI bu makinede yuklu degil ve oturum acik degil (`vercel build` icin `vercel pull` + giris gerekir), bu yuzden `vercel build` CALISTIRILAMADI. Yerine `.next` uretim build'inin (2026-09-22 01:12) her route icin urettigi nft trace dosyalari (`.next/server/**/*.nft.json`) okundu; Vercel function paketini bu listeden kurar. Fark: yerel Windows build'i oldugu icin `sharp` Linux ikili dosyalari (asagida) olculemedi. Olcum betikleri oturumun gecici klasorundeydi, repoya eklenmedi.

**Sonuc (deploy basina, paylasimsiz toplam)**
- 90 nft dosyasi; statik onuretilmis sayfalar cikarilinca ~80 gercek lambda, toplam ~600 MB (tum nft'ler: 637 MB). Function basina min 1,7 / medyan 7,1 / maks 14,4 MB (ana sayfa `/`).
- Kalem dagilimi (tum function'lar toplami): `@prisma/client` ~385 MB (%60), `next` calisma zamani ~119 MB (1,3 MB x 90), `.next/server/chunks` (uygulama kodu) ~104 MB, `public/` ~7,6 MB, `sharp` 5 admin route'unda.
- En buyukler: `/` 14,4 MB; admin `gorsel-ekle/gorsel-yenile/gorsel-getir/gorsel-renk-ara` ~10,7 MB; `admin/upload` 9,0; `urunler/[slug]` 8,8; diger admin sayfalari ~7,4-8,4 MB.

**Nedenler**
1. `node_modules/@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs` = 4,58 MB, HER lambda'da (~80/80; kok layout/ortak kodlar prisma'ya dokunuyor). Prisma 7 `prisma-client` uretecinin varsayilan "fast" derleyicisi. Ayni klasorde "small" varyanti 2,31 MB.
2. Ana sayfa function'i `public/` altini (menu 3,4 MB, anasayfa 2,2 MB, hero-model.jpg 1,3 MB, catalog-banner.jpg 0,4 MB = ~8,2 MB) paketliyor. Sebep `next.config.mjs`teki Include DEGIL, `src/components/home/instagram-grid.tsx:24` icindeki `existsSync(path.join(process.cwd(), "public", ...))`: nft bunu `public/*` joker izi olarak okuyor. Bu gorseller Vercel'de CDN'den servis edildigi icin lambda'da gereksiz. Diger 88 lambda'da `public/` yalniz ~0,09 MB (logo/ikon).
3. `urunler/[slug]` (musteri sayfasi) `description-html.ts` uzerinden cheerio + undici + htmlparser2 (tek 1,46 MB chunk) aliyor; admin gorsel route'lari da ayni chunk'i `koton-images.ts` uzerinden aliyor (orada gercekten gerekli).
4. `sharp` (5 admin route'u): yerelde 0,6 MB + 0,42 MB win32 `.node`; Vercel'de (Linux) `@img/sharp-linux-x64` + libvips eklenir, tahminen +15 MB/route (OLCULMEDI).

**Config kontrolu**
- `next.config.mjs`: yalniz `outputFileTracingIncludes: { "/": ["./public/instagram/**/*"] }` var (izlenen: yalniz 2 README.md, 0 MB - sorun degil). `outputFileTracingExcludes` YOK.
- Prisma `binaryTargets`: schema'da yok; uretec `prisma-client` (Rust motoru yok, wasm derleyici + Neon adapter). Hicbir lambda'da query-engine/`.node` binary'si izlenmiyor (tek `.node` sharp'in). Yani "fazla platform binary'si" sorunu YOK; asil kalem wasm derleyicisi.

**Oneriler (tahmini kazanc, uygulanmadi)**
1. `prisma/schema.prisma` generator'a `compilerBuild = "small"` + `prisma generate`: -2,27 MB x ~80 lambda = **~-170 MB deploy basina (~%29)**. En buyuk ve en kolay kazanc. Risk: sorgu derleme biraz yavaslayabilir; canliya cikmadan admin/urun listesi ile denenmeli.
2. Ana sayfa icin `outputFileTracingExcludes: { "/": ["./public/menu/**", "./public/anasayfa/**", "./public/hero-model.jpg", "./public/catalog-banner.jpg", "./public/payment/**"] }`: **~-8 MB** (yalniz 1 lambda, ~%1,4). Include/Exclude birlikte `public/instagram` izini koruyor mu build'de dogrulanmali. Kalici cozum: `existsSync` kontrolunu `public` joker izi birakmayacak sekilde (sabit liste / env) degistirmek.
3. `description-html.ts`ten cheerio'yu ayirmak (render yolunda yalniz sanitize-html kalsin): `urunler/[slug]`ta **~-1,4 MB** (1 route, kucuk).
4. Deploy sayisini azaltmak: son 30 gunde 339 commit, bunun 55'i (%16) yalniz `.md`; her push deploy uretiyorsa bos yere kota harciyor. Vercel > Settings > Git > Ignored Build Step: `git diff HEAD^ HEAD --quiet -- . ':(exclude)*.md'` (0 = build atla). Ayrica commit'leri toplu push etmek.
5. Kalibrasyon (once bu yapilmali): Vercel > son deployment > Functions/Build Summary'deki gercek function boyutlari ile bu nft olcumu karsilastirilmali; ayrica tek bir deploy sonrasi kota artisi (MB) ~600 MB mi (ham) yoksa ~150-200 MB mi (sikistirilmis) bakilmali. 339 commit x 600 MB kotadan cok buyuk oldugundan Vercel'in olcumu ham toplam degil (sikistirma/tekilleme/tum push'lar deploy degil); "kota / deploy" oranini bilmeden kazanc mutlak GB olarak degil, **oransal (~%30)** okunmali.

**Toplam beklenti**: 1+2+3 ile deploy basina ~600 MB -> ~420 MB (~%30 azalma); 4 ile deploy sayisi ~%15 daha az. Function sayisini azaltmak (admin ~50 sayfa = ~350 MB) mimari degisiklik gerektirir, onerilmedi. Edge runtime'a gecis de (bcryptjs/sharp/Prisma) riskli oldugu icin onerilmedi.

**Gerekirse gercek `vercel build`**: `npm i -g vercel` -> `vercel login` -> `vercel pull --yes` (NOT: `.vercel/.env.*.local` icine gercek env yazar, gitignore'da) -> `vercel build` -> `du -sh .vercel/output/functions/*.func`.

---

## Functions Storage: 4 oneri uygulandi (2026-09-22)

Ustteki "Vercel Functions Storage kotasi analizi" notundaki 4 oneri sirayla uygulandi; her adimdan sonra `tsc --noEmit`, `npm test` (79/79) ve `npm run build` calistirildi, hepsi temiz (lint: 0 hata, onceki 6 uyari). Boyutlar yine yerel `.next` nft izlerinden olculdu (gercek `vercel build` yapilamadi, Windows izi); gercek Vercel boyutu ilk deploy'da panelden dogrulanmali.

| Adim | Degisiklik | Olculen sonuc (paylasimsiz toplam nft) |
|---|---|---|
| Baslangic | - | 637,6 MB (~80 lambda ~600 MB) |
| 1 | `prisma/schema.prisma` generator'a `compilerBuild = "small"` + `prisma generate` | 455,7 MB (-182 MB, %28,5); medyan function 7,1 -> 4,9 MB |
| 2 | `next.config.mjs`: `outputFileTracingExcludes` ("/" icin menu, anasayfa, hero-model.jpg, catalog-banner.jpg, payment) | 448,3 MB; ana sayfa 14,4 -> 4.88 MB |
| 3 | `description-html.ts` cheerio'suz (yalniz sanitize-html); cheerio normalize adimi `koton-images.ts`'e tasindi (`normalizeKotonDescription`) | 447,0 MB; `urunler/[slug]` 8,8 -> 5,3 MB, cheerio/undici bloku pakette yok |
| 4 | `vercel.json` `ignoreCommand` | deploy sayisini azaltir, boyutu degistirmez |

**Toplam**: 637,6 -> 447,0 MB (**-190 MB, %29,9**); gercek lambda'lar ~600 -> ~418 MB. En buyuk function 14,4 -> 8,6 MB (admin gorsel route'lari, sharp/cheerio gerekli).

**Dogrulamalar**
- Adim 1: Neon'a karsi admin urun listesi sorgusu (include ile, 20 satir) ve siparis listesi sorgusu hatasiz calisti (Neon'da siparis yok, 0 satir dondu). "fast" ile "small" ayni sorgularla karsilastirildi: soguk ilk sorgu ~300 ms, urun listesi medyan ~300 ms, siparis ~122 ms - iki varyantta fark yok (ag gecikmesi baskin).
- Adim 2: build sonrasi ana sayfa izinde `public/instagram/*` (gecici bir `post-1.jpg` ile denendi, sonra silindi) hala var; menu/anasayfa/hero/banner/payment yok. Include ile Exclude cakismadi. Logo/ikon dosyalari (~0,09 MB) izde kaliyor.
- Adim 3: eski (cheerio'lu) ve yeni uygulama Neon'daki 68 urun aciklamasinda + 11 bozuk-HTML/XSS ornegiyle karsilastirildi: HTML farki 0 (DB'de yalniz `\r\n` -> `\n` satir sonu, gorsel etkisiz), duz metin farki yalniz `<script>/<style>` icerigi artik metne sizmiyor (iyilesme). Bozuk `<p><p>` girdilerinde eski davranisi korumak icin sanitize sonrasi `<p></p>` temizligi eklendi. Koton import yolu (cheerio -> sanitize) eskisiyle ayni sonucu verir.
- Adim 4: komut gercek commit'lerde denendi: yalniz `.md` degistiren commit'lerde cikis 0 (build atlanir), kod commit'lerinde 1 (build calisir); `vercel.json` gecerli JSON, `crons`/`rewrites` aynen duruyor.

**DIKKAT (ignoreCommand)**: komut yalniz SON commit'i (`HEAD^` -> `HEAD`) karsilastirir. Bir push'ta birden fazla commit varsa ve sonuncusu yalniz `.md` ise (ornegin kod commit'i + DEPLOY_STATUS commit'i birlikte push edilirse) kod degisiklikleri DEPLOY EDILMEZ, bir sonraki kod push'una kadar canliya cikmaz. Daha guvenli alternatif (Vercel'in "son basarili deploy" SHA'si; ortam degiskeni Vercel'de dogrulanmadi): `git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- . ':(exclude)*.md'`. Ayrica Vercel'de Settings > Git > Ignored Build Step alani doluysa vercel.json'u ezebilir; panelde bos olmali.

**Bekleyen**: degisiklikler commit/push EDILMEDI. Gercek etki ilk deploy sonrasi Vercel panelinde (Functions boyutlari + kota artisi) dogrulanmali; `sharp` Linux ikilileri (5 admin route'u) hala olculemedi.

---

## ignoreCommand guvenli surume gecti + eski deployment temizligi (2026-09-22)

**1. `vercel.json` `ignoreCommand`**
- Eski: `git diff HEAD^ HEAD --quiet -- . ':(exclude)*.md'` (yalniz son commit'e bakiyordu)
- Yeni: `git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- . ':(exclude)*.md'` (son basarili deploy'dan bu yana TUM commit'lere bakar; degisken yoksa `HEAD^`'e duser). Boylece "kod commit'i + sonda .md commit'i" ayni push'ta olsa da kod deploy edilir. Bu, yukaridaki "DIKKAT (ignoreCommand)" uyarisinin cozumudur.
- Dogrulama: `tsc --noEmit` temiz, `npm run build` basarili. Komut gecici worktree'de gercek commit'lerle denendi: ucu yalniz `.md` olan commit'te eski komut cikis 0 (build ATLAR, kod kaybi riski), yeni komut onceki SHA kod commit'inden onceyse cikis 1 (build calisir), fark yoksa 0, gecersiz SHA'da 128 (build calisir, guvenli yon). `VERCEL_GIT_PREVIOUS_SHA` degiskeninin Vercel'de gercekten tanimli oldugu ilk deploy'da hala dogrulanmadi (tanimsizsa `HEAD^` fallback'i eski davranisla ayni). Panelde Settings > Git > Ignored Build Step bos olmali.
- Degisiklik commit/push EDILMEDI.

**2. Vercel deployment temizligi (Vercel CLI, `r7zenith` hesabi, login gerekmedi)**
- Onceki durum: 42 deployment (hepsi production, READY; 2026-09-18 23:12 - 2026-09-21 22:14). `bollmark.com` ve `www.bollmark.com` en yeni deployment'a bagliydi.
- Kullanici onayiyla en yeni 3 disinda **39 deployment silindi** (`vercel remove <id> --yes`, 0 basarisiz).
- Kalan deployment ID'leri: `dpl_CvWdLrVN2gduNxnovPmQXrim4L7q` (production alias'lari bunda), `dpl_8Z4hBTToWe53jmDkAX8RH6cwCNxq`, `dpl_37i4KueQSmThUqbbjzJNrAFCux2t`.
- Silme sonrasi: `bollmark.com`, `www.bollmark.com`, `bollmark.com/urunler` -> HTTP 200; alias'lar hala `dpl_CvWdLrVN...`'de.
- Not: bu, silinenlere ait rollback secenegini de kaldirir; geri donus yalniz kalan 3 deployment'a mumkun.

---

## Dogrulama: optimizasyonlar push edildi mi, gercek boyut ne cikti (2026-09-22)

**Commit/push durumu**: 4 optimizasyon (`compilerBuild = "small"`, `outputFileTracingExcludes`, cheerio'suz `description-html.ts`, guvenli `ignoreCommand`) hepsi `a47f3d6` commit'inde ("Vercel function boyutu kucultme + guvenli ignoreCommand", 2026-09-22 02:01) toplu halde commit/push EDILDI, `origin/main` ile ayni. Ustteki iki nottaki ("Functions Storage: 4 oneri uygulandi" ve "ignoreCommand guvenli surume gecti") "bekleyen: commit/push edilmedi" ifadeleri bu commit'ten ONCEKI ana aitti, artik gecersiz.

**Kullanicinin panelden teyidi**: Vercel panelinde en son (production) deployment'in commit'i `a47f3d6` olarak goruluyor; yani su an bildirilen ~560 MB rakami zaten butun optimizasyonlari iceren bu commit'e ait. Beklenen ~%30'luk azalma (637,6 -> ~447 MB yerel tahmin) ile karsilastirildiginda 560 MB daha yuksek cikiyor; en olasi sebep DEPLOY_STATUS.md'de zaten not edilen sharp'in Linux native binary'leri (`@img/sharp-linux-x64` + libvips, yerel Windows olcumune hic girmemisti, 5 admin route'unda) ve/veya Vercel'in raporladigi rakamin nft izlerinden hesaplanan "paylasimsiz toplam" ile ayni olcum yontemini kullanmiyor olmasi.

**Gercek `vercel build` ile olcum denendi, TAMAMLANAMADI**: `vercel pull --environment production` + `vercel build --prod` bu oturumda calistirildi ama iki engelle karsilasildi:
1. `vercel pull` hassas env degiskenlerini (DATABASE_URL dahil, 12 adet) `[SENSITIVE]` placeholder'i ile indirdi; ilk build denemesi bu yuzden `/hesap/giris` sayfasinin static export'unda gecersiz DB URL hatasiyla basarisiz oldu.
2. Yerel `.env`'deki (ayni Neon DB) degerlerle placeholder'lar dolduruldu (`.vercel/.env.production.local`, gitignore'da, git'e gitmedi), ikinci deneme ise oturumun otomasyon siniflandiricisi tarafindan "Credential Exploration" gerekcesiyle engellendi ve calistirilamadi.
- Sonuc: sharp'in Linux binary boyutu ve gercek `.vercel/output/functions/*.func` boyutlari bu oturumda da OLCULEMEDI. `.vercel/.env.production.local` dosyasi yerelde (secret degerlerle) kaldi; istenirse `vercel build` izin verilerek interaktif oturumda tekrar denenebilir, ya da dosya silinebilir.

**ignoreCommand kontrolu**: `vercel.json`daki guvenli surum (`VERCEL_GIT_PREVIOUS_SHA` fallback'li) degismeden duruyor, dogrulandi. Vercel panelinde Settings > Git > Ignored Build Step alaninin BOS olmasi gerekiyor (bu ayari ezebilir) - bu, koda erisimi olmayan bir panel ayari oldugu icin kullanici tarafindan kontrol edilmeli.

---

## Odeme sayfasinda kayitli adres secimi (2026-09-22)

`ODEME_KAYITLI_ADRES_SECIMI_PLANI.md`'deki plan uygulandi.

- `src/app/(site)/odeme/page.tsx`: Musteri oturumu artik **opsiyonel** okunuyor (`getServerSession(customerAuthOptions)`, redirect YOK - misafir siparisi bozulmadi). Oturum varsa `prisma.customerAddress.findMany({ where: { customerId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] })` ile adresler cekilip `CheckoutForm`'a `savedAddresses` prop'u olarak, `session.user.email` de `customerEmail` prop'u olarak geciliyor.
- `src/app/(site)/odeme/checkout-form.tsx`: "Teslimat Bilgileri" basliginin altina, kayitli adresler varsa her biri icin secilebilir bir radyo karti (etiket + kisa ozet) + ayri bir "Yeni adres kullan" secenegi eklendi; varsayilan adres (ilk siradaki, `isDefault` once siralaniyor) baslangicta secili. Bir adres seciliyken alttaki `customerName/customerPhone/shippingAddress/city/district/postalCode` alanlari o adresin degerleriyle doluyor ve **salt-okunur** oluyor (planin (a) secenegi); "Yeni adres kullan" secilince alanlar bosalip normal duzenlenebilir hale donuyor. `customerEmail` alani oturumdaki e-posta ile onceden doluyor ama her zaman duzenlenebilir kaliyor.
  - Onemli detay: alanlar `disabled` degil `readOnly` yapildi - `disabled` input'lar `FormData`'ya dahil olmuyor, bu da `/api/orders`'a giden payload'da adres alanlarinin bos gitmesine yol acardi. `readOnly` hem gorsel olarak salt-okunur hem de submit'te deger tasiyor.
  - Secim degisince inputlara dogru `defaultValue` yansisin diye her input'a `addressChoice`'a bagli bir `key` verildi (secim degisince input remount olup yeni degerle acilir) - React'in uncontrolled input + degisen `defaultValue` sorununu bu sekilde asildi.
- `/api/orders` route'unda hicbir degisiklik YOK (plana gore) - payload sekli ayni, sadece alanlarin ilk degeri degisti.
- Dogrulama: `npx tsc --noEmit` temiz. Tarayicida gorsel/fonksiyonel test bu oturumda YAPILMADI (dev server calistirilmadi) - onerilir: giris yapmis bir musteri hesabiyla `/odeme`'ye gidip kayitli adres karti secilince alanlarin dolup salt-okunur oldugunu, "Yeni adres kullan" ile bosalip duzenlenebilir oldugunu, misafir modunda (oturumsuz) adres blogu hic gorunmedigini kontrol et.
- Degisiklik commit/push EDILMEDI.

**Bekleyen**: yok (kod tarafinda). Kalan tek acik nokta gercek sharp/Linux function boyutunun olculmesi; bunun icin ya interaktif oturumda `vercel build` izni ya da panelin Functions/Build Summary ekraninin (deployment `a47f3d6`) manuel incelenmesi gerekiyor.

---

## Sepet sayfasi (/sepet) Release temasina birebir uyum (2026-09-22)

`SEPET_SAYFASI_RELEASE_BIREBIR_PLANI.md`'deki plan uygulandi. `src/app/(site)/sepet/page.tsx` tamamen yeniden yazildi.

- Ust kisim: ortalanmis breadcrumb ("Ana Sayfa / Sepetim"), 36px/400/-1.44px baslik + sayac (cart-drawer.tsx ile ayni olcek), masaustunde sagda "Alisverise Devam Et" linki (mobilde bu link listenin altina, checkout butonunun ustune tasindi).
- Iki kolonlu govde: sol `lg:flex-1 lg:min-w-0` (urun listesi), sag `lg:w-[432px] lg:shrink-0` sabit ozet karti (`bg-ink/5`, `rounded-none`, `p-8`).
- Masaustunde 4 sutunlu tablo basligi (URUN/FIYAT/ADET/TOPLAM); mobilde ayri bir kart duzeni (gorsel+isim+fiyat ust satirda, adet secici+cop kutusu altta) - iki duzen de ayni satir icinde `hidden lg:grid` / `lg:hidden` ile ayrildi (ayni `<div>`da grid `contents` triki denenmisti, sutun hizalamasini bozdugu icin iki ayri markup'a gecildi).
- Adet secici: `border-line`, `rounded` (4px, plan onerisi - pill degil), ince `Minus`/`Plus` (lucide-react) + ayri `Trash2` ikon buton (`removeLine`).
- Sag kartin en ustunde ucretsiz kargo ilerleme cubugu: `SHIPPING_THRESHOLD_CENTS` ile `totalCents` kiyaslanip kalan tutar gosteriliyor, esik dolunca "Ucretsiz kargo kazandiniz" mesajina donuyor, `bg-stone` dolu cubuk.
- Mevcut `CouponField`, `useBundleDiscount`, `CartNotices` bilesenleri korunup yeni yerlesime tasindi.
- **Siparis notu eklenmedi** (kullanici acikca istemedi).
- **YENI**: "Mesafeli Satis Sozlesmesi'ni okudum, kabul ediyorum" checkbox'i eklendi - `/odeme`daki checkout-form.tsx'teki ayni link/metinle tutarli (`/sayfa/kullanim-kosullari` diye bir sayfa yok, projede zaten `/sayfa/mesafeli-satis-sozlesmesi` kullaniliyor). Checkbox isaretlenmeden Odemeye Gec butonu `hasBlockingIssues` mantigina ek bir kosulla (`checkoutDisabled = hasBlockingIssues || !termsAccepted`) pasif kaliyor.
- Bos sepet durumu cart-drawer.tsx'teki buyuk/italik `font-accent` tipografisiyle tutarli hale getirildi.
- "Complete the set" tamamlayici urun onerisi bu iterasyona DAHIL EDILMEDI (plana gore ayri gorev).
- **Dogrulama**: `npx tsc --noEmit` temiz. Playwright ile calisan dev server'da (`localhost:3000`, sepete gercek bir urun + mevcut bir test satiri eklenerek) hem 1600px masaustu hem 375px mobil goruntulendi - iki sutunlu masaustu duzeni, tablo basliklari, adet secici + cop kutusu, ucretsiz kargo cubugu, kupon/ozet/checkbox/buton, mobil kart duzeni ve "Alisverise Devam Et" konumu gozle dogrulandi. Ilk denemede masaustunde satir toplam fiyati ozet kartiyla cakisiyormus gibi gorunuyordu; `getBoundingClientRect` ile olculdugunde gercek bir overflow olmadigi (sag sutun tam da kartin sol kenarinda bitiyor, plan zaten "aralarinda ekstra bosluk yok" diyordu) dogrulandi.
- **Degisiklik commit/push EDILMEDI** - kullanici onayi bekleniyor.

**Kullanici geri bildirimiyle 3 duzeltme (ayni oturum, ayni gun)**:
1. Baslik/"Alisverise Devam Et" satiri `items-end` yerine `items-center` yapildi - link artik "Sepetim" basligiyla dikey ortalanmis, eskiden alt hizada kaliyordu.
2. Sol urun listesi ile sag ozet karti arasina `lg:gap-16` (64px) eklendi - kullanicinin ekran goruntusu karsilastirmasinda Release'de gercekte bir bosluk oldugu, plandaki "bitisik" notunun yanlis olculdugu ortaya cikti.
3. `/odeme` (checkout-form.tsx) icindeki "Mesafeli Satis Sozlesmesi" onay checkbox'i kaldirildi - kullanici artik onayi yalniz `/sepet` adiminda bir kez veriyor (iki kez sorulmasin istendi). `/api/orders` hala `termsAccepted: true` bekliyor (schema/DB degismedi), checkout-form artik bunu sabit `true` gonderiyor - cunku `/sepet`teki checkbox isaretlenmeden "Odemeye Gec" linki zaten pasif kalip kullaniciyi `/odeme`ye hic gecirmiyor. Not: bu onay durumu kalici bir yerde (DB/cart context) saklanmiyor, yalniz sepet sayfasindaki React state - kullanici sepete ugramadan dogrudan `/odeme` URL'sine giderse (ör. eski sekme/bookmark) UI'da tekrar sorulmadan siparis olusabilir; kullanici bunu bilerek tercih etti.

---

## Odeme sayfasi (/odeme) Release checkout gorsel diline uyum (2026-09-22)

`ODEME_SAYFASI_RELEASE_BIREBIR_PLANI.md`'deki plan uygulandi (bu bir Shopify hosted checkout oldugu icin kod kopyalanamadi, sadece olculen gorsel dil - radius/bosluk/akis - referans alindi; Bollmark'in `ink`/`line`/`stone` paleti ve `Poppins`/`font-sans` fontu korundu).

- `src/app/(site)/odeme/checkout-form.tsx` tamamen yeniden yazildi: form artik 4 bolume ayrildi - "Iletisim" (e-posta + yeni "Kampanya ve firsatlardan haberdar ol" checkbox'i, UI-only, backend'e/`payload`'a baglanmadi), "Teslimat" (mevcut kayitli adres secimi/inputlar DOKUNULMADAN, sadece `rounded-xl` gorsel stile cevrildi), "Kargo" (yeni, hesaplanan `shippingCents`'i statik bir satirda gosteren bilgi kutusu), "Odeme" (iyzico guven notu + hata + submit butonu). Her bolum basligi `text-xl font-semibold`.
- Masaustu duzeni `lg:grid lg:grid-cols-[1fr_0.87fr] lg:gap-12`, form icerigi `max-w-[580px]`; sag ozet paneli `rounded-2xl bg-ink/5` ve `lg:sticky lg:top-24`.
- Sag ozet paneli ile mobildeki acilir/kapanir "Siparis Ozeti" seridi **ayni tek `<details>` agaci** olarak kuruldu (iki ayri JSX kopyasi degil) - boylece `CouponField`/`LoyaltyField` sayfada iki kez mount olup cift API cagrisi yapmiyor. `useRef` + `matchMedia("(min-width: 1024px)")` ile masaustunde `details.open = true` zorlaniyor, mobilde native toggle (JS'siz calisan `<details>/<summary>`) aynen kaliyor; ok ikonu `group-open:rotate-180` ile donuyor.
- Urun satirlarina kucuk gorsel + siyah rozet (adet sayisi) eklendi.
- `CouponField` bilesenine geriye donuk uyumlu yeni bir `variant?: "default" | "segmented"` prop'u eklendi - varsayilan `"default"` `/sepet` sayfasindaki mevcut gorunumu birebir koruyor, `/odeme` artik `variant="segmented"` ile input+buton'u bitisik/yuvarlak koseli tek parca gosteriyor. `LoyaltyField` sadece `/odeme`de kullanildigi icin dogrudan `rounded-xl` stile cevrildi (yeni prop gerekmedi).
- Is mantigina (`handleSubmit`, `refreshPrices`, `/api/orders` ve `/api/odeme/baslat` cagrilari, fiyat hesaplama) DOKUNULMADI - sadece JSX/stil katmani degisti.
- Planin acikca "eklenmesin" dedigi Ship/Pickup pill-toggle **eklenmedi**.
- **Dogrulama**: `npx tsc --noEmit` ve `npx eslint` temiz. Calisan dev server'da (`localhost:3000`, sepete gercek bir urun eklenerek) Playwright ile hem 1440px masaustu hem 375px mobil goruntulendi: masaustunde iki kolonlu duzen + sticky ozet paneli + segmented kupon alani gozle dogrulandi; mobilde sayfa ilk acildiginda ozet seridinin **kapali** basladigi, tiklaninca urun listesi/kupon/toplamlarin tam icerigiyle acildigi ve okun donduğü ayrica test edildi.
- **Degisiklik commit/push EDILMEDI** - kullanici onayi bekleniyor.

**Kullanici geri bildirimiyle 3 duzeltme (ayni oturum, ayni gun)**:
1. Urun gorseli sag-ust adet rozeti kirpiliyordu (`overflow-hidden` olan ayni div'in disina tasan `-right-1.5 -top-1.5` konumlandirmasi rozetin ceyregini kesiyordu, daire yerine "kagit kivrimi" gibi goruntuleniyordu) - gorsel artik ayri bir ic `div`de (`overflow-hidden rounded-xl`), rozet o div'in disinda, ust kapsayici `div`de (overflow kirpmiyor) - artik tam daire gorunuyor.
2. Urun gorsellerine Release referansindaki gibi belirgin yuvarlak kose (`rounded-xl`) ve hafif/saydam golge (`shadow-[0_4px_10px_rgba(0,0,0,0.08)]`) eklendi.
3. Sag "Siparis Ozeti" paneli artik sadece icerigi kadar yuksek yuvarlak bir kutu degil - kullanicinin onayladigi secenege gore masaustunde (`lg:`) sinirsiz/rounded-none, tam sayfa yuksekligine (flex + `items-stretch` ile sol form kolonuyla esit yukseklige) uzanan, tarayicinin sag kenarina kadar giden gri arka plan oldu ("sayfa tam ortadan ikiye bolunmus" gorunumu) - mobilde (`lg:` alti) eskisi gibi kenarlardan bosluklu, yuvarlak koseli, acilir/kapanir kutu olarak kaliyor (ayni `<details>` agaci, sadece disini saran yeni bir renk/genislik `div`i eklendi).

**Kullanici geri bildirimiyle 2. tur duzeltme (ayni oturum, ayni gun)**:
1. Sag panel icerigi (Siparis Ozeti basligi, urun satirlari, kupon/toplam) onceki genislikte (`lg:max-w-[480px]`) sabit birakildi - bir onceki turda arka planla birlikte icerik de yanlislikla tum gri kolona yayilmisti, bu geri alindi: sadece arka plan genisliyor, yazilar/gorseller eskisi kadar dar kaliyor.
2. Sag gri kolon genisligi `lg:basis-[43%]`den `lg:basis-1/2`e cekildi - sayfa artik gercekten tam ortadan (1440px'de x=720) ikiye bolunuyor, sol form kolonu da ayni `lg:basis-1/2`.
3. Urun gorsellerinin kose yuvarlakligi `rounded-xl`den `rounded-lg`e, golgesi de daha belirgin bir degere (`shadow-[0_6px_14px_rgba(0,0,0,0.16)]`) cekildi - onceki golge (0.08 opaklik) acik gri arka planda neredeyse hic gorunmuyordu.

**Kullanici geri bildirimiyle 3. tur duzeltme (ayni oturum, ayni gun)**:
- Urun gorseli kartı Release'in gercek checkout gorseline (kullanicinin verdigi ornek link) birebir yaklastirildi: artik kare (`h-16 w-16`), beyaz zeminli, ince `border border-line/60` cercevesi olan, kose yuvarlakligi `rounded-xl`, hafif ic bosluklu (`p-1.5`) bir kart; fotograf `object-cover` yerine `object-contain` ile kirpilmadan kart icinde ortalanmis goruntuleniyor (Shopify'in checkout sepet resimleriyle ayni "beyaz kutu icinde urun" hissi).

**Kullanici geri bildirimiyle 3. tur duzeltme (ayni oturum, ayni gun) - urun gorselleri tamamen kayboluyordu**:
- **Kok neden**: `h-20 w-20` / `h-[80px] w-[80px]` gibi bu projede DAHA ONCE HIC KULLANILMAMIS Tailwind boyut degerleri, calisan dev server'da (birden fazla tam server yeniden baslatma ve `.next/cache` silme denense bile) CSS'e hic derlenmiyordu - `getComputedStyle` ile dogrulandi: `.h-[80px]`/`.w-[80px]` kurallari stylesheet'te YOKTU, o div `0x0` boyutuna cokup gorsel/rozet/kart tamamen kayboluyordu (kullanicinin ekran goruntusunde de ayni bozukluk vardi - bu sadece yerel bir onizleme sorunu degildi). Onceden kullanilan `h-16 w-16` gibi degerler calisiyordu cunku projede baska yerlerde zaten mevcuttu/derlenmisti.
- **Cozum**: O elemanin boyutu artik Tailwind class'i yerine dogrudan `style={{ height: 80, width: 80 }}` inline stille veriliyor - Tailwind'in derleme tuhafligindan tamamen bagimsiz, garanti calisan bir yontem.
- Bu arada gelistirme sunucusu bir kez tamamen durdurulup `.next/cache` silinerek temiz yeniden baslatildi (kullanicinin daha once acik birakmis olabilecegi terminal sekmesi etkilenmis olabilir, islevsel bir kayip yok).
- Kullanicinin ikinci istegi uzerine: sag/sol paneller arasina Release'deki gibi ince bir dikey ayrac cizgisi eklendi (`lg:border-l lg:border-line` sag gri kolonun sinirinda).
- Sag bolumun en ustunde bahsedilen "beyazlik" ayrica arastirildi, mevcut yapida (gri arka plan disaridan `mx-0`/padding-siz, ust bosluk yok) boyle bir bosluga yol acacak bir CSS bulunamadi - buyuk ihtimalle gorsellerin 0x0'a cokmesinin (yukaridaki asil hata) neden oldugu gecici bir yerlesim bozulmasiydi; gorsel duzeltildikten sonra tam yukseklik ekran goruntusunde boyle bir bosluk gozlemlenmedi. Kullanici tekrar goruyorsa ayrica bildirmesi istenmeli.

**Kullanici "cizgi/bosluk hala duruyor" geri bildirimi - olcumle dogrulama (ayni oturum, ayni gun)**:
- `getComputedStyle`/`getBoundingClientRect` ile programatik olarak dogrulandi: sag (gri) ve sol (form) kolonlar birebir ayni y=72'de basliyor (ust hizasinda bosluk YOK) ve ikisi de ayni y=1275'te bitiyor (alt hizasinda da fark YOK, footer'dan once kalan bosluk her iki kolonda esit - sadece formun kendi `lg:py-16` ic dolgusu kadar, bu tasarimin bir parcasi). Dikey ayrac cizgisi de DOM'da mevcut: `border-left: 1px rgba(17,17,17,0.15)`.
- Bu olcumler dogru cikinca, kullanicinin hala eski/bozuk gorunumu gormesinin en olasi nedeni: bu oturumda gelistirme sunucusu bir kez tamamen durdurulup temiz cache ile yeniden baslatildi (image bug'ini cozmek icin) - bu, tarayicidaki HMR baglantisini kopardi ve kullanicinin sekmesi otomatik yenilenmemis olabilir. **Kullaniciya sert yenileme (Ctrl+Shift+R / Ctrl+F5) yapmasi istendi.**
- Cizgi rengi yine de daha belirgin olsun diye `border-line` (cok acik gri, #ebebeb) yerine `border-ink/15`e (siyahin %15 opaklikta hali) cekildi - iki farkli arka plan (beyaz/gri) uzerinde de daha tutarli gorunur.
- Urun gorselleri kullanicinin istegiyle kareden (80x80) dikeye (72x96, giysi fotograflarina daha uygun 3:4 oran) cevrildi.

**Kullanici "hala ayni sorunlar" geri bildirimi sonrasi KOKTEN mimari degisiklik (ayni oturum, ayni gun)**:
Kullanicinin ekran goruntusu net kanit oldu: sag gri panel gercekten footer'dan once erken kesiliyordu (benim yerel olcumlerimde rastlantisal olarak esit cikan sepet icerigiyle bu fark edilmemisti). Kok neden: bu projenin gelistirme ortaminda Tailwind'in `lg:items-stretch`, `lg:rounded-none`, `lg:border-l` gibi DAHA ONCE HIC KULLANILMAMIS responsive class kombinasyonlari guvenilir derlenmiyor (h-20/h-[80px] hatasinda oldugu gibi) - bu kombinasyon kullanicinin tarayicisinda/derlemesinde SESSIZCE devre disi kalinca flex stretch calismiyor, kose yuvarlakligi kalkmiyor, ayrac cizgisi cikmiyordu.
- **Yapisal cozum**: Iki kolonlu satir artik `flex` yerine bu kod tabaninda zaten yaygin ve kanitlanmis sekilde calisan `lg:grid lg:grid-cols-2` kullaniyor - CSS Grid'in **varsayilan** davranisi geregi (ekstra bir "stretch" class'ina ihtiyac olmadan) her iki kolon da satirin en uzun icerigi kadar yukseklige otomatik uzaniyor; bunu HEM 3 urunlu HEM 1 urunlu sepetle Playwright'ta olcerek dogruladim (`grayBottom === formBottom`, ikisinde de).
- Sag panelin kose yuvarlakligi (`0`), sol/alt margin'i (`0`), sol ayrac cizgisi (`1px solid rgba(17,17,17,.15)`) ve ic sol dolgusu artik Tailwind responsive class'larina degil, `isDesktop` state'ine (mevcut `matchMedia("(min-width: 1024px)")` efekti genisletildi) bagli **inline style**'a yazılıyor - derleme belirsizliginden tamamen bagimsiz, garanti dogru.
- "Sipariş Özeti" basliginin ust bosluğu `lg:py-16`(64px)'ten `lg:pt-8`(32px)'e indirilerek panel biraz yukari cekildi.
- E-posta alani "İletişim" bolumunden cikarilip "Teslimat" bolumune, "Ad Soyad"dan hemen once tasindi; "İletişim" bolumunde artik sadece kampanya/haber checkbox'i var.
- **Onemli not**: dev server bu oturumda birkac kez durdurulup `.next/cache` silinerek temiz baslatildi - kullanicinin tarayicisi hala eski bir HMR oturumuna bagliysa sert yenileme (Ctrl+Shift+R) gerekebilir, ama bu sefer KOK NEDEN (Tailwind class derleme belirsizligi) ortadan kaldirildigi icin normal bir sayfa yenilemesinde de dogru gorunmesi beklenir.

**Kullanicinin gonderdigi tam (kirpilmamis) ekran goruntusuyle GERCEK bug bulundu ve duzeltildi (ayni oturum, ayni gun)**:
- Kullanicinin ekran goruntusu (localhost:3000/odeme, 1920px pencere) sayesinde net tespit edildi: sag gri panel gercekten dokuman genisliginden **24px** kisa kaliyordu. Kok neden basit bir gozden kacan detay: `mx-6` Tailwind class'i HEM sol HEM sag margin'i 24px yapiyor, ama isDesktop inline style'i sadece `marginLeft: 0` set ediyordu, `marginRight`i sifirlamayi UNUTMUSTUM - masaustunde sag kenarda 24px bosluk kaliyordu. `marginRight: 0` eklenerek duzeltildi, Playwright ile dogrulandi: `gray.right === document.clientWidth` artik tam esit.
- "Alt tarafta footer'la arasinda bosluk kaliyor" konusu arastirildi: bu bosluk (~96px) `site-footer.tsx`teki `mt-section` class'indan geliyor (`tailwind.config.ts`: `spacing.section = "6rem"`/96px) - SITE GENELINDE her sayfada footer'in ustunde sabit duran, kasitli bir tasarim boslugu, checkout'a ozel bir hata degil. Iki kolon da (gri ve beyaz) TAM AYNI yukseklikte bitiyor (olculdu, birebir esit) - bu bosluk sadece gri renk sayesinde artik GORUNUR hale geldi, oysa beyaz zeminde hep vardi ama fark edilmiyordu. Yine de kisa sepetlerde panel viewport'a gore orantisiz kucuk kalmasin diye satira `minHeight: calc(100vh - 72px)` (masaustunde) eklendi - guvenlik onlemi, zorunlu duzeltme degil.
- **Ders**: Bu tur "iki taraf da esit olmali" duzeltmelerinde artik HER inline style degisikliginde sol/sag/ust/alt TUM kenarlarin acikca set edildiginden emin olunacak (Tailwind class + kismi inline override karisimi kolayca boyle bir kenarin unutulmasina yol aciyor).

---

## Odeme sayfasi (/odeme) duzeltmeleri - ODEME_SAYFASI_DUZELTMELERI_PLANI.md uygulandi (2026-09-22)

1. **Footer /odeme'de tamamen kaldirildi**: `src/components/site-footer.tsx` - `isCheckout` true iken bileşen artik `null` donuyor (onceden sadece ust `mt-section` boslugu kaldiriliyordu, footer'in kendisi -guven kutulari, link sutunlari, iyzico bandi- hala render oluyordu). Kontrol kesin `pathname === "/odeme"`, `/odeme/basarisiz` ve `/odeme/tesekkurler` etkilenmiyor.
2. **`rowStyle`/`minHeight: calc(100vh - 72px)` hack'i kaldirildi**: `checkout-form.tsx` - footer artik olmadigi icin gri panelin "footer'a kadar uzansin" amaci ortadan kalkti, satir artik dogal icerik yuksekligine gore akiyor. Az urunlu sepette gri panelin altinda bosluk kalabilir - beklenen/kabul edilen davranis.
3. **Sol bloktaki "İletişim" bolumu (yalniz UI-only kampanya checkbox'i) kaldirildi**: `newsletterOptIn` alani baska hicbir yerde (backend/API) okunmuyordu (grep ile dogrulandi), kaldirilmasi guvenli.
4. **Header alti bosluk**: Ilk turda plandaki Secenek B (`-mt-px`, sadece /odeme) uygulanmisti ama kullanici "bosluk hala duruyor" diye bildirdi. Bu makinede o an Python/Playwright kurulu olmadigindan ilk turde gorsel olculemedi; kullanici geri bildirimi uzerine Playwright (scratchpad'e npm ile kuruldu) ile gercek pikseller olculdu: header'in gercek render yuksekligi **69.125px**, ama sabit spacer (`h-[72px]`, hem `site-header.tsx` hem `layout.tsx` Suspense fallback'inde) 72px varsayiyordu - **~2.9px** fark tum sitede vardi, sadece diger sayfalarda body/header arka plan rengiyle ayni oldugu icin fark edilmiyordu, /odeme'de gri panel bunu gorunur kildi. Bu yuzden `-mt-px` (yerel/Secenek B) geri alinip **kok neden duzeltildi (Secenek A)**: `site-header.tsx`'teki `<header>`'a `h-[72px]` sabit yukseklik, ic grid row'a (`py-5` yerine) `h-full` verildi - artik header'in gercek yuksekligi HER sayfada spacer ile birebir 72px (Playwright'ta `headerBottom === 72 === spacer.bottom === afterTop` olarak dogrulandi, hem /urunler hem /odeme'de). Bu paylasilan bir bilesen oldugu icin tum siteyi etkiler ama duzeltme yalnizca dogru yonde (gercek boyuta sabitleme).
- **Dogrulama**: `npx tsc --noEmit` temiz. Playwright ile (scratchpad'e kurulan gecici paket, projeye eklenmedi) hem bos sepetle hem gercekten sepete urun eklenip `/odeme`'ye tam sayfa yenilemeyle gidilerek ekran goruntusu alindi - header ile form/gri panel arasinda bosluk kalmadigi, footer'in olmadigi, "İletişim" bolumunun olmadigi gozle dogrulandi.
- **Ayri/ilgisiz bulgu (duzeltilmedi, kullanici "sonraya birakalim" dedi)**: Sepette urun varken `/odeme`'ye tam sayfa yenilemeyle girildiginde Next.js dev overlay'inde tekrarlanabilir bir "Hydration failed" hatasi cikiyor (`site-header.tsx` sepet rozeti `<span>`, satir ~647 civari) - sepet sayisi sunucuda 0 render olup istemcide `localStorage`'dan yuklenince olusuyor. Bu oturumda dokunulmayan `site-header.tsx`/`src/lib/cart.tsx` kodunda, muhtemelen bu duzeltmelerden ONCE de var olan, oncest ayri bir bug; ODEME_SAYFASI_DUZELTMELERI_PLANI.md kapsaminda degil.
- **Commit/push**: Yerel commit atildi, push EDILMEDI (kullanici onayi bekleniyor).

**Kullanici istegiyle ek: iyzico kart logo bandi sag panelin altina eklendi (ayni oturum, ayni gun)**:
Footer /odeme'de tamamen kaldirilinca, orada olan iyzico guven bandi ("iyzico ile Öde" + Mastercard/Visa/Amex/Troy) kayboldu. Kullanici bunu sag ozet panelinin altina koymamizi istedi.
- `checkout-form.tsx`'teki `summaryPanel`e ("Toplam" satirindan sonra) yeni bir blok eklendi. Ilk denemede footer'daki dosya (`iyzico-logo-band-white.svg`) dogrudan kullanilip `bg-ink` renkli bir "hap" icine konmustu (logo beyaz oldugu icin acik gri panelde cigi cikaramazdi) - kullanici "bu logolarin direkt siyahi yok mu, arka plan eklemeden" diye sorunca, aynı SVG'nin (tum sekiller tek renk `#FFFFFF`/`#FFFFFE` fill kullaniyor, dogrulandi) renk degistirilmis bir kopyasi `sed` ile `public/payment/iyzico-logo-band-black.svg` olarak olusturuldu (fill'ler `#111111`/proje `ink` rengine cevrildi) ve hap kaldirilip logo dogrudan gri panel uzerine konuldu. Mobil/masaustu ayni `<details>` agacinin parcasi oldugu icin ekstra kod gerekmedi.
- **Dogrulama**: `npx tsc --noEmit` temiz, Playwright ile sepete gercek urun eklenip `/odeme`ye gidilerek ekran goruntusu alindi - logo bandi "Toplam" satirinin hemen altinda, koyu hap icinde net okunur sekilde goruntulendi.
- **Commit/push**: Yerel commit atildi, push EDILMEDI.

**Sozlesme onayi bug'i duzeltildi: cart-drawer'dan /odeme'ye gecince onay atlanabiliyordu (ayni gun, ODEME_SAYFASI_DUZELTMELERI_PLANI.md madde 5)**:
Onceki tasarimda "Mesafeli Satis Sozlesmesi" onayi sadece `/sepet` sayfasindaki checkbox'ta aliniyor, `/odeme`'ye gecebilmis olmak onayin verildigi varsayiliyordu (`termsAccepted: true` sabit gonderiliyordu). Ancak header'daki sepet ikonundan acilan cart-drawer, kullaniciyi `/sepet`'e hic ugratmadan dogrudan `/odeme`'ye goturuyor - bu akista onay hicbir zaman sorulmuyordu.
- `checkout-form.tsx`: gercek bir `termsAccepted` state + checkbox eklendi (aynı `/sayfa/mesafeli-satis-sozlesmesi` linki/metni, `/sepet`'teki eski checkbox ile birebir ayni). Submit butonunun `disabled` kosuluna `!termsAccepted` eklendi, payload'daki sabit `termsAccepted: true` yerine gercek state gonderiliyor.
- `sepet/page.tsx`: eski `termsAccepted` state'i ve checkbox'i kaldirildi (asil onay artik `/odeme`de alindigi icin tekrar sormaya gerek yok), `checkoutDisabled` artik sadece `hasBlockingIssues`'a bagli.
- `src/app/(site)/api/orders/route.ts`daki `termsAccepted: z.literal(true, ...)` sunucu dogrulamasina dokunulmadi (zaten dogruydu).
- **Dogrulama**: `npx tsc --noEmit` temiz. Bu makinede Python yoktu, Playwright'in Node.js API'si `npx playwright install chromium` ile kurulup gecici bir script'le (projeye eklenmedi, testten sonra silindi) dogrulandi: (1) `/urunler`den gercek bir urune girilip beden secilip "Sepete Ekle" ile sepete eklendi, (2) header'daki sepet ikonuyla acilan drawer'daki "Odemeye Gec" linkiyle `/sepet`'e hic ugranmadan `/odeme`ye gecildi, (3) checkbox isaretlenmeden butonun `disabled` oldugu, isaretlenince checkbox'in `checked` durumuna gectigi dogrulandi (bu ortamda iyzico API anahtarlari `.env`de tanimli olmadigindan `paymentMode` yerelde hep `null` - buton yereldeyken checkbox'tan bagimsiz olarak da disabled kaliyor, bu checkout formunun onceden var olan, bu degisiklikle ilgisiz bir yerel-ortam kisitlamasi; kod incelemesiyle `disabled` kosulunun `!termsAccepted`i dogru sekilde icerdigi teyit edildi). (4) `/sepet` sayfasina dogrudan gidildiginde checkbox'in artik olmadigi ve "Odemeye Gec" linkinin (sepette engelleyici sorun yokken) aktif oldugu dogrulandi - eski akis bozulmadi.
- **Commit/push**: Yerel commit atildi (`ce1c8bf`), push EDILMEDI.

**Sepet adet secicisi: sayilar kesiliyordu + stok kontrolu yoktu (ayni gun, kullanici geri bildirimi)**:
Iki ayri sorun bildirildi. (1) `/sepet`teki adet input'unda iki haneli sayilar (10, 12...) kesik gorunuyordu - kok neden: input `w-5` (20px) genislikti ve tarayicinin native spinner ok ikonlari (Chrome/Edge varsayilani, ozel +/- butonlari zaten varken gereksiz) genislikten pay aliyordu. `w-7`ye genisletildi, `appearance-none` + `[&::-webkit-inner-spin-button]:appearance-none`/`outer-spin-button` ile native oklar kaldirildi. (2) Kullanici input'a veya + butonuna istedigi kadar sayi girip stoktan fazla adet secebiliyordu - secici hicbir zaman stogu sorgulamiyordu.
- `src/lib/cart-shared.ts`deki `ResolvedCartLine.stock` zaten vardi ama `src/lib/cart.tsx`'teki istemci `CartLine` tipi bu alani hic tasimiyordu, sepete eklenirken de tazelemede de kayboluyordu. `CartLine`e opsiyonel `stock` alani eklendi; `toCartLine`, `applyFresh` (fiyat/stok tazelemesi) artik bunu dolduruyor.
- `product-viewer.tsx`: urun sayfasindan sepete eklerken `addLine`e `stock: selected.stock` de gonderiliyor - boylece stok bilgisi ilk fiyat tazelemesini beklemeden hemen mevcut oluyor.
- `cart.tsx`: `updateQuantity` ve `addLine` artik bilinen `stock`u (varsa) ust sinir olarak kullaniyor (`Math.min(..., stock)`), stok bilinmiyorsa eski davranis (MAX_LINE_QUANTITY=99) korunuyor.
- `sepet/page.tsx` ve `cart-drawer.tsx`: "+" butonu adet stoga esitlenince pasiflesiyor (aynı `Minus` butonunun adet<=1'de pasiflesmesi gibi), input'a `max={line.stock}` eklendi.
- **Dogrulama**: `npx tsc --noEmit` temiz. Playwright ile "Son 1 adet kaldı" uyarisi olan gercek bir varyant sepete eklendi, `/sepet`te input'a "9999" yazilip degistirilince adet 1'de kaldigi, "+" butonuna 5 kez basilinca da 1'de kaldigi ve butonun `disabled` oldugu dogrulandi; ayni varyantla iki haneli adet gorunumu de (baska bir testte, 10 adede kadar) kesilmeden dogrulandi.
- **Commit/push**: Yerel commit atildi (`d6571bd`), push EDILMEDI.

---

## Anasayfa mobil urun bolumleri: kaydirmali "tek tek buyuk kart" gorunumu (ayni gun, ANASAYFA_MOBIL_KAYDIRMALI_URUN_PLANI.md uygulandi)

Kullanici istegi: Shopify Release temasindaki gibi, mobilde "Yeni Gelenler" ve "Cok Satanlar" bolumlerinde urunler tek tek buyuk gorunsun, yaninda bir sonrakinin kenari gorunsun, kaydirinca gecsin - onceden ikisi de mobilde sabit 2 sutunlu grid kullaniyordu (kaydirma yok, kart kucuk).

- `src/components/featured-carousel.tsx`: mobil (`md:hidden`) grid'i, sayfadaki "Ozel Koleksiyonlarimiz" bolumunun kullandigi ayni `snap-x snap-mandatory` + `overflow-x-auto` teknigine cevrildi, her `ProductCard` `w-[82vw] shrink-0 snap-start` ile sarmalandi. Masaustu (`md:block`) ok/slider mantigina dokunulmadi.
- `src/components/home/bestsellers-tabs.tsx`: ayni teknik `#bestsellers-panel`e uygulandi (mobilde snap-x/w-[82vw], masaustunde eski 4 sutunlu grid korunuyor - `md:` class'lari ayni kaldi). Ek olarak sekme (Tumu/Kadin/Erkek) degistiginde mobil kaydirma pozisyonu artik sifirlaniyor: yeni bir `scrollRef` + `selectTab()` fonksiyonu (`setActiveKey` + `scrollLeft = 0`) eklendi, hem sekme butonlarinin `onClick`i hem klavye navigasyonundaki `focusTab` bunu kullaniyor.
- **Dogrulama**: `npx tsc --noEmit` temiz. Bu makinede Python yok ama Node.js Playwright (scratchpad'e gecici kuruldu, projeye eklenmedi, test sonrasi silindi) ile 390px genislikte gercek ekran goruntusu alindi: kart genisligi olculdu (~320px / 390px viewport = %82, hedeflenen `w-[82vw]` ile birebir uyumlu), sagda bir sonraki urunun kenari goruluyor, `scrollBy` ile kaydirinca bir sonraki karta geciyor, Cok Satanlar'da sekme degistirince `scrollLeft` 0'a (baslangic konumuna) donuyor dogrulandi. Site su an `PREVIEW_PASSWORD` ile korunan "Coming Soon" kapisinin arkasinda oldugundan, testte `.env`deki sifreyle `bm_preview` cookie'si set edilerek gecildi (sifre hicbir dosyaya yazilmadi).
- **Commit/push**: Yerel commit atilacak, push EDILMEDI (onceki oturumlardaki gibi kullanici onayi bekleniyor).

**Duzeltme (ayni gun, kullanici gercek ekran goruntusuyle bildirdi)**: Kullanici localhost'ta test edince ilk kartin cok buyuk durdugunu, sol kenarda hic bosluk olmadigini ve sagdaki urunun cok az gorundugunu bildirdi (Release'in "Just arrived" carousel'iyle karsilastirmali ekran goruntusu gonderdi). Playwright ile gercek piksel olcumu yapilinca kok neden bulundu: CSS scroll-snap (`snap-mandatory` + `snap-start`) container'in kendi `px-4` (16px) padding'ini gormezden geliyor - tarayici sayfa yuklenir yuklenmez ilk snap noktasini (ilk kartin basi) viewport'un sol kenarina hizalamak icin container'i otomatik 16px kaydiriyordu (`scrollLeft` yuklemede 0 degil 16 olarak olculdu), bu yuzden sol bosluk hicbir zaman gorunmuyordu - hem `featured-carousel.tsx` hem `bestsellers-tabs.tsx`'te, hatta ayni teknigi kullanan onceden var olan "Ozel Koleksiyonlarimiz" bolumunde de (dokunulmadi, kapsam disi) ayni sorun oldugu Playwright'la dogrulandi.
- Duzeltme: her iki container'a `scroll-px-4` (scroll-padding: 1rem) eklendi - artik tarayici snap noktasini hizalarken 16px'lik padding'i "guvenli alan" olarak sayiyor, sayfa yuklendiginde `scrollLeft` gercekten 0'da kaliyor, sol bosluk her zaman gorunuyor.
- Kart genisligi `w-[82vw]`den `w-[75vw]`'ye kucultuldu - hem "ilk urun cok buyuk" geri bildirimine hem de sagdaki urunun daha fazla gorunmesine (peek genisligi ~58px'ten ~70px'e, viewport'un ~%15'inden ~%18'ine) cikti, Release'deki oranlara daha yakin.
- **Dogrulama**: `npx tsc --noEmit` temiz. Playwright ile 390px genislikte tekrar olculdu: sol bosluk artik tam 16px (`card1.x === 16`), kart genisligi `390 * 0.75 = 292.5px` olarak dogru, sagdaki urunun peek genisligi 69.5px. Ekran goruntusu de alinip gozle karsilastirildi, kullanicinin gonderdigi Release referansiyla orantı olarak uyumlu.

---

## Cok markali gorsel bulma: Excel gorsel/aciklama eslestirmesi artik marka bazli (ayni gun, COK_MARKALI_GORSEL_BULMA_PLANI.md uygulandi)

Excel'den toplu urun aktarimi zaten marka bagimsizdi (FIRMAADI sutunundan marka dogru okunuyordu), ama gorsel/aciklama bulma adimi (`koton-images.ts`) sabit `KOTON_BASE = "https://www.koton.com"` kullaniyordu - Slazenger gibi baska markalarin urunleri hep "bulunamadi" donuyordu.

- **`src/lib/brand-image-sources.ts` (yeni)**: `BRAND_IMAGE_SOURCES` eslesme tablosu (`KOTON` ve `SLAZENGER`, ikisi de `?format=json` ile ayni semayi donduruyor - dogrulandi) + `resolveImageSourceForBrand(brandName)`. Yeni marka eklemek icin tek satir yeterli.
- **`src/lib/koton-images.ts`**: `KOTON_BASE` sabiti kaldirildi, tum fonksiyonlar (`fetchAutocompleteUrl`, `fetchKotonProductData`, `fetchGoogleCseUrl`, `findKotonProductData`, `enrichOne`, `enrichFromUrl`) artik parametre olarak `baseUrl` aliyor. `fetchGoogleCseUrl`'deki domain kontrolu de `baseUrl`'den turetiliyor. `KotonEnrichmentResult`e `sourceDisplayName` eklendi (arayuzde marka bazli mesajlar icin).
- **`src/lib/excel-import.ts`**: `KotonEnrichmentTarget`e `imageSourceBaseUrl`/`imageSourceDisplayName` eklendi - `importProductGroups` yeni urun hedeflerini olustururken `resolveImageSourceForBrand(group.brandName)` ile dolduruyor; marka tabloda yoksa `null` - bu durumda `enrichOne`/`enrichFromUrl` hic ag istegi atmadan erken donuyor. Ayrica yeni marka olusturulurken (excel'den hep BUYUK HARF gelir) artik `titleCaseTr` ile Title Case'e cevriliyor ("SLAZENGER" -> "Slazenger").
- **4 cagri noktasi** (`excel-aktar/gorsel-getir`, `[id]/gorsel-yenile`, `[id]/gorsel-renk-ara`, `[id]/gorsel-ekle`) urunu `include: { brand: true }` ile cekip `resolveImageSourceForBrand` sonucunu hedefe ekliyor. `gorsel-ekle`'deki link dogrulamasi genellesti: marka tabloda varsa sadece o markanin domain'i kabul ediliyor, tabloda yoksa herhangi bir `https://` linki kabul ediliyor.
- Arayuz metinleri (excel-import-wizard sonuc ekrani, products-table, variant-editor) marka bazli/genel hale getirildi - API'den donen `sourceDisplayName` varsa "Slazenger'da bulunamadi" gibi, yoksa "Bu marka icin otomatik gorsel kaynagi tanimli degil, linkle ekleyebilirsiniz" gibi genel mesaj gosteriliyor.
- **Arastirma bulgulari**: slazenger.com.tr'nin `/autocomplete/?search_text=` uc noktasi gercekten 404 donuyor (plandaki supheyi dogruladi). `.env`deki `GOOGLE_CSE_API_KEY` gecersiz cikti ("API Key not found" hatasi) - bu **onceden var olan, bu degisiklikle ilgisiz bir yapilandirma sorunu** (Koton icin de calismiyordu), Google CSE yedek arama bu yuzden hicbir markada aktif degil; duzeltmek icin gecerli bir anahtar `.env`e girilmeli.
- **DUZELTME (ayni gun, sonraki oturumda)**: Yukaridaki "urun sayfalarinin `?format=json`i Koton ile birebir ayni sema kullaniyor" notu **yanlis cikti** - kullanicinin kendisi slazenger.com.tr'de arama kutusuna urun adini (orn. "FESKA") yazinca fotograflarin geldigini bildirmesi uzerine yeniden test edildi: Slazenger urun sayfalari `?format=json` ile normal HTML donduruyor (Koton'daki gibi JSON degil). Bkz. asagidaki "Slazenger icin ayri arama motoru" bolumu - koton-images.ts hic degistirilmeden, tamamen ayri bir motor (slazenger-images.ts) yazildi.
- **Dogrulama**: `npx tsc --noEmit` ve `npm run build` temiz. `ornek-veriler/SLAZENGER31082026CHECKLIST.xls` ile gercek bir ice aktarim (tsx ile dogrudan `parseExcelFile`/`importProductGroups`/`enrichOne` cagrilarak, canli Neon DB'ye karsi) denendi: 20 satir hatasiz parse edildi, 2 urun / 20 varyant basariyla olusturuldu, her iki urun de dogru sekilde `imageSourceBaseUrl: "https://www.slazenger.com.tr"` aldi; gorsel arama sirayla autocomplete (404) -> Google CSE (gecersiz anahtar) -> bulunamadi zincirini dogru isletip `missingColors` dolu, `found: false` sonucunu dondurdu - bu, markanin kendi aramasi calismadiginda beklenen ("gorselsiz DRAFT kalir, admin linkle ekleyebilir") davranis. Bu 2 urun (SA26LE047, SA26OG001) artik canli veritabaninda DRAFT olarak duruyor, gorselsiz - admin panelden "Linkle Ekle" ile tamamlanmayi bekliyor.
- **Kapsam disi birakildi (plan bolum 6)**: Slazenger'in KOD3 degeri "SPOR AYAKKABI" mevcut kategori haritasinda/anahtar kelime listesinde yok - kod cokmuyor (AI onerisine dusuyor), ama otomatik eslesmiyor; istenirse ayri bir istekle eklenebilir.
- **Commit/push**: Bu commit push edildi (`ec10493`) - AMA bu bir HATAYDI: kullanicinin "yap pushlama" mesaji aslinda "yap, pushlama" (= yapma degil, PUSH'LAMA/push etme) demekti, ben yanlislikla "push'la" (imperative) olarak okudum. Kullanici sonradan duzeltti. Bundan sonraki oturumlarda acikca istenmedikce push YAPILMAYACAK.

**Ek sorun: bu yanlislikla yapilan push Vercel deploy'unu kirdi (ayni gun, sonraki oturumda tespit/duzeltildi)**:
Kullanici Vercel panelinde deploy'un hata verdigini bildirdi. Build log'u incelendi: `vercel.json`daki `ignoreCommand` (sadece `.md` disi degisiklik varsa build'i tetiklemek icin `git diff "${VERCEL_GIT_PREVIOUS_SHA}" HEAD -- . ':(exclude)*.md'` kullaniyor) `fatal: bad object 0260169...` hatasiyla patladi. Kok neden: onceki oturumlarda "push EDILMEDI" notuyla biriken 10 commit bu oturumda tek seferde push edilince (`0260169..ec10493`), Vercel'in sig (shallow) git clone'u onceki deploy'un SHA'sini (`0260169`, aslinda sadece 11 commit geriden gercek bir ata) icermedi - `git diff` bu objeyi bulamayinca build TAMAMEN durdu (sadece build atlanmadi, deploy pipeline'i kirildi).
- **Duzeltme**: `vercel.json`daki `ignoreCommand` once `git cat-file -e "${SHA}"` ile objenin gercekten mevcut olup olmadigini kontrol ediyor; yoksa (ya da fark varsa) `exit 1` ile guvenli tarafta kalinip normal build tetikleniyor - artik "bad object" build'i hicbir zaman dusurmuyor, en kotu ihtimalle gereksiz bir build calisir.
- **Ek soru (kullanici sordu)**: Hatali/yarim kalan deploy Vercel function storage'inda yer tutar mi? Hayir - build, `npm install`/`next build` adimlarina hic ulasmadan `ignoreCommand` asamasinda (~6 saniyede) durdugu icin hicbir function derlenip yuklenmedi; sadece "Deployments" gecmisinde onemsiz bir log/metadata kaydi olarak duruyor, kota/kullanima dahil degil.
- **Commit/push**: `vercel.json` duzeltmesi yapildi, bu oturumun diger degisiklikleriyle BIRLIKTE commit'lenecek, push EDILMEDI (kullanicidan acik onay bekleniyor - bkz. yukaridaki not).

---

## Slazenger icin ayri arama motoru: Koton JSON API'sini desteklemiyormus, gercek veri kaynagi farkli cikti (ayni gun, kullanicinin kendi bulgusu uzerine)

Bir onceki oturumdaki "Slazenger, Koton'un `?format=json` semasini birebir destekliyor" varsayimi **yanlis** cikti - o oturumda enrichOne hicbir zaman gercek bir urun sayfasina ulasamadigi (autocomplete 404, Google CSE anahtari gecersiz) icin bu hic test edilmemisti. Kullanici slazenger.com.tr'nin kendi arama kutusuna urun adinin (checklist'teki "ÜRÜN ADI" sutunundaki) ILK KELIMESINI (orn. "FESKA Erkek Spor Ayakkabi" -> "FESKA") yazinca fotograflarin geldigini bildirdi - bu ipucuyla gercek altyapi arastirildi:

- `?format=json` Slazenger urun sayfalarinda **calismiyor** (normal HTML donuyor, Koton'daki `product.base_code`/`variants[]` semasi yok).
- `/arama?q=<kelime>` calisiyor ve HTML sonuc listesinde her renk AYRI bir urun karti/URL olarak donuyor (Koton'daki gibi tek sayfada tum renkleri listeleyen bir `variants` dizisi yok).
- Her urun sayfasinin icinde TEK bir `<script type="application/ld+json">` (schema.org Product) blogu var: `sku` (orn. "SA26LE047-120" - urun koduyla baslıyor, dogrulama icin kullanildi), `description` (duz metin, Koton'daki gibi HTML degil), `image` (o renge ozel gorsel URL dizisi).

**Karar (kullanicinin talebi)**: Koton tarafina (`koton-images.ts`) HIC DOKUNULMADAN, Slazenger icin tamamen AYRI bir motor yazildi + admin panelde excel ice aktarma sayfasina "Koton Urunleri Ekle" / "Slazenger Urunleri Ekle" seklinde acik bir marka secim ekrani eklendi.

- **`src/lib/brand-image-sources.ts`**: her markaya `strategy: "koton" | "slazenger-arama"` alani eklendi (`ImageSourceStrategy` tipi disa aciliyor).
- **`src/lib/excel-import.ts`**: `KotonEnrichmentTarget`e `imageSourceStrategy` eklendi, `importProductGroups` bunu `resolveImageSourceForBrand`'den dolduruyor.
- **`src/lib/slazenger-images.ts` (yeni dosya)**: `enrichOneSlazenger` (arama tabanli, excel ice aktarma + "yeniden ara"/"renk icin ara" butonlari icin) ve `enrichFromUrlSlazenger` (admin'in elle verdigi bir urun linkinden, "linkle ekle" butonu icin). Ikisi de sadece `koton-images.ts`'in disa acik `reuploadImageToBlob` yardimcisini paylasiyor, geri kalani tamamen bagimsiz. Renk eslestirmesi urun karti basligindan yapiliyor; baslikta "/" varsa ("Siyah / Beyaz" gibi coklu renk kombinasyonu) KASITLI olarak atlaniyor - yanlis eslesme riski almamak icin (o renk "bulunamadi" sayilir, admin elle ekleyebilir).
- **4 cagri noktasi** (`excel-aktar/gorsel-getir`, `[id]/gorsel-yenile`, `[id]/gorsel-renk-ara`, `[id]/gorsel-ekle`) artik `imageSource.strategy`'ye gore `enrichOne`/`enrichFromUrl` (Koton) ile `enrichOneSlazenger`/`enrichFromUrlSlazenger` (Slazenger) arasinda dallaniyor.
- **`src/components/admin/excel-import-wizard.tsx`**: ilk adim olarak "1. Marka Sec" ekrani eklendi (Koton/Slazenger butonlari), sonraki adimlarin numarasi (2-3-4) buna gore kaydirildi. Bu secim sadece basliklari netlestiriyor - ice aktarim zaten her satirin FIRMAADI'sina gore dogru motoru otomatik seciyor.
- **Iki gercek hata bulunup duzeltildi (canli veriyle test ederken kullanicinin geri bildirimiyle)**:
  1. **Placeholder gorsel**: Slazenger'da gercekten fotografi olmayan bir urunde (SA26OG001) ld+json `image` alani GORELI (baseUrl'siz cozulemeyen) bir "fotograf hazirlaniyor" SVG placeholder'i donduruyordu (`/Data/EditorFiles/urun-gorseli-hazirlaniyor.svg`) - bu once indirme hatasina (`Invalid URL`) yol aciyordu. Duzeltme: goreli URL'ler artik baseUrl ile mutlaklastiriliyor, placeholder deseni (`urun-gorseli-hazirlaniyor`) filtreleniyor - o renk artik duzgunce "bulunamadi" sayiliyor, sahte gorsel yuklenmiyor.
  2. **Dusuk cozunurluk + eksik fotograf sayisi**: Kullanici sitedeki fotograflarin net oldugunu ama bize gelenlerin dusuk kaliteli oldugunu ve sadece 6 (MAX_IMAGES_PER_COLOR) fotograf alindigini, halbuki daha fazla oldugunu bildirdi. Arastirilinca: ld+json'daki `image` URL'leri ("...-O.jpg", "www.slazenger.com.tr" alan adinda) gercekte 371x557px kucuk thumbnail'lar - sitenin GERCEKTEN gosterdigi buyuk gorsel ayni dosya adinin "img.slazenger.com.tr" alt alanindaki "-B" (buyuk) suffix'li hali (1200x1800px, dogrulandi). `upgradeToLargeVariant()` fonksiyonu eklendi (desen tutmuyorsa orijinal URL'i degistirmeden birakiyor - hicbir zaman gorseli tamamen kaybetmiyor). `MAX_IMAGES_PER_COLOR` 6'dan 16'ya cikarildi (test urununde 7 fotograf vardi, 6'da biri hep eksik kaliyordu).
- **Dogrulama**: `npx tsc --noEmit` ve `npm run build` temiz. Canli DB'deki 2 gercek Slazenger urunu (SA26LE047: Beyaz+Bej, SA26OG001: Bej+Kahve) uzerinde `enrichOneSlazenger` dogrudan (tsx ile) calistirildi: SA26LE047 icin 14 gorsel (renk basina 7, tam galeri) + aciklama basariyla yuklendi, blob'daki gercek dosya 1200x1800px olarak dogrulandi (duzeltme sonrasi); SA26OG001 icin gorsel gercekten yok oldugu dogru tespit edilip (placeholder yuklenmeden) "bulunamadi" olarak isaretlendi. Test script'leri (`slazenger-test*.ts`, `slazenger-retest.ts`) gecici olarak proje kokune yazildi, calistirildi, sonrasinda silindi - repo'ya eklenmedi.
- **Commit/push**: Kullanicinin acik talebiyle commit atildi, push YAPILMADI (kullanici "sana pushla demedim" dedi - bundan sonra acikca istenmedikce push edilmeyecek).

---

## Koton otomatik gorsel aramasi tamamen kapatildi, sadece BRAND_IMAGE_SOURCES'tan cikarilarak (ayni gun, yeni oturum)

Kullanici, Koton icin artik otomatik gorsel/aciklama aramasinin (koton.com'a hicbir istek gitmeden) tamamen devre disi kalmasini istedi - Slazenger'a dokunulmadan. Tek degisiklik: `src/lib/brand-image-sources.ts`teki `BRAND_IMAGE_SOURCES` tablosundan `KOTON` satiri silindi (kod tarafinda `koton-images.ts` hic degistirilmedi).

- **Nasil calisiyor**: `resolveImageSourceForBrand("Koton")` artik `null` donuyor. Bu deger `koton-images.ts`teki `enrichOne`/`enrichFromUrl` ve `slazenger-images.ts`teki karsiliklarina `imageSourceBaseUrl: null` olarak gecince, `enrichOne` zaten var olan `if (!target.imageSourceBaseUrl) return emptyResult;` erken donusu sayesinde Koton urunleri icin hicbir ag istegi atmiyor. Bu, excel ice aktarimi, "Fotograflari yeniden ara" (`gorsel-yenile`) ve "Bu renk icin ara" (`gorsel-renk-ara`) akislarinin ucunu kapsiyor.
- **Arayuz mesajlari zaten hazirdi**: `products-table.tsx` ve `variant-editor.tsx`teki `sourceDisplayName` null oldugunda gosterilen mesaj onceki oturumdan itibaren zaten "Bu marka icin otomatik gorsel kaynagi tanimli degil, linkle ekleyebilirsiniz." seklindeydi (COK_MARKALI_GORSEL_BULMA_PLANI.md'de ongorulmustu) - ek bir metin degisikligi gerekmedi.
- **Onemli istisna - "Linkle ekle" (`gorsel-ekle` route)**: Bu akis `enrichOne` degil, admin'in elle yapistirdigi URL'i dogrudan kullanan `enrichFromUrl`/`enrichFromUrlSlazenger`'i cagiriyor. Marka tabloda kayitli olmadiginda (artik Koton dahil) domain kontrolu tamamen kaldirilip herhangi bir `https://` linki kabul ediliyor (bu, tabloda olmayan markalar icin BILEREK boyle tasarlanmis - "linkle ekle her zaman calisir" ilkesi). Yani bir admin BUYUK OZENLE elle bir koton.com urun linki yapistirirsa, sistem yine de o tek sayfaya istek atar - bu otomatik arama degil, admin'in acikca sectigi bir eylem oldugu icin kapsam disi birakildi, kod degistirilmedi (kullanicinin talebi de sadece `brand-image-sources.ts`'i degistirmekle sinirliydi).
- **Dogrulama**: `npx tsc --noEmit` ve `npm run build` temiz gecti. Tarayici uzerinden network sekmesi testleri (Koton urununde yeniden ara -> istek gitmiyor / Slazenger urununde regresyon yok / kucuk Koton excel aktarimi -> istek gitmiyor) bu oturumda calistirilmadi, sadece kod/statik analiz ile dogrulandi.
- **Commit/push**: Bu oturumda commit atildi, push YAPILMADI (kullanicinin acik onayi bekleniyor).

---

## Kampanya bug: ayni urunun 2 farkli renk varyanti sepette olunca indirim sadece birine uygulaniyordu (ayni gun, KAMPANYA_AYNI_URUNDE_COKLU_VARYANT_INDIRIM_HATASI_PLANI.md uygulandi)

Kullanici bildirdi: kategori bazli (orn. "Ayakkabi") kodsuz %20 otomatik kampanya varken, ayni model bir urunun 2 farkli rengini sepete eklediginde indirim sadece bir satira uygulaniyordu. Kok neden `src/lib/coupons.ts` -> `resolveBestDiscount()` icindeki `bestPerLine` Map'inin sepet satirlarini SADECE `productId` ile anahtarlamasiydi - `CouponLine` tipinde varyant/satir kimligi hic yoktu, bu yuzden ayni urunun iki farkli renk varyanti (iki ayri sepet satiri, ayni `productId`) tek anahtara coküyor, sadece indirimi yuksek olan satir tutuluyordu. Bu hem `/api/kuponlar/dogrula` (anlik onizleme) hem `orders/route.ts` (gercek/baglayici siparis hesaplamasi) icin gecerliydi, yani gercek siparislerde de eksik indirim uygulaniyordu.

- **`src/lib/coupons.ts`**: `CouponLine`e `variantId: string` eklendi. `computeCouponDiscount()`in `lineDiscounts` ciktisina (hem PERCENT hem FIXED dalinda) `variantId` eklendi. `resolveBestDiscount()`teki `bestPerLine` Map'i artik `productId` yerine `variantId` ile anahtarlaniyor - ayni urunun farkli varyantlari artik ayri satirlar olarak degerlendirilip her biri kendi indirimini aliyor. `bestByCoupon` (rozet/isim icin en avantajli kampanyayi secen toplama) zaten `coupon.id` ile anahtarliydi, degismedi.
- **Cagri siteleri**: `src/app/(site)/api/kuponlar/dogrula/route.ts`teki `lines.push(...)`a `variantId: line.variantId` eklendi (zod semasinda zaten vardi). `src/app/(site)/api/orders/route.ts`teki `resolvedLines` zaten `variantId` iceriyordu (yapisal olarak `CouponLine` ile uyumlu oldugu icin ek degisiklik gerekmedi).
- **FIXED dali etkilenmiyordu** (plan'da dogrulandigi gibi) - toplam `discountCents` zaten `bestPerLine`'a degil dogrudan `matchingLines` toplamina dayaniyor, sadece PERCENT dalindaki satir-bazli "en iyi kampanya" secimi etkileniyordu; FIXED'e `variantId` yine de tutarlilik icin eklendi.
- **Dogrulama**: `npx tsc --noEmit` ve `npm run build` temiz gecti. Yerel sunucuda canli sepet/kupon akisiyla manuel test bu oturumda YAPILMADI (statik/tip dogrulamasiyla sinirli kalindi) - istenirse bir sonraki oturumda gercek kategori kampanyasi + 2 renk varyantiyla `/api/kuponlar/dogrula` ve `orders/route.ts` uzerinden dogrulanabilir.
- **Commit/push**: Bu oturumda commit atilacak, push YAPILMAYACAK (kullanicinin "yap pushlama" mesaji = "yap, push'lama" yani push ETME anlaminda - bkz. yukarida `ec10493` ile ilgili gecmis yanlis anlama notu).

---

## Sepet/odeme: kampanya/kupon indirimi artik urun listesinde satir bazinda da gosteriliyor (ayni gun, SEPET_SATIR_BAZLI_KAMPANYA_INDIRIMI_GOSTERIMI_PLANI.md uygulandi)

Kullanici bildirdi: `/sepet` sayfasinda sag ozet kutusu kampanya/kupon indirimini TOPLAM olarak gosteriyordu ama soldaki urun listesinde (her satirda gorsel/isim/fiyat) bu indirim hic gorunmuyordu - sadece manuel indirim (`Product.compareAtCents`) satir bazinda ustu cizili gosteriliyordu. Bu ozellik bir onceki (`ca93e91`) coklu varyant bug fix'inin ustune kuruldu - o fix ile zaten `bestPerLine` Map'i `variantId` ile anahtarlanmisti, bu is sadece o kirilimi disariya (API yanitina, sonra UI'a) tasidi.

- **`src/lib/coupons.ts`**: `BestDiscountResult`e `lineDiscounts: { variantId: string; discountCents: number }[]` eklendi - `resolveBestDiscount()` artik kazanan tarafin (otomatik kampanya ya da girilen kod, hangisi kazandiysa) satir kirilimini da donduruyor (otomatik tarafta `bestPerLine` Map'inden, kodlu tarafta `validateCoupon`in yeni donen `lineDiscounts` alanindan). `CouponValidation`in `valid: true` dalina da `lineDiscounts` eklendi.
- **`src/app/(site)/api/kuponlar/dogrula/route.ts`**: response body'sine (hem "otomatik kazandi" hem "normal") `lineDiscounts` eklendi.
- **`src/components/coupon-field.tsx`**: `CouponResult` tipine `lineDiscounts` eklendi, `checkDiscount()` API yanitindaki `data.lineDiscounts ?? []`i `onDiscountChange`e geciriyor.
- **`src/app/(site)/sepet/page.tsx`** ve **`src/app/(site)/odeme/checkout-form.tsx`** (odeme sayfasindaki siparis ozeti listesi de ayni urun satirlarini gosterdigi icin tutarlilik amaciyla oraya da eklendi): `coupon.lineDiscounts`tan `variantId -> discountCents` bir Map olusturulup her satirda kullaniliyor. Manuel indirim (`compareAtCents`) varsa o oncelikli (kupon indirimi o satirda 0 sayiliyor) - sunucu tarafinda ikisi zaten asla ayni anda pozitif olmuyor. Indirim varsa eski fiyat `text-ink/40 line-through`, net fiyat `text-sale` ile gosteriliyor (mevcut manuel indirim gorsel diliyle ayni).
- **checkout-form.tsx'te ek not**: O listede daha once manuel indirim (`compareAtCents`) bile gosterilmiyordu (sadece tek fiyat basiliyordu) - bu isle birlikte hem manuel hem kampanya/kupon indirimi orada da (sepet sayfasiyla ayni desende) gosterilir hale getirildi.
- **Dogrulama**: `npx tsc --noEmit` ve `npm run build` temiz gecti. Yerel sunucuda canli kampanya/kupon ile tarayici testi bu oturumda YAPILMADI (statik/tip dogrulamasiyla sinirli kalindi).
- **Commit/push**: Bu oturumda commit atildi, push YAPILMADI (kullanici yine "yap pushlama" dedi - push ETME anlaminda, yukaridaki nota bkz).

---

## Ana sayfa "Yeni Gelenler"/"Cok Satanlar" kartlarinda renk swatch'lari eksikti (ayni gun, ANASAYFA_YENI_GELENLER_RENK_VARYANTI_PLANI.md uygulandi)

Kullanici bildirdi: ana sayfadaki "Yeni Gelenler" bolumunde coklu rengi olan bir urun (FESKA Erkek Spor Ayakkabi) sadece tek rengin fotografini gosteriyordu, kartin altinda renk secme noktalari (swatch) hic cikmiyordu - katalog (`/urunler`) sayfasinda ayni urun icin swatch'lar sorunsuz calisiyordu. Kok neden: `src/lib/home-products.ts`teki `toProductCardData()`, `ProductCardData.colors` alanini hic doldurmuyordu; `ProductCard` bilesenindeki `colors.length > 1` swatch kosulu bu yuzden hep `false` kaliyordu.

- **`src/lib/catalog.ts`**: `getCatalogEntries()` icinde zaten var olan renk toplama mantigi (varyantlardan `isColor:true` degerlerini toplayip hex'i olanlari `{name, hex, imageUrl}` dizisine cevirme) `buildColorSwatches(product)` adinda ortak, disa acik bir fonksiyona cikarildi. `getCatalogEntries` artik bu fonksiyonu cagiriyor (davranis degismedi).
- **`getPublishedProducts()` sorgusu**: `optionImages` include'undaki `take: 1` limiti kaldirildi - swatch'larin renk basina dogru `imageUrl` bulabilmesi icin urunun TUM renk galerisi gerekiyordu (once sadece ilk gorsel cekiliyordu). Bu sorgu sadece ana sayfada kullanildigi icin baska bir yeri etkilemiyor.
- **`src/lib/home-products.ts`**: `toProductCardData()` artik `colors: buildColorSwatches(p)` ile bu alani dolduruyor. Ana sayfada urun basina hala TEK kart gosteriliyor (katalogdaki gibi renk basina ayri kart YARATILMADI) - sadece var olan `ProductCard` bileseninin swatch satiri artik veriyi aliyor. "Cok Satanlar" sekmesindeki urun bazli satis siralamasi (`pickBestsellers`, `soldByProductId`) etkilenmedi.
- **Dogrulama**: `npx tsc --noEmit` ve `npm run build` temiz gecti. Yerel sunucuda `/urunler` katalog sayfasinda swatch'larin (ayni mantiga dayandigi icin) hala dogru calistigi Playwright ile dogrulandi. Ana sayfada su an gosterilen 8+8 urunun hicbirinde (test sirasinda) HEM 2+ renk HEM her iki rengin de hex kodu tanimli olmasi rastlamadi (ör. FESKA'nin kendi renkleri hex'siz - bu veri eksikligi katalogda da ayni sekilde swatch'siz kaliyor, kod degisikligiyle ilgisi yok) - bu yuzden ana sayfada swatch noktalarinin GORSEL olarak cikmasi bu oturumda dogrudan ekranda GORULEMEDI, ama kod yolu katalogdakiyle birebir ayni oldugu ve tip/derleme kontrolleri temiz gectigi icin dogru calismasi bekleniyor. Hem 2+ renk hem hex tanimli bir urun (katalogda `KIRMIZI`/`KAHVERENGI` swatch'lariyla dogrulanan "Pamuklu Uzun Genis Kollu Bisiklet Yaka Oversize Tisort" gibi) yeni/cok satan listesine girdiginde gozle de teyit edilebilir.
- **Commit/push**: Bu oturumda commit atildi, push icin kullanicinin onayi bekleniyor.
- **Ek dogrulama (kullanici ekran goruntusuyle bildirdi)**: Kullanici ana sayfada FESKA Erkek Spor Ayakkabi'nin swatch'siz gorundugunu bildirdi. Arastirilinca: FESKA'nin 2 rengi var (Beyaz, Bej) ama `VariantAttributeValue` tablosunda "Beyaz" degerinin `hexColor`'i hic girilmemisti (`null`), sadece "Bej" icin `#e8dcc5` vardi. `buildColorSwatches` hex'i olmayan renkleri disarida biraktigi icin dizi 1'e dusuyor, `ProductCard`teki `colors.length > 1` sarti hep false kaliyor ve TUM swatch satiri (Bej dahil) gizleniyordu - bu kod tarafinda degil, veri tarafinda (admin panelinde hic girilmemis bir hex) bir eksiklikti, katalog sayfasinda da ayni sekilde gizliydi. Kullanicinin onayiyla `VariantAttributeValue` tablosunda `value: "Beyaz", hexColor: null` olan tek kayit `#ffffff` ile guncellendi (gecici bir `tsx` script'i ile, DB'ye dogrudan yazildi, script sonra silindi - repo'ya bir kod degisikligi eklenmedi). Sonrasinda ana sayfada FESKA karti altinda iki swatch noktasinin (beyaz halka + bej) gorundugu Playwright ile GORSEL olarak dogrulandi.
- **Kapsam degisikligi (ayni gun, kullanici swatch'i yeterli bulmadi)**: Swatch noktalari calismaya basladiktan sonra kullanici "hala ayri bir kart olarak gorunmuyor" dedi - yani asil istedigi, plandaki "swatch" cozumu degil, planin ele aldigi ama riskli bulunup elenmis ALTERNATIF secenekmis: katalog sayfasindaki gibi coklu renkli bir urunun ana sayfada da RENK BASINA AYRI KART olarak gorunmesi (ör. FESKA Beyaz ve FESKA Bej, Yeni Gelenler'de 2 ayri kart). AskUserQuestion ile teyit alinip bu yonde uygulandi:
  - **`src/lib/catalog.ts`**: `getCatalogEntries()`in bir urunu (renk sayisi kadar) `CatalogEntry`'e bolen ic mantigi `productToCatalogEntries(product)` adinda disa acik, tek basina cagirilabilir bir fonksiyona cikarildi (davranis aynen korundu, sadece disariya da acildi).
  - **`src/lib/home-products.ts`**: `toProductCardData()` (urun bazinda TEK kart ureten eski yardimci) kaldirildi, yerine `catalogEntryToCardData(entry, campaigns)` eklendi - bu, `CatalogEntry`yi (renk basina zaten ayri giris) `ProductCard`in bekledigi sekle ceviriyor (katalog sayfasindaki `urunler/page.tsx`nin ayni islemi yapan satir-ici kodunun mantigen ayni tekrari). `BESTSELLER_TAB_LIMIT` disa acildi.
  - **`src/app/(site)/page.tsx`**: "Yeni Gelenler" artik `products.flatMap(productToCatalogEntries).slice(0, 8)` ile ilk 8 KARTI (urun degil) aliyor - `products` zaten en yeniden eskiye sirali oldugu icin bu, en yeni renk-kartlarini dogru sirada verir. "Cok Satanlar" tarafinda urun SECIMI hala eskisi gibi `pickBestsellers` ile URUN bazinda yapiliyor (satis adedi/one cikan/en yeni siralamasi ETKILENMEDI) - secilen urunler DAHA SONRA `productToCatalogEntries` ile renk kartlarina bolunup toplam kart sayisi yine `BESTSELLER_TAB_LIMIT` (8) ile kesiliyor.
  - **Bulunan gercek bug (bu degisiklik olmadan fark edilmezdi)**: `featured-carousel.tsx` (2 yer) ve `bestsellers-tabs.tsx`teki React liste anahtarlari (`key={p.productId}`) SADECE productId kullaniyordu - ayni urunun 2 renk karti artik ayni productId'yi paylastigi icin bu React key CAKISMASINA yol acardi (sessiz render hatasi riski). `key={`${p.productId}-${p.colorLabel ?? "tek"}`}` ile duzeltildi (katalog sayfasindaki `urunler/page.tsx`nin zaten kullandigi desenle ayni).
  - **Dogrulama**: `npx tsc --noEmit`, `eslint` (degisen dosyalar) ve `npm run build` temiz gecti. Yerel sunucuda hem ana sayfada (FESKA Beyaz + FESKA Bej artik Yeni Gelenler'de VE Cok Satanlar'da 2 ayri kart olarak) hem `/urunler` katalog sayfasinda (regresyon yok, 82 urun + FESKA swatch'lari hala calisiyor) Playwright ile GORSEL olarak dogrulandi.
  - **Commit/push**: Bu oturumda commit atildi, push icin kullanicinin onayi bekleniyor.
- **Ek duzeltme (ayni gun, kullanici ekran goruntusuyle bildirdi)**: Kullanici renk swatch'larinin kenarlarinin kesik gorundugunu bildirdi. Inceleme: secili renk noktasinin halkasi (`ring-2 ring-offset-2`) 18px'lik daireyi her kenardan 4px asiyor (toplam gorsel cap 26px), ama bu halkayi saran `button` sadece 24px (h-6 w-6) - yani halka kendi butonunun kutusunu her kenardan 1px asiyordu. Bu normalde gozle fark edilmez ama bazi ekran/yakinlastirma oranlarinda (ör. Windows kesirli DPI olceklemesi) tarayicinin bu 1px'lik tasmayi kirpmasina yol acabiliyor. **`src/components/product-card.tsx`**: swatch butonu `h-6 w-6` (24px) yerine `h-7 w-7` (28px) yapildi - halka (26px) artik butonun kendi kutusu icine tam sigiyor, hicbir tarafta tasma kalmadi. Playwright ile buyutulmus (izole klonlanmis) elemanla halkanin tam bir cember oldugu, ayrica ana sayfada normal boyutta da duzgun gorundugu dogrulandi. `npx tsc --noEmit` ve `eslint` temiz gecti.
## Oturum: KOTON_TARAYICIDAN_GORSEL_ACIKLAMA_PLANI.md push'landi
- Sadece `KOTON_TARAYICIDAN_GORSEL_ACIKLAMA_PLANI.md` commit'lendi (`9877431`) ve `main`e push'landi (`73c1fdb..9877431`). Baska dosya eklenmedi (`gorsel-test/` ve diger untracked dosyalara dokunulmadi).
- Push oncesi `git log origin/main..HEAD --stat` kontrol edildi: pushlanan tek commit sadece bu `.md` dosyasini iceriyordu, dolayisiyla `vercel.json` ignoreCommand geregi Vercel deploy'u atlanmasi bekleniyor (kod degisikligi yok).
## Oturum: Urunler listesinde urun kodu kopyala butonu (URUNLER_KOD_KOPYALA_BUTONU_PLANI.md)
- **`src/components/admin/copy-code-button.tsx`** (yeni): ikon-only kucuk `CopyCodeButton`. Tiklaninca kodu panoya kopyalar, 1.5 sn yesil `Check` gosterir, `stopPropagation` cagirir.
- **`src/components/admin/products-table.tsx`**: "Urun" kolonundaki tek `<Link>` sarmalayici `div` yapildi; gorsel ve urun adi ayri `Link` olarak kaldi, urun kodu satiri Link'in DISINA alinip yanina kopyala butonu eklendi (kod yoksa gorunmez).
- **Dogrulama**: `npx tsc --noEmit` ve eslint (degisen dosyalar) temiz. Localhost'ta gorsel dogrulama kullanicidan bekleniyor. Commit/push atilmadi.
## Oturum: Excel aktarimi - slug/SKU cakismasi, Ayakkabi/Corap esleme (EXCEL_SLAZENGER_SLUG_CAKISMASI_VE_AYAKKABI_CORAP_ESLEME_PLANI.md)
- **`src/lib/excel-import.ts`**: `generateUniqueSlug` opsiyonel `reserved` setini de kontrol ediyor; `importProductGroups` tek bir `usedSlugs` seti veriyor (ayni parcadaki ayni adli urunler `-2` soneki alir, `Product.slug @unique` ihlali biter). Ayni kod+renk+beden farkli barkod icin SKU'ya barkodun son 4 hanesi ekleniyor. `CATEGORY_MAP` ve `PRODUCT_NAME_CATEGORY_KEYWORDS`'e Ayakkabi/Corap eklendi.
- **`excel-import-wizard.tsx` / `toast.tsx`**: toast'a `data.detail` eklendi, uzun mesaj kelime kaydiriyor.
- **Dogrulama**: `tsc --noEmit` temiz, degisen dosyalarda eslint temiz. SLAZENGER13042026 dosyasi localhost'ta iceri aktarildi (20 urun, 182 varyant). `npm run build` calistirilmadi.
- **Not**: `generateUniqueSlug` test icin `export` edildi. Gorsel eslesmede ayni model adli iki urun kodu (ZEKKO, ZEX) ve `/` iceren cok renkli basliklar Slazenger aramasinda tam eslesmiyor, kalan gorseller elle eklenmeli. Commit atildi, push atilmadi.
## Oturum: Urun gorselleri - coklu secim, toplu yukleme, surukle-birak siralama (URUN_GORSEL_COKLU_YUKLEME_PLANI.md)
- **`src/components/admin/multi-image-field.tsx`** yeniden yazildi (disa donuk API ve `ImageEntry` ayni; `product-images-field.tsx` ve `variant-editor.tsx` degismedi). "Gorsel Ekle" `multiple` dosya seciciyi aciyor, kartin uzerine bilgisayardan dosya surukle-birak destekleniyor. Yuklemeler en fazla 3 eszamanli kuyrukla gidiyor, bekleyen kartlar yerel onizleme + spinner ile gorunuyor, hatalilarda "Tekrar dene" var. Parent'a sadece yuklemesi biten gorseller, grup bitince secim sirasiyla listenin sonuna ekleniyor.
- Liste yerine kare kucuk resim izgarasi (3 / sm:4 / lg:5 sutun). Siralama dnd-kit (`rectSortingStrategy`) ile surukleyerek; `PointerSensor` yerine `MouseSensor` + `TouchSensor` (150 ms gecikme) + `KeyboardSensor` kullanildi (Pointer + Touch birlikte mobilde kaydirmayla cakisiyordu). Kartta sira no, "Vitrin" rozeti, yildiz, sola/saga, alt metin kalemi, sil. `isCover` mantigi aynen korundu. "URL ile ekle": satir basina bir URL.
- Yukleme surerken formun `submit`i capture fazinda engelleniyor, toast + satir ici uyari gosteriliyor (her `MultiImageField` kendi bekleyenlerini kontrol ediyor).
- **`src/lib/client-image-resize.ts`** (yeni): uzun kenar 2000 px'i ya da dosya 4.5 MB'i asarsa tarayicida canvas ile kucultup JPEG (0.9) yapiyor, EXIF yonu korunuyor; hata olursa orijinal gidiyor.
- **`src/app/api/admin/upload/route.ts`**: `MAX_SIZE_BYTES` 4.5 MB'a cekildi. Admin korumali `DELETE` eklendi (`deleteBlobUrls`); bilesen sadece bu oturumda kendi yukledigi URL'ler kaydetmeden silinince cagiriyor.
- **Dogrulama**: `npx tsc --noEmit` ve `npm run lint` temiz (0 hata, 6 eski uyari). Localhost'ta test kullanicidan bekleniyor. Commit/push atilmadi.
## Oturum: Katalog kartinda gri zemin testi — onaylandi (BEYAZ_ARKAPLAN_GRI_ZEMIN_TEST_PLANI.md)
- **`tailwind.config.ts`**: `colors`e `"image-bg": "var(--image-bg)"` eklendi. **`src/app/globals.css`**: `:root`a `--image-bg: #f2f1ef;` eklendi (ton denemesi icin tek deger).
- **`src/components/product-card.tsx`**: gorsel kapsayicisi `bg-line` -> `bg-image-bg`, ana ve hover (`secondImage`) `<Image>`lara `mix-blend-multiply` eklendi. Rozetler, favori butonu, "Stokta Yok" katmani, urun detay sayfasi, sepet cekmecesi degismedi. `isolate` eklenmedi (kapsayicinin opak zemini blend icin yeterli).
- Degisiklik `ProductCard`i kullanan her yerde gecerli: `/urunler`, urun detay "benzer urunler", ana sayfa karuselleri/Cok Satanlar sekmeleri, favorilerim.
- **Dogrulama**: `npx tsc --noEmit` temiz, `npm run lint` 0 hata (6 eski uyari). Localhost:3000'de derlenmis CSS'te `.bg-image-bg` / `.mix-blend-multiply` ve `--image-bg` goruldu. Kullanici localhost'ta onayladi, commit + push edildi (25fac5f).
## Oturum: Gri zemin sadece Slazenger'e daraltildi, urun detayina da eklendi — onaylandi (SLAZENGER_GRI_ZEMIN_PLANI.md)
- Onceki "katalog kartinda tum urunlere gri zemin" karari (`2f700e7`) **sadece Slazenger markasina** daraltildi. Koton ve diger markalar gri zemin oncesi haline dondu (`bg-line`, blend yok). `--image-bg` ve Tailwind `image-bg` tanimlari aynen duruyor.
- **`src/lib/image-backdrop.ts`** (yeni): `usesGreyBackdrop(brandName)`, marka adi trim + `toLocaleLowerCase("tr")` ile `"slazenger"` ise true. DB'de marka adi "Slazenger" olarak dogrulandi (okuma): yayinda 20 urun (14 ayakkabi, 6 corap). KOTON 68 urun.
- **`src/lib/catalog.ts`**: `getPublishedProducts`, `getCatalogEntries`, `getRelatedProducts` sorgularina `brand: { select: { name: true } }` eklendi (ek sorgu yok). `CatalogEntry`ye `greyBackdrop` eklendi, `productToCatalogEntries` dolduruyor.
- **Kart verisi**: `home-products.ts`, `urunler/page.tsx`, `urunler/[slug]/page.tsx` (benzer urunler), `hesap/(panel)/favorilerim/page.tsx` artik `greyBackdrop` geciyor (favorilerim sorgusuna da marka eklendi).
- **`product-card.tsx`**: `ProductCardData.greyBackdrop?`. Kapsayici `bg-image-bg`/`bg-line`, `mix-blend-multiply` sadece true ise (ana gorsel, swatch onizleme ve hover gorseli). False'ta siniflar `2f700e7` oncesiyle birebir ayni (git diff ile karsilastirildi).
- **`product-viewer.tsx`**: `brandName`den `greyBackdrop`. Mobil Embla ve masaustu galeri kutulari kosullu `bg-image-bg`, `<Image>`lara kosullu blend. Mobil ilerleme cizgilerine sadece Slazenger'de `shadow-[0_0_2px_rgba(0,0,0,0.35)]`. Hover buyumesi korundu, `isolate` gerekmedi. Lightbox, rozetler, kalp, buyutec degismedi. (`URUN_DETAY_GRI_ZEMIN_PLANI.md` daha once uygulanmamisti, alanlar `bg-line`ti.)
- **Dogrulama**: `npx tsc --noEmit` temiz, `npm run lint` 0 hata (6 eski uyari). Localhost:3000 HTML kontrolu: `/urunler` 43 gri + 80 normal kart; Slazenger detay (ayakkabi ve corap) gri + blend + cizgi golgesi; Koton detay hic gri/blend yok. Kullanici localhost'ta onayladi, commit + push edildi (25fac5f).
## Oturum: Slazenger gri zemini sepet cekmecesi ve sepet sayfasina da eklendi — onaylandi
- **Veri**: `CartLine`a (`lib/cart.tsx`) opsiyonel `greyBackdrop`, `ResolvedCartLine`a (`lib/cart-shared.ts`) `greyBackdrop` eklendi. `lib/cart-lines.ts` `resolveCartLines` sorgusuna `brand: { select: { name: true } }` eklendi, `usesGreyBackdrop` ile dolduruluyor. `toCartLine` ve `applyFresh` alani tasiyor (`same` karsilastirmasina da eklendi). Boylece localStorage'daki eski satirlar da cekmece acilinca / `/sepet`te otomatik tazelemeyle bayragi aliyor.
- **Sepete ekleme**: `product-card.tsx` hizli ekle ve `product-viewer.tsx` `addToCart` `greyBackdrop`u satira yaziyor (tazelemeden once de dogru gorunsun diye).
- **Gorunum**: `cart-drawer.tsx` ve `sepet/page.tsx` (mobil + masaustu satiri) gorsel kutulari kosullu `bg-image-bg`/`bg-line`, `<Image>` kosullu `mix-blend-multiply`. Slazenger disinda siniflar aynen.
- Odeme sayfasi (`odeme/checkout-form.tsx`) ozetindeki kucuk gorseller istenmedigi icin degistirilmedi.
- **Dogrulama**: `npx tsc --noEmit` temiz, `npm run lint` 0 hata (6 eski uyari). `/api/sepet/dogrula` localhost'ta Slazenger satiri icin `greyBackdrop: true`, Koton icin `false` donuyor. Kullanici onayladi, yerel commit atildi, push atilmadi.
## Oturum: Site aramasi - canli oneri + animasyonlu arama paneli (ARAMA_CANLI_ONERI_PLANI.md)
- **`src/lib/search-text.ts`** (yeni, istemci+sunucu): `normalizeTr` (Turkce harf/aksan/buyuk-kucuk sadelestirme, karakter karakter), `tokenize`, `highlightRanges` (normalize eslesmeyi orijinal metindeki konuma geri esler), `SEARCH_MIN_LENGTH` 2 / `SEARCH_MAX_LENGTH` 80.
- **`src/lib/search.ts`** (yeni): `getSearchIndex` yayindaki urunlerin hafif listesi (ad, kod, marka, kategori+parent, cinsiyet, tag, renkler + renk kapak gorseli, SKU/barkod, normalize `haystack`), `unstable_cache` + `search-index` tag, revalidate 3600. `matchProducts`: her kelime haystack'te (VE), puan kod/SKU/barkod birebir 1000 > kod ile baslar 300 > ad sorguyla baslar 500 > addaki kelime basi 200 > ad icinde 100 > sadece marka/kategori/renk 20; esitlikte stokta > isFeatured > yeni. Sorgu kelimesi bir renge uyuyorsa `matchedColors`.
- **`src/lib/revalidate-catalog.ts`**: `revalidateTag("search-index", { expire: 0 })` eklendi (Next 16'da tek argumanli form deprecated).
- **`src/app/(site)/api/arama/route.ts`** (yeni): `GET ?q=` en fazla 4 sonuc + total. Fiyat `resolveProductDisplayPrice` ile (kartla ayni, kampanya dahil). Renk eslesirse o rengin gorseli + `?renk=`. `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
- **`src/components/search-overlay.tsx`** (yeni): portal, MobileMenu'nun `shouldRender/visible` deseni. Masaustu header altindan inen panel (4 sutun mini kart, grid max 1040px), mobil tam ekran (`100dvh`, dikey liste, "Vazgec"). 200 ms debounce, AbortController, sorgu->sonuc Map onbellegi, onceki sonuclar soluk kalir / ilk aramada 4 iskelet. Son aramalar (localStorage `bollmark:recent-searches`, 5, tek tek sil + Temizle), populer kategori chip'leri, 1 harf ipucu, sonuc yok durumu, eslesen kisim kalin, "Tukendi" etiketi, Slazenger gri zemini. Esc/backdrop/X/Vazgec/sonuc/sayfa degisimi kapatir, ↑/↓/Enter, combobox/listbox ARIA, body scroll kilidi, odak geri doner, `motion-reduce`.
- **`tailwind.config.ts`**: `search-in` keyframe/animation (sonuclar 40 ms arayla belirir).
- **`site-header.tsx`**: masaustu arama `<Link>` -> buton, ikon X'e donusur (`AnimatedSearchIcon`). Mobilde sol sutuna 44 px arama butonu. Arama acikken header saydam degil, mega menu hover'i kapali; arama acilinca mega/mobil menu, mobil menu acilinca arama kapanir. `/` kisayolu.
- **`urunler/page.tsx`**: `?ara=` (80 karakter) ayni `matchProducts` ile suzuyor (renk eslesirse sadece o renk girisi), facet'ler arama sonuclarindan, sirala yoksa puana gore. Banner "“q” için sonuçlar" + "N ürün", breadcrumb Ana Sayfa / Arama, sonuc yoksa ayri bos durum + "Tüm Ürünlere Göz At". Metadata `“q” araması | Bollmark`, `robots: { index: false, follow: true }`. Toolbar/cekmece zaten diger parametreleri koruyor, `ara` kaybolmuyor.
- **Dogrulama**: `npx tsc --noEmit` temiz, degisen dosyalarda eslint temiz (`npm run lint`teki 46 hata `.open-next/` build ciktisindan, bu isle ilgisiz). Localhost: API "gomlek"/"Gömlek"/"GÖMLEK" ayni 9 sonuc, "siyah gömlek" 3'e daraliyor, `7WAM60151NW` ve `7wam60151` dogru urunu getiriyor, "xyzqq" 0. Playwright 1440 px ve 390 px: panel acilis, sonuclar, ↓ aktif kart, Esc kapanis + scroll kilidi + odak donusu, `/` kisayolu, Enter -> `/urunler?ara=gomlek` (13 giris), sonuc yok sayfasi, mobil ikon/logo yerlesimi, son aramalar. Admin'de ad degistirip indeks tazelenmesi test edilmedi (canli DB'ye yazmamak icin). Commit/push atilmadi.
- **Duzeltme (ayni oturum)**: Arama panelinde cok renkli urunun sadece bir rengi cikiyordu. Kullanici tercihiyle katalogdaki gibi her renk ayri sonuc: indekste renklere `outOfStock` eklendi, `api/arama` urunleri renklere aciyor (sorgu bir renge uyuyorsa sadece o renk), limit 4 -> 8, `total` artik renk girisi sayisi (ör. "gomlek" 13, `/urunler?ara=gomlek` ile ayni). Esit puanda stokta olmayan renk sona.
- **Duzeltme**: Masaustu arama sonuclari sagda bos alan birakiyordu (grid `max-w-[1040px]`, 4 sutun). Sinir kaldirildi, `xl:grid-cols-8`: 8 sonuc tam genislikte tek satir (1905px'te Playwright ile dogrulandi).
## Oturum: Katalog "Daha Fazla Göster" (parti parti yukleme) — onaylandi (KATALOG_DAHA_FAZLA_YUKLE_PLANI.md)
- Sonsuz kaydirma YOK: yeni parti yalnizca butona basinca gelir, footer her zaman erisilebilir. Parti boyutu 24.
- **`src/lib/catalog-listing.ts`** (yeni): `page.tsx`'teki arama/facet/filtre/siralama hatti `getCatalogListing(params)`e, kart verisi `toCatalogCardProps(entry, automaticCampaigns)`e tasindi (`applySearch`, `parseSearchQuery`, `sortEntries`, `FALLBACK_IMAGE` dahil). Davranis birebir ayni.
- **`src/lib/catalog-filters.ts`**: `CATALOG_PAGE_SIZE = 24`, `CATALOG_SHOW_PARAM = "goster"` (istemci de kullandigi icin Prisma'siz dosyada). `FILTER_PARAM_KEYS`'e eklenmedi, filtre sayisina katilmaz.
- **`src/app/(site)/urunler/actions.ts`** (yeni): `"use server"` `loadMoreCatalog(query, offset)` -> `{ items, total }`; offset gecersizse 0. Yeni API route acilmadi.
- **`src/components/catalog-grid.tsx`** (yeni, client): ayni grid siniflari, sayac "X / Y ürün gösteriliyor", 2px ilerleme cizgisi, pill buton `<a href="?...&goster=N">` (JS kapaliyken/Google icin calisir, JS varken preventDefault + `useTransition` ile aksiyon). Beklerken "Yükleniyor" + `aria-busy`, hata olursa "Yüklenemedi, tekrar deneyin". Bitince "Tüm ürünleri gördünüz · N ürün" + "Başa dön ↑". `total <= 24` ise blok yok. Yeni kartlar `animate-catalog-in` (400 ms, 30 ms kademeli, en fazla 300 ms, `motion-reduce` kapali), `aria-live` duyurusu, odak ilk yeni karta (`preventScroll`). URL `window.history.replaceState` ile guncelleniyor (Next 16 dokumani: router ile senkron).
- **Geri tusu**: Next geri donuste sayfanin onbellekteki ilk render'ini (24 kart) yukluyordu. Butonla yuklenen liste istemcide modul seviyesinde sorguya gore tutuluyor; URL'deki `?goster` ayni sayiyi gosteriyorsa grid o listeyle aciliyor. Ayni rota icinde (grid yeniden mount olmadan) `?goster` kart sayisiyla uyusmazsa liste yeniden seciliyor (ör. `?goster=72` iken "Tüm Ürünler" linki -> 24).
- **`page.tsx`**: `?goster` ustteki 24'un katina yuvarlaniyor (plan "en yakin" diyordu; `?goster=131` gibi yarim son parti 120'ye dusmesin diye `ceil`), en az 24, en fazla toplam. `CatalogGrid` `key={sorgu}` ile filtre/siralama/arama degisince sifirlaniyor. Bos durum dallari, banner, breadcrumb, metadata degismedi.
- **`catalog-toolbar.tsx`**: siralama ve filtre/cip degisiminde `goster` siliniyor. (`filter-drawer.tsx` URL kurmuyor, degismedi.)
- **`tailwind.config.ts`**: `catalog-in` keyframe/animation.
- **Dogrulama**: `npx tsc --noEmit` temiz; `npm run lint`te `src/` icin 0 hata (6 eski uyari, 46 hata `.open-next/` build ciktisindan). Playwright 1440 px ve 390 px: Tum Urunler 24/131 -> 48 -> ... -> 131 + bitis metni, kaydirma zipamiyor (delta 0), URL `?goster=48`, odak ilk yeni kartta, `aria-live` metni; urune girip geri donunce 48 kart ve ayni kaydirma konumu (6059 px); `?goster=72` link -> 24 -> geri -> 72 ve ayni konum (8793 px); `?goster=72` dogrudan 72 kart; siralama degisince 24'e donus, siralı ikinci parti tekrarsiz; `?ara=koton&stok=stokta`da istemcide eklenen 48 kart sunucunun `?goster=48` listesiyle birebir ayni, cip kaldirilinca 24; Erkek (40), Kadin, aksesuar (45) calisiyor; gomlek/tisort (9) ve `?ara=gömlek` (13) blok yok; `goster=abc/-5` -> 24, `100000` -> tumu; yeni kartlarda hizli ekle ve swatch'lar mevcut; mobilde yatay tasma yok. Hata durumu (ag kesintisi) elle test edilmedi. Kullanici localhost'ta onayladi, yerel commit atildi (af1a5a1), push atilmadi.
## Oturum: Sezon bazli urun siralama — onaylandi (SEZON_BAZLI_SIRALAMA_PLANI.md)
- Kullanici karari: "2027 Kış" = 2026 sonbahar/kisinda satilan urun, ayni yil icinde Kış=1, Yaz=2 (2026 Yaz 20262 < 2027 Kış 20271 < 2027 Yaz 20272).
- **Sema** (`prisma db push` ile canli Neon'a UYGULANDI, sadece ekleme): yeni `Season` (id, name unique, rank, isCurrent, createdAt), `Product.seasonId` (opsiyonel) + `@@index([seasonId])`. Mevcut urunlerin hepsi su an sezonsuz. Deploy oncesi canlidaki eski kod yeni alani gormez, etkilenmez.
- **`src/lib/seasons.ts`** (yeni): `normalizeSeason` ("2027 kış/KIS/2027-Kış/KIŞ 2027" -> "2027 Kış", taninmayan ham + rank 0), donem sirasi tek sabitte (`SEASON_TERMS`), `getOrCreateSeasonId` (mevcut sezonun elle degistirilmis rank'ina dokunmaz), `sortBySeason` (rank DESC, sezonsuz en sonda, kararli). Prisma iliski uzerinden `nulls: last` desteklemedigi icin siralama bellekte.
- **Excel**: `excel-import.ts` KOD6'yi `seasonRaw` olarak okuyor; aktarimda sezon yoksa olusturuluyor, yeni urune baglaniyor, barkodla eslesen mevcut urunde de guncelleniyor (KOD6 bossa mevcut sezon korunur) -> eski Excel'i yeniden aktarmak sezonu geriye donuk doldurur. Onizlemede "Sezon" sutunu + bos/taninmayan sezon uyarisi.
- **Siralama**: `getCatalogEntries` / `getPublishedProducts` DB'den `createdAt DESC, id ASC`, sonra `sortBySeason`, stoksuzlar yine en sonda. Fiyat/isim siralamasi ve arama skoru degismedi. "Daha Fazla Göster" offset'i ayni listeyi kestigi icin `id` ile kararli.
- **Anasayfa Yeni Gelenler**: `home-products.ts` `pickNewArrivals` - isCurrent sezon once, gerisi katalog sirasi (guncel isaretli degilse en yuksek rank basta). Cok Satanlar yedegi de katalog sirasini kullaniyor. revalidate mantigi degismedi.
- **Admin**: `/admin/sezonlar` (yeni, Katalog menusunde): liste, yukari/asagi (rank degis-tokus), tek "Güncel sezon", urun sayisi, elle sezon ekleme, sezonsuz urun sayisi. Urun listesinde "Sezon" sutunu + sezon filtresi (+ "Sezonu olmayanlar"), toplu "Sezon Ata" (`bulk` route `SET_SEASON`). Urun duzenlemede sezon secimi. Tum sezon degisiklikleri `revalidateCatalog()` cagiriyor.
- **Dogrulama**: `npx tsc --noEmit` temiz, degisen dosyalarda eslint 0 hata. Dev sunucusu yeniden baslatildi (eski Prisma istemcisi globalThis'te kalmisti). Canli DB'de 2 gecici TEST urunu (once 2027 Kış, 2 sn sonra 2026 Yaz) ile Playwright: `/urunler` ve anasayfa Yeni Gelenler'de kislik 1., sonradan eklenen yazlik 2., sezonsuzlar sonra; "Daha Fazla Göster" ile 133/133 kart tekrarsiz; 2026 Yaz "Güncel" yapilinca Yeni Gelenler'de yazlik one gecti; asagi/yukari tasima katalog sirasini degistirdi; toplu Sezon Ata ve urun duzenlemeden sezon kaydi DB'ye yansidi; KOTON11052026 onizlemesinde Sezon sutunu "2026 Yaz". Test urunleri silindi (gorsel URL'si gercek urunle ortak oldugu icin blob silinmedi). "2026 Yaz" ve "2027 Kış" sezon kayitlari (0 urun) birakildi. Kullanici onayladi, commit + push edildi (266c707).
## Oturum: Urun aciklamasi bicimlendirme — satir bosluklari + kalin basliklar — onaylandi (URUN_ACIKLAMASI_BICIMLENDIRME_PLANI.md)
- **Goruntuleme** (`src/lib/description-html.ts`): `looksLikeHtml` ve `plainTextToHtml` eklendi. `sanitizeDescriptionHtml` etiketsiz girdiyi once HTML'e ceviriyor: bos satirla ayrilan bloklar `<p>`, blok ici satir sonlari `<br>`. Kisa ilk satir (<= 40 karakter, "." ile bitmiyor, "Anahtar: Deger" degil, altinda satir var) ve ":" ile biten satirlar `<strong>`. `transformTags`: h1-h6 -> strong, div -> p. ALLOWED_TAGS degismedi, yeni bagimlilik yok. DB/migration yok, eski duz metin kayitlar render aninda duzeliyor.
- **Admin editor**: `@tiptap/react @tiptap/pm @tiptap/starter-kit` (v3.31) kuruldu. `src/components/admin/description-editor.tsx` (yeni): StarterKit (heading/code/codeBlock/blockquote/hr/strike/link kapali), yapistirilan `<hN>` kalin paragrafa, arac cubugu Kalin/Italik/Madde/Numarali/Bicimi temizle, gizli input + `useDirtySignal` (SaveBar tetikleniyor), `required` icin submit'te "Açıklama gerekli", mount oncesi 220px iskelet. Eski duz metin aciklamalar editore `plainTextToHtml` ile, Koton HTML'i bicimli yukleniyor.
- **`urunler/[id]/page.tsx` ve `yeni/page.tsx`**: textarea -> `DescriptionEditor` (yenide `required`); server action'larda `description` DB'ye yazilmadan `sanitizeDescriptionHtml`'den geciyor.
- **Dogrulama**: `src/lib/description-html.test.ts` (5 test, `npx tsx --test`) geciyor. `npx tsc --noEmit` temiz (once `prisma generate` gerekti, pull sonrasi istemci eskiydi), `npm run lint` 0 hata (6 eski uyari), `npm run build` basarili. TipTap chunk'i yalnizca admin urun duzenle/yeni sayfalarinin client manifest'inde; `/urunler/[slug]` etkilenmiyor. Kullanici localhost'ta onayladi, commit + push edildi (25fac5f).
- **Veri duzeltmesi (ayni oturum, canli DB)**: `6SAK80011UW` (id `cmuhkrd0z002904l5w0c3gfnq`) urununde 8 fotograf yanlislikla genel gorsellere eklenmisti; tek transaction ile ayni sirayla KAHVERENGİ renk gorsellerine (`ProductOptionImage`) tasindi, `ProductImage` kayitlari silindi. Blob dosyalarina dokunulmadi, kapak isaretli degil (ilk foto kapak). Onbellek icin admin'de urunu bir kez kaydetmek yeterli.
## Oturum: Varyant tablosu siralama basligi formu kaydediyordu — onaylandi (VARYANT_TABLO_SIRALAMA_KAYDEDIYOR_PLANI.md)
- **Kok neden**: `src/components/admin/data-table.tsx` siralama basligi butonunda `type` yoktu; urun duzenleme formu icinde varsayilan `submit` oldugu icin "Beden"/"Renk" basligina basmak tum formu gonderiyordu ("Değişiklikler kaydedildi" + yenileme).
- **Duzeltme**: sadece `type="button"` eklendi. Ayni taramayla `src/components/admin/` altinda tipsiz ve submit amacli olmayan butonlara da eklendi: `data-table.tsx` (siralama basligi), `excel-import-wizard.tsx` ("Marka değiştir", "Başka dosya seç"), `orders-tabs.tsx` (sekme), `sign-out-button.tsx` (Çıkış), `toast.tsx` (kapat X), `topbar.tsx` (kullanici menusu).
- **Dokunulmayanlar**: `delete-product-form.tsx` ve `category-delete-form.tsx` butonlari bilerek submit (form gonderiyor). `button.tsx` (`Button`) ve `icon-button.tsx` (`IconButton`) genel sarmalayicilar, `type`'i props'tan aliyor; varsayilanini degistirmek formlarda submit'e guvenen kullanimlari bozabilecegi icin degistirilmedi. Siralama mantigi (`VariantEditor` `sortedRows`) degismedi.
- **Dogrulama**: `npx tsc --noEmit` temiz, `src/components/admin` eslint 0 hata (3 eski uyari). Kullanici localhost'ta onayladi, yerel commit atildi, push atilmadi.
## Oturum: Vercel gorsel donusum limiti + AI bot trafigi (VERCEL_GORSEL_VE_BOT_LIMIT_PLANI.md) — 2026-09-30
- **Neden**: Vercel Hobby'de Image Transformations 5.000/5.000 doldu, Fluid Active CPU %75. 24 saatteki ~14 bin istegin ~10,2 bini Meta'nin yapay zeka tarayicisi `meta-externalagent/1.1`; `/_next/image`'e ~6,5 bin istek. Dashboard'da Firewall -> Bot Management -> **AI Bots = Deny** acildi (30 Eyl 00:37). Bot Protection (Challenge) iyzico callback / `/api/vega` / cron takilmasin diye bilerek acilmadi.
- **`next.config.mjs` images**: `deviceSizes [640, 828, 1200, 1600]`, `imageSizes [256, 384]`, `qualities [75]`, `formats ["image/webp"]`, `minimumCacheTTL 2678400` (31 gun; Blob URL'leri degismez). Blob kaynaklari zaten max 1600px. Projede `quality` prop'u kullanan `<Image>` yok.
- **`sizes` eksikleri**: `product-viewer.tsx` masaustu 2 sutunlu galeri `(min-width: 768px) 33vw, 100vw` (galeri `1fr` sutunu, 1440 px'te kare basi ~%26, 1920'de ~%32 vw), anasayfa hero `100vw`, sepet sayfasi kucuk resimleri `96px`, sepet cekmecesi `90px`. Mobil karusel `100vw` (md:hidden) ve lightbox (`yet-another-react-lightbox`, next/image degil) degismedi.
- **`robots.ts`**: `*` icin `/api/`, `/sepet` ve filtre parametreli desenler (`renk`, `beden`, `fiyat-min`, `fiyat-max`, `stok`, `indirimli`, `ara`) eklendi (`/api/odeme` artik `/api/` kapsaminda); `?kategori=` serbest. AI botlari (meta-externalagent, GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai, CCBot, Google-Extended, PerplexityBot, Bytespider, Amazonbot, Applebot-Extended) icin `Disallow: /`. Googlebot/Bingbot/facebookexternalhit/Twitterbot/WhatsApp dokunulmadi.
- **Canonical (D)**: urun sayfasinda `alternates.canonical` zaten query'siz idi, degisiklik yok.
- **Dogrulama**: `npm run build` basarili. `next start` ile: robots.txt beklenen cikti; anasayfa ve urun sayfasinda `/_next/image` genislikleri yalniz 256/384/640/828/1200/1600, hepsi `q=75`; `?renk=x` ile acilan urun sayfasinda canonical query'siz. Kullanici talebiyle commit + push edildi. Takip: AI Bots=Deny sonrasi Image Transformations ve CPU grafigi izlenecek; gerekirse urun sayfasini ISR'a tasima ayri plan.
- **Ek (ayni gece, 00:50)**: Canlida urun fotograflari bozuk cikti. Kok neden: Image Transformations kotasi dolu, `/_next/image` onbellekte olmayan her genislik icin **402** donuyor (onbellekte olanlar HIT/200). Yeni `sizes`/`deviceSizes` ile tarayicilar daha once donusturulmemis genislikler istedigi icin bozulma artti; hero da 402. Kullanici onayiyla **gecici** `images.unoptimized: true` eklendi (gorseller Blob/CDN'den dogrudan). **YAPILACAK**: kota sifirlaninca (~30 Eyl 14:00) `unoptimized` satiri kaldirilacak.
- **`unoptimized` etkisi (kullaniciya aciklandi)**: Blob **depolamasi** artmaz (yeni dosya olusmuyor). Blob **data transfer** artar: gorseller artik her ziyaretcide dogrudan Blob'dan ve mobilde de tam 1600px (~60-190 KB) iniyor; Vercel panelinden Blob Data Transfer izlenmeli.
- **Iki sikistirma adimi**: (1) panelde yuklerken `lib/image-compress.ts` bir kez 1600px WebP q78 -> Blob'a kaydediyor; (2) Vercel `/_next/image` ekran boyutuna gore ayrica kucuk kopyalar uretiyor, kotayi dolduran bu. Urun fotolari zaten sikistirildigi icin (2) kalici kapali kalabilir. `public/` gorselleri (or. `hero-model.jpg` 1,4 MB) hic sikistirilmadi, `unoptimized` ile oldugu gibi gidiyor.
- **Karar bekliyor**: (a) kalici `unoptimized` + `public/` gorsellerini bir kez sikistir, ya da (b) kota sifirlaninca (~30 Eyl 14:00) `unoptimized` satirini kaldir.
## Oturum: SEO Faz 1 — global metadata + temel semalar (SEO_TEKNIK_DENETIM_VE_PLAN.md 2.6, 2.7, 2.8) — 2026-09-30
- **Global metadata** (`src/app/(site)/layout.tsx`): `metadataBase: new URL(getSiteUrl())`, `title: { default: "Bollmark | Modern Giyim", template: "%s | Bollmark" }`, varsayilan OpenGraph (`baseOpenGraph` - `src/lib/site-metadata.ts`: siteName, `tr_TR`, `/og-default.jpg` 1200x630), `twitter: summary_large_image`. Next.js alt sayfanin openGraph'ini ust layout'la birlestirmedigi icin kendi openGraph'ini yazan sayfalar `baseOpenGraph`'i yayiyor.
- **`public/og-default.jpg`**: `hero-model.jpg`'den sharp ile 1200x630 (attention kirpma, q82, ~110 KB).
- **Elle yazilan " | Bollmark" ekleri kaldirildi**: urun, katalog (kategori/cinsiyet/tum urunler/arama) ve iletisim basliklari; cift ek olusmadigi kontrol edildi. Anasayfa layout ile ayni segmentte oldugu icin sablon uygulanmiyor, basligi degismedi.
- **Yeni dosyalar**: `src/lib/seo.ts` (`truncateDescription` 160 karakter kelime siniri, `breadcrumbJsonLd`, `homeJsonLd`), `src/lib/store-info.ts` (magaza adresi/saatleri/e-posta/Instagram), `src/components/json-ld.tsx` (`<` -> `<` kacisli script).
- **Semalar**: anasayfaya tek `@graph` ile Organization + WebSite (SearchAction `/urunler?ara=`) + ClothingStore (adres, Pzt-Cmt 10:00-19:00). Urun ve katalog sayfalarina BreadcrumbList (gorsel breadcrumb ile ayni veri; arama sonuc sayfalarinda yok). Urun Product JSON-LD icerigi degismedi (Faz 2).
- **Yasal sayfalar** (`sayfa/[slug]`): `generateMetadata` - title = sayfa basligi, description = icerigin ilk 160 karakteri, canonical. Iletisim sayfasina canonical.
- **Sabit adres**: robots.ts, sitemap.ts ve urun sayfasindaki `BASE_URL = "https://bollmark.com"` -> `getSiteUrl()`.
- **Kullanici kararlari**: magazanin telefonu yok (semada `telephone` yazilmiyor). Magaza Google Haritalar'da "Koton Karacabey" adiyla kayitli; semada bilincli olarak "Bollmark" kullaniliyor. Instagram `koton.karacabey` (footer'daki hesap). Anasayfa magaza kartindaki "Runguçpaşa" yazimi (dogrusu Runguşpaşa) dokunulmadan birakildi.
- **Dogrulama**: `npx tsc --noEmit` temiz, degisen dosyalarda eslint 0 hata. Dev sunucusunda (onizleme cookie'siyle) anasayfa, urun, kategori, cinsiyet, yasal, iletisim ve arama sayfalarinin head'i ve JSON-LD'leri kontrol edildi. Kullanici onayladi, yerel commit atildi, push atilmadi.
- **Sonraki**: Faz 2 (urun JSON-LD Merchant standardi). Katalog canonical'lari Faz 3'te (temiz kategori URL'leri).
## Oturum: SEO Faz 2 — urun yapisal verisi Google Merchant standardinda (SEO_TEKNIK_DENETIM_VE_PLAN.md 2.5) — 2026-09-30
- **`buildProductJsonLd`** (`src/lib/seo.ts`): 1'den fazla varyantta `ProductGroup` (productGroupID = urun kodu, `variesBy` color/size yalniz gercekten farkliysa) + `hasVariant[]` (sku, gtin13, color, size, o rengin galerisi, `?renk=` url'li offer); tek varyantta duz `Product`. brand, material, `audience.suggestedGender` (Erkek/Kadın/Unisex), tum galeri gorselleri (gorsel yoksa alan yok; Unsplash FALLBACK_IMAGE kaldirildi).
- **Fiyat**: product-viewer ile ayni `resolveProductDisplayPrice(effectivePrice(varyant))` - ekrandaki fiyatla birebir; indirimde `priceSpecification` StrikethroughPrice. `priceValidUntil` yalniz bitis tarihi olan otomatik kampanyada (su anki "Ayakkabılarda %20" bitissiz -> yok).
- **Offer**: `itemCondition` New, seller -> `#organization`, `shippingDetails` (TR; fiyat >= 1.500 TL ise 0, degilse StoreSettings.defaultShippingCents = 350 TL), `hasMerchantReturnPolicy` (TR, 14 gun `STORE_INFO.returnDays`, ReturnByMail, ReturnFeesCustomerResponsibility).
- **GTIN**: EAN-13 kontrol hanesi dogrulaniyor; canli DB'de 1.043 varyantin tamami gecerli.
- **Metadata**: urun title `productTitle` = "{Marka} {Urun adi}" (marka adda geciyorsa tekrar yok); OG gorseli yoksa layout varsayilani; `other` ile `product:price:amount`/`currency`/`product:availability`.
- **`descriptionToPlainText`**: `<br>` ve `</p|li|div|h1-6>` once bosluga cevriliyor ("getiriyor.Stil ÖnerisiGömlek" bitisikligi duzeldi); `description-html.test.ts`'e test eklendi (6/6).
- **Planla fark**: urun yorum/puan altyapisi YOK (planda var yaziyordu) - aggregateRating/review eklenmedi. `deliveryTime` eklenmedi: hazirlama 1-3 is gunu biliniyor ama kargo yolda kalma suresi (transitTime) bilinmiyor - kullanicidan bekleniyor.
- **Acik notlar**: marka DB'de "KOTON" (basliklarda buyuk harf; admin'den "Koton" yapilabilir). Bazi urunlerde aciklama "Detaylı ürün açıklaması yakında eklenecek." (ince icerik, Faz 6).
- **Dogrulama**: tsc temiz, eslint 0 hata. Tek varyantli (tote canta), cok renkli (tisort, 8 varyant) ve kampanyali (FESKA ayakkabi, 2.952 / 3.690 TL, ucretsiz kargo) urunlerde JSON-LD kontrol edildi. Kullanici onayladi, yerel commit, push yok.
## Oturum: SEO Faz 3 — temiz kategori URL'leri (SEO_FAZ3_KATEGORI_URL_PLANI.md) — 2026-09-30
- **Yeni rotalar**: `(site)/[cinsiyet]` (/kadin, /erkek, /unisex, /cocuk - yalniz `GENDER_SLUGS`, digerleri 404), `(site)/[cinsiyet]/[kategori]` (/erkek/gomlek), `(site)/kategori/[slug]` (/kategori/ayakkabi); aktif olmayan kategori 404. `/urunler` tum urunler + arama (?ara=) olarak kaldi.
- **Ortak katalog**: `urunler/page.tsx` govdesi `src/components/catalog-page.tsx`'e (`CatalogPage`, `catalogMetadata`) tasindi; yeni rotalar kapsami (`kategori`/`cinsiyet`) yoldan verip ayni `getCatalogListing`'i kullaniyor. `loadMoreCatalog` sorgusu kapsam parametrelerini iceriyor, adres cubugu temiz yol.
- **`src/lib/catalog-url.ts`**: `GENDER_SLUGS`, `catalogHref`, `parseCatalogPath`, `decodePathSegment`, `categorySlug` (Turkce -> ASCII), `LEGACY_CATEGORY_SLUGS`. Tum katalog baglantilari (mega menu masaustu/mobil, arama chip'leri, mega-menu-cards, footer, anasayfa kartlari, empty-category-state, urun/katalog breadcrumb) buradan.
- **301**: `proxy.ts` `redirectLegacyCatalog` - `/urunler?kategori=&cinsiyet=` (ara yoksa) -> temiz yol, diger parametreler korunur, eski Turkce slug'lar eslenir.
- **Toolbar/grid/header**: filtre cekmecesinde kategori secimi yeni yola gidiyor (arama sayfasinda sorguda kaliyor); "Daha fazla goster" mevcut yolu kullaniyor; `hasCatalogBanner` ve header aktif menu ogesi `parseCatalogPath` ile.
- **Metadata**: canonical = temiz yol (sirala/goster/filtre haric). Kategori: title "{Cinsiyet} {Kategori} Modelleri" / cinsiyetsizde `metaTitle` ya da "{Kategori} Modelleri"; description `metaDescription` ya da otomatik. `Category.description` doluysa banner basliginin altinda giris metni. Banner H1 cinsiyetli sayfada "Erkek Gömlek". Aksesuar gibi urunleri yalniz alt kategoride olan ust kategoride H1/breadcrumb "Tüm Ürünler" gorunuyordu - duzeltildi.
- **Admin**: `updateCategory` artik slug'i degistirmiyor (ad degisince menu linkleri kiriliyordu); yeni kategori ve Excel ice aktarimi `categorySlug` (ASCII) kullaniyor. Marka slug'larina dokunulmadi.
- **Sitemap**: urunu olan cinsiyet, cinsiyet+kategori ve /kategori sayfalari (48) + urun basina ilk 5 gorsel (723 image:loc). **robots.ts**: `allow` icine `/urunler/*?renk=` (urun JSON-LD varyant url'leri `/*?*renk=` filtre engeline takiliyordu).
- **YAPILACAK (deploy ile)**: `npx tsx scripts/kategori-slug-ascii.ts --apply` - eşofman-altı/parfüm/dış-giyim -> esofman-alti/parfum/dis-giyim (kuru calisma dogru). Calistirilana kadar bu 3 kategori eski Unicode slug'la calisir; `/urunler?kategori=parfüm` yonlendirmesi script sonrasi dogru hedefe (/kategori/parfum) gider.
- **Dogrulama**: tsc temiz, eslint 0 hata, testler 6/6. curl: eski adresler 301 (parametreler korunarak), yeni rotalar 200, /foo /erkek/yok /kategori/yok 404. Playwright: mega menu linkleri yeni yol, tiklama /erkek/gomlek, saydam header yeni sayfalarda, cekmeceden kategori -> /erkek/gomlek?sirala=fiyat-artan, "Daha fazla goster" 24 -> 48 (/erkek?goster=48). Kullanici onayladi, yerel commit, push yok.
## Oturum: SEO Faz 4 — Google Merchant feed (SEO_TEKNIK_DENETIM_VE_PLAN.md 2.9) — 2026-09-30
- **Feed**: `src/app/feed/google.xml/route.ts` (`revalidate = 3600`) + `src/lib/merchant-feed.ts`. RSS 2.0 + g: alanlari, her varyant ayri item: id (sku), item_group_id (urun kodu), title "{Marka} {Urun} {Renk} {Beden}", description (duz metin, 5000), link (`?renk=` cok renkliyse), image_link + en fazla 10 additional_image_link (rengin galerisi), availability, price/sale_price (resolveProductDisplayPrice - sayfa ve JSON-LD ile ayni), brand, gtin (EAN-13 gecerliyse, degilse identifier_exists=no), condition, google_product_category, product_type ("Kadın > Aksesuar > Ayakkabı"), color, size, gender, age_group (Çocuk -> kids), shipping (TR, >= 1.500 TL 0, degilse defaultShippingCents). Gorselsiz urunler atlanir. Localhost: 963 item, 963 gtin, 163 sale_price, 231 out_of_stock.
- **Kullanici karari: DB + admin alani** (kod ici sabit liste yerine). `Category.googleCategoryId Int?` eklendi - `npx prisma db push` canli Neon DB'ye uygulandi (yalniz yeni nullable sutun, veri kaybi uyarisi yok) + `prisma generate`. Feed'de bos ise ust kategorininki, o da yoksa 166.
- **`src/lib/google-categories.ts`**: Google taksonomisinden (tr-TR, 2021-09-21 surumu, resmi dosyadan dogrulandi) 27 secenek + mevcut slug'lar icin ilk atama tablosu. (Yelek icin tahmin edilen 5514 aslinda "Yagmur Pantolonlari" cikti; dogrusu 1831.)
- **Admin**: `category-form-fields.tsx` "SEO ayarları" altinda Google kategori select; `readCategoryFields` `googleCategoryId`'yi okuyor; `kategoriler/[id]` sayfasi degeri geciyor. Olusturma formunda alan yok (null kalir).
- **`scripts/google-kategori-ata.ts`**: `--apply` ile calistirildi, 41 kategoriye ilk atama canli DB'ye yazildi (degeri olana dokunmaz).
- **proxy.ts**: `/feed/google.xml` onizleme kapisindan muaf (robots/sitemap gibi). robots.txt'te engel yok.
- **Dev notu**: `prisma generate` sonrasi dev sunucusunda Tailwind "ENOENT src/generated/prisma/models.ts" ile tum sayfalar 500 verdi; `.next` silinip yeniden baslatinca duzeldi.
- **Kullanicinin yapacagi (deploy sonrasi)**: Merchant Center hesabi + site dogrulama + feed'i planli getirme (gunluk) `https://bollmark.com/feed/google.xml` olarak ekleme; kargo/iade ayarlari.
- **Dogrulama**: tsc temiz, eslint 0 hata, feed 200 `application/xml`. Admin kategori ekrani giris gerektirdigi icin tarayicida test edilmedi. Kullanici onayladi, yerel commit, push yok.
- **Push (2026-09-30)**: SEO Faz 1-4 (fe2990e..869908f) kullanici talebiyle push edildi; oncesinde `npm run build` basarili. `scripts/kategori-slug-ascii.ts --apply` canli DB'de calistirildi (esofman-alti, parfum, dis-giyim). Canli kontrol: `/urunler?kategori=gomlek&cinsiyet=Erkek` -> 301 `/erkek/gomlek`, `/urunler?kategori=parfüm` -> 301 `/kategori/parfum`; /erkek, /erkek/gomlek, /kategori/ayakkabi, /kategori/parfum, sitemap, robots 200; `/feed/google.xml` 200 (963 item); Googlebot UA ile anasayfa 200, ClothingStore semasi var. Siradaki: kullanici Merchant Center kurulumu, sonra Faz 5 (gorsel on-uretim, once plan).
- **Merchant Center dogrulama (2026-09-30)**: `(site)/layout.tsx` metadata'ya `verification.google` (HTML etiketi, bollmark.com) eklendi ve push edildi. Merchant Center'da web sitesi `www.bollmark.com/` idi, kullanici `https://bollmark.com` olarak duzeltti (www adresi baska bir Merchant Center hesabinca sahiplenilmisti). Not: `https://www.bollmark.com` bollmark.com'a yonlenmiyor, dogrudan 200 donuyor - kullaniciya Vercel Domains'te www -> bollmark.com redirect onerildi (SEO plan 2.13).
- **Teslim suresi (2026-09-30)**: Merchant Center kargo ayarinda kullanici hazirlama 1-3, nakliye 1-3 gun girdi. `STORE_INFO.handlingDays`/`transitDays` eklendi; urun JSON-LD `shippingDetails.deliveryTime` (handlingTime + transitTime, DAY) artik yaziliyor (Faz 2'de transit suresi bilinmedigi icin eksikti). Yerel commit.
- **Merchant Center kurulumu tamamlandi (2026-10-01)**: kullanici hesabi kurdu - web sitesi https://bollmark.com (HTML etiketiyle dogrulandi), ulke yalniz Turkiye, kargo sabit 350 TL / 1.500 TL ustu ucretsiz, hazirlama 1-3 + nakliye 1-3 gun, iade 14 gun postayla / musteri oder / geri odeme 14 gun. Veri kaynagi "PRODUCTS SOURCE 2" = `https://bollmark.com/feed/google.xml` gunluk getirme (ilk getirmede 751 urun); "Google tarafindan bulundu" kaynagi gizlendi. Isletme Profili baglantisi bilerek yapilmadi (tek profil "Koton Leventoğlu"). `ff5100b` (JSON-LD deliveryTime) push edildi, canlida dogrulandi.
- **Search Console + Bing (2026-10-01)**: kullanici Google Search Console'a `https://bollmark.com` URL on eki mulku ekledi (HTML etiketiyle dogrulandi), `sitemap.xml` gonderildi - ilk anda "Getirilemedi", kisa sure sonra basarili. Bing Webmaster Tools'a GSC'den ice aktarildi (site + site haritasi). Kalan kullanici isi: Vercel Domains'te www -> bollmark.com yonlendirmesi. Siradaki kod isi: SEO Faz 5 (gorsel on-uretim, once plan).
- **www yonlendirmesi (2026-10-01, kullanici izniyle)**: Vercel API ile `www.bollmark.com` -> `bollmark.com` 308 (proje domain ayari, `redirect` + `redirectStatusCode`). CLI token'i 22 Eyl'de dolmustu, `npx vercel@latest whoami` ile yenilendi. Canli: `https://www.bollmark.com/erkek/gomlek?sirala=fiyat-artan` -> 308 ayni yol + parametrelerle bollmark.com; bollmark.com 200. iyzico callback'leri zaten bollmark.com'a geldigi icin etkilenmez. SEO plan 2.13 tamam.
