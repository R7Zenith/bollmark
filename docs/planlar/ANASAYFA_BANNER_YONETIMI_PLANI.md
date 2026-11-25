# Anasayfa Banner Yönetimi + Muhteşem Kasım Banner'ı — Plan

Durum: uygulandı ve push edildi (2026-11-25). Kullanıcı seçimi: A açık, B kapalı, kırmızı bant açık

## İstek

1. Anasayfa hero'suna şu an reklamı dönen **Muhteşem Kasım** (25–29 Kasım, tüm ürünlerde 2. ürüne %50) görseli konsun. Not: kampanya başlangıcı kullanıcı kararıyla 26'dan 25 Kasım'a çekildi, sitede 25 Kasım'da başladı.
2. Hero banner'ları (slaytları) **admin panelden** eklenip, sıralanıp, açılıp kapatılabilsin; kod değişikliği gerekmesin.

## Mevcut durum (kod incelendi)

- `src/app/(site)/page.tsx`: hero `HeroCarousel` (embla, 6 sn otomatik geçiş, tek slaytta kontrolsüz). Slayt 1 kodda sabit: `/hero-model.jpg` + "2026 Sonbahar / Kış" + h1 "Her gün için, her parça için" + Keşfet. Slayt 2: `HeroKalpToplaSlide`, yalnız Kalp Topla `LIVE` iken.
- Hero'nun üstünde `EfsaneAnasayfaBandi` (kırmızı metin bandı + geri sayım) var; kampanya penceresinde tarayıcı saatiyle açılır.
- Kalp Topla, kampanya süresince ara veriyor (FROZEN) ama hero'daki Kalp Topla slaytı yine görünüyor (efsane planındaki açık nokta).
- Anasayfa ISR (`revalidate = 3600`).
- Görseller R2'ye `/api/admin/upload` ile gidiyor. **Ama** `compressImage` 1600 px'e, tarayıcıdaki `resizeImageForUpload` 2000 px'e küçültüyor → yazılı masaüstü banner'ı tam ekranda bulanık olur.
- `next.config.mjs`: `images.unoptimized: true` (kalıcı karar). Yani görsel olduğu gibi iner; mobilde masaüstü görselinin de inmemesi gerekir.
- Hazır görseller: `Claude outputs/muhtesem-kasim/muhtesem-kasim-chatgpt-9x16.jpg` (1080×1920, mobil için doğrudan uygun), `...-chatgpt-4x5.jpg`. Yatay (masaüstü) versiyon yok.

## Öneriler / kararlar

### 1. Banner türü: iki mod

| Mod | Ne zaman | Görünüm |
|---|---|---|
| **Yazılı görsel** | Yazı görselin içinde (reklam görselleri gibi) | Üstüne metin binmez, tüm slayt tıklanır |
| **Görsel + site yazısı** | Fotoğraf yazısız (şimdiki sezon hero'su gibi) | Etiket/başlık/açıklama/buton sitede HTML olarak basılır |

Muhteşem Kasım için **yazılı görsel** öneriliyor: Meta reklamında görülen görselin birebir aynısı sitede de karşılasın (tanınırlık, reklam → site tutarlılığı). Mobil görsel hazır; masaüstü için ChatGPT ile yatay versiyon üretilecek (aşağıda prompt).

### 2. Ölçüler ve güvenli alan

Hero tam ekran (`min-h-svh`, `object-cover`) olduğu için kenarlar ekrana göre kırpılır; yazılı görsellerde metin güvenli alanda kalmalı.

| | Ölçü | Güvenli alan (yazı/ürün burada) | Neden |
|---|---|---|---|
| Masaüstü | 2400×1350 (16:9) | üst %15, alt %15, sol/sağ %8 boş | Üstte menü; 1366×650 gibi geniş-basık ekranlar alt/üstü, 16:10 ekranlar yanları kırpar |
| Mobil | 1080×1920 (9:16) | üst %15, alt %8, sol/sağ %5 boş | Üstte menü + kampanya şeridi, altta slayt noktaları |

Admin'de her slayt için masaüstü/mobil **odak noktası** (3×3 seçim → `object-position`) olsun.

### 3. Veri modeli (yeni tablo, yalnız ekleme)

`HomeSlide`: id, name (iç ad), kind (`IMAGE_ONLY` | `TEXT_OVERLAY`), enabled, sortOrder, startsAt?, endsAt?, desktopImageUrl, mobileImageUrl?, desktopFocus, mobileFocus, altText (zorunlu), href?, eyebrow?, title?, subtitle?, buttonLabel?, textAlign (sol/orta), overlay (yok/hafif/orta), showCountdown (bitiş tarihine geri sayım), createdAt, updatedAt, updatedByEmail.

Kalp Topla slaytı içerik olarak kodda kalır (animasyonlu); panelde "Sistem slaytı" olarak listede görünür: aç/kapat + sıra. Bunun için küçük bir ayar (ör. `HomeSlideSystem` satırı ya da mevcut bir ayar tablosuna iki kolon) yeterli.

`EfsaneCumaSettings`'e `homeBand Boolean @default(true)`: anasayfadaki kırmızı Muhteşem Kasım bandını panelden kapatabilmek için (banner varken ikisi aynı mesajı tekrar ediyor; öneri: kapalı).

### 4. Admin ekranı: `/admin/bannerlar` ("Anasayfa Banner'ları")

- Liste: küçük önizleme, ad, tür, aktif anahtarı, tarih aralığı + durum rozeti (Yayında / Planlandı / Süresi doldu / Kapalı), yukarı-aşağı sıralama, düzenle, sil.
- Form: yukarıdaki alanlar; masaüstü + mobil görsel yükleme (mobil boşsa masaüstü kullanılır); önerilen ölçü yazısı yükleme alanının altında.
- **Canlı önizleme**: masaüstü (16:9) ve telefon (≈9:19,5) çerçevesinde, menü ve nokta alanları ile güvenli alan çizgileri üstüne çizilmiş halde. Kırpma sorunu yayından önce görülür.
- Kaydedince `revalidatePath("/")`; işlem geçmişine (audit) yazılır; personel rol sistemine bir yetki olarak eklenir.
- Görsel değişince/slayt silinince eski R2 dosyası silinir (`deleteBlobUrls`).
- Banner yüklemesi ayrı profil: en fazla 2400 px genişlik (istemcide de 2400), WebP kalite ~82, Meta için JPEG kopyası gerekmez.

### 5. Ön yüz

- Slaytlar DB'den, `sortOrder`'a göre; Kalp Topla sistem slaytı kendi sırasında. Kalp Topla, Muhteşem Kasım arası süresince **otomatik gizlenir**.
- Tarih penceresi dakika hassasiyetinde, ISR'den bağımsız işler (Efsane'deki `renderedAt` + tarayıcı saati deseni; hidrasyon uyuşmazlığı olmadan). Gizlenen slayt nokta bırakmaz; tek slayt kalırsa kontroller kaybolur (mevcut davranış).
- Görsel `<picture>` ile: `md` ve üstünde masaüstü, altında mobil kaynak → yalnız biri iner (unoptimized olduğu için önemli). İlk slayt `fetchpriority="high"` + eager; diğerleri mevcut `HeroSlideDeferred` ile ertelenir.
- Sayfada tek h1: sıra değişse de bozulmasın diye sabit, görünmez (`sr-only`) bir site h1'i; slayt başlıkları h2 (görsel görünüm aynı kalır).
- Yazılı görsel slaytında tüm alan bir bağlantı, `aria-label` = alt metin; noktalar/oklar bağlantının üstünde tıklanabilir kalır.
- Mevcut sezon hero'su DB'ye "Görsel + site yazısı" slaytı olarak taşınır, ekranda birebir aynı görünür.

### 6. İlk içerik (Claude Code yükler)

| Sıra | Slayt | Görsel | Bağlantı | Pencere |
|---|---|---|---|---|
| 1 | Muhteşem Kasım (A) | masaüstü: `Claude outputs/muhtesem-kasim/muhtesem-kasim-banner-desktop.png` (1672×941); mobil: `Claude outputs/muhtesem-kasim/muhtesem-kasim-banner-mobil.jpg` (1080×1920, "25–29 KASIM" yazan yeni sürüm) | `/urunler` | şimdi → 29 Kasım 23:59 (İstanbul) |
| 2 | Sezon hero'su | `/hero-model.jpg` | `/urunler` (mevcut Keşfet hedefi) | süresiz |
| 3 | Kalp Topla (sistem) | kodda | `/kalp-topla` | Kalp LIVE iken ve ara dışında |

## Masaüstü görseli: ChatGPT prompt'u

ChatGPT'ye `Claude outputs/muhtesem-kasim/muhtesem-kasim-chatgpt-4x5.jpg` dosyasını ekleyip:

```
Ekteki görsel, Bollmark mağazasının "Muhteşem Kasım" kampanya görseli. Bunun web sitesi ana sayfası için YATAY versiyonunu yap: 16:9 oranında, verebildiğin en yüksek çözünürlükte.

Aynı kalacaklar: aynı 6 ürün (kahverengi şişme mont, payetli bronz elbise, açık gri kapüşonlu mont, yeşil ekose gömlek, gri spor ayakkabı, siyah-beyaz Slazenger ayakkabı), aynı ışık, aynı renkler, aynı 3D turuncu parlak yazı stili.

Yerleşim:
- Sol yarı: siyaha yakın koyu zemin, arkadan turuncu ışık parlaması. Yazılar burada, sola hizalı ve alt alta: "2. ÜRÜNE", altında çok büyük 3D "%50", hemen sağında iki satır "Muhteşem / Kasım", en altta turuncu çerçeveli hap şeklinde "TÜM ÜRÜNLERDE · 26–29 KASIM".
- Sağ yarı: açık gri stüdyo zemin, 6 ürün 3'lü iki sıra halinde, hafif zemin gölgeli.
- İki yarı arasında ekteki gibi hafif eğik, turuncu parlayan bir ayrım kenarı.

Güvenli alan (çok önemli): görselin üstten %15'i, alttan %15'i ve soldan/sağdan %8'i yalnızca zemin olsun; hiçbir yazı veya ürün bu kenarlara girmesin. Site bu kenarları ekran boyuna göre kırpıyor, üstte de menü var.

bollmark logosu KOYMA. Bu dört yazı dışında hiçbir yazı ekleme. Yazılar birebir şöyle olsun ve Türkçe karakterler doğru yazılsın: "2. ÜRÜNE", "%50", "Muhteşem Kasım" (ş harfi ve noktasız ı ile), "TÜM ÜRÜNLERDE · 26–29 KASIM".
```

Çıkan dosyayı `Claude outputs/muhtesem-kasim/muhtesem-kasim-banner-desktop.jpg` (ya da .png) olarak kaydet. Kontrol: "Muhteşem" ve "Kasım" doğru mu, ürün sayısı 6 mı, kenarlarda boşluk var mı. ChatGPT 3:2 (1536×1024) verirse de kullanılabilir; Claude Code ölçüyü kontrol edip raporlar.

## Uygulama sırası

1. Şema (HomeSlide + sistem slaytı ayarı + `EfsaneCumaSettings.homeBand`) → **canlı DB'ye uygulamadan önce kullanıcı onayı**.
2. Banner yükleme profili (2400 px).
3. Admin `/admin/bannerlar` + sidebar + yetki + audit + önizleme; `/admin/efsane-cuma`'ya "Anasayfa bandı" anahtarı.
4. Ön yüz: DB'den slaytlar, `<picture>`, tarih penceresi, sr-only h1, Kalp Topla ara gizleme, bant anahtarı.
5. İlk içerik: sezon hero'su + Muhteşem Kasım slaytı (R2'ye yükleyerek).
6. Test + ekran görüntüleri (`Claude outputs/anasayfa-banner/`).

## Ek (2026-11-25): Muhteşem Kasım seçenek B + ücretsiz kargo slaytı

Kullanıcı iki Muhteşem Kasım seçeneğini sitede yan yana görüp birini seçmek istiyor; ayrıca sakin, siteye uyumlu bir "1.500 TL üzeri ücretsiz kargo" slaytı istiyor.

- **Seçenek A**: reklamdaki 3D turuncu yazılı görsel ("Yazılı görsel" modu, yukarıdaki gibi).
- **Seçenek B**: sitenin kendi diline uygun, editoryal moda fotoğrafı (yazısız, ChatGPT) + yazılar sitede Poppins ile ("Görsel + site yazısı" modu). Yazılar keskin, Türkçe karakter riski yok, panelden değiştirilebilir.
- **Ücretsiz kargo**: açık krem/bej, sakin natürmort fotoğraf (yazısız, ChatGPT) + yazılar sitede, koyu renkte.

Bunun için "Görsel + site yazısı" moduna **metin rengi** alanı eklenir: `textTone` = `LIGHT` (beyaz yazı, koyu görsel) | `DARK` (siyah yazı, açık görsel). DARK'ta buton siyah zemin/beyaz yazı, karartma varsayılanı "yok" olur.

Dosyalar (kullanıcı ChatGPT'den indirip koyar):

| Slayt | Masaüstü | Mobil |
|---|---|---|
| Muhteşem Kasım B | `Claude outputs/muhtesem-kasim/muhtesem-kasim-B-desktop.png` (1672×941) | `Claude outputs/muhtesem-kasim/muhtesem-kasim-B-mobil.png` (941×1672) |
| Ücretsiz kargo | `Claude outputs/anasayfa-banner/kargo-ucretsiz-desktop.png` (1672×941) | `Claude outputs/anasayfa-banner/kargo-ucretsiz-mobil.png` (941×1672) |

İçerikler:

| Slayt | Mod | Metinler | Bağlantı | Durum |
|---|---|---|---|---|
| Muhteşem Kasım B | Görsel + site yazısı, LIGHT, sola hizalı, hafif karartma, geri sayım açık | Etiket: "Muhteşem Kasım · 25–29 Kasım" / Başlık: "Tüm ürünlerde 2. ürüne %50" / Açıklama: "Sepetindeki 2. ürün yarı fiyatına." / Buton: "Alışverişe başla" | `/urunler` | **Kapalı** oluşturulur (A açık). Pencere A ile aynı |
| Ücretsiz kargo | Görsel + site yazısı, DARK, sola hizalı, karartma yok | Etiket: "Kargo" / Başlık: "1.500 TL üzeri ücretsiz kargo" / Açıklama: "Siparişin özenle paketlenip kapına gelsin." / Buton: "Alışverişe başla" | `/urunler` | Açık, süresiz, Muhteşem Kasım'dan sonra (sıra 2) |

Kargo başlığındaki 1.500 TL, sitenin ücretsiz kargo eşiğiyle aynı olmalı; Claude Code DB'deki eşiği kontrol edip farklıysa kullanıcıya söyler.

Karşılaştırma: localhost'ta panelden A açık/B kapalı ve tersi yapılarak bakılır; kullanıcı seçer, diğeri kapalı kalır (silinmez).

## Görseller geldi (2026-11-25)

Kullanıcı 6 görseli üretti, yukarıdaki adlarla kaydedildi. Hepsi ChatGPT çıktısı, yatay olanlar 1672×941 (2400 değil): olduğu gibi kullanılır, büyütme yapılmaz.

Kırpma riski (A masaüstü): "%50" yazısı soldan ~80 px'te başlıyor. 1440×900 gibi 16:10 ekranlarda tam ekran `object-cover` her yandan ~83 px kırptığı için "%" işareti kesilebilir. Çözüm: görselin soluna koyu zemin, sağına açık gri zemin rengiyle kenar uzatması (kenar piksellerinden degrade, yapay zekâ yok) yapılarak her iki yana ~100 px boşluk eklenir; sonra tüm hedef ekranlarda yazı ve ürünlerin kesilmediği doğrulanır.

## Açık noktalar

- Banner tıklama ölçümü (GA4 `select_promotion`) sonraki adım olabilir; bu planın kapsamı dışında.
- Kampanya bitince (30 Kasım) Muhteşem Kasım slaytı kendiliğinden kaybolur; panelden silinmesi gerekmez.

## Uygulama durumu (2026-11-25)

- Şema canlıda (kullanıcı onaylı): `HomeSlide`, `EfsaneCumaSettings.homeBand`. Kalp Topla sistem slaytı aynı tabloda `id = "kalp-topla"`, `kind = KALP_TOPLA` satırı (yalnız aç/kapat + sıra).
- Yetki: personel rolünde ayrıntılı izin yok; sayfa yalnız Tam Yetkili'ye açık (`requireAdmin` + `proxy.ts`). Önizleme `/banner-onizleme` (panel kabuğu dışında, yine yalnız yönetici).
- İlk görseller R2 yerine `public/anasayfa/banner/` (yerelde R2 anahtarı yok; kullanıcı kararı). Profil aynı: 2400 px sınırı, WebP 82, büyütme yok.
- Ücretsiz kargo eşiği DB'de değil, kodda (`SHIPPING_THRESHOLD_CENTS` = 1.500 TL); kargo ücreti DB'de 150 TL.
- Açık zeminli (siyah yazılı) slaytta oklar/noktalar koyu çizilir, saydam header okunsun diye üstte hafif koyu geçiş var.
- Odak noktaları varsayılan `50% 50%`; sezon hero'su `50% 18%` (eskisiyle aynı). Ekran testi: tarayıcı çubuğu olmayan 1440×900 ve 390×844 test pencerelerinde A'nın "%" işareti kenarda kesiliyor (görselin yazısı kenara çok yakın); gerçekçi pencerelerde (1440×789, 390×664, 360×640) tam görünüyor.
- Sezon hero'su önce/sonra piksel karşılaştırması: fark yalnız dev ortamının sol alt rozetinde.
- Admin ekran görüntüleri alınamadı (otomasyon için oturum açılamadı).
