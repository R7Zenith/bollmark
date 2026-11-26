# Microsoft Clarity kurulum raporu (2026-11-27)

**Amaç:** sepet ve ödeme adımlarında ziyaretçilerin nerede takıldığını görmek (son 3 gün: 105 sepete ekleme, 10 ödeme sayfası açılışı, 0 satış).

**Kullanıcı kararları:**
- Clarity çerez bandına bağlı değil. Müşteri sitesine giren herkes, çerez tercihi ne olursa olsun kaydedilir (KVKK riski kullanıcı tarafından bilerek kabul edildi).
- Çerez Politikası, Gizlilik Politikası ve çerez bandı metinlerine **hiçbir şey eklenmedi**. Sistemi yalnız kullanıcı inceleyecek.

## Yapılanlar

### 1. Yükleme
- `src/lib/clarity.ts`: proje kimliği `NEXT_PUBLIC_CLARITY_PROJECT_ID` değişkeninden okunur. Değer boşsa hiçbir şey yüklenmez ve `clarity()` hiçbir şey yapmaz. Kuyruk Clarity'nin resmi kurulum koduyla aynı.
- `src/components/clarity.tsx`: betik `next/script` ile `strategy="lazyOnload"` yüklenir (gerekçe aşağıda). Muhteşem Kasım aktifken `clarity('set','kampanya','muhtesem-kasim')` çağrılır; aktiflik mevcut `useEfsane().active` ile alınır. `consentv2` çağrılmaz.
- Yalnız `src/app/(site)/layout.tsx` içinde render edilir. `(admin)` ve `(gate)` ayrı kök layout'lar olduğu için oralarda hiç yüklenmez.
- **CSP:** `next.config.mjs`, `vercel.json` ve `src/proxy.ts` dosyalarında Content-Security-Policy başlığı yok, eklenecek bir şey olmadı.
- GA4 ve Meta Pikseli yükleyicilerine ve `lib/consent.ts` dosyasına dokunulmadı.

**Neden `lazyOnload`:** betik `load` olayından sonra, tarayıcı boştayken iner, yani LCP görseli ve hidrasyonla hiçbir zaman yarışmaz. Ölçümde `lazyOnload` yaklaşık 29 KB Clarity yükünü ölçüm içinde gösterdi ve LCP/TBT değişmedi. `afterInteractive` ölçümünde asıl betik (clarity.js) Lighthouse penceresine yetişmedi (yalnız 3 KB), dolayısıyla daha iyi görünen o sayılar Clarity'nin gerçek maliyetini yansıtmıyor. Olay kaybı yok: betik inene kadar çağrılar kuyrukta bekliyor. Tek kayıp, betik inmeden (ilk birkaç saniyede) çıkan ziyaretçilerin kaydının tutulmaması. Sepet ve ödeme analizi için bunun önemi yok.

### 2. Maskeleme (`data-clarity-mask="True"`)
| Yer | Kapsam |
|---|---|
| Ödeme `checkout-form.tsx` | Teslimat bölümünün tamamı: kayıtlı adres kartları, e-posta, ad soyad, telefon, adres, il, ilçe, posta kodu, sipariş notu |
| Ödeme `loyalty-field.tsx` | Puan satırındaki üye adı |
| Giriş / kayıt `hesap/(auth)/giris` | Yalnız girdiler: giriş e-posta ve şifre; kayıt ad, e-posta, telefon, şifre (buton ve hata metinleri okunur kalsın diye) |
| Doğrulama bekleniyor | Maskeli e-posta metni |
| Hesabım `hesap/(panel)/layout.tsx` | Panelin tamamı: ad, siparişler, adresler, iade talepleri, tercihler |
| Sipariş durumu | Sipariş no ve e-posta girdileri ile sonuç bölümünün tamamı (sipariş, adres, iade formu) |
| Teşekkürler / Başarısız | Sipariş numarası |
| Mobil menü `site-header.tsx` | Üye adı |

- **Kart bilgisi:** iyzico tarafında. `checkout-form.tsx` sipariş oluşunca `paymentPageUrl` adresine yönlendiriyor (iyzico'nun kendi sayfası, başka alan adı). Sitede kart girdisi yok, gömülü iyzico formu da yok, dolayısıyla Clarity kart bilgisini göremez.
- **Kalan risk:** teşekkürler ve başarısız sayfalarının adresinde `?siparis=BLM...` var. Clarity sayfa adresini kaydeder, sipariş numarası adres içinde görünür (kişisel ad, adres veya telefon değil).

### 3. Özel olaylar (`src/lib/meta/track.ts`, rızadan bağımsız)
| Clarity olayı | Bağlı fonksiyon | Nerede |
|---|---|---|
| `sepete_ekle` | `trackAddToCart` | Sepete ekleme |
| `sepeti_gor` | `trackViewCart` | `/sepet` sayfası (sepet çekmecesinde yok) |
| `odeme_baslat` | `trackInitiateCheckout` | `/odeme` açılışı |
| `odeme_bilgisi` | `trackAddPaymentInfo` | iyzico'ya yönlendirmeden hemen önce |
| `satin_alma` | `trackPurchase` | Teşekkürler sayfası (`PurchaseTracking` yalnız Meta ya da GA4 açıkken render edilir; canlıda ikisi de açık) |

Meta ve GA4 olaylarının rıza kontrolleri aynen duruyor.

### 4. Aydınlatma metinleri
Kullanıcı kararıyla değişiklik yok. Bilgi için: localhost'ta "Reddet" seçiliyken Clarity şu çerezleri bıraktı: birinci taraf `_clck` (1 yıl) ve `_clsk` (1 gün); Microsoft alan adlarında `CLID`, `MUID` (clarity.ms ve bing.com, yaklaşık 13 ay), `MR`, `SM`, `ANONCHK`, `SRM_B`. Veriler ayrıca `c.bing.com` adresine de gidiyor.

## Hız ölçümü (localhost production build, mobil Lighthouse 12.8.2, 3 çalıştırmanın medyanı)

| Sayfa | Durum | Puan | LCP | TBT | Toplam indirilen | Clarity ek yükü |
|---|---|---|---|---|---|---|
| Anasayfa | Önce | 85 | 4,06 sn | 22 ms | 4344 KB | – |
| Anasayfa | Sonra (lazyOnload) | 85 | 4,07 sn | 35 ms | 4373 KB | **28,9 KB** |
| Ürün sayfası | Önce | 81 | 5,00 sn | 22 ms | 1479 KB | – |
| Ürün sayfası | Sonra (lazyOnload) | 82 | 4,92 sn | 13 ms | 1508 KB | **28,6 KB** |
| Anasayfa | Karşılaştırma: afterInteractive | 93 | 3,07 sn | 41 ms | 3734 KB | 3,1 KB (clarity.js ölçüme yetişmedi) |
| Ürün sayfası | Karşılaştırma: afterInteractive | 82 | 4,45 sn | 24 ms | 1410 KB | 3,1 KB (clarity.js ölçüme yetişmedi) |

Not: çalıştırmalar arasında puan ±5, anasayfa ağırlığı 3,7–4,4 MB oynuyor (carousel görselleri). Clarity'nin etkisi bu gürültünün içinde: yaklaşık 29 KB ek indirme, TBT'de birkaç on ms.

## Doğrulama (localhost:3100, production build, `.env` içindeki kimlikle)
- **Bant dokunulmamış (anasayfa):** `www.clarity.ms/tag/<proje kimliği>`, `scripts.clarity.ms/.../clarity.js` ve `*.clarity.ms/collect` istekleri gitti. GA4 ve Meta isteği yok.
- **Reddet seçili (ürün sayfası):** Clarity istekleri gitti, GA4 ve Meta isteği yok.
- **Kontrol, hepsini kabul:** GA4 (`gtag/js` ve `g/collect`) yüklendi, yani rıza davranışı çalışıyor. Meta yerelde zaten kapalı (`META_TEST_EVENT_CODE` yok), bu yüzden Meta'nın "yüklenmedi" sonucu yerelde rızadan bağımsız. Meta yükleyicisinin koduna dokunulmadı.
- **Admin (`/admin`, giriş ekranı):** Clarity'ye hiç istek yok, `window.clarity` tanımsız.
- **Olaylar (Reddet seçili):** ürün sayfasında `sepete_ekle`, `/sepet`'te `sepeti_gor`, `/odeme`'de `odeme_baslat`; kampanya etiketi `set kampanya muhtesem-kasim`. `odeme_bilgisi` ve `satin_alma` gerçek sipariş gerektirdiği için (ortak veritabanına yazar) denenmedi.
- **Ödemede maskelenen alanlar:** customerEmail, customerName, customerPhone, shippingAddress, city, district, postalCode, note.
- **tsc:** temiz. **Testler:** 297/297. **Lint:** değişen dosyalarda temiz. Tüm projede tek hata `docs/reklam/kalp-topla-reels/src/sahneler.jsx` (git'e eklenmemiş video dosyası, bu işle ilgisiz); 5 uyarı da eski.

## Değişen dosyalar
- Yeni: `src/lib/clarity.ts`, `src/components/clarity.tsx`, bu rapor
- `src/app/(site)/layout.tsx`, `src/lib/meta/track.ts`
- Maskeleme: `src/app/(site)/odeme/checkout-form.tsx`, `src/components/loyalty-field.tsx`, `src/app/(site)/hesap/(auth)/giris/page.tsx`, `src/app/(site)/hesap/(auth)/dogrulama-bekleniyor/page.tsx`, `src/app/(site)/hesap/(panel)/layout.tsx`, `src/app/(site)/siparis-durumu/page.tsx`, `src/app/(site)/odeme/tesekkurler/page.tsx`, `src/app/(site)/odeme/basarisiz/page.tsx`, `src/components/site-header.tsx`
- `.env.example` (boş `NEXT_PUBLIC_CLARITY_PROJECT_ID`). Değerin kendisi yalnız yerel `.env` dosyasında (gitignore'da).
- Veritabanı: şema ve kayıt değişikliği yok.

## Canlıya alınınca Clarity panelinde kontrol edilecekler
1. **Vercel:** `NEXT_PUBLIC_CLARITY_PROJECT_ID=<proje kimliği>`, yalnız Production, Sensitive değil. `NEXT_PUBLIC_` değişkenleri build sırasında koda gömülür, bu yüzden değişkeni ekledikten sonra yeniden deploy gerekir.
2. **Settings > Setup:** "Installed" ya da "Tracking is active" görünmeli (ilk veri birkaç dakika ile 2 saat arasında gelir).
3. **Settings > Masking:** mod "Balanced" (varsayılan) ya da "Strict" olmalı. "Relaxed" seçilirse işaretsiz girdiler de görünür.
4. **Recordings > Filters > Custom events:** `sepete_ekle`, `sepeti_gor`, `odeme_baslat`, `odeme_bilgisi`, `satin_alma` listede görünmeli. En faydalı filtre: `odeme_baslat` var, `odeme_bilgisi` yok, yani ödeme formunda takılanlar.
5. **Custom tags:** `kampanya = muhtesem-kasim` (yalnız 26–29 Kasım oturumlarında).
6. **Bir kaydı açıp kontrol et:** ödeme Teslimat bölümü, Hesabım ve sipariş durumu yıldız/blok olarak görünmeli; ad, adres ve telefon okunmamalı.
7. **Heatmaps:** `/sepet` ve `/odeme` için tıklama ve kaydırma haritaları; "Dead clicks" ve "Rage clicks" önerileri.
8. **Admin oturumu kaydı olmamalı:** URL filtresinde `/admin` aranınca sonuç çıkmamalı.

## Ayrıca: Next.js güvenlik uyarısı
`npm run build` "Your version of Next.js (16.4.2) is affected by a known security vulnerability" diyerek durdu, ikinci denemede tamamlandı. Next.js yükseltilmesi öneriliyor (`next upgrade --agent=security`). Bu işte yükseltme yapılmadı.

## Yerel ortam notu
`undici` package.json'da olduğu halde yerel `node_modules` içinde yoktu (build hata veriyordu). `npm install` ile lock dosyasından kuruldu, `package-lock.json` değişmedi.
