# Meta Pixel ve Conversions API (CAPI) Entegrasyonu Planı

Durum: uygulandı ve push edildi (2026-10-24). Kalan: canlıda Olay Yöneticisi doğrulaması (CAPI olayları, Purchase tekilleştirme).

Tarih: 24 Ekim 2026

Amaç: Bollmark'a Meta Pixel (tarayıcı) ve Meta Conversions API (sunucu) entegrasyonu
kurmak. Her şey mevcut çerez rıza altyapısına (`useConsent` / `hasConsent` /
`bm-consent-change` olayı / `bm_consent` çerezi) bağlı çalışır: pazarlama rızası
yoksa ne tarayıcıdan ne sunucudan hiçbir olay gitmez.

---

## Adım 0 — Plan
Bu dosya.

## Adım 1 — İnceleme (kod yazmadan önce rapor)
- Çerez rıza altyapısı dosyaları ve kullanımı.
- Sepetin yapısı (istemci / sunucu).
- Sipariş oluşturma ve ödemenin başarılı sayıldığı nokta.
- Müşteri kaydı, favori ve site içi arama.
- Ürün / varyant kimlikleri (id, SKU, barkod).

### İnceleme bulguları (özet)
- **Rıza:** `src/lib/consent.ts` (hasConsent, onConsentGranted, saveConsent; rıza geri
  çekilince `_fbp`/`_fbc` silme ve `fbq('consent', ...)` çağrısı zaten var),
  `src/lib/use-consent.ts` (useConsent), `src/components/consent/*`. Bant yalnız
  `(site)` layout'unda; `/admin` ayrı layout.
- **Sepet:** İstemci tarafı (`src/lib/cart.tsx`, localStorage). Giriş yapmış müşteride
  `PUT /api/sepet` ile DB'ye debounce'lu senkron var; misafirde sepete eklemede sunucu
  isteği yok.
- **Sipariş:** `POST /api/orders` siparişi `PENDING_PAYMENT` oluşturur. Ödeme
  `POST /api/odeme/baslat` ile iyzico'da başlar. Ödemenin tek doğruluk noktası
  `src/lib/payment/orders/reconcile.ts` → `afterPaid()` (callback, webhook, cron,
  poll ve 0 TL siparişler hepsi buradan geçer). Teşekkür sayfası:
  `/odeme/tesekkurler?siparis=...`.
- **Kayıt:** `POST /api/musteri-kayit` (istemci: `hesap/(auth)/giris/page.tsx`).
- **Favori:** `src/lib/wishlist.tsx` `toggle(productId)` — ürün bazlı (varyant yok).
- **Arama:** `src/components/search-overlay.tsx` → `go()` ile aramanın onaylandığı nokta.
- **Kimlikler:** `ProductVariant.sku` zorunlu ve tekil; Google Merchant feed'i
  (`src/lib/merchant-feed.ts`) `g:id` olarak `variant.sku`, `g:item_group_id` olarak
  `product.code ?? product.id` kullanıyor.

## Adım 2 — Ortam değişkenleri
- `NEXT_PUBLIC_META_PIXEL_ID=1458383412848656` → `.env`.
- `META_CAPI_ACCESS_TOKEN` → kullanıcı kendisi ekledi. Değeri asla okunmaz, yazdırılmaz,
  loglanmaz, kopyalanmaz; yalnız sunucuda `process.env` ile kullanılır. Tanımlı değilse
  CAPI sessizce devre dışı.
- `META_TEST_EVENT_CODE` (opsiyonel) → tanımlıysa tüm CAPI olaylarına `test_event_code`.
- `.env.example`'a isimler (değersiz) eklenir. `.env`'in `.gitignore`'da olduğu doğrulanır.

## Adım 3 — Meta Pixel (tarayıcı)
- Script yalnız "Pazarlama" rızası varsa yüklenir; yoksa hiç indirilmez.
- Sonradan rıza verilirse (`bm-consent-change`) sayfa yenilenmeden yüklenir. Rıza geri
  çekilirse `fbq('consent','revoke')`, `_fbp`/`_fbc` silinir, yeni olay gönderilmez.
- `next/script` + `afterInteractive`.
- `/admin` altında asla çalışmaz (bileşen yalnız `(site)` layout'unda).
- Production dışında (localhost dahil) kapalı; yalnız `META_TEST_EVENT_CODE` tanımlıysa
  test amaçlı çalışır. "Production" = `VERCEL_ENV === "production"`.
- URL'de `fbclid` varsa ve pazarlama rızası varsa `_fbc` çerezi
  `fb.1.<zaman_ms>.<fbclid>` formatında oluşturulur.

## Adım 4 — Takip edilecek olaylar
PageView (App Router geçişleri dahil, çift sayım yok — Pixel'in otomatik pushState
takibi kapatılır), ViewContent, AddToCart, AddToWishlist, Search, InitiateCheckout,
AddPaymentInfo, Purchase, CompleteRegistration.

Parametreler: `currency: "TRY"`, `value` KDV dahil satış fiyatı (Purchase'da indirimler
sonrası ödenen toplam, kargo dahil), `content_type`, `content_ids`, `contents`
(id, quantity, item_price), `num_items`.

### Kimlik kuralı (content_ids) — KESİN KURAL
- **Varyant bazlı olaylarda `content_ids` = `ProductVariant.sku`** (`content_type: "product"`).
  SKU zorunlu ve tekil; Google Merchant feed'inde `g:id` olarak zaten bu kullanılıyor.
  İleride Meta ürün kataloğu feed'inde de `id` = `variant.sku` kullanılacak.
- SKU'nun bilinmediği tek durum: eski sürümden kalan, henüz fiyat tazelemesi görmemiş
  sepet satırı. Bu durumda `variantId`'ye düşülür (sepet `/sepet` ve `/odeme`'de
  otomatik tazelenip SKU'yu aldığı için pratikte geçicidir).
- **Ürün bazlı olaylar** (ViewContent varyant seçilmeden önce, AddToWishlist):
  ViewContent'te ürünün tüm varyant SKU'ları `content_ids` olarak gönderilir
  (`content_type: "product"`). AddToWishlist ürün bazlı olduğu için
  `content_type: "product_group"`, `content_ids` = `Product.id` gönderilir (Meta
  katalog feed'inde `item_group_id` = `Product.id` olarak kullanılmalıdır).
- Olay gönderim kodu tek merkezde: `src/lib/meta/track.ts` (tarayıcı),
  `src/lib/meta/capi.ts` (sunucu).

## Adım 5 — Conversions API (sunucu)
- Sunucudan yalnız: Purchase, InitiateCheckout, AddToCart, CompleteRegistration.
  PageView, ViewContent ve diğerleri yalnız Pixel ile.
- Purchase → `reconcile.ts afterPaid()` içinden; CompleteRegistration →
  `/api/musteri-kayit` içinden. AddToCart ve InitiateCheckout için tek hafif uç nokta:
  `POST /api/meta/olay` (DB sorgusu yok; sadece rıza ve oturum kontrolü + Meta'ya gönderim).
- Gönderim `after()` ile yanıtı bekletmeden; 3 sn zaman aşımı; hata olursa sadece kısa
  log, akış asla bozulmaz.
- Rıza: `bm_consent` çerezinde pazarlama yoksa sunucudan da olay yok. Purchase için
  sipariş anındaki rıza + `_fbp`/`_fbc`/user agent siparişle birlikte saklanır
  (`Order.metaCapiContext`); bu alan boşsa Purchase gönderilmez.
- Tekilleştirme: tarayıcı ve sunucu aynı `event_id`. Purchase: `purchase_<siparişNo>`.
- Purchase sipariş başına bir kez: `Order.metaPurchaseSentAt` koşullu güncelleme ile.
- Ortam ayrımı: sipariş test modunda (production dışı) oluşturulduysa Purchase yalnız
  test modundaki sunucudan, production'da oluşturulduysa yalnız production'dan gider
  (Neon prod/local aynı DB'yi paylaştığı için).
- user_data: em, ph (90 ile başlayan rakamlar), fn, ln, ct, zp, country ("tr"),
  external_id → Meta normalizasyonu + SHA-256. client_ip_address, client_user_agent,
  fbp, fbc hashlenmeden. IP veritabanına kaydedilmez.
- `action_source: "website"`, `event_source_url`, `event_time`.
- Graph API sürümü tek sabitte: **v26.0** (Meta'nın güncel sürümü, 29 Temmuz 2026).
- Şema değişikliği: `Order.metaCapiContext String?` ve `Order.metaPurchaseSentAt
  DateTime?` — **uygulamadan (db push) önce kullanıcıya sorulacak.**

## Adım 6 — Çerez Politikası
- Envanter tablosuna `_fbp`, `_fbc`, `fr` (Meta Platforms, üçüncü taraf, Pazarlama).
- Gizlilik/KVKK metinleri değiştirilmez; eklenmesi gerekenler kullanıcıya liste halinde
  bildirilir.

## Adım 7 — Test ve onay
- Localhost'ta `META_TEST_EVENT_CODE` ile test adımları kullanıcıya verilir.
- Vercel ortam değişkenleri + Redeploy hatırlatması.
- Kullanıcı localhost'ta onaylayana kadar commit yok. "yerel commit at" denince önce
  `DEPLOY_STATUS.md`'ye Türkçe not, sonra yerel commit. Açıkça söylenmeden push yok.
