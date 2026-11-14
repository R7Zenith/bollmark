# Bollmark - Güncel Durum

## KALDIĞIM YER (2026-11-14, HepsiJET entegrasyonu Faz 1–4, Faz 5 HepsiJET'i bekliyor)

- **Devam etmek için:** `docs/planlar/HEPSIJET_ENTEGRASYON_PLANI.md` bölüm **8.1** (yerel ortamın hali, test siparişi, HepsiJET cevabı gelince adım adım ne yapılacağı). Faz 5 betiği `scripts/hepsijet-test-gonderileri.ts` hazır, mock'ta denendi.

- **Faz 4 – Takip:** HepsiJET takibi mevcut `/api/cron/yurtici-takip` içinde (yeni cron yok), Yurtiçi adımı aynen önce çalışır. Durum eşleme ve sipariş/mail geçişleri plan bölüm 8'de. Müşteri tarafında takip linki koşulu (`ykCancelledAt`) HepsiJET gönderisini gizlemesin diye düzeltildi. Sıradaki: Faz 5 (test gönderileri), HepsiJET test hesabının yeniden açılmasını bekliyor.

- **Faz 3 – Admin:** sipariş detayı kargo kartında Yurtiçi / HepsiJET sekmesi (yalnız iki mod da açıkken ve aktif gönderi yokken), HepsiJET kartı (gönder, etiket PDF `/admin/kargolar/hepsijet-etiket/[id]`, durumu yenile, iptal). `HEPSIJET_MODE=off` iken sayfa eskisiyle aynı. HepsiJET'te aktif sipariş Yurtiçi'ye gönderilemez (Yurtiçi `sendBlockReason`'a tek satır). Yerel `.env`'de mod geçici `mock` (test hesabı askıda). **Canlı DB'de test siparişi `BLM261114-6828` (TEST ALICI Deneme, PAID) var; Faz 5 sonunda silinecek, Vega çekerse Vega'dan elle silinmeli.**

- **Faz 2 – DB (canlı, kullanıcı onaylı, 2026-11-14):** `Shipment`'a 6 nullable sütun (`hjStatus`, `hjStatusMessage`, `hjSentAt`, `hjCancelledAt`, `hjLastSyncAt`, `hjLastError`), `prisma/migrations/20261114000000_hepsijet_shipment/migration.sql` ile `prisma db execute` üzerinden; `migrate diff` boş. Mevcut 28 kargo kaydı okunuyor, hj alanları boş. Henüz bu alanlara yazan kod yok.

Faz 1 notu:

- **Plan:** `docs/planlar/HEPSIJET_ENTEGRASYON_PLANI.md` (bölüm 2.1 doküman doğrulaması, bölüm 8 faz durumu).
- **Yapılan:** `src/lib/hepsijet/` istemcisi (config, client, map, mock, shipments + testler). Henüz hiçbir yerden çağrılmıyor; şema, admin, cron ve müşteri tarafı değişmedi. Yurtiçi'ye dokunulmadı. `.env.example`'a boş `HEPSIJET_*` anahtarları eklendi; değerler yalnız yerel `.env`'de.
- **Engel:** HepsiJET test hesabı 2026-11-14'te hatalı şifre (401) denemelerinden sonra askıya alındı (423). HepsiJET'ten yeniden aktivasyon ve şifre teyidi istenecek. Takip yolu, silme metodu, etiket yanıt biçimi ve durum listesi dokümanda yok; hesap açılınca doğrulanacak (`shipments.ts` başındaki sabitler).
- **Doğrulama:** 262/262 test, tsc, lint temiz. Push/deploy yok, Vercel env'ine bir şey eklenmedi.

## Önceki not (2026-11-09, anasayfa hero carousel + Kalp Topla slaytı)

- **Plan:** `KALP_TOPLA_HERO_CAROUSEL_PLANI.md`.
- **Yapılan:** Anasayfa hero'su carousel oldu (`src/components/home/hero-carousel.tsx`, embla, loop, 6 sn otomatik geçiş). Slayt 1 mevcut sezon hero'su (görsel/yerleşim birebir aynı, h1 ve priority korundu). Slayt 2 Kalp Topla (`hero-kalp-topla-slide.tsx` + `hero-kalp-topla-motion.tsx`): yalnız `getKalpSettings().mode === "LIVE"` iken eklenir (ISR, tester mantığı yok); başlık h2, eşik/oran ayarlardan. Yükselen kalpler (CSS) + parça parça dolan bar + "%X kilit açıldı" döngüsü; slayt pasif/sekme gizliyken durur. Görseller `public/anasayfa/kalp-topla-{desktop,mobile}.jpg` (mozjpeg, ~255 KB); ilk yüklemede inmez, hydration'dan 2,5 sn sonra veya ilk etkileşimde yüklenir.
- **Kurallar (kullanıcı kararı, 2026-11-09):** prefers-reduced-motion kontrolü yok, hover'da otomatik geçiş durmaz. Kaydırma/ok/nokta ve Durdur butonu otomatik geçişi durdurur (yalnız Oynat ile döner); klavye odağı içerideyken bekler. Tek slayt kalırsa hiçbir kontrol render edilmez. Durdur butonu noktaların yanında (sağ alt köşe "Bize yaz" butonunun altında kalıyordu).
- **Doğrulama:** tsc, değişen dosyalarda lint (`.open-next` eski hataları hariç), build temiz. Playwright (1440/375): slayt 1 eski hero ile ölçü/font/konum olarak birebir; LCP `hero-model.jpg`; otomatik geçiş, ok/nokta/swipe, Durdur; LIVE değilken (kodda geçici mock, DB'ye dokunulmadı) tek slayt ve kontrol yok; 375'te yatay taşma yok; tek h1. Ekran görüntüleri `Claude outputs/hero-carousel/`.
- **Düzeltme (2026-11-09):** Mobilde buton ve slayt noktaları tarayıcı çubuklarının altında kalıyordu; iki slayt `min-h-screen` (100vh) yerine `min-h-svh`. Masaüstünde ölçüler aynı (doğrulandı); mobil gerçek cihazda kullanıcı kontrol edecek.
- **Bilinen:** Anasayfada açılan mevcut Kalp Topla tanıtım popup'ı hero'nun üstüne geliyor (değiştirilmedi). Next 16'da `priority` deprecated (`preload`), slayt 1'de istek üzerine bırakıldı.

## Önceki not (2026-11-08, admin "Giden Mailler" sayfası)

- **Yapılan:** `/admin/giden-mailler` (yalnız ADMIN, kenar menü Müşteriler altında): müşteriye giden mailler alıcı, tür, tarih, durum ve tam HTML içeriğiyle. Alıcıya göre arama, tür/durum filtresi; detayda hata mesajı ve sandbox'lı önizleme.
- **DB (canlı, kullanıcı onaylı, 2026-11-08):** `EmailLog` tablosu `prisma/migrations/20261108000000_email_log/migration.sql` ile `prisma db execute` üzerinden eklendi, `migrate diff` boş.
- **Kural:** yalnız `sendMail`'e `log: { kind }` verilen 9 müşteri çağrısı kaydedilir; admin bildirimleri, iletişim formu ve `scripts/mail-test-gonder.ts` kaydedilmez. Kayıt hatası gönderimi bozmaz. Kayıtlar 30 gün sonra `kalp-topla-temizlik` cron'unda silinir.
- **Doğrulama:** tsc, lint, 199/199 test, build temiz; yerelde örnek kayıtlarla liste/detay/filtre kullanıcıya gösterildi, örnekler silindi (tablo boş). Geçmiş mailler yok: kayıt bu deploy'dan sonra başlar.

## Önceki not (2026-11-08, müşteri mailleri yeni tasarım)

- **Plan:** `docs/mail-tasarimlari/MAIL_TASARIMLARI_PLANI.md` (referans tasarımlar aynı klasörde).
- **Yapılan:** 01–08 işlem mailleri ortak şablona geçti (`src/lib/email/`). Kalp Topla açıkken doğrulama maili 14 (kalp verince) / 15 (üyelik), kapalıyken 06 sade. Kalp Topla'nın 10–13 maili ve admin mailleri değişmedi. Hangi durumda mail gittiği değişmedi. Şema değişikliği yok.
- **Doğrulama:** tsc, lint (değişen dosyalar), 199/199 test, build temiz. 16 test maili (`scripts/mail-test-gonder.ts`, DB'ye yazmaz) kullanıcının gelen kutusunda onaylandı; commit + push 2026-11-08.

## Önceki not (2026-11-05, aksesuar Excel aktarımı öncesi kategori hazırlığı)

- **Tetikleyen:** `Vega_Koton_04.11.2026.xls` (92 aksesuar ürünü); KOD3 değerleri (BELTS, HATS, SHAWLS, EARRINGS, NECKLACES, RINGS, BRACELETS, SOCKS LC, BOXERS BSC) haritada yoktu.
- **Yapılan:**
  - `scripts/aksesuar-kategorileri.ts` (varsayılan kuru, `--confirm` ile yazar): Aksesuar altında Kemer, Şapka & Bere, Şal & Atkı, Takı & Bijuteri, Çorap'ı garanti eder; Boxer üst seviyede. Canlı DB'de beşi de zaten Aksesuar altındaydı, Boxer üst seviyedeydi; `--confirm` çalıştı, **hiçbir şey yazılmadı**. DB'deki yazım "Takı & Bijuteri" (ü'süz).
  - `src/lib/excel-import.ts`: CATEGORY_MAP'e 9 KOD3 satırı; ad anahtar kelimeleri Takı & Bijuteri (küpe, kolye, yüzük, bileklik, bilezik), Şal & Atkı (fular, bandana, atkı), Şapka & Bere (şapka, kasket, bere). "kemer" ve "şal" bilerek yok (Kemerli Elbise, Şal Yaka Ceket). `generateUniqueCategorySlug` export edildi.
- **Doğrulama:** tsc temiz, değişen dosyalarda lint temiz (`.open-next` eski hataları hariç), build temiz. Önizleme mantığı script ile Excel üzerinde: 92/92 eşleşti (78 addan, 14 KOD3'ten), çakışma ve DB'de olmayan kategori yok; kadın ürünleri Kadın, 5 erkek kemeri ve 3 boxer Erkek. Mevcut 325 ürünün kategorisi yeni kelimelerden etkilenmiyor. Localhost'ta Aksesuar mega menüsü 5 kategoriyi gösteriyor. Admin önizlemesi tarayıcıda açılmadı (giriş gerekli, Playwright bağlanamadı).
- **Bilinen:** Dosyada 4 barkod tekrar ediyor, 12 satır parse'ta atlanıyor (mevcut davranış). Kadın mega menüsü ürünlü aksesuar kategorilerini de listeliyor (şu an Çanta, Ayakkabı, Parfüm); aktarımdan sonra Kemer, Takı, Çorap da orada görünecek. Ürünler henüz aktarılmadı.

## Önceki not (2026-11-04, admin müşteri detay sayfası + IP/konum kaydı)

- **Plan:** `MUSTERI_DETAY_SAYFASI_PLANI.md`.
- **Yapılan:**
  - Müşteri listesinde isim artık detaya gider: hesaplıda `/admin/musteriler/[id]`, misafirde `/admin/musteriler/misafir?email=` (salt okunur; e-postayla hesap varsa hesaplıya yönlenir). "Detay" linki kalktı, puan düzeltme yerinde. Sipariş listesine "Siparişlerini gör" ile gidilir.
  - Detay: kimlik kartı, özet (sipariş sayısı/toplam/ortalama/son; `deletedAt: null`, `customerId` veya `customerEmail`), kayıtlı + siparişlerde kullanılan adresler, sipariş geçmişi (50 satır), IP ve konum kartı. Kalp Topla kartları değişmeden en altta. Ortak kartlar `src/components/admin/customer-detail/`.
  - Düzenleme `/admin/musteriler/[id]/duzenle`: ad, telefon (`normalizeTrMobile`), e-posta (başka hesapta varsa hata), adres ekle/düzenle/sil/varsayılan. Hepsi `requireAdmin` + audit (`CUSTOMER_UPDATED`, `CUSTOMER_ADDRESS_CREATED/UPDATED/DELETED`, eski → yeni). **Kullanıcı kararı:** e-posta değişince `emailVerifiedAt` sıfırlanır, kullanılmamış doğrulama tokenları silinir. Geçmiş siparişlere ve `passwordHash`'e dokunulmaz.
  - IP kaydı (ileriye dönük): `src/lib/client-ip.ts` (`@vercel/functions`). `Order.clientIp/ipCity/ipRegion/ipCountry` sipariş anında, `CustomerDevice.ip/ipCity/ipRegion/ipCountry` kayıt/girişte (`ipHash` aynen). Cihaz satırları zaten 90 günde siliniyor; `kalp-topla-temizlik` cron'u artık 2 yıldan eski siparişlerin IP alanlarını null'luyor.
- **DB (canlı, kullanıcı onaylı, 2026-11-04):** 8 nullable sütun `prisma/migrations/20261104000000_musteri_ip_konum/migration.sql` ile `prisma db execute` üzerinden eklendi, `migrate diff` boş. (`migrate dev` kullanılmaz: db push düzeni, yerel = canlı DB.)
- **Doğrulama:** tsc temiz, değişen dosyalarda lint temiz (`.open-next` çıktısındaki eski hatalar hariç), 189/189 birim testi, build temiz. Tarayıcı testini kullanıcı localhost'ta yaptı; canlı DB'ye geçici test verisi yazılmadı.
- **Bilinen:** PERSONEL `/admin/musteriler`'e zaten giremiyor, sayfa tamamen ADMIN'e özel. Müşteri listesi siparişleri yalnız e-postayla grupluyor; e-postası değiştirilen müşterinin eski e-postalı siparişleri listede ayrı misafir satırı olur. İl/ilçe serbest metin (projede seçim listesi yok).

## Önceki not (2026-11-04, üye e-posta doğrulama + zorunlu telefon)

- **Tetikleyen:** reklamlar 2026-11-03 gecesi başladı; sabah gelen 3 üyenin (üçü de Hotmail) hiçbiri doğrulamadı. Plan: `docs/planlar/UYE_DOGRULAMA_VE_TELEFON_ZORUNLU_PLANI.md`.
- **Teşhis:** Vercel Production'da `MAIL_FROM` tanımlı (değer gizli). Yerel `RESEND_API_KEY` yalnız gönderim yetkili, alan adı/gönderim listesi API'den okunamadı. DNS'te `resend._domainkey`, `send.` SPF/MX ve DMARC (`p=none`) var. 3 üyenin hepsi için doğrulama token'ı oluşmuş (gönderim denenmiş); muhtemel neden Hotmail Gereksiz klasörü, kanıtlanamadı. **Elle:** Resend panelinde bu 3 gönderimin durumu ve Vercel'deki `MAIL_FROM` değerinin `@bollmark.com` olduğu kontrol edilecek.
- **Yapılan:**
  - `/hesap/dogrulama-bekleniyor`: kayıttan sonra açılır, maskeli e-posta, "tekrar gönder" (10 dk sınırı), "Alışverişe devam et" (`?devam=` yalnız site içi yol, `src/lib/safe-path.ts`). Doğrulanmış üye devam yoluna, girişsiz ziyaretçi girişe gider. Kalp Topla o üye için ACTIVE ise kampanya renklerinde, kalp/kupon animasyonlu "Kalp Topla'dan faydalanmak için e-postanı doğrula" kartı.
  - Kayıtta "Alışverişe devam" yerine önce bu sayfa açılır; Kalp Topla `?kalp=` dönüşü korunur. Giriş sekmesi değişmedi.
  - Hesabım layout'unda doğrulanmamış üyeye ince uyarı şeridi (mevcut sorguya `emailVerifiedAt` eklendi, yeni sorgu yok).
  - Telefon kayıtta zorunlu, `src/lib/phone.ts` (`normalizeTrMobile` → E.164 `+905xxxxxxxxx`, `formatTrMobile`) istemci ve API'de; Meta CAPI'ye normalize değer gider. Şema değişmedi, unique yok. Hesap Özeti'nde telefonu boş üyeye "Telefon numaranı ekle" kutusu.
- **Doğrulama:** tsc temiz, lint değişen dosyalarda temiz, 187/187 birim testi, build temiz. Playwright ile yerelde tüm senaryolar (telefonsuz red, `+905321234567` kaydı, "biraz bekle", devam, Kalp akışı, uyarının doğrulamayla kaybolması, `//evil.com` → `/hesap`, 1280/375 taşma yok). Test üyeleri (`bm-dogrulama-test-*`) ve testte oluşan boş Kalp barı/turu canlı DB'den silindi.
- **Bilinen, değiştirilmedi:** Ödeme sayfasında telefon yalnız seçili kayıtlı adresten dolar, `Customer.phone` kullanılmaz. Tercihler sayfası telefonu normalize etmeden kaydediyor ve boşaltabiliyor.

## Önceki not (2026-10-31, Kalp Topla Faz 11, yayın tamamlandı)

- **Kalp Topla 2026-10-31'de yayında, mod Açık** (geçiş 13:33 UTC, kullanıcı yaptı). Eşik 10, %50, kupon 48 saat. Deploy `bollmark-eckpjr7jd`, `main` `c7e202c`.
- `kalp-topla-wip`, `main`'e birleştirildi; `vercel.json`'daki bu dalın deploy kapatma satırı kaldırıldı. Canlı DB şemayla aynı (`migrate diff` boş, kısmi indeksler var), `db push` gerekmedi.
- **Vercel Production'a eklendi:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `UNSUBSCRIBE_SECRET`, `DEVICE_IP_SALT` (yalnız Production, yerel `.env`'den ayrı değerler). Secret değerler geri okunamadığı için ilk gerçek push ve çıkış e-postasında sınanacak. Canlıda push aboneliği 0.
- **T12/Y7:** 0 üye, gerek kalmadı. 25 siparişin hepsi silinmiş, uygun ödenmiş sipariş yok; `--uygula` çalıştırılmadı. 6 üyeden 2'si doğrulanmamış, ilk kalpte doğrulama e-postası alır.
- **Yasal metinler:** Gizlilik güncellendi (6776 → 9172 karakter), Kampanya Koşulları oluşturuldu. Yazma öncesi yedek `Claude outputs/kalp-topla-yayin/yasal-metinler-yedek-oncesi.json`. Üç sayfa canlıda 200. Sitemap 1 saatlik önbellekte, Koşullar'ın girdiği görülmedi.
- **Açık'a geçiş doğrulandı:** tur, kalp, davet, bonus, bar 0. 4 test kuponu `TEST_CANCELLED`, 1 `USED` kaldı. `BLM261030-5986` `kalpTestAt` ile işaretlendi. Ödenmemiş test siparişi yoktu. Yeni bar eşiği kod ve ayardan doğrulandı, gerçek tur satırı ilk kalpte oluşacak.
- **Misafir kontrolü:** 1280/375 şerit, pencere, bar ve `/kalp-topla` açık, yatay taşma yok. Görüntüler `Claude outputs/kalp-topla-yayin/`. Çerez yalnız o test tarayıcısında reddedildi.
- **Doğrulama:** tsc temiz, 183/183 birim testi, build temiz. `docs/gunluk/2026-10.md` çakışması iki taraf da korunarak çözüldü.
- **Atlanan:** 9.1'in 5, 6 ve 7. maddeleri kullanıcı kararıyla yapılmadı.
- **Yayın sonrası düzeltmeler:**
  - Şerit varken md ve üstünde ürün sayfası üst boşluğu 32 px artar (`data-kalp-serit`, CSS `:has`), ürün bilgisi kesilmez. Katalog kırıntısına dokunulmadı: kutu 3 px değiyor, yazı görünüyor.
  - "Arkadaşını çağır" artık önce `KalpDialog` içinde davet kutusunu açar: 3 adım, link, WhatsApp, Linki kopyala, destekleniyorsa Diğer. 3. adım metni bu üründe aktif kalp olup olmamasına göre değişir (`inviteBonusStep`). Kalplerim'deki paylaşım alanı değişmedi. Paylaşım için Meta/GA4 olayı yok.
  - `KalpDialog` ekran yüksekliğiyle sınırlandı, taşarsa içeride kayar.
  - Admin sol menüde Kalp Topla, Pazarlama'dan ayrılıp kalp ikonlu kendi grubuna taşındı (Ayarlar, Rapor, Davetler, Onaylar). Adresler değişmedi.
  - Yerel test sahte üye yanıtıyla yapıldı; gerçek üye hesabı ve gerçek telefon denenmedi, `navigator.share` yokken Diğer'in gizlenmesi tarayıcıda doğrulanamadı.
  - Kullanıcı isteğiyle `denemekalp1`, `kalpdeneme`, `ozileventkalp1` test hesapları canlıdan silindi. Yerel yedek `Claude outputs/kalp-topla-yayin/test-hesaplari-yedek.json`, commit edilmeyecek. Test listesinde 1 hesap kaldı.
- **Bilinen küçük sorunlar (düzeltilmedi):**
  - Ürün sayfasında ve başlığında "KOTON" görünüyor (bkz. `KOTON_IBARELERI_KALDIRMA_PLANI.md`).
  - 375'te çerez bandındaki "Tümünü Kabul Et" iki satıra iniyor.
- **Kalan elle yapılacaklar:**
  - İlk gerçek kuponlu siparişte admin'de iki satır, Vega'da ayrı satırlar ve fatura tutarları/KDV kontrol edilecek.
  - Chrome ve Android'de gerçek push denenecek, iPhone'da tercih satırının çıkmadığına bakılacak.
  - Saatlik cron'un ilk gerçek bildirimleri ve e-posta görünümü izlenecek.
  - `/sitemap.xml`'de Koşullar sayfası kontrol edilecek.

## Önceki not (2026-10-31, Kalp Topla Faz 10)

- Dal `kalp-topla-wip`, `main`'e birleştirilmedi. **Faz 10 (rapor) kullanıcı onayıyla kapatıldı, commit ve push edildi (yalnız bu dal; `vercel.json`'da bu dalın deploy'u kapalı).** Şema değişmedi: `KalpCoupon.status` yorumuna `CANCELLED` eklendi, `db push` yapılmadı.
- **Yapılan:** `/admin/kalp-topla/rapor` (`src/lib/kalp-topla/report.ts`, `admin-rules.ts`), `/admin/musteriler/[id]` (doğrulama, kuponlar, kalpler, bonus, onaylar, cihaz eşleşmeleri), kupon iptal ve süre uzatma (`admin-coupons.ts`, `src/components/admin/kalp-coupon-actions.tsx`), menüde "Kalp Topla Raporu", müşteri listesinde "Detay", 2 yeni denetim eylemi.
- **Kullanıcı kararları:** Rapor varsayılan gerçek veri, ayrı "Test verisi" görünümü var. Dönem 7/30/90/Tümü; aktif bar ve bekleyen bonus anlık. Ciro yalnız kuponlu satırlar, kısmi iadeler düşmez, indirim `Order.kalpDiscountCents`. Talep geri çekilen kalpleri de sayar, bonus sayılmaz. Geçerli davet yalnız `CREDITED`. `CANCELLED` yalnız `AVAILABLE` kupona uygulanır, "verilen"de sayılır, Kalplerim'de "İptal edildi" yazar. İptal öncesi modal onay var; `window.confirm` kullanılmaz.
- **Test ayrımı:** `kalpTestAt` yalnız Açık'a geçişte yazıldığı için test siparişi kuponun `isTest`'inden de anlaşılır. Kalp testliği turundan gelir.
- **Düzeltme:** `coupon-expiring` `eventKey`'ine bitiş zamanı eklendi; yoksa uzatılan kuponun ikinci hatırlatması sessizce düşüyordu.
- **Doğrulama:** 181/181 birim testi, tip kontrolü temiz, lint değişen dosyalarda hatasız. Elle sayım 30/30, hatırlatma 3/3, iptal ve uzatma arayüzden 4/4 (`scripts/kalp-topla-senaryo-faz10.ts`). 1280/375 görüntüleri `Claude outputs/kalp-topla-faz10/`.
- **Temizlik:** geçici kt10 kayıtları ve geçici admin silindi; 12 tablonun sayısı ve iki rapor başlangıçla aynı. Mod ve ayarlar değişmedi, Vega'ya kayıt düşmedi, e-posta gitmedi.
- **Yayın öncesi denenecekler:**
  - Kalplerim'de "İptal edildi" etiketinin tarayıcıda görünümü.
- **Bilinen:** 375 genişlikte tablolar kendi içinde yana kayar, kupon butonları kaydırınca görünür.
- Sıradaki: Faz 11 (yayın).

## Önceki not (2026-10-31, Kalp Topla Faz 9)

- Dal `kalp-topla-wip`, `main`'e birleştirilmedi. **Faz 9 (vitrin) kullanıcı onayıyla kapatıldı, yerel commit, push EDİLMEDİ.** Şema değişmedi. Bu commit diğer bilgisayarda kullanıcı push edene kadar görünmez.
- **Yapılan:** `/kalp-topla` (`src/app/(site)/kalp-topla/page.tsx`), şerit ve ilk ziyaret penceresi (`src/components/kalp-topla/kalp-vitrin.tsx`), liste verisi (`src/lib/kalp-topla/vitrin.ts`, 60 sn önbellek), OG görseli `public/og-kalp-topla.jpg`, Kampanya Koşulları ve Gizlilik bölümü (`prisma/legal-pages-content.ts`), Çerez Politikası eklemeleri, sitemap (`/kalp-topla` yalnız Açık modda). `durum` ucu artık eşik ve oran da döner.
- **Kullanıcı kararları:** FROZEN'da `/kalp-topla` açık, üstte "Kampanya şu an duraklatıldı" notu, listeler, şerit ve pencere gizli. 404 yalnız INVISIBLE'da (kampanya hiç açılmamışken Kapalı mod ve Gizli yayında test dışı ziyaretçi). Şerit X ile 7 gün kapanır (`bm_kalp_serit`), metin masaüstünde "Beğendiğin ürüne kalp ver, 10 kalp dolunca yarı fiyatına al. Nasıl mı?", mobilde "Kalp ver, 10 kalp dolunca yarı fiyatına al". Gizlilik'te yeni bölüm 11, "Değişiklikler" 12 oldu; planın "IP adresiniz saklanmaz" değişikliği metinde karşılığı olmadığı için atlandı. Çerez Politikası kodda, `main`'e birleşince yayına çıkar; "İşlevsel" kategorisi eklendi, `CONSENT_VERSION` değişmedi.
- **Bizim kararımız:** Şerit ve pencere `/kalp-topla`, ödeme ve hesap sayfalarında çıkmaz. Localstorage kapalıysa pencere hiç açılmaz, şerit normal görünür.
- **DB'ye yazılmadı:** Gizlilik ve Kampanya Koşulları canlıda eski. `/sayfa/kalp-topla-kosullari` bu yüzden 404, beklenen durum. Script `scripts/kalp-topla-yasal-metinler.ts` varsayılan kuru, gerçek yazma `--confirm`; hiç çalıştırılmadı (kuru modda bile). Koruma mantığı git'teki eski metinle DB'siz doğrulandı. Yazılınca Koşullar sitemap'e girer, Gizli yayında da görünür.
- **Doğrulama:** 173/173 birim testi, tip kontrolü ve build temiz; lint değişen dosyalarda temiz. Çerez bandı çakışması 1280/375 geçti: bant açıkken pencere yok, tercih sonrası açılıyor, 375'te pencere 264/667 px. 375'te yatay taşma yok. Mod testi: Gizli yayında test hesabı açık, test dışı üye ve misafir 404; Kapalı'da test hesabı FROZEN, test dışı üye ve misafir 404. Görüntüler `Claude outputs/kalp-topla-faz9/`.
- **Denenmedi:** herkese açılmış kampanyada misafir için FROZEN (canlıda yalnız test turu var), Açık mod, şeridin 7 gün sonra dönmesi, localstorage kapalıyken şerit. Son şerit metni tarayıcıda görülmedi (genişlik ölçüldü, 297 px, kullanıcı localhost'ta baktı); ekran görüntülerinde eski metin var.
- **Temizlik:** kt9 geçici üyeleri silindi, mod Gizli yayın, 3 test hesabı, 5 tur, 15 kalp, 3 kupon, 3 bar. Geçici veri script'i `scripts/kalp-topla-ekran-faz9.ts`.
- **Yayın öncesi avukata sorulacaklar:**
  - Kalp verince e-posta izninin otomatik açılması 6563'e uygun mu; uygun değilse akış açık onaya çevrilecek ve Gizlilik metni de buna göre güncellenecek.
  - `bm_davet` ve `bm_cihaz` çerezlerinin işlevsel/zorunlu sayılması onaysız kullanım için yeterli mi.
- **Yerel `.env` (dükkan bilgisayarı):** `DEVICE_IP_SALT`, `UNSUBSCRIBE_SECRET`, `PAYMENT_ENCRYPTION_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PAYMENT_LOCAL_TEST`, `IYZICO_SANDBOX_API_KEY`, `IYZICO_SANDBOX_SECRET_KEY`, `IYZICO_SANDBOX_BASE_URL` burada yok; kullanıcı evden getirecek, üretilmeyecek. Yokken sandbox ödeme, push ve e-posta çıkış linki bu bilgisayarda çalışmaz. `MAIL_DEV_REDIRECT` ve `SITE_URL=http://localhost:3000` var.
- **Bilinen:** Giriş yapmış üyede header'daki `/hesap` linkinde hydration uyarısı var, Faz 9'dan gelmiyor. `.next/dev/types` eski kalırsa tsc ve build silinmiş route'a takılır: pull sonrası bu klasör silinir. Şerit her ziyaretçide `durum` isteği yapar (plan 5.0), trafik artınca Neon'da izlenmeli. `yasal-satici-iletisim-guncelle.ts` kaynak metin değiştiği için artık yazmaz.
- **Diğer bilgisayarda ilk iş:** Commit push edildiyse `git pull origin kalp-topla-wip`, `npm install`, `npx prisma generate`, `.next/dev/types` sil.
- Sıradaki: Faz 10 (rapor).

## Önceki not (2026-10-31, Kalp Topla Faz 8)

- Dal `kalp-topla-wip`, `main`'e birleştirilmedi, push edilmedi. **Faz 8 (bildirimler) kullanıcı onayıyla kapatıldı, yerel commit.** Şema değişmedi.
- **Yapılan:** outbox (`src/lib/kalp-topla/notifications.ts`), 4 e-posta şablonu, günlük sınır (Y1), "son 6 saat", tek tık çıkış başlıkları, push (`public/sw.js`, `web-push`), zil + Hesabım > Bildirimler, saatlik cron `/api/cron/kalp-topla`. `sendMail` artık başarı döndürüyor, `text` ve `headers` alıyor.
- **Kullanıcı kararları (2026-10-31), T3'ü değiştirir:** kalp verene e-posta sorulmaz, onay otomatik açılır (`KALP_VERME`, sürüm `EMAIL-KALP-2026-10-31`). Bir kez çıkan üye yeniden açılmaz. Kalp ver butonu altında tek satır not var. İlk kalp penceresi tümüyle kalktı; push yalnız İletişim Tercihleri'nden açılır. `Customer.pushPromptDismissedAt` kullanılmıyor, silinmedi.
- **Yasal risk (kullanıcıya bildirildi):** otomatik onay 6563 sayılı kanunun önceden onay kuralını karşılamayabilir, en riskli olan "son 2 kalp" e-postası. Yayın öncesi muhasebeci/avukata sorulmalı.
- **Doğrulama:** 171/171 birim testi, tip kontrolü temiz, tam lint 0 hata (son küçük düzenlemelerden sonra yalnız değişen dosyalarda çalıştı). `scripts/kalp-topla-senaryo-faz8.ts` 21 OK, 7 e-posta `MAIL_DEV_REDIRECT` ile gitti. One-click çıkış, cron 401/200, zil 1280/375 denendi; görüntüler `Claude outputs/kalp-topla-faz8/`.
- **Denenmedi:** gerçek push (Chrome, Android, iPhone'da tercih satırının çıkmaması), kalp verince `after()` ile anlık gönderim, FROZEN'dan dönüşte cron yerleştirmesi, kullanıcının gelen kutusunda şablon görünümü.
- **Yayın öncesi:** Vercel'e `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (yerel `.env`'de var, Vercel'e eklenmedi). `/sayfa/kalp-topla-kosullari` Faz 9'a kadar 404. Saatlik cron için Vercel planı panelden doğrulanmadı (plan: Pro).
- **Temizlik:** kt8 verisi kapsam kontrollü tek transaction'da silindi; mod Gizli yayın, 3 test hesabı duruyor.
- `next dev` Turbopack ile yine sürekli yeniledi: `.next/dev` silinip `npx next dev --webpack` ile çözüldü.
- Sıradaki: Faz 9 (vitrin).

## Önceki not (2026-10-31, Kalp Topla Faz 7)

- Dal `kalp-topla-wip`, `main`'e birleştirilmedi, push edilmedi. **Faz 7 (iade ve değişim) ✅ kullanıcı onayıyla kapatıldı, yerel commit.**
- **Yapılan:** kupon geri yükleme (satır başına bir kez, `OrderItem.kalpRestoredAt`), değişimde kupon taşıma/geri yükleme, stok koduyla fark hesabı, "fark tahsil/iade edildi", fark açıkken tamamlamada uyarı. Sipariş listesinde "Dikkat gerekiyor" notu.
- **Kullanıcı kararları:** kargodan önce ödemesi iptal edilen veya tam iade edilen kuponlu satırda iade talebi aranmaz, kupon iyzico başarısından sonra döner; süresi dolmuşsa dönmez, denetim kaydı ve sipariş detayında not olur. Kargolanmış siparişte tamamlanmış iade talebi + ücret iadesi şartı aynen. Ödeme alındıktan sonra kupon USED yapılamazsa sipariş durmaz, "Dikkat gerekiyor" notu düşer.
- **Süre kuralı (plan 5.8 yorumu):** iade anında süre bitmemişse kullanım anındaki kalan süre verilir; bitmişse kargolanmış iadede `refundExtraHours`.
- **DB (canlı, kullanıcı onaylı, 2026-10-31):** `OrderItem.kalpCouponId` unique kalktı, normal indeks oldu; `kalpRestoredAt` eklendi. Çift kullanım koruması artık kupon durumunda. `prisma/migrations/20261031000000_kalp_kupon_unique_kaldir/migration.sql`, `prisma db execute --file` ile uygulandı (proje `db push` düzeninde, `_prisma_migrations` tablosu yok). `migrate diff` boş.
- **Doğrulama:** 163/163 birim testi, tip kontrolü ve lint temiz; `scripts/kalp-topla-senaryo-faz7.ts` senaryoları hatasız. Gerçek sandbox: `BLM261031-7095` ödendi, iptal edildi, kupon döndü, ikinci iptal reddedildi. `/api/orders` eşzamanlı iki istek: 201 ve 409. Admin ekranındaki "Ödemeyi İptal" butonu ve 1280/375 ekran görüntüleri denenmedi.
- **Temizlik:** kt7 test üyesi, kuponları ve 13 siparişi (`BLM261031-7095`, `BLM261031-4967` dahil) tek transaction'da silindi. PaymentLog satırları durur (yabancı anahtar yok).
- **Elle yapılacak:**
  - `BLM261030-5986` ve `BLM261031-7095` Vega'da elle kontrol edilmeli (ikisinde de `vegaFetchedAt` boştu, bu tek başına kanıt değil). 7095 sitede artık yok.
  - Neon `yedek-faz7-kupon-unique` branch'i birkaç gün sonra elle silinmeli (otomatik silme kapalı).
- `BLM261030-5986` kuponu USED kaldı, test kuponu; dokunulmadı.
- Sıradaki: Faz 8 (bildirimler).

## Önceki not (2026-10-30, Kalp Topla Faz 6)

- Dal `kalp-topla-wip`, `main`'e birleştirilmedi. **Faz 6 (fiyat, sepet, sipariş) ✅ kullanıcı kararıyla kapatıldı, kod dalda (`047e514`).**
  Şema değişmedi. Aşağıdaki bekleyen testler yapılmadı, yayın öncesi bakılacak.
- **Yapılan:** `priceCart` ve `/api/sepet/fiyat`, otomatik/elle kupon, kuponlu adedin satıra bölünmesi, kupon RESERVED/USED/serbest
  bırakma, puan tavanı (T7), iyzico sepetinde kuponlu satıra indirim dağıtılmaması. Faz 5 elle testi: otomatik +2, "İncelemede", Onayla geçti;
  İptal elle denenmedi. Bar mesajı "İstersen arkadaşını çağır" oldu; bilgisayarda "Arkadaşını çağır" doğrudan site penceresini açıyor.
- **Sandbox testi:** `BLM261030-5986` (vegaId 27): 3.190 TL ürün kuponla 1.595 TL ödendi, Ödemeyi İptal ile iade edildi, kupon USED kaldı
  (geri yükleme Faz 7). Sepet testi kullanıcıda geçti.
- **Ertelenen testler (yayın öncesi):** ödemeyi yarıda bırakma (DB'de bu siparişten yok), 2 adet + puan (DB'de yok), 1280/375 ekran görüntüleri. Stok geri gelişi kullanıcı gözlemi, DB'den doğrulanmadı.
  Canlıdaki eski kod test siparişini iptal ederse kuponu bırakmaz: test boyunca canlı admin sipariş listesini açma.
- **Vega:** Test siparişinde `vegaFetchedAt` boş kaldı, iade Vega'ya otomatik gitmez; Vega'da elle iptal edilmeli. Kullanıcıya göre
  `SiparisNotu` Vega'da "Sipariş No" sütununda görünüyor; çözüm ayrı oturumda.
- **Yerel `.env`:** `SITE_URL=http://localhost:3000`, `PAYMENT_LOCAL_TEST=1` ve `IYZICO_SANDBOX_*` var (anahtarlar DB'deki sandbox kaydından kopyalandı,
  DB'ye yazılmadı). Bu ayar yalnız yerelde çalışır, Vercel'e eklenmez, sipariş notuna `LOCAL TEST` yazar. Admin'deki "Sandbox bağlantısını test et"e basılmaz.
- `/api/kuponlar/dogrula` artık kullanılmıyor, planda kaldırılacak.
- Sıradaki: Faz 7 (iade ve değişim).

## Önceki not (2026-10-30, Kalp Topla Faz 5)

- Dal `kalp-topla-wip`, `main`'e birleştirilmedi. **Faz 5 (Davet) ✅ tamamlandı, commit ve dal push'u yapıldı.**
  Davet penceresine animasyon eklendi.
- **Diğer bilgisayarda ilk iş:** `git pull`, `npm install`, `npx prisma generate`. `.env`'de `SITE_URL=http://localhost:3000`
  ve `MAIL_DEV_REDIRECT` var mı bak, yoksa ekle. `DEVICE_IP_SALT`, `UNSUBSCRIBE_SECRET`, `PAYMENT_ENCRYPTION_KEY` için kullanıcıya sor, üretme.
- **Bekleyen sorular:** "Nasıl çalışır?" 2. sahnesi ve "Son N kalp" mesajı isteğe bağlı dille yumuşasın mı
  (öneri: "Son 2 kalp! İstersen arkadaşını çağır, +2 eklesin"). Admin Davetler ekranı açılıp denenmeli.
- Doğrulama: tip kontrolü temiz, 139/139 birim testi, build temiz, Faz 5 dosyalarında lint hatası yok
  (tam `npm run lint` başka dosyalarda 46 hata veriyor, Faz 5'ten önce de vardı mı bakılmadı). Senaryo
  `scripts/kalp-topla-senaryo-faz5.ts`: 51 OK, 0 hata, parmak izi aynı. Ekran görüntüleri
  `Claude outputs/kalp-topla-faz5/`; admin Davetler ekranı görüntülenemedi (`.env`'deki admin bilgisi 401).
- **DB:** `KalpBonusCredit_splitFromId_key` ve kısmi `KalpBonusCredit_root_unique` canlı DB'ye eklendi
  (`prisma/manual-sql/2026-10-30-kalp-bonus-credit-indeksleri.sql`, `prisma db execute`, kullanıcı onaylı).
  Şemada tanımlı, `migrate diff` boş. Script sonrası son durum: Gizli yayın, 2 test hesabı, 7 kalp, 2 tur, 2 kupon, 1 bar, davet/bonus 0.
- **Yerel `.env`:** `SITE_URL=http://localhost:3000` eklendi (Vercel'e eklenmez). `DEVICE_IP_SALT` ve
  `UNSUBSCRIBE_SECRET` hâlâ yok; kullanıcı diğer bilgisayara bakacak. Localhost'ta IP boş sayıldığı için
  aynı IP işareti yerelde tuzla da oluşmaz, yalnız script'te sahte özetle test edildi.
- **Bilinen:** `next dev` (Turbopack) iki kez sayfaları sürekli yeniledi, nedeni bulunmadı, Faz 5'e bağlı olduğu kanıtlanmadı.
  Olursa `.next/dev` sil, `npx next dev --webpack` ile başlat.
  Ürün sayfasında dev panelinde hydration uyarısı var, Faz 5 bileşenleri sunucuda çizilmiyor, kaynağı bulunmadı.
- Bildirimler ("arkadaşın katıldı", "bonus süresi doldu") ve saatlik cron Faz 8'de. Sıradaki: Faz 6.

## Önceki not (2026-10-30, Kalp Topla Faz 4)

- Dal: **`kalp-topla-wip`** (origin'de var). `main`'e birleştirilmedi; `main` push edilmedi.
  Bu dalın Vercel deploy'u `vercel.json` içindeki `git.deploymentEnabled` ile kapalı.
- **Faz 4 kodu bitti;** tip kontrolü, lint, 127/127 birim testi ve build temiz. Planda Faz 4
  henüz "Tamamlandı" işaretli DEĞİL.
- Kullanıcı kararları (Faz 4): bekleyen kalp, kampanya o üye için açık değilken bekler, açılınca
  sayılır; Kapalı modda yalnız test turu varsa yalnız test hesapları donuk görür; Kalplerim'de
  kupon listesi var; Y15 testi silinmiş işaretli sahte siparişlerle yapılacak.
- **Faz 4 ✅ tamamlandı (2026-10-30, kullanıcı localhost'ta onayladı), yerel commit.** Senaryo testi
  49 OK, 0 hata. Ekran görüntüleri 1280/375. Kullanıcı isteğiyle eklenenler: animasyonlu "Nasıl
  çalışır?" penceresi, belirgin bar başlığı (%50 kupon rozeti), büyük kalpler, soluk "N kez doldu"
  satırı, sarı "Kilit açıldı" şeridi. Sıradaki: Faz 5 (Davet).
- **Canlı DB'de kullanıcının test verisi var:** mod Gizli yayın, 2 test hesabı, 7 kalp, 2 tur, 2 kupon,
  1 bar (salt okuma, 2026-10-30). Bu yüzden Faz 4 senaryo ve ekran script'leri şu an çalışmayı reddeder.
  Veri Açık'a geçiş sıfırlamasıyla temizlenir.
- **Kurtarma:** `scripts/kalp-topla-test-guvenlik.ts` (ayar yedeği `scripts/.kalp-topla-yedek-*.json`,
  git dışı). Yarıda kalırsa: `npx tsx scripts/kalp-topla-senaryo-faz4.ts temizle`. Gerçek Ctrl+C ile
  denenmedi.
- **Kupon henüz sepette çalışmaz:** Faz 6. Bar mesajındaki "Arkadaşını çağır" için buton/link Faz 5'te.
- **Yeni değer üretilmeyecek:** `PAYMENT_ENCRYPTION_KEY`, `DEVICE_IP_SALT`, `UNSUBSCRIBE_SECRET` bu
  bilgisayarda eksik, kullanıcı diğer bilgisayardan kopyalayacak. `MAIL_DEV_REDIRECT` eklendi.
- **Bekleyen karar:** `kalp-topla-wip` dalını `main`'e birleştirmek ve `vercel.json`'daki `kalp-topla-wip`
  satırını kaldırmak. **`main`'e push kullanıcının açık
  izni olmadan yapılmaz.**
- **Diğer bilgisayarda ilk iş:** `.env`'de `MAIL_DEV_REDIRECT=ozilevent@gmail.com` satırı var mı
  bak, yoksa ekle; `DATABASE_URL` ve diğer gerekli değişkenlerin İSİMLERİNİ (değerlerini değil)
  `.env.example` ile karşılaştırıp eksikleri kullanıcıya söyle (Kalp Topla için yalnız yerelde
  olanlar: `DEVICE_IP_SALT`, `UNSUBSCRIBE_SECRET`, `MAIL_DEV_REDIRECT`); `npm install` çalıştır.

Son güncelleme: 2026-10-31

Bu dosya projenin **şu anki** durumunu kısa tutar. Yeni bir oturumda kaldığın
yerden devam etmek için önce bunu, sonra gerekirse ilgili günlük dosyasını oku.

- Oturum günlükleri (ne yapıldı, neden, nasıl doğrulandı): `docs/gunluk/`
- Planlar (açık olanlar ve arşiv): `docs/planlar/README.md`

## Altyapı

- **Canlı site:** Vercel, proje `bollmark`; domain `bollmark.com`, DNS Cloudflare'de.
  `main`'e push otomatik deploy tetikler. Yalnız `.md` değişen commit'ler deploy
  ETMEZ (`vercel.json` `ignoreCommand`).
- **Repo:** https://github.com/R7Zenith/bollmark.git (`main`)
- **Veritabanı:** Neon Postgres, Prisma 7. Yerel geliştirme ve canlı site **AYNI**
  veritabanını kullanır; yerelde yazan her test canlı veriye yazar.
- **Görseller:** hepsi Cloudflare R2'de (`img.bollmark.com`). Eski Vercel Blob
  görselleri 2026-10-12'de taşındı; Blob deposu henüz silinmedi (aşağıda).
- **Önizleme kapısı:** kapalı (2026-10-13), site herkese açık; tekrar açmak için
  `PREVIEW_GATE` env'ini sil/`on` yap + redeploy (`src/proxy.ts`).
- **Ödeme:** iyzico sanal POS canlıda (kullanıcı teyidi, 2026-10-09).
- **Vega:** Ticimax taklidi SOAP servisi (`src/app/Servis`) çalışıyor (2026-09-11). Vega'daki Site Adı `vega.bollmark.com` (2026-10-25); Cloudflare Worker `vega-bridge-worker` hem bu adı hem `www.` ekli halini hem eski workers.dev adresini taşıyor.
- **Cron (Vercel, günde 1):** sepet hatırlatma, ödeme mutabakatı, Instagram kareleri (`/api/cron/instagram`).
- **Yeni bilgisayarda kurulum:** `KURULUM-NOTLARI.md` ve `.env.example`.

## Açık işler

| İş | Durum | Plan |
|---|---|---|
| Blob'dan R2'ye görsel taşıma | Taşıma (2026-10-12) ve Faz 3 kod temizliği (2026-10-13) bitti; kod artık Blob'a hiç yazmıyor/okumuyor. Kalan Faz 4: Blob deposunu kapatma, kullanıcı, 1–2 gün Blob grafiği izlendikten sonra. | `docs/planlar/BLOB_TAMAMEN_KALDIRMA_PLANI.md` |
| Meta Pixel + Conversions API | Push edildi (2026-10-24). Vercel'e yalnız **Production** ortamına `NEXT_PUBLIC_META_PIXEL_ID` ve `META_CAPI_ACCESS_TOKEN` (sensitive) CLI ile eklendi; `META_TEST_EVENT_CODE` Vercel'de YOK (yalnız yerel `.env`). Ayrı redeploy yapılmadı, bu push'un yayını değişkenleri alır. `CONSENT_VERSION` 2 (herkese bant yeniden çıkar). `Order.metaCapiContext` / `metaPurchaseSentAt` db push ile eklendi. Gizlilik Politikası Meta maddeleri DB'ye hedefli yazıldı. Kalan: canlıda Olay Yöneticisi'nde AddToCart/InitiateCheckout/Purchase sunucu olaylarının ve tekilleştirmenin doğrulanması. | `docs/planlar/META_PIXEL_CAPI_PLANI.md` |
| Google Analytics 4 (GA4) + KDV oranları | Push edildi (2026-10-25). Vercel'e yalnız **Production** ortamına `NEXT_PUBLIC_GA4_MEASUREMENT_ID` CLI ile eklendi (ayrı redeploy yok, bu push'un yayını alır); `NEXT_PUBLIC_GA4_DEBUG` yalnız yerel `.env`. `CONSENT_VERSION` 3 (herkese bant yeniden çıkar). `Category.vatRate` / `Product.vatRate` db push ile eklendi; kategori oranları girildi (Parfüm, Takı & Bijuteri, Saç Aksesuarları %20; diğer 40 kategori %10). Vega `SelectUrun` artık bu oranı gönderiyor. Gizlilik Politikası (`gizlilik-politikasi`) GA4/Google maddeleri push ile birlikte DB'ye yalnız bu kayıt hedeflenerek yazıldı. Kalan: canlıda Realtime/DebugView'da olayları ve `purchase`'ı doğrulamak. | `GA4_KURULUM_PLANI.md` |
| Ön Bilgilendirme Formu + ödeme onay kutusu + kargo bilgisi | Push edildi (2026-10-25, GA4 ile birlikte). `/on-bilgilendirme-formu` (statik, kod tarafında), ödemede iki belge pencerede açılıyor (Ön Bilgilendirme siparişe özel). Ürün sayfası ve sepette kargo ücreti (panel > Ayarlar, şu an 350 TL), 1.500 TL eşiği ve 1-3 iş günü notu. DB değişikliği yok. Kalan: canlıda kutu işaretlenince "Ödemeye Geç"in açıldığının denenmesi (yerelde ödeme kapalı). Satıcı telefonu (Telefon / WhatsApp) ve MERSİS 2026-10-26'da eklendi (aşağıdaki satır). | — |
| İletişim telefonu + Instagram DM | Push edildi (2026-10-26). Bulutfon numarası (+90 224 323 01 21) 26 Ekim'de alındı; yalnız WhatsApp Business için kullanılacak, aramalar açılmayacak: sitede `tel:` linki yok, JSON-LD'de `telephone` yok, yasal metinlerde "Telefon / WhatsApp" düz metin. WhatsApp Business 27 Ekim'de açıldı ve `whatsappActive` = true yapıldı (2026-10-27, `docs/planlar/WHATSAPP_BUSINESS_VE_SITE_BUTONU_PLANI.md`). Değişenler: footer, iletişim sayfası ve anasayfa kartında WhatsApp linki; yüzen "Bize yaz" butonunda WhatsApp + Instagram menüsü (marka renkli ikonlar); ürün sayfasında Beden Tablosu'nun altında "Sorunuz mu var? WhatsApp · Instagram" satırı (WhatsApp hazır mesajla `wa.me?text=` açılıyor); "Hemen Al" butonu kaldırıldı; çalışma saati 19:30. MERSİS ve VKN girildi; unvan ve vergi dairesi mevcut sözleşme metninden (kullanıcı onayı); KEP boş. Mesafeli Satış Sözleşmesi ve Gizlilik Politikası DB kayıtlarına MERSİS + Telefon/WhatsApp hedefli yazıldı (`scripts/yasal-satici-iletisim-guncelle.ts`). Instagram DM: yüzen buton, ürün sayfasında "Instagram'dan sor", footer/iletişim linki; Meta `Contact` / GA4 `contact` rızaya bağlı. Kalan: KEP adresi; açılmayan numaranın yasal yeterliliğinin muhasebeci/avukatla teyidi; canlıda olayların doğrulanması. 27 Ekim 2026: Instagram kullanıcı adı koton.karacabey → bollmarkcom; sitedeki Instagram DM butonları, footer bağlantısı ve diğer referanslar güncellendi; canlıda (push d976a0a). | `docs/planlar/ILETISIM_TELEFON_VE_INSTAGRAM_DM_PLANI.md` |
| Meta katalog bağlantısı | Uygulandı (2026-10-26, `main` 63f284b). `/feed/meta.xml` (availability boşluklu, görseller R2 `.jpg` kopyaları, başlıkta renk/beden "Baş Harf Büyük"); `getItemGroupId` feed'ler, JSON-LD ve AddToWishlist'te ortak; yeni yüklemelerde R2'ye `.jpg` kopyası otomatik. R2 toplu JPEG işi bitti (2188 dosya, hata 0). Canlı `meta-feed-kontrol`: 1661 item, 2179 görsel `image/jpeg`, sorun yok. `/feed/google.xml` değişmedi. `meta-externalagent` UA canlıda 403 (Vercel Firewall AI Bots = Deny), `facebookexternalhit` 200. Commerce Manager (2026-10-26): mevcut katalog "Tüm Ürünler" kullanıldı; eski XMLExport akışı silindi, yeni planlı akış "Bollmark Site Feed (meta.xml)" 3 saatte bir; yükleme 1,7 B ürün, sorun 0 (Firewall engellemedi). Pixel (`bollmark.com` veri seti, 1458383412848656) kataloğa bağlandı; eski "eski salaklık" veri seti ve piksel kaynağı ayrıldı. Kalan: 29–30 Ekim'de eşleşme oranı kontrolü (hedef ≥%90), 2026 ürün setleri, Instagram ürün etiketleme uygunluğu (bkz. plan, "Commerce Manager kontrolü (2026-10-27)"). | `docs/planlar/META_KATALOG_PLANI.md` |
| 27 Ekim ürünlerinin açıklama taslakları | DB'ye yazıldı (2026-10-27, kod değişikliği yok). 27 Ekim'de eklenen 16 ürüne (11 parfüm, 4 gömlek, 1 ceket) `scripts/ai-taslak-aktar.ts --iceri` ile yalnız `descriptionDraft` yazıldı, `originalDescription` bir kez doldu; `description` değişmedi. Kalan: kullanıcının admin'de "Açıklama: taslak bekliyor" filtresinden okuyup onaylaması. | `docs/planlar/arsiv/SEO_FAZ6_OZGUN_ACIKLAMA_VE_YONLENDIRME_PLANI.md` |
| Vega sipariş aktarımı | Canlıda (2026-10-26). Vega Site Adı `vega.bollmark.com` (sipariş isteği `www.` ekli geliyor; Worker'a iki özel alan adı bağlı). Ödenmiş siparişler (2026-10-26 00:00 sonrası) Vega'ya düşüyor, Vega stoğu ayırıp kullanılabilir stoğu geri gönderiyor (doğrulandı), sitede stok koruması aktif; fatura tutarı/KDV, firma adı, Site Adresi `bollmark.com` doğru. Arctos fatura serisi KOTON şubesi ETicaretSeri = `BLM` (kullanıcı). Acil kapatma `VEGA_SIPARIS_AKTARIM=off`. Kalan: Vega "Sipariş No" sütunu boş (veriyle dolmuyor, Vega/Arctos desteğine sorulacak); Vega'da iptal siteye bildirilmiyor (elle); ilk gerçek siparişte BLM fatura serisinin entegratörde kabulü | `docs/planlar/VEGA_SIPARIS_AKTARIM_PLANI.md` |
| Kalp Topla kampanyası | Uygulama başladı. **T13 güncellendi (2026-10-30):** test Neon branch'i yok, geliştirme canlı DB'de; şema yalnız eklemeli, her şema/veri scripti kullanıcı onaylı, test verisi `isTest`. **Faz 0 (yerel ortam güvenliği) ✅ tamamlandı, yerel commit (push yok):** yerel `.env`'de `MAIL_DEV_REDIRECT` ile tüm e-postalar ozilevent@gmail.com'a, konuda asıl alıcı (`src/lib/mail.ts`; Vercel'e eklenmez). iyzico yerelde kod gereği sandbox. Yerel sandbox test siparişleri ortak DB üzerinden Vega'ya düşebilir: kullanıcı kabul etti, gerekirse Vega'dan elle silinir, önlem yok. Admin'de "Sandbox bağlantısını test et"e basılmamalı (canlı ödeme hazırlığını bozar, Faz 6'da ele alınacak). **Faz 1 (Kaydedilenler, T9) ✅ tamamlandı, yerel commit (push yok):** favori butonu yer imi ikonu + "Kaydet / Kaydedildi", Hesabım'da "Kaydedilenler" (`/hesap/kaydedilenler`), eski `/hesap/favorilerim` 301 (`next.config.mjs`). DB, `api/favoriler`, localStorage anahtarı ve Meta/GA4 olay adları değişmedi. **Faz 2 (Temel) ✅ tamamlandı, yerel commit (push yok):** Kalp Topla şeması canlı DB'ye eklendi (2026-10-30, kullanıcı onaylı; 14 yeni tablo + mevcut 6 tabloya nullable/varsayılanlı alanlar; `db push` iki yeni unique alanda genel veri kaybı uyarısı verdiği için `--accept-data-loss` yerine incelenmiş ekleme-only SQL `prisma db execute` ile uygulandı, ardından `db push` "in sync"). Kısmi indeks `KalpHeart_open_unique` şemada (`partialIndexes` önizleme özelliği; koşul Postgres'in sakladığı `= ANY (ARRAY[...])` biçiminde, yoksa db push her seferinde fark görür). `/admin/kalp-topla` ayarlar (mod, test hesapları, test eşiği, değerler, kötüye kullanım eşikleri, engelli alan adları), ürün formunda "Kalp Topla dışı", denetim kodları, `campaignStateFor` + `GET /api/kalp-topla/durum`. Mod Kapalı (ayar satırı henüz yok, varsayılanlar). Açık'a geçiş onay/sıfırlama penceresi Faz 4'te. **Faz 3 (Üyelik ve onay) ✅ tamamlandı, yerel commit (push yok):** her yeni kayıtta genel doğrulama e-postası (kullanıcı kararı) + `/hesap/dogrula`; geçici e-posta engeli (`disposable-email-domains-js` 1.26.0 sabit + admin listesi); `bm_cihaz` + `CustomerDevice` (kayıt/giriş, IP tuzlu özet); kayıt formunda e-posta/WhatsApp onay kutuları; Hesabım > İletişim Tercihleri (push satırı Faz 8'de); `MarketingConsentLog` (ham IP); `/abonelik/iptal` + `POST /api/abonelik/iptal` (HMAC); admin Kalp Topla Onayları + CSV; günlük temizlik cron'u (`vercel.json` 03:30). T12 script'i yalnız kuru çalıştı (uygun üye 0); gerçek çalıştırma yayın fazında. Yeni env'ler yalnız yerel `.env`'de: `DEVICE_IP_SALT`, `UNSUBSCRIBE_SECRET` — Vercel'e yayın fazında eklenecek. Gizlilik/Çerez metinleri (bm_cihaz, ham IP) Faz 9'da; bu kod o metinlerden önce canlıya alınmamalı. **Faz 4 (Bar ve kalp) ✅ tamamlandı, yerel commit (`kalp-topla-wip`).** **Faz 5 (Davet) ✅ tamamlandı, commit `kalp-topla-wip`.** Faz 6, 7, 8, 9 ve 10 tamamlandı (yukarıdaki notlar). Sıradaki: Faz 11. | `KALP_TOPLA_PLANI.md` |
| Ödeme ekranı Sipariş Özeti paneli | Açık (2026-10-31). Bilgisayarda `/odeme` ekranında panel kapalı geliyor (`checkout-form.tsx`, `details`), müşteri tutarı göremeyebilir; satışı etkileyebilir. Faz 7'den sonra bakılacak. | — |
| Kalp Topla test kalıntıları | `BLM261030-5986` ve `BLM261031-7095` Vega'da elle kontrol edilecek. Neon `yedek-faz7-kupon-unique` branch'i birkaç gün sonra silinecek. | — |
| Neon veri transferi (egress) + compute azaltma | **Durduruldu (2026-10-30)**, sıradaki iş Kalp Topla. Kota durumu: 5 GB egress'in ~%80'i, compute 100 CU-saatin 89,5'i dolu; aşılırsa compute dönem sonuna kadar askıya alınır. Kota dolarsa kullanıcı Neon Launch'a geçecek. **Adım 1 yerel commit `82a6d76`, push edilmedi:** menüye ayrı `menu` etiketi verildi; Vega stok değişikliği artık yalnız o ürünü tazeliyor. Adım 2 (`ProductVariant.productId` indeksi, `npm run db:push`) teklif edildi, onay bekliyor; uygulanmadı. Compute bulgusu: DB günde ~22,7 saat uyanık, Vega `SiparisServis` 2 dakikada bir sorguluyordu. **Kullanıcı 2026-10-30'da Vega sipariş sorgulama aralığını 30 dakikaya çıkardı** (stok gönderimi değişmedi). Etkisi ölçülecek; (a) Vega yanıtını önbellekten verme / (b) Launch / (c) ikisi kararı bekliyor. Kalan: push kararı, 30 dk etkisinin ölçümü, adım 2'nin onayı, adım 3 ve sonrası. | `NEON_TRANSFER_AZALTMA_PLANI.md` ("Uygulama durumu") | `NEON_TRANSFER_AZALTMA_PLANI.md` |
| Parfüm → Aksesuar alt kategorisi | Uygulandı (2026-10-28). DB'de parentId Aksesuar (ortak DB, canlıda da geçerli); Çok Satanlar'a Aksesuar sekmesi, diğer sekmeler yalnız giyim. Adresler değişmedi. Kalan: Aksesuar kutusu şu an parfüm görseli gösteriyor; istenirse admin'den Aksesuar kategorisine görsel. | `docs/gunluk/2026-10.md` |
| Yurtiçi Kargo entegrasyonu | Faz 1–4 tamamlandı ve push edildi (2026-11-10, `b863fa3`). **CANLIDA AÇIK (2026-11-11):** Vercel Production'a `YURTICI_MODE=live`, `YURTICI_GO_USERNAME`, `YURTICI_GO_PASSWORD`, `YURTICI_PROXY_URL`, `YURTICI_SYNC=on` (hepsi sensitive) eklendi; `ignoreCommand` redeploy'u iptal ettiği için HEAD'in (`5417a2c`) temiz worktree'sinden `vercel deploy --prod` ile yayınlandı. İlk gerçek siparişte gönder → şube okutma → mail birlikte izlenecek. Kapatmak: `YURTICI_MODE=off` + yeniden deploy (yalnız .md commit'i deploy tetiklemez). Fixie hesabı açıldı; Yurtiçi'den IP onayı bekleniyor (Erişim Yetkilendirme Formu, plan Bölüm 3). `Shipment`'a 13 Yurtiçi alanı + `cargoKey` unique indeksi canlı DB'ye eklendi (kullanıcı onaylı, yalnız ekleme, `migrate diff` boş). Yurtiçi env'leri yalnız yerel `.env`'de; Vercel'de yok, yani canlıda `YURTICI_MODE` tanımsız = kapalı, admin eski elle kargo formunu görür, cron hiçbir şey yapmaz. Yeni cron `/api/cron/yurtici-takip` (`vercel.json`, UTC 7/10/13/16 = TR 10/13/16/19). Mock/test modunda Yurtiçi işlemleri yalnız alıcı adı "TEST ALICI" ile başlayan siparişlerde açılır. Termal etiket 10×7 cm: dükkanda Chrome'dan "Argox Bollmark" yazıcısı seçilir (aynı Argox'un Vega'yı bozmamak için ikinci kaydı, stok 100×70, Dikey). **IP onayı geldi (2026-11-10); canlıda kimlik + IP çalışıyor (salt-okuma sorgu). WSDL doğrulandı, düzeltmeler push edildi.** **Faz 5 tamam (2026-11-11):** test kullanıcısı verilmedi; canlıda oluştur → sorgula (NOP) → iptal (CNL) döngüsü script ile çalıştı, DB'ye yazılmadı. Ayrıntı: plan "Faz 5 durumu". Bölüm 7 env + deploy yapıldı (yukarıda). Vercel env'leri ve `live` kullanıcı onayıyla. | `docs/planlar/YURTICI_KARGO_ENTEGRASYON_PLANI.md` |

## Bu dosya nasıl güncellenir

- Oturum notu **buraya değil**, o ayın günlük dosyasının sonuna eklenir
  (`docs/gunluk/2026-10.md`; yeni ayda yeni dosya).
- Bu dosyaya yalnız güncel durum değiştiğinde dokunulur: bir açık iş bittiğinde
  satırı silinir, yeni bir açık iş çıktığında eklenir.
- Biten planın dosyası `docs/planlar/arsiv/` altına taşınır.
- Şifre, API anahtarı, token gibi değerler hiçbir dosyaya yazılmaz.
