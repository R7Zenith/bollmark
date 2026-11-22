# Google Analytics 4 (GA4) Kurulum Planı

Durum: uygulandı ve push edildi (2026-10-25). Kalan: GA4 arayüzünde geçmiş tabanlı sayfa değişikliklerini kapatmak ve canlıda olay doğrulaması.

Tarih: 25 Ekim 2026

Amaç: Bollmark'a GA4 (gtag.js, yalnız tarayıcı tarafı) kurmak. Her şey mevcut çerez rıza
altyapısına (`useConsent` / `hasConsent` / `bm-consent-change` / Consent Mode v2 hazırlığı,
`src/lib/consent.ts`) ve Meta Pixel'de kullanılan merkezi takip modülüne
(`src/lib/meta/track.ts`) bağlı çalışır. Sunucu tarafı (Measurement Protocol) KURULMAZ.

---

## Adım 0 — Plan
Bu dosya.

## Adım 1 — Ortam değişkeni
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-YGXJVLGKJG` → `.env`; ismi `.env.example`'a.
- Aynı değişken Vercel CLI ile `bollmark` projesinin YALNIZ Production ortamına eklenir.
  Aynı isimde değişken varsa üzerine yazmadan önce kullanıcıya sorulur. Redeploy YAPILMAZ.
- `NEXT_PUBLIC_GA4_DEBUG` (opsiyonel, yalnız yerel `.env`): `true` ise production dışında
  GA4 `debug_mode` ile çalışır (DebugView testi için).

## Adım 2 — Yükleme ve rıza (Consent Mode v2 "temel/basic")
- gtag.js YALNIZ "Analitik" rızası varsa indirilir; yoksa script hiç yüklenmez.
- Yüklemeden önce `initGoogleConsent()`: Consent Mode v2 varsayılanları `denied`, ardından
  mevcut tercih ile `update` (analitik → `analytics_storage: granted`; pazarlama da varsa
  `ad_storage`, `ad_user_data`, `ad_personalization: granted`).
- Rıza sonradan verilirse (`bm-consent-change`) sayfa yenilenmeden yüklenir.
- Rıza geri çekilirse: `saveConsent` consent `update` ile `denied` gönderir, `_ga` ve `_ga_*`
  çerezlerini siler; ayrıca `window['ga-disable-G-…'] = true` yapılır ki yüklü kalan gtag.js
  çerezsiz ping dahil hiçbir istek göndermesin (temel modun gereği). Yeni olaylar `hasConsent`
  kontrolüyle zaten durur.
- `next/script` + `afterInteractive`.
- `/admin` altında asla çalışmaz: bileşen yalnız `(site)` layout'unda.
- Production dışında (`VERCEL_ENV !== "production"`) kapalı; yalnız
  `NEXT_PUBLIC_GA4_DEBUG=true` ise `debug_mode: true` ile çalışır.
- Dosyalar: `src/lib/ga4.ts` (ortam kararı + purchase verisi, sunucu),
  `src/components/google-analytics.tsx` (yükleyici).

## Adım 3 — Sayfa görüntülemeleri (çift sayım yok)
- **Seçim: page_view'i biz gönderiyoruz.** `gtag('config', ..., { send_page_view: false })`
  ile otomatik ilk page_view kapatılır; App Router'daki her URL değişiminde
  (`usePathname` + `useSearchParams`) `page_view` bir kez gönderilir. Katalogdaki
  "Daha Fazla Göster" (`?goster=`) parametresi yeni sayfa sayılmaz.
- **GA4 arayüzünde yapılacak (kullanıcı):** Yönetici > Veri akışları > web akışı >
  Gelişmiş ölçüm > ayarlar > Sayfa görüntülemeleri > "Tarayıcı geçmişi olaylarına göre sayfa
  değişiklikleri" KAPATILMALI. Açık kalırsa her istemci taraflı geçiş iki kez sayılır.
  Gelişmiş ölçümün diğer seçenekleri (kaydırma, dış bağlantı tıklamaları vb.) açık kalabilir.

## Adım 4 — E-ticaret olayları
Hepsi `src/lib/meta/track.ts` içinden; sayfalarda dağınık `gtag` çağrısı yok. Meta olayı
olan her noktada GA4 olayı aynı fonksiyondan gider.

| GA4 olayı | Meta karşılığı | Tetiklendiği yer |
|---|---|---|
| page_view | PageView | `google-analytics.tsx` (URL değişimi) |
| view_item_list | — | Katalog/arama listesi (`catalog-grid.tsx`, ilk yükleme) |
| select_item | — | Katalog/arama listesinde karta tıklama |
| view_item | ViewContent | Ürün sayfası (`product-viewer.tsx`) |
| add_to_cart | AddToCart | `cart.tsx addLine` |
| remove_from_cart | — | `cart.tsx removeLine` (satır silme) |
| view_cart | — | `/sepet` sayfası (sayfa başına bir kez) |
| begin_checkout | InitiateCheckout | `/odeme` (sayfa başına bir kez) |
| add_shipping_info | — | `/odeme` sipariş (adres) oluşturulunca |
| add_payment_info | AddPaymentInfo | iyzico ödeme sayfasına yönlendirmeden önce |
| purchase | Purchase | `/odeme/tesekkurler` (ödeme doğrulanmışsa) |
| add_to_wishlist | AddToWishlist | `wishlist.tsx toggle` (ekleme) |
| search | Search | `search-overlay.tsx` |
| sign_up | CompleteRegistration | Kayıt formu (`method: "email"`) |

Parametreler:
- `currency: "TRY"`; `value` KDV dahil (fiyatlar zaten KDV dahil).
- `items[]`: `item_id`, `item_name`, `item_brand`, `item_category`, `item_variant`
  ("Renk / Beden"), `price`, `quantity`.
- **item_id kuralı Meta ile aynı:** varyant bazlı olaylarda varyant SKU'su (bilinmiyorsa
  `variantId`). `view_item` varyant seçilmeden gittiği için Meta'daki gibi ürünün tüm
  varyant SKU'ları ayrı kalem olarak gönderilir. Ürün bazlı olaylarda (add_to_wishlist,
  view_item_list, select_item — kartlar varyant değil ürün/renk gösterir) Meta'nın
  AddToWishlist kuralı gibi `item_id = Product.id`, `item_variant` = kartın rengi.
- Sepet satırlarına marka/kategori adı eklendi (sepet tazelemesinde sunucudan dolar).
- `remove_from_cart` yalnız satır silmede; adet değişikliği takip edilmez.
- `purchase`: `transaction_id` = sipariş numarası, `value` = ödenen toplam (indirimler
  sonrası, kargo dahil — Meta Purchase ile aynı), `shipping`, `tax`, `coupon` (kodlu kupon
  varsa), kalemler sipariş satırlarından (sunucuda DB'den).
  - `tax`: her kalem kendi KDV oranıyla, KDV dahil satır tutarından iç yüzde ile
    (`fiyat × oran / (100 + oran)`), kalemler toplanır; kargo için %20 eklenir
    (`src/lib/vat.ts`). Oran önceliği: ürünün `vatRate`'i → kategorinin → üst kategorinin → %10.
    Not: sipariş geneli indirimler (kupon/paket/puan) kalemlere dağıtılmaz.

### KDV oranı alanları (kullanıcı kararı, 25 Ekim 2026)
- `Category.vatRate Int?` (admin kategori formu: boş = üst kategoriden / %10, %1, %10, %20)
  ve `Product.vatRate Int?` (admin ürün düzenleme: boş = kategoriden; doluysa ezer).
- Giyim, ayakkabı, çanta, kemer, cüzdan %10; parfüm ve kozmetik %20.
- Şema değişikliği (`ALTER TABLE ... ADD COLUMN "vatRate" INTEGER`, Category ve Product):
  Neon prod ve yerel aynı DB olduğu için **db push kullanıcı onayıyla**. Mevcut kategorilere
  oran yazmak da ayrıca kullanıcı onayıyla.
  - Tekrar gönderim yok: gönderilince `localStorage`'a `bm-ga4-purchase-<siparişNo>`
    yazılır; sayfa yenilense veya aynı tarayıcıda tekrar açılsa da ikinci kez gitmez.
    GA4 de aynı `transaction_id`'yi tekilleştirir.

## Adım 5 — Yasal metinler
- Çerez Politikası envanterine `_ga` ve `_ga_YGXJVLGKJG` (Google, üçüncü taraf, Analitik,
  2 yıl); "analitik çerez kullanılmamaktadır" cümlesi GA4 bilgisiyle değiştirilir.
- Çerez bandı ve tercih modalındaki Analitik açıklamasında Google Analytics adı ve yurt
  dışına aktarım notu.
- Gizlilik Politikası / KVKK aydınlatma metni (`prisma/legal-pages-content.ts`): Meta
  maddeleriyle aynı yapıda Google Analytics ve Google'a yurt dışı aktarım eklemeleri
  (madde 2, 3, 4, 5, 10); sağlayıcı "Google Ireland Limited". İşletme bilgileri değişmez. **Canlı DB'ye yazmak** ayrı adım:
  kullanıcı "push et" dediğinde, deploy ile birlikte, yalnız `gizlilik-politikasi` kaydı hedefli.
- `CONSENT_VERSION` "2" → "3" (bant herkese yeniden çıkar).

## Adım 6 — Test ve onay
- Localhost'ta `NEXT_PUBLIC_GA4_DEBUG=true` ile GA4 > Yönetici > DebugView testi.
- Kullanıcı localhost'ta onaylayana kadar commit yok. "yerel commit at" denince önce
  `DEPLOY_STATUS.md`'ye Türkçe not, sonra yerel commit. Açıkça söylenmeden push yok.
