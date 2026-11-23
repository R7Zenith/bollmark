# Efsane Cuma 2026 — 2. Ürüne %50 İndirim

Durum (2026-11-23): kod yerelde hazır, localhost'ta çalışıyor. **Commit ve push yapılmadı.** Şema değişikliği canlı DB'ye uygulandı (kullanıcı onaylı).

## Kararlar (kullanıcıyla netleşen)

| Konu | Karar |
|---|---|
| Şema | Onaylandı: `EfsaneCumaSettings` tablosu, `OrderItem.campaignOriginalUnitCents` + `campaignLabel`, `Order.campaignDiscountCents`. Hepsi ekleme. |
| Kargo ücreti | 150 TL kalıyor (DB'deki değer; brief'te 350 yazıyordu). Eşik 1.500 TL, indirim sonrası tutara göre. |
| Diğer indirimler | **Yalnız Efsane**: kampanya süresince kupon kodu, kombin (bundle) indirimi ve puan kullanımı kapalı. Otomatik kampanyalar (ör. Ayakkabılarda %20) baz fiyata dahil (OLEKS örneği bunu gerektiriyor). |
| Kalp Topla kuponu | Birleşmez. İkisi de uygulanabiliyorsa ödenecek tutarı düşük olan seçilir (eşitlikte Efsane), sepette not çıkar. |

## Hesap kuralı

- Adetler tek tek açılır, **güncel satış fiyatına** (manuel indirim ya da otomatik kampanya sonrası fiyat) göre büyükten küçüğe sıralanır; 2., 4., 6. … adet yarı fiyat olur. Eşit fiyatta sepet sırası korunur.
- Yarı fiyat kuruşa yuvarlanır (x,5 kuruş yukarı). Örnek: 265 TL → 132,50 TL.
- İndirimli adet, Kalp kuponundaki gibi **ayrı OrderItem satırı** olur: `unitPriceCents` indirimli fiyat, `campaignOriginalUnitCents` indirimsiz fiyat, `campaignLabel` "Efsane Cuma – 2. ürüne %50". Sipariş toplamı = satır toplamları; iyzico'da bu satıra başka indirim dağıtılmaz (`noDiscount`). Kalem toplamı sipariş tutarına birebir eşit (doğrulandı).
- `Order.campaignDiscountCents` yalnız bilgi amaçlı (indirim satırlara gömülü; `kalpDiscountCents` ile aynı desen).

## Dosyalar

- `src/lib/efsane-cuma.ts`: saf kural (pencere, sıralama, yarı fiyat, metinler) + `efsane-cuma.test.ts`
- `src/lib/efsane-cuma-server.ts`: DB ayarı, varsayılanlar, yerel test penceresi
- `src/lib/pricing/price-cart.ts`: tek fiyat hesabına entegrasyon (Kalp/Efsane karşılaştırması, kod/kombin/puan kapatma)
- `src/lib/kalp-topla/pricing.ts` `splitOrderItems`: Efsane satırları
- `src/app/(site)/api/orders/route.ts`, `api/sepet/fiyat/route.ts`, `lib/payment/orders/initialize.ts`
- Sepet/ödeme/çekmece: `cart-view.tsx`, `checkout-form.tsx`, `cart-drawer.tsx`, `use-automatic-discount.ts`, `components/efsane-cuma/sepet.tsx`
- Vitrin: `components/efsane-cuma/{efsane-context,vitrin,durum}.tsx`, `product-card.tsx`, `product-viewer.tsx`, ana sayfa, layout, `/efsane-cuma` sayfası
- Kalp arası: `kalp-topla/settings.ts`, `bar.ts`, `api/kalp-topla/durum`, `kalp-bar.tsx`, `/kalp-topla`, Kalplerim, `kalp-ara-notu.tsx`
- Admin: `/admin/efsane-cuma` (anahtarlar + tarihler, işlem geçmişine yazılır), sipariş detayı ve İadeler'de satır bazlı kampanya bilgisi
- E-posta: sipariş e-postasında indirimli satırın yanında kampanya adı ve normal birim fiyat
- Meta: InitiateCheckout değeri artık indirim + kargo sonrası ödenecek tutar (fiyat önizlemesi gelince bir kez gider). Purchase zaten `order.totalCents`. `feed/meta.xml`'e dokunulmadı.
- DB: `prisma/migrations/20261123000000_efsane_cuma/migration.sql` (`db execute` ile uygulandı, `migrate diff` boş)

## Görünürlük

- Tüm vitrin yazıları tarayıcı saatiyle (dakika hassasiyeti) açılır/kapanır; ISR önbelleğinden bağımsız olarak 26 Kasım 00:00'da açılır, 30 Kasım 00:00'da kapanır.
- Üst şerit: kırmızı (#D0021B), sabit, tıklayınca `/efsane-cuma`. Görünürken header 32 px aşağı iner. Mobilde tek satıra sığsın diye kısa metin: "EFSANE CUMA: 2. ürüne %50 indirim — 26–29 Kasım" (masaüstünde tam metin). Çerez bandı altta, çakışma yok.
- `/efsane-cuma`: kampanya bitince "Kampanya sona erdi." yazar, 404 vermez.
- Kampanya süresince ürün sayfasındaki kombin indirimi kutusu gizlenir (kombin indirimi uygulanmadığı için).

## Kalp Topla arası

- Ara açıkken kampanya durumu `ACTIVE` yerine `FROZEN` olur. Bunun sonucunda yeni kalp verilemez ve bar dolmaz; tur kapanmadığı için yeni kupon da üretilmez. Ayrıca bu arada geri çekme de engellenir.
- Davetle gelen kayıtların bonusu `WAITING` kredisi olarak bekler (30 gün geçerli). Ara bitince üye barı ya da Kalplerim'i açtığında, ya da kalp verdiğinde yerleşir.
- Mevcut kuponlar kullanılabilir.
- Ürün sayfası barı, `/kalp-topla` ve Kalplerim'de not gösterilir: "Kalp Topla, Efsane Cuma boyunca ara verdi. 30 Kasım'da kaldığın yerden devam ediyor."
- Admin'de ayrı anahtar var; ara, kampanyayla aynı tarihleri kullanır.

## Test

Birim testleri: `npm test` 280/280 geçti (8 yeni Efsane testi dahil). tsc temiz (yalnız önceden var olan `undici`/`RouteContext` hataları), değişen dosyalarda lint 0 hata.

Senaryolar gerçek ürünlerle, gerçek `priceCart` üzerinden PREVIEW modunda çalıştırıldı (DB'ye yazma yok, kampanya anı 27 Kasım 12:00), kargo 150 TL:

| Senaryo | Sepet | Ara toplam | Otomatik kampanya | Efsane | Kalp | Kargo | Ödenecek |
|---|---|---|---|---|---|---|---|
| (a) tek ürün | 1.090 | 1.090 | — | — | — | 150 | **1.240** |
| (b) iki farklı fiyat | 1.090 + 590 | 1.680 | — | −295 | — | 150 | **1.535** |
| (c) aynı üründen 2 adet | 1.190 ×2 | 2.380 | — | −595 | — | 0 | **1.785** |
| (d) 3 ürün | 1.490 + 890 + 390 | 2.770 | — | −445 | — | 0 | **2.325** |
| (e) 4 ürün | 1.490 + 1.090 + 890 + 390 | 3.860 | — | −740 (545+195) | — | 0 | **3.120** |
| (f) OLEKS + 2.390 | 2.490 (güncel 1.992) + 2.390 | 4.880 | −498 | −996 | — | 0 | **3.386** |
| (f2) OLEKS ×2 | 2.490 ×2 | 4.980 | −996 | −996 | — | 0 | **2.988** |
| (g1) indirim sonrası 1.500 altı | 1.090 + 590 (ham 1.680) | 1.680 | — | −295 | — | **150** | **1.535** |
| (g2) indirim sonrası 1.500 üstü | 1.090 + 890 | 1.980 | — | −445 | — | **0** | **1.535** |
| (h1) Kalp kuponlu, 2 ürün | 1.490 + 390 | 1.880 | — | — | −745 | 150 | **1.285** (Kalp seçildi, not var) |
| (h2) Kalp kuponlu, 4 ürün | 1.490 + 1.090 + 890 + 390 | 3.860 | — | — | −745 | 0 | **3.115** (Kalp 745 > Efsane 740) |
| (h3) Kalp kuponlu, Efsane avantajlı | 1.490 + 1.490 + 1.190 + 1.090 | 5.260 | — | −1.290 | — | 0 | **3.970** (Efsane seçildi, not var) |
| (i1) başlangıçtan 1 dk önce (25 Kas 23:59) | 1.090 + 590 | 1.680 | — | — | — | 0 | **1.680** (kapalı) |
| (i2) başlangıçtan 1 dk sonra (26 Kas 00:01) | 1.090 + 590 | 1.680 | — | −295 | — | 150 | **1.535** |
| (i3) bitişten 1 dk önce (29 Kas 23:58) | 1.090 + 590 | 1.680 | — | −295 | — | 150 | **1.535** |
| (i4) bitişten sonra (30 Kas 00:00:59) | 1.090 + 590 | 1.680 | — | — | — | 0 | **1.680** (kapalı) |
| (x) kuruş | 2.390 + 265 | 2.655 | — | −132,50 | — | 0 | **2.522,50** |

(h) senaryolarında gerçek bir üyenin kullanılabilir Kalp kuponu yalnız okunarak kullanıldı (kupon ayrılmadı).

iyzico tutarı (DB'ye yazmadan): OLEKS ×2 + 2.390 TL sepetinde OrderItem satırları 996 (Efsane) + 2.490 + 2.390, iyzico kalemleri 996 + 2.235,90 + 2.146,10 = **5.378 TL = sipariş tutarı**.

**Yapılmadı:** gerçek iyzico sandbox ödemesi. Ortak (canlı) DB'ye sipariş kaydı yazacağı için kullanıcı onayı bekleniyor. Ayrıca `.env`'de `PAYMENT_LOCAL_TEST` / sandbox anahtarları tanımlı değil.

Ekran görüntüleri: yalnız mobil ana sayfa ve mobil ürün kartı alındı (`Claude outputs/efsane-cuma/`); kalanları kullanıcının isteğiyle bırakıldı (dev derlemesi çok yavaştı).

## Yerel test penceresi

`.env.local`'e geçici olarak eklendi (test bitince silinecek):

```
EFSANE_CUMA_TEST_START=2026-11-23T00:00:00+03:00
EFSANE_CUMA_TEST_END=2026-11-29T23:59:59+03:00
```

Vercel'de ve production derlemede yok sayılır. Canlıda tarihler DB ayarından gelir; satır yoksa 26 Kasım 00:00 – 29 Kasım 23:59:59.

## Açık noktalar

- Ana sayfa hero'sundaki Kalp Topla slaytı ara süresince de görünür (tıklayınca `/kalp-topla`'daki ara notuna gider).
- Ödeme sayfasında indirim kodu alanı duruyor; kampanya süresince kod girilirse "Efsane Cuma boyunca kupon kodu kullanılamaz." çıkar. Puan alanı kullanılabilir puan göstermez (tavan 0).
- Sepetteki ücretsiz kargo çubuğu artık indirim sonrası tutara bakıyor (sunucu hesabıyla aynı). Bu değişiklik diğer indirimler için de geçerli.
- Sepet ve ödeme toplamları kuruşlu gösteriliyor (`formatExactPrice`; tam TL'de görünüm aynı).
- Commit öncesi `DEPLOY_STATUS.md` güncellenecek.
