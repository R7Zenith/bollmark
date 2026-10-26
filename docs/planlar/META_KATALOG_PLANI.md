# Meta Katalog Bağlantısı Planı

Durum: devam ediyor (Aşama B kodu `meta-katalog` dalında; R2 JPEG kopyaları bitti, kontrol "sorun yok"; `main`'e merge/push kullanıcı onayı bekliyor)

Tarih: 26 Ekim 2026

Amaç: Sitedeki ürünleri Meta Commerce Manager'da bir kataloğa bağlamak. Hedef:
Advantage+ katalog reklamları (dinamik yeniden hedefleme), karusel/koleksiyon reklamlar,
mümkünse Instagram ürün etiketleme.

Hazır olan: `/feed/google.xml` (`src/lib/merchant-feed.ts`; `g:id` = `variant.sku`,
`g:item_group_id` = `product.code ?? product.id`), Pixel + CAPI canlıda
(bkz. `META_PIXEL_CAPI_PLANI.md`).

---

## Ön tespitler (kontrol öncesi, plan dosyalarından)

1. **AddToWishlist kimlik uyumsuzluğu riski:** `META_PIXEL_CAPI_PLANI.md`'ye göre
   AddToWishlist `content_type: "product_group"`, `content_ids` = `Product.id` gönderiyor;
   feed'de ise `item_group_id` = `product.code ?? product.id`. Ürünün `code`'u doluysa
   bu olay katalogla eşleşmez. Tek bir yardımcı fonksiyonla (ör. `getItemGroupId(product)`)
   ikisi aynı değere bağlanmalı.
2. **Görsel biçimi riski:** Görseller R2'de ve AVIF yükleme planı uygulanmış. Meta katalog
   AVIF'i desteklemeyebilir; feed'deki `image_link` JPEG/PNG olmalı. Gerekirse Meta için
   JPEG türevi kullanılır.
3. **Feed'e dışarıdan erişim:** 26 Ekim'de dışarıdan yapılan bir istek `/feed/google.xml`
   için istemci hatası aldı. Meta'nın feed çekicisi (`facebookexternalhit`,
   `meta-externalagent` vb.) Vercel Firewall / bot koruması / middleware tarafından
   engellenmemeli.

## Adım 1 — Claude Code kontrolü ve düzeltme
- Feed alanları Meta şartlarına göre denetlenir (id, title, description, availability,
  condition, price, sale_price, link, image_link, additional_image_link, brand,
  item_group_id, color, size, gender, age_group, product_type, google_product_category).
- Pixel/CAPI olaylarındaki `content_ids` / `content_type` feed ile karşılaştırılır.
- Google Merchant'ı bozacak bir değişiklik gerekirse ayrı `/feed/meta.xml` açılır
  (aynı `merchant-feed.ts` mantığını paylaşır).
- Rapor bu dosyanın sonuna "Kontrol bulguları" başlığıyla eklenir.
- Şema değişikliği gerekirse önce kullanıcıya sorulur (Neon prod/local aynı DB).

## Adım 2 — Commerce Manager kurulumu (kullanıcı, push sonrası)
1. business.facebook.com → Commerce Manager → Katalog ekle → E-ticaret → "Ürün bilgisi
   yükle" → işletme portföyü Bollmark → ad: "Bollmark Katalog".
2. Katalog → Kataloğ → Veri kaynakları → Ürün ekle → Veri akışı → Planlı akış (URL) →
   `https://bollmark.com/feed/google.xml` (veya `/feed/meta.xml`) → Her gün, 04:00
   (İstanbul) → para birimi TRY.
3. İlk yüklemenin hatalarını "Sorunlar" sekmesinden kontrol et.
4. Katalog → Olaylar → "bollmark.com" veri setini (Pixel 1458383412848656) bağla.
5. İşletme Ayarları → Veri kaynakları → Kataloglar → reklam hesabını ve kişileri ata.
6. Ürün setleri: Tüm ürünler, Kadın, Erkek, Çocuk, Stokta olanlar.
7. 24–48 saat sonra Katalog → Olaylar: ViewContent / AddToCart / Purchase için
   "eşleşen içerik kimliği" oranı hedef ≥ %90.
8. Instagram: Commerce Manager'da "Satış kanalları / Mağaza" seçeneği sunuluyorsa kur;
   sunulmuyorsa katalog reklamları yine çalışır.

## Adım 3 — Takip
- Eşleşme oranı düşükse hangi olayda düştüğüne bakılır, Adım 1'e dönülür.
- Bu plan bitince `arsiv/` altına taşınır.

---

## Kontrol bulguları (2026-10-26)

Yöntem: localhost'ta `/feed/google.xml` üretildi (3,4 MB) ve tüm item'lar betikle
tarandı; feed'deki 403 tekil ana görselin tamamı indirilip boyutu/biçimi ölçüldü;
veritabanında yalnız okuma sorguları çalıştırıldı; canlı feed farklı user agent'larla
istendi. Meta kuralları resmî alan listesinden
(developers.facebook.com/docs/commerce-platform/catalog/fields) ve tarayıcı sayfasından
(…/sharing/webmasters/web-crawlers) alındı.

### Feed özeti
- **1661 item, 273 ürün (item_group).** Feed'e yalnız `PUBLISHED` ürünler girer (31
  `ARCHIVED` dışarıda). Görselsiz ve varyantsız ürünler kodda atlanıyor; şu an
  yayındaki 273 ürünün hepsinde görsel ve varyant var, hiçbiri atlanmıyor. Fiyatı 0
  olan ürün için ayrı bir filtre YOK (şu an 0 TL ürün de yok). Stoksuz varyantlar
  `out_of_stock` olarak feed'de kalıyor (324 item); bu doğru.
- Uygun olanlar:
  - `g:id` = `variant.sku`: 1661 tekil, tekrar yok, hepsi ≤100 karakter.
  - `g:item_group_id` = `product.code ?? product.id`: 273 ürünün hepsinde `code` dolu
    (tüm DB'de 304/304), iki ürünün aynı code'u paylaştığı durum yok.
  - `title` ≤150 (Meta sınırı 200).
  - `description`: boş olan yok, HTML/markdown kalıntısı yok, ≤5000.
  - `g:condition` = `new` (1661/1661).
  - `g:price`: format `920.00 TRY` (nokta ondalık), KDV dahil. `g:sale_price` 166 item'da
    var ve ürün sayfasıyla aynı (örnek: SX16CNT017-BEJ-STD 920.00 → 750.00; sayfa
    JSON-LD'si 920.00 / 750.00).
  - `link` mutlak `https://bollmark.com/urunler/<slug>`; ürünün birden çok rengi varsa
    `?renk=` ile renk seçili açılıyor (771 item). Beden seçili gelmiyor (Meta bunu
    istemiyor).
  - `g:additional_image_link` ayrı etiketler hâlinde, en çok 10.
  - `g:brand`: 1661/1661 dolu (KOTON 929, Twister 224, Slazenger 173, Sateen 138, Quzu 92,
    Dilvin 77, Bollmark 28).
  - `g:gender` female 972 / male 679 / unisex 10; `g:age_group` adult 1626 / kids 35.
    Değerler Meta'nın kabul ettikleri arasında. Şema değişikliği gerekmiyor.
  - `g:color`, `g:size`, `g:product_type` (ör. `Kadın > Aksesuar > Çanta`),
    `g:google_product_category`: hepsinde dolu.
  - XML kaçışları `escapeXml` ile yapılıyor (`&` → `&amp;` vb.); CDATA yok; kaçışsız `&` yok;
    Türkçe karakterler UTF-8.
- **Erişim:**
  - Localhost'ta `facebookexternalhit/1.1` ve `meta-externalagent/1.1` ikisi de 200 aldı.
  - **Canlıda `meta-externalagent/1.1` 403 alıyor.** Bunu Vercel Firewall'daki
    "AI Bots = Deny" kuralı yapıyor, kodda böyle bir kural yok. `facebookexternalhit`,
    `facebookcatalog/1.0` ve normal tarayıcı canlıda 200 alıyor.
  - `robots.txt` `meta-externalagent`'ı `/` için engelliyor.
  - Proxy/middleware `.xml`'i matcher'dan zaten dışlıyor.
  - Çerez rızası feed'i etkilemiyor.
  - Canlı yanıt başlıkları: `X-Vercel-Cache: HIT`, ISR `revalidate = 3600`.

### 1) Katalog reddeder

| # | Sorun | Kanıt | Önerilen düzeltme |
|---|---|---|---|
| 1.1 | **Görseller WebP.** Meta: "Images must be in JPEG or PNG format, at least 500 x 500 pixels". | Feed'deki 2179 tekil görselin hepsi `img.bollmark.com` (bizim R2) üzerinde `.webp`; gerçek istekte `Content-Type: image/webp` (403 ana görsel ölçüldü, 403'ü de WebP). Boyut sorunu yok: en küçük 870×1142, 500px altı 0. R2'de JPEG türevi YOK (`.jpg`/`.jpeg` 404); `image-compress.ts` her yüklemeyi WebP'ye çeviriyor. | Ayrı `/feed/meta.xml`, görsel adresi JPEG türevine işaret eder. Türevin nasıl üretileceği kullanıcı kararı (aşağıda "Karar gereken noktalar" 1). |
| 1.2 | **`g:availability` = `in_stock` / `out_of_stock`.** Meta yalnız `in stock` / `out of stock` (boşluklu) kabul ediyor. | 1337 `in_stock`, 324 `out_of_stock`. | `/feed/meta.xml`'de boşluklu değer. Google feed'i değişmez. |
| 1.3 | **Feed'in Meta tarafından çekilip çekilemeyeceği doğrulanmalı.** Meta, katalog feed'ini hangi user agent'la çektiğini belgelemiyor. | Canlıda `meta-externalagent` 403 (Firewall AI Bots = Deny); planda yazan 26 Ekim'deki "istemci hatası" büyük olasılıkla bu. `facebookexternalhit` 200. | Kod değişikliği yok. Commerce Manager'da feed eklenince "Şimdi yükle" ile denenir. Hata alırsa Vercel Firewall'a yalnız `/feed/` yolu için "Bypass" özel kuralı eklenir (kullanıcı, dashboard'dan). AI Bots kuralı açık kalır. |

### 2) Eşleşmeyi bozar

| # | Sorun | Kanıt | Önerilen düzeltme |
|---|---|---|---|
| 2.1 | **AddToWishlist `content_ids` = `Product.id` (cuid), feed'de `item_group_id` = `product.code`.** | Feed'deki 273 ürünün 273'ünde code dolu. Yani AddToWishlist olaylarının **%100'ü** katalogla eşleşmez. | `getItemGroupId(product)` (`code ?? id`) yardımcı fonksiyonu. Feed ve AddToWishlist bunu kullanır; `wishlist.tsx`'e ürünün code'u da taşınır. Başka `product_group` kullanan yer yok. |
| 2.2 | **InitiateCheckout'ta eski sepet satırı için `variantId`'ye düşme (fallback).** | `/odeme`'de olay, sepet localStorage'dan ilk yüklendiği anda gidiyor; aynı anda başlayan `autoRefresh` SKU'yu sonra dolduruyor. 24 Ekim'den (Pixel commit'i) sonra eklenen her satırda SKU var: ürün sayfası, ürün kartı ve kombin kartı `addLine`'a `sku` veriyor; sunucudan çekilen sepet `toCartLine` ile SKU alıyor. Sıklık DB'den ölçülemiyor: DB'deki sepet yalnız id+adet tutuyor. Pratikte yalnız 24 Ekim öncesinden kalmış ve o günden beri hiç açılmamış localStorage sepetlerinde olur, giderek sıfıra iniyor. | Düzeltme önermiyorum (azalan, geçici). İstenirse InitiateCheckout, SKU'su eksik satır varken tazeleme bitene kadar bekletilebilir. |
| 2.3 | GA4 `view_item_list` / `select_item` / `add_to_wishlist` `item_id` = `Product.id`; sepet ve ödeme olayları SKU. | Yalnız GA4 içi tutarlılık; Meta'yı etkilemiyor. | Dokunulmadı (yalnız rapor). |

**Olay tablosu**

| Olay | Kaynak | content_type | content_ids | contents | value / currency | Feed ile eşleşiyor mu |
|---|---|---|---|---|---|---|
| ViewContent | tarayıcı | `product` | ürünün tüm varyant SKU'ları | yok | ürün sayfası `priceCents` / TRY | ✔ (`g:id`) |
| AddToCart | tarayıcı + CAPI (`/api/meta/olay`) | `product` | `line.sku` (yoksa `variantId`) | var | satır fiyatı × adet / TRY | ✔. Aynı `event_id` (UUID) ve aynı `customData` nesnesi iki tarafa gidiyor. |
| AddToWishlist | tarayıcı | `product_group` | `Product.id` | yok | yok | ✘ (2.1) |
| InitiateCheckout | tarayıcı + CAPI | `product` | satır SKU'ları (yoksa `variantId`) | var | satırlar toplamı (indirim ve kargo hariç) / TRY | ✔. Aynı `event_id` ve veri. Eski satırda 2.2. |
| AddPaymentInfo | tarayıcı | `product` | satır SKU'ları | var | genel toplam (indirim ve kargo dahil) / TRY | ✔ |
| Purchase | tarayıcı + CAPI | `product` | `OrderItem.variant.sku` (yoksa `variantId`) | var | sipariş toplamı / TRY | ✔. İki taraf da `purchaseCustomData(order)` ve `purchase_<siparişNo>` kullanıyor. Varyantı silinmiş sipariş satırı: 0. |
| Search | tarayıcı | — | — | — | — | ürün kimliği yok |

### 3) İyileştirme

| # | Konu | Kanıt | Öneri |
|---|---|---|---|
| 3.1 | Başlıklarda BÜYÜK HARF. Renk ve beden değerleri varyant seçeneklerinden büyük harfle geliyor (ör. `… Omuz Çantası BEYAZ STD`, `… SÜET HAKİ STANDART`). 5 başlık tamamen büyük harf (`KOTON TROUSERS SİYAH DESENLİ 34`); bunlar ürün adının kendisinden geliyor. Meta "aşırı büyük harf" kullanımını reklam kalitesinde uyarı olarak gösterebilir. | 15 başlıkta 3+ kelimelik büyük harf bloğu var, 5 başlık tamamen büyük harf. | Meta feed'inde başlıktaki renk/beden "Baş Harf Büyük" yazılabilir (`Beyaz`, `Süet Haki`). Tamamen büyük harfli 5 ürün adı admin'den düzeltilmeli. İsteğe bağlı. |
| 3.2 | Meta, başlıkların ≤65 karakter olmasını öneriyor (sınır 200). | Başlıklar ≤150. | Gerek yok; yalnız bilgi. |
| 3.3 | Fiyatı 0 olan ürün için feed'de filtre yok. | Şu an 0 TL ürün yok. | İstenirse `finalPriceCents > 0` koşulu eklenir (Google için de geçerli). |

### Karar gereken noktalar (Aşama B öncesi)

1. **JPEG türevi nasıl üretilecek?**
   - **A (öneri): R2'de kalıcı JPEG kopyası.**
     - Bir defalık yerel betik: her `.webp` görselin yanına aynı adla `.jpg` yazılır.
       Yaklaşık 2179 dosya, R2 yazma işlemi ücretsiz kotanın çok altında, Vercel maliyeti 0.
     - Yeni yüklemelerde (admin yükleme ve Excel aktarımı) `image-storage` tarafında
       ikinci bir `.jpg` PUT eklenir.
     - Meta feed'i `.webp` → `.jpg` adresini kullanır.
     - Betiği sen onaylamadan çalıştırmam.
   - **B: Cloudflare Image Transformations.**
     - `img.bollmark.com/cdn-cgi/image/format=jpeg/<yol>` biçiminde adres kullanılır.
     - Kod tarafında yalnız feed'deki URL değişir.
     - Zone'da Transformations'ı açman gerekir.
     - Ücretsiz katman ayda 5.000 tekil dönüşüm; şu an 2179 görsel var. Ürün sayısı
       büyüdükçe sınıra yaklaşır.
   - **C (önermiyorum): Vercel'de istek anında dönüştürme.**
     - Ayrı bir route `sharp` ile çevirir.
     - Her önbellek ıskası bir fonksiyon çağrısı ve CPU harcar.
     - `sharp` function boyutunu büyütür (Functions Storage notu).
     - Fluid CPU sınırına daha önce yaklaşılmıştı.
2. **Başlık büyük harf düzeltmesi (3.1)** Meta feed'inde yapılsın mı?
3. `/feed/meta.xml` açılır (1.1 ve 1.2 Google feed'ini bozmadan yalnız ayrı feed'le
   çözülebiliyor). Mantık `merchant-feed.ts`'te ortak kalır; yalnız `availability`
   biçimi ve görsel URL'si parametreyle değişir.
4. Şema değişikliği gerekmiyor.

**Kullanıcı kararları (2026-10-26):** 1-A (R2'de kalıcı JPEG, kalite 85, aynı boyut;
önce 5 görsellik deneme, toplu çalıştırma ayrıca onaylanacak; `.webp`'lere dokunulmaz),
2 evet (`/feed/meta.xml`; Google feed'i birebir aynı kalacak), 3 evet (yalnız Meta
feed'inde). Vercel Firewall'a dokunulmayacak; feed Commerce Manager'da denenecek.

## Aşama B uygulaması (2026-10-26, localhost, commit yok)

- **`getItemGroupId(product)`** (`src/lib/item-group-id.ts`, `code ?? id`).
  - Kullanan yerler: iki feed, JSON-LD `productGroupID` (`seo.ts`) ve Meta AddToWishlist.
  - AddToWishlist zinciri: `CatalogEntry` ve `ProductCardData`'ya `itemGroupId` eklendi →
    `wishlist.toggle(productId, itemGroupId, item)` → `trackAddToWishlist(productId, itemGroupId, item)`.
  - Ürün sayfası değeri `productCode`'dan hesaplıyor.
  - GA4 `add_to_wishlist` `item_id` = `Product.id` olarak kaldı (dokunulmadı).
  - Not: canlıda katalog önbelleği (`unstable_cache`, 1 sa) deploy'dan önceki girişleri
    en çok 1 saat daha sunabilir. O sürede karttan gelen AddToWishlist'te kimlik boş gidebilir.
- **`/feed/meta.xml`**.
  - `buildMerchantFeed("google" | "meta")`, mantık `merchant-feed.ts`'te ortak.
  - Meta farkları:
    - availability `in stock` / `out of stock`;
    - görseller `jpegCopyUrl` ile `.jpg`;
    - başlıkta renk ve beden "Baş Harf Büyük" (Türkçe yerel ayar; `STD`, `XS`–`XXXL`, `T`
      ve rakam içeren bedenler — `34`, `28/32`, `7-8 Yaş`, `3XL` — olduğu gibi);
    - tamamen büyük harfli ürün adı aynı kuralla düzeltiliyor (yalnız `KOTON TROUSERS SİYAH DESENLİ`).
  - 1661 başlığın 1497'si değişti.
  - DB'deki adlara dokunulmadı.
  - Marka adı (`KOTON …`) ürün adının parçası olduğu için büyük harf kaldı.
- **Google feed'i birebir aynı:** değişiklik öncesi/sonrası `/feed/google.xml` md5 eşit
  (`6c2b64ff…`).
- **JPEG kopyaları.**
  - `compressImage` aynı yeniden boyutlandırılmış görselden WebP (q78) ve JPEG (q85,
    saydam alan beyaz) üretiyor.
  - `uploadImage` `.jpg`'yi aynı adla paralel yazıyor. Yazan yollar: admin yükleme,
    Koton/Slazenger, link içe aktarma, Instagram.
  - `deleteR2Urls` `.webp` ile birlikte `.jpg`'yi de siliyor.
  - Ölçüm (yerel, 2400px girdi, 9 görsel ortalaması): WebP 370 ms → WebP+JPEG 400 ms
    (+~30 ms, %8). JPEG ortalama 210 KB. R2 PUT paralel olduğu için ek bekleme yok denecek kadar az.
- **Toplu betik** `scripts/r2-jpeg-kopyalari.ts`.
  - Bayrak verilmezse yalnız sayar; `--limit=N` ya da `--hepsi` ile yazar.
  - Yazma `wrangler r2 object put` ile yapılıyor (bucket `bollmark-images`). `wrangler login`
    yeterli; R2 S3 anahtarı gerekmez. Yerelde `R2_` anahtarları yok (Vercel'dekiler
    "Sensitive"); `.env.local`'e yalnız `R2_PUBLIC_BASE_URL` (gizli değil) eklendi.
  - Var olan kopyayı herkese açık adrese benzersiz `?kontrol=` ile HEAD atarak bulur ve
    atlar. Böylece Cloudflare düz adres için 404'ü önbelleğe almaz.
  - Boyutun aynı kaldığını doğrular.
  - DB'ye yazmaz; `.webp`'lere dokunmaz.
  - **5 görsellik deneme (2026-10-26):** 5/5 yazıldı, hata 0, 1523×2000 (WebP ile aynı).
    `https://img.bollmark.com/admin-upload/03c35a0a-…-145efbe1.jpg` → 200
    `image/jpeg`, `Cache-Control: public, max-age=31536000, immutable`; görsel tarayıcıda
    düzgün. Toplu çalıştırma (`--hepsi`, kalan 2188) kullanıcı onayı bekliyor.
- **Kontrol betiği** `scripts/meta-feed-kontrol.ts` (yalnız okur). localhost sonucu:
  - 1661 item; zorunlu alan eksiği 0;
  - availability `in stock` 1336 / `out of stock` 325, geçersiz 0;
  - fiyat biçimi hatası 0, tekrarlanan id 0, 500px altı 0;
  - **WebP 2179** (yerelde `R2_PUBLIC_BASE_URL` olmadığı için `.jpg`'ye çevrilmedi;
    R2 adımı bitince 0 olmalı).
- tsc ve eslint (değişen dosyalar) temiz.

### Sıra (push öncesi)
1. Kullanıcı `.env.local`'e R2 anahtarlarını ekler.
2. `npx tsx scripts/r2-jpeg-kopyalari.ts --limit=5` → yazılan `.jpg`'ler tarayıcıda ve
   `Content-Type: image/jpeg` ile kontrol edilir.
3. Kullanıcı onayıyla `--hepsi` (≈2190 dosya, ≈450 MB, R2 ücretsiz kotası içinde).
4. `npx tsx scripts/meta-feed-kontrol.ts` → WebP 0, indirilemeyen 0.
5. Commit/push (kullanıcı söyleyince). Commerce Manager'a `https://bollmark.com/feed/meta.xml`.

### Olay Yöneticisi'nde content_ids doğrulaması (localhost)
1. `.env`'de `META_TEST_EVENT_CODE` tanımlı olsun (Olay Yöneticisi > Bollmark veri seti >
   Olayları Test Et sekmesindeki kod). `npm run dev`'i yeniden başlat.
2. Olayları Test Et'te "Web sitesi" alanına `http://localhost:3000` yazıp "Web sitesini aç".
   Açılan sekmede çerez bandında **Pazarlama**'yı kabul et.
3. Bir ürün sayfası aç (ör. `/urunler/gaver-s-rt--antas-?renk=BEJ`).
   - Test Et listesinde **ViewContent** → "Parametreler"de `content_ids`, ürünün tüm
     varyant SKU'ları olmalı (ör. `SX16CNT017-BEJ-STD`, `SX16CNT017-SİYAH-STD`, …).
   - Karşılaştırma: `http://localhost:3000/feed/meta.xml` içinde Ctrl+F ile bu SKU'ları
     `<g:id>` olarak bul.
4. Kalbe tıkla → **AddToWishlist**: `content_type` `product_group`, `content_ids` ürün kodu
   (ör. `SX16CNT017`). Feed'deki `<g:item_group_id>` ile aynı olmalı.
5. Beden seç → Sepete ekle → **AddToCart**: `content_ids` = seçilen varyantın SKU'su
   (feed'de `<g:id>`).
   - Localhost'tan sunucu (CAPI) kopyası IP olmadığı için reddedilebilir (bilinen durum).
   - Tarayıcı olayına bakılır.
6. Sepet → Ödemeye geç → **InitiateCheckout**: sepetteki her satırın SKU'su.
7. Her olayda `currency` `TRY`. Feed'de olmayan bir kimlik görürsen hangi olay olduğunu not et.
