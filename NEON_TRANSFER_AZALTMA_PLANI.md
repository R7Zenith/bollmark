# Neon Veri Transferi (Egress) Azaltma Planı

Durum: Plan onaylandı (2026-10-29), adım adım uygulanıyor. Kararlar: öneri 4
**ertelendi**, öneri 9 şimdilik **yapılmayacak**, pg_stat_statements **kurulmayacak**,
eksik indeksler öncelikli. Uygulama sırası: 1 → indeksler → 3 → 2+7 → 5, 6, 8.

## Özet

- Neon ücretsiz planında kota **proje başına aylık 5 GB**. Kota aşılırsa compute
  **bir sonraki fatura dönemine kadar askıya alınır**, site çöker. Kotaya Neon'dan
  dışarı giden her bayt sayılır: sorgu sonuçları, `pg_dump`, mantıksal replikasyon.
- Veritabanı küçük, toplam **15 MB**. İçinde base64 görsel yok, büyümüş log tablosu
  da yok. Sorun saklanan veri değil, **aynı büyük sorguların çok sık çalışması**.
- En pahalı tek sorgu "tüm yayındaki ürünleri her şeyiyle çek" sorgusu: her
  çalışmada **~1,6 MB** taşıyor. Ana sayfa, katalog önbelleği, Meta/Google feed'i
  ve arama indeksi bu sorguyu ya da benzerini kullanıyor.
- Canlı sitenin son 24 saati, ölçülen sorgu boyutlarıyla çarpınca
  **~125–160 MB/gün** ediyor (aylık ~4–4,8 GB). Bu, kotanın %80'inin dolmasını
  canlı sitenin tek başına açıklayabileceğini gösteriyor. Localhost bunun üstüne
  ekleniyor; payı ölçülemedi (bkz. "Ölçülemeyenler").
- En büyük kaldıraçlar:
  1. Vega'dan gelen her stok değişikliği **tüm ürün sayfalarının** önbelleğini siliyor.
  2. Sorgular kartlarda kullanılmayan kolonları da çekiyor (açıklamalar vb.).
     Bunları atmak katalog sorgusunda **%37** tasarruf sağladı, ölçüldü.
  3. SEO/AI botları, sayfa yeniden üretimlerinin **%42**'sini tetikliyor.
  4. Localhost'un yerel Postgres'e taşınması.
- Önerilerin hiçbiri görsel kalitesine, ürün fotoğraflarına veya `next.config.mjs`
  görsel ayarlarına dokunmuyor. Görünümü veya hızı etkileyebilecek tek nokta ⚠ ile
  işaretli (öneri 9, isteğe bağlı).

## Nasıl ölçüldü

1. **Veritabanı istatistikleri** (salt okunur): `pg_extension`,
   `pg_total_relation_size`, `pg_stat_user_tables`, `pg_column_size`.
2. **Sorgu başına gerçek bayt**: projenin kendi fonksiyonları
   (`getPublishedProducts`, `getProductBySlug`, `getRelatedProducts` vb.) veya
   birebir kopyaları canlı veritabanında çalıştırıldı. Neon WebSocket'inden gelen
   bayt sayıldı. Yazma yapılmadı. Betik projede değil, geçici klasördeydi.
3. **Trafik**: `vercel logs requests -e production --since 24h`, 5.446 istek kaydı
   (28 Eki 20:30 – 29 Eki 20:30). Kayıtlar rota, önbellek sonucu
   (`HIT/MISS/STALE/REVALIDATED`) ve user-agent'a göre sayıldı. Runtime logları
   (2.272 satır) Vega metotları için tarandı.
4. **Neon dokümanı**: plans, network-transfer, branching ve pg_stat_statements
   sayfaları.

### Ölçülen sorgu boyutları (Neon'dan çıkan bayt)

| Sorgu (kaynak) | Bayt | Not |
|---|---|---|
| Ana sayfa `getPublishedProducts()` (`src/lib/catalog.ts:92`) | **1.585 KB** | 289 ürün, tüm kolonlar ve ilişkiler |
| Katalog `buildCatalogEntries` kapsamsız (`src/lib/catalog.ts:196`) | **1.585 KB** | `include` ürünün tüm kolonlarını da getiriyor |
| Aynı katalog sorgusu, yalnız gereken alanlarla (`select`) | **1.003 KB** | **−%37**, sonuç aynı |
| Katalog sorgusu, "Erkek" kapsamı | 563 KB | Her kategori/cinsiyet kombinasyonu ayrı sorgu |
| Feed `buildMerchantFeed` (`src/lib/merchant-feed.ts:67`) | **1.598 KB** | Meta 3 saatte bir çekiyor |
| Arama indeksi `buildSearchIndex` (`src/lib/search.ts:34`) | 1.023 KB | |
| Sitemap ürün sorgusu (`src/app/sitemap.ts:16`) | 397 KB | Günde ~1 kez |
| Yalnız açıklama kolonları (description + originalDescription + descriptionDraft) | 380 KB | Kartlarda hiç kullanılmıyor |
| Yalnız varyant + seçenek ağacı | 542 KB | |
| Admin ürün listesi, 50 ürün (`src/app/(admin)/admin/urunler/page.tsx:117`) | 256 KB | |
| Ürün sayfası `getProductBySlug` | 9 KB | |
| Ürün sayfası `getRelatedProducts` (`src/lib/catalog.ts:373`) | **50 KB** | Ürünün kendisinin 5 katı |
| Vega `SelectSiparis` (sipariş yokken) | ~2,2 KB | Günde ~1.100 kez |
| Küçük sorgular (kampanyalar, StoreSettings, kategori) | 0,1–1,4 KB | |

### Son 24 saatte canlıda veritabanına giden işler

| İş | 24 saatteki adet | Tahmini bayt/gün |
|---|---|---|
| Ürün + renk sayfası yeniden üretimi (`/urunler/[slug]` MISS 252 + REVALIDATED 334 + STALE 144; `/renk/` 116 + 94 + 34) | ~974 × ~62 KB | **~59 MB** |
| Ana sayfa yeniden üretimi (STALE 11 + REVALIDATED 13) | 24 × ~1,6 MB | **~38 MB** |
| Katalog önbelleği (`getCatalogEntries`) yeniden kurulumu | ölçülemedi | tahmini 10–30 MB |
| Meta feed (STALE 8) + Google feed (1) | 9 × ~1,6 MB | **~14 MB** |
| Admin (canlıda 688 istek; ürün listesi .rsc 35 × 256 KB vb.) | | ~10–12 MB |
| Dinamik katalog sayfaları, önbelleksiz küçük sorgular (715 render × ~3 KB) | | ~2 MB |
| Vega `SiparisServis` (1.098 çağrı) + `UrunServis` (35 çağrı) | | ~2,5 MB |
| **Toplam** | | **~125–160 MB/gün** |

## Öncelik sırasına göre öneriler

Tasarruf tahminleri yukarıdaki 24 saatlik ölçüme dayanıyor. Her öneri tek başına
uygulanıp localhost'ta gösterilebilir.

### 1. Vega stok güncellemesi ve ürün kaydı yalnız ilgili ürünün sayfasını tazelesin

> **Uygulandı (2026-10-30), yalnız Vega kısmı.** Uygulama sırasında asıl kök neden
> bulundu: mega menü önbelleği (`src/lib/site-nav.ts`) `catalog` etiketini kullanıyordu.
> Menü layout'ta olduğu için bu etiket tüm vitrin sayfalarına yapışıyordu (yerel ISR
> kaydındaki `x-next-cache-tags` ile görüldü). Sonuç: `revalidateTag("catalog")`, slug
> verilse bile tüm ürün, renk, sepet ve yasal sayfaları siliyordu.
>
> Çözüm:
> - Menüye ayrı bir `menu` etiketi verildi.
> - Vega için yeni `revalidateProductStock()` yazıldı. Yalnız o ürünün sayfasını ve
>   renk sayfalarını, ayrıca katalog, ana sayfa, arama ve kombinleri tazeler. Menüye
>   dokunmaz.
>
> Admin ürün kaydı hedefli yapılmadı. Kategori, cinsiyet ya da görsel değişikliği
> menüyü etkiliyor; menüyü tazelemek de zaten tüm sayfaları siliyor.
>
> Ödün: başka ürünlerin sayfasındaki "Benzer Ürünler" bölümü en çok 1 saat eski stok
> gösterebilir.

- **Sorun:** Vega'dan gelen her stok değişikliği `revalidateCatalog()`'u slug'sız
  çağırıyor. Bu çağrı `/(site)/urunler/[slug]` desenini, yani **tüm ürün
  sayfalarını** geçersiz kılıyor. Ardından gelen her ziyaret (çoğu bot) ürün
  sayfasını sıfırdan üretiyor: her biri ~62 KB. Admin'de ürün kaydı ve silme de
  slug'sız çağırıyor. Ayrıca slug verilse bile tüm renk sayfaları
  (`/urunler/[slug]/renk/[renk]`) ve tüm kombin sayfaları siliniyor.
- **Kanıt:**
  - `src/app/Servis/[service]/route.ts:318`: `if (changed > 0) revalidateCatalog();`
  - `src/app/(admin)/admin/urunler/[id]/page.tsx:309` ve `:339`: slug'sız çağrı.
  - `src/lib/revalidate-catalog.ts:24-30`: renk ve kombin desenleri her çağrıda siliniyor.
  - Vercel: 24 saatte 334 ürün sayfası `REVALIDATED`, 252 `MISS`. Yayında yalnız
    289 ürün var, yani aynı sayfalar gün içinde defalarca üretiliyor. Runtime
    logunda 24 saatte ~35 `VaryasyonGuncelle` var; her biri bir tam silme.
- **Çözüm:**
  - Vega işleyicisinde güncellenen varyantın ürün slug'ını alıp
    `revalidateCatalog(slug)` çağırmak.
  - Ürün düzenleme sayfasında da slug'ı geçirmek.
  - `revalidate-catalog.ts`'te renk sayfalarını yalnız o ürün için silmek.
    Next 16'da tek ürünün renk alt yolunu desenle silmenin doğru yazımı uygulamada
    test edilecek; olmazsa ürün sayfasına özel bir `cacheTag` kullanılacak.
  - Kombin sayfalarını yalnız ürün bir kombine dahilse silmek.
- **Tahmini tasarruf:** ürün/renk üretimlerinin büyük kısmı, **~35–45 MB/gün**
  (aylık ~1,1–1,3 GB).
- **Risk:** Düşük. Kategori, ana sayfa ve arama yine anında tazeleniyor; sadece
  diğer ürünlerin sayfaları gereksiz yere silinmiyor. Kontrol: stok değişince o
  ürünün sayfasında yeni stok görünmeli, başka bir ürünün sayfası `HIT` kalmalı.
- **Görünüm/hız:** Değişmez. Önbellekten sunulan sayfa sayısı arttığı için hız
  iyileşir.

### 2. Ağır sorgular yalnız kullanılan alanları çeksin (`include` → `select`)

- **Sorun:** Prisma'da `include` ürünün **tüm kolonlarını** getiriyor: kartlarda
  hiç kullanılmayan `description`, `originalDescription`, `descriptionDraft`,
  `material`, `careInstructions`. Varyant seçeneklerinde de her değerin
  `attribute` kaydının tüm alanları geliyor.
- **Kanıt:**
  - `src/lib/catalog.ts:92` (`getPublishedProducts`, ana sayfa)
  - `src/lib/catalog.ts:196` (`buildCatalogEntries`)
  - `src/lib/catalog.ts:383` (`getRelatedProducts`, ürün başına 2 × 24 ürün)
  - `src/lib/merchant-feed.ts:67` (feed: `brand: true`, `category: { include: { parent: true } }`,
    `optionImages: { include: { value: true } }`)
  - `src/app/(admin)/admin/urunler/page.tsx:117` (admin listesi)
  - `src/lib/variant-attributes.ts:71`: `variantOptionsInclude` her yerde `attribute: true`
  - Ölçüm: aynı katalog verisi `select` ile 1.585 KB'tan 1.003 KB'a indi.
    Açıklama kolonları tek başına 380 KB.
- **Çözüm:** Her sorguya, o sayfanın gerçekten kullandığı alanları listeleyen bir
  `select` yazmak. Ortak bir "kart için varyant seçenekleri" seçimi
  (`value: { select: { value, position, hexColor, attribute: { select: { name, isColor } } } }`)
  `variantOptionsInclude`'un yanına eklenir. Feed `description` alanını
  kullandığı için onda yalnız `originalDescription` ve `descriptionDraft` düşer.
  TypeScript, eksik bırakılan alanı derlemede yakalar.
- **Tahmini tasarruf:** ana sayfa, katalog, feed, benzer ürünler ve admin
  listesinde %30–40; toplamda **~25–35 MB/gün**.
- **Risk:** Düşük-orta. Bir alan unutulursa derleme hata verir. Görünen veri aynı
  kalmalı. Kontrol: ana sayfa, katalog, ürün sayfası ve feed çıktısının
  değişiklikten önce ve sonra karşılaştırılması (feed XML'i satır satır diff).
- **Görünüm/hız:** Değişmez. Sorgular daha kısa sürer (ölçümde 918 ms → 556 ms).

### 3. Kötü niyetli olmayan ama gereksiz botları durdurmak

- **Sorun:** Sayfa üretimini tetikleyen 1.911 isteğin **797'si (%42)** botlardan
  geliyor. Ürün sayfalarında öne çıkanlar ElevenlabsCrawler (175), MJ12bot (115)
  ve AhrefsBot (109). Bunlar Google sıralamasına katkı vermiyor, ama her gelişleri
  bir sayfa üretimi demek.
- **Kanıt:** Vercel istek kayıtlarında user-agent dağılımı.
  `src/app/robots.ts:9`'daki `AI_BOTS` listesinde bu üçü yok. Vercel Firewall'da
  "AI Bots = Deny" açık (DEPLOY_STATUS), ama bu üçünü durdurmuyor.
- **Çözüm:** `ElevenlabsCrawler`, `MJ12bot` ve `AhrefsBot`'u `AI_BOTS` listesine
  eklemek. robots.txt'ye uymayanlar için Vercel Firewall'a user-agent kuralı.
  Firewall kuralı panelden yapılır, kod değişikliği değildir; ayrıca onay alınır.
  Googlebot, Storebot-Google, Bingbot ve facebookexternalhit **dokunulmadan kalır**.
- **Tahmini tasarruf:** ürün üretimlerinin ~%30–40'ı daha. 1. öneriyle birlikte
  **~10–20 MB/gün** ek.
- **Risk:** Ahrefs'i SEO analizi için kullanıyorsan (projede Ahrefs eklentisi
  yüklü) site taraması durur. Ahrefs'i kullanmak istiyorsan bu bot listeden
  çıkarılır. Google'a etkisi yok.
- **Görünüm/hız:** Değişmez.

### 4. Localhost'u canlı veritabanından ayırmak (seçenek a: yerel Postgres)

> **ERTELENDİ** (kullanıcı kararı, 2026-10-29). Localhost canlı Neon'a bağlı kalıyor.

- **Sorun:** `next dev`'de sayfalar **her istekte** yeniden üretilir. Next 16
  dokümanı (`caching-without-cache-components.md:187`): "In Development, Pages are
  always rendered on-demand and are never cached". Ana sayfa önbelleksiz
  `getPublishedProducts()` çağırıyor. Bu yüzden localhost'ta ana sayfayı her
  açış ve dosya kaydedince gelen her Fast Refresh **~1,6 MB**, ürün sayfası
  ~62 KB yiyor. Günde 30 ana sayfa yenilemesi tek başına ~50 MB eder.
- **Kanıt:** `.env`'de canlı Neon adresi var, `DEPLOY_STATUS.md:17` aynı DB'yi
  belirtiyor. Ölçümler yukarıda. Localhost'un gerçek payı ölçülemedi.
- **Çözüm:** Aşağıdaki "Localhost seçenekleri" bölümünde (a) seçeneği.
- **Tahmini tasarruf:** localhost trafiğinin **tamamı**.
- **Risk:** Orta, çünkü çalışma alışkanlığını değiştiriyor (ayrıntı aşağıda).
- **Görünüm/hız:** Değişmez. Görseller R2'de (`img.bollmark.com`) durduğu için
  yerel kopyada da gerçek fotoğraflar görünür. Localhost daha hızlı olur, çünkü
  Neon gidiş-dönüşü kalkar.

### 5. Katalog önbelleğini tek bir listeden üretmek

- **Sorun:** `getCatalogEntries(kategori, {cinsiyet})` her kategori × cinsiyet
  kombinasyonu için **ayrı** önbellek kaydı ve ayrı tam sorgu üretiyor. Her
  `revalidateCatalog()` (günde onlarca) hepsini birden siliyor. Ardından gelen
  ziyaretler, her kombinasyon için 100 KB–1,6 MB'lık sorguyu ayrı ayrı yeniden
  çalıştırıyor.
- **Kanıt:** `src/lib/catalog.ts:240` (anahtara argümanlar giriyor).
  `src/lib/catalog-listing.ts:107`. Vercel'de dinamik katalog rotaları 24 saatte
  ~715 render. Kaçının önbellek kaçırması olduğu loglarda görünmüyor.
- **Çözüm:** Önbellekte yalnız **tek** kapsamsız liste tutmak. Kategori ve
  cinsiyet filtresini bellekte uygulamak; bunun için `CatalogEntry`'e kategori
  slug'ı ve üst kategori slug'ı eklenir. Kapsamsız liste ölçüldü: 422 giriş,
  **535 KB JSON**. Vercel veri önbelleğinin 2 MB öğe sınırının altında.
  Böylece her silmeden sonra tek bir ~1 MB sorgu kalır (2. öneriyle).
- **Tahmini tasarruf:** **~10–25 MB/gün** (tahmin, doğrudan ölçülemedi).
- **Risk:** Orta. Sıralama ("öne çıkanlar önce" seçeneği) ve kategori eşleşme
  kuralı (alt kategori dahil) aynen korunmalı. Kontrol: birkaç kategori/cinsiyet
  sayfasında ürün listesi ve sırası öncesiyle birebir aynı olmalı.
- **Görünüm/hız:** Değişmez. İlk açılıştan sonra filtreleme biraz hızlanır.

### 6. Ana sayfa ürün listesini önbellekten okumak

- **Sorun:** Ana sayfa (`src/app/(site)/page.tsx:82`) her yeniden üretimde
  `getPublishedProducts()` ile 1,6 MB çekiyor. Katalog önbelleğiyle aynı tazeleme
  anında çalıştığı için aynı veri iki kez okunuyor. Localhost'ta da her açılışta
  okunuyor.
- **Kanıt:** 24 saatte 24 ana sayfa üretimi, ~38 MB.
- **Çözüm:** Ana sayfanın ihtiyaç duyduğu alanları (2. öneriyle daraltılmış)
  `unstable_cache` ile `catalog` etiketine bağlamak, ya da 5. öneri yapıldıysa
  doğrudan o tek listeden türetmek. Ham Prisma sonucu 3 MB JSON, bu yüzden
  önbelleğe girebilmesi için önce daraltılması şart (2 MB sınırı). Tarih
  alanları önbellekte metne dönüştüğü için (`createdAt`) sayıya çevrilerek
  saklanır.
- **Tahmini tasarruf:** canlıda ~15–25 MB/gün; localhost'ta ana sayfa
  yenilemelerinin tamamı.
- **Risk:** Orta. "Yeni Gelenler", "Çok Satanlar" ve sezon renkleri aynı
  çıkmalı; ekran görüntüsüyle karşılaştırılacak.
- **Görünüm/hız:** Değişmez.

### 7. Meta/Google feed sorgusunu daraltmak

- **Sorun:** Meta Commerce Manager feed'i 3 saatte bir çekiyor; her çekişte feed
  yeniden üretiliyor (24 saatte 8 `STALE`). Her üretim 1,6 MB. Aylık ~400 MB,
  yani kotanın ~%8'i.
- **Kanıt:** `src/lib/merchant-feed.ts:67-76`, Vercel `/feed/meta.xml` STALE 8.
- **Çözüm:** 2. önerideki `select` daraltması. Feed içeriği birebir aynı kalır.
  Feed `revalidate` süresini uzatmak bir şey kazandırmaz, çünkü katalog zaten
  gün içinde defalarca tazeleniyor.
- **Tahmini tasarruf:** ~4–6 MB/gün (2. önerinin içinde sayıldı).
- **Risk:** Düşük; feed XML'i önce/sonra diff ile doğrulanır.
- **Görünüm/hız:** Etkisi yok.

### 8. Admin: kenar menüsü önceden yüklemesi ve ürün listesi

- **Sorun:** Canlıda neredeyse her admin sayfası 24 saatte tam 30 kez `.rsc`
  isteği almış (kargolar, iadeler, kampanyalar, sezonlar, markalar...). Bu
  eşitlik, kenar menüsündeki `<Link>`'lerin her sayfa açılışında hepsini önceden
  yüklediğini (prefetch) düşündürüyor; kesinleşmesi uygulamada test edilecek.
  Önceden yükleme o sayfaların sorgularını da çalıştırıyor. Ürün listesi tek
  başına 256 KB.
- **Kanıt:** `src/components/admin/sidebar.tsx:118` (`prefetch` belirtilmemiş).
  Vercel'de `/admin/*.rsc` sayıları.
- **Çözüm:** Admin kenar menüsü linklerine `prefetch={false}`. Admin ürün
  listesine 2. önerideki `select` daraltması.
- **Tahmini tasarruf:** ~5–10 MB/gün.
- **Risk:** Düşük. Admin'de sayfa geçişleri birkaç yüz ms gecikebilir. Vitrine
  etkisi yok.
- **Görünüm/hız:** Vitrin değişmez. Admin menü geçişi biraz yavaşlayabilir.

### 9. ⚠ (İsteğe bağlı) Vega stok değişiminde katalogu anında değil, birkaç dakikada bir tazelemek

> **Şimdilik YAPILMAYACAK** (kullanıcı kararı, 2026-10-29). 1–8 uygulandıktan sonra
> ölçüme göre yeniden konuşulacak.

- **Sorun:** 1. öneriden sonra da her Vega stok değişikliği ana sayfa, katalog ve
  arama önbelleğini siliyor. 29 Ekim 09:00–10:00'daki gibi bir saatte 23 Vega isteği gelirse
  arada gelen ziyaretler aynı ağır sorguları tekrar tekrar çalıştırır.
- **Çözüm:** Vega kaynaklı değişikliklerde ana sayfa ve katalog için anında
  silme yerine kısa bir zaman tabanlı tazeleme (ör. 10 dk). Ürün sayfası anında
  tazelenmeye devam eder. Sepet ve ödeme stoğu zaten canlı kontrol ediyor
  (`/api/sepet/dogrula`).
- **⚠ Etkisi:** Katalog kartındaki "Stokta Yok" / "Son X Adet" rozeti en çok
  10 dk gecikmeli güncellenir. Görsel ve hız değişmez, ama kartta görünen bilgi
  kısa süre eski kalabilir. Bu yüzden ayrıca onay gerekiyor; önce 1–8 uygulanıp
  ölçülmeli.

### 10. Ölçümü kalıcı hale getirmek (tasarruf değil, takip)

> **pg_stat_statements kurulmayacak** (kullanıcı kararı, 2026-10-29).

- **pg_stat_statements:** Veritabanında **kurulu değil** (yalnız `plpgsql`).
  Neon'a göre her projede kurulabilir
  (`CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`), ama istatistikler compute
  her uyuduğunda sıfırlanıyor. Ücretsiz planda compute 5 dk boşta kalınca uyuyor
  ve bu kapatılamıyor, yani bu araç burada sınırlı fayda verir. Kurulumu bir DB
  değişikliği olduğu için ayrıca onay gerekir. Önerim: kurmamak.
- **Neon API:** Branch detay uç noktası (`GET /projects/{id}/branches/{id}`)
  dönem başından beri biriken `data_transfer_bytes` değerini veriyor; ücretsiz
  planda da açık. Bir Neon API anahtarıyla günde bir kez okunup
  `docs/gunluk`'e not edilirse her değişikliğin etkisi görülür. API anahtarını
  sen oluşturmalısın; hiçbir dosyaya yazılmaz.
- **Hemen yapılabilecek:** Neon konsolu → proje Overview'daki "Network transfer"
  değerini bugün ve her uygulama adımından sonra not etmek.

### Yan bulgu (kotayla ilgili değil): eksik indeks

> **ÖNCELİKLİ** (kullanıcı kararı, 2026-10-29). Neon compute 100 CU-saatin 89,5'inde.
> Uygulama sırasında 2. adım.

- `ProductVariant.productId` üzerinde indeks yok (`prisma/schema.prisma:250-263`).
- `pg_stat_user_tables`'a göre `ProductVariant` 85.485 kez tam taranmış ve
  98,7 milyon satır okunmuş; `ProductVariantOption` 103 milyon satır.
- Bu egress'i değil, compute süresini (ücretsiz planda 100 CU-saat) etkiler.
  `@@index([productId])` eklemek düşük riskli. İstersen ayrı bir iş olarak ele alınır.

## Localhost seçenekleri

| | (a) Bilgisayarda yerel Postgres + canlı kopya | (b) Neon'da geliştirme branch'i | (c) Mevcut düzen + önbellek |
|---|---|---|---|
| Kotaya etkisi | Yalnız kopyayı alırken: `pg_dump` ~15–20 MB. Haftada bir yenilemek ayda ~80 MB | **Etkisi yok, aynı kotadan yer.** Neon: "the network transfer allowance is per project and shared across all products in that project"; branch bazında da `data_transfer_bytes` sayılıyor | Kısmen azaltır. Dev'de sayfalar hiç önbelleklenmez, ana sayfa her açılışta 1,6 MB |
| Gerçek ürünler görünür mü | Evet. Kopya anındaki ürünler, görseller R2'den | Evet, branch anındaki ürünler | Evet, canlı |
| Canlı veriye yanlışlıkla yazma | **Kalkar.** Bugün localhost'ta yapılan her test canlıya yazıyor | Kalkar | Devam eder |
| Diğer limitler | Yok | 100 CU-saat ve 5 GB depolama ana branch'le ortak; 10 branch sınırı | – |
| Kurulum | PostgreSQL 18 kurulumu (Neon sunucusu 18.6; bilgisayarda PostgreSQL, Docker ve `pg_dump` yok). `src/lib/prisma.ts` yerel adreste `@prisma/adapter-pg` kullanmalı: Neon adaptörü düz Postgres'e WebSocket ile bağlanamaz. Yeni bağımlılık ve ~5 satır kod | Neon konsolunda iki tık; kod değişmez | Öneri 6 |
| Veri tazeliği | Elle yenileme gerekir (tek komut, ~1 dk) | Branch "reset from parent" ile yenilenir | Hep canlı |

**Önerim: (a).** Kotayı gerçekten kurtaran tek seçenek bu. Yanında localhost'ta
yapılan testlerin canlı siparişlere ve ürünlere dokunması da biter. (b) yalnız
veriyi ayırır, kotayı ayırmaz. Not: `KALP_TOPLA_PLANI.md` Faz 0'daki "test Neon
branch'i" de aynı kotadan yer.

**(a)'nın getirdiği alışkanlık değişikliği, onaylaman gereken noktalar:**

1. Localhost admin'de yapılan ürün düzenlemesi artık **canlıya gitmez**. Canlı
   ürün düzenlemesi `bollmark.com/admin`'den yapılır.
2. `scripts/` altındaki canlıya yazan betikler (ör. `scripts/ai-taslak-aktar.ts`,
   `scripts/yasal-satici-iletisim-guncelle.ts`) `.env`'deki `DATABASE_URL`'i
   kullanıyor. Canlıya yazmaları gerektiğinde canlı adres ayrı bir değişkenle,
   bilinçli olarak verilmeli. `prisma db push` de varsayılan olarak yerel DB'ye
   gider; canlı şema değişikliği ayrıca ve bilerek yapılır. Bu aynı zamanda daha
   güvenli.
3. Vega, iyzico callback ve Meta feed zaten yalnız canlıda çalışıyor; bunlar
   etkilenmez.

## Ölçülemeyenler (dürüst not)

- **Localhost'un payı:** Neon, aynı branch ve aynı bağlantı adresindeki
  localhost ile canlı trafiğini ayırmıyor. Neon'a göre sorgu veya bağlantı bazında
  transfer dökümü de yok. 4. öneri uygulanınca, Neon Overview'daki günlük artış
  canlının gerçek payını gösterir.
- **24 saatlik örnek:** Yalnız 28–29 Ekim'e bakıldı. Excel ile toplu ürün
  aktarılan günlerde `revalidateCatalog()` ve admin trafiği çok daha yüksek
  olabilir.
- **Katalog önbelleği kaçırmaları** loglarda görünmüyor; 5. öneri bu yüzden
  aralıkla tahmin edildi.
- **Fatura dönemi başlangıcı:** Ücretsiz plan için tam sıfırlanma günü
  dokümanda yazmıyor. Konsoldan bakılmalı. 1 Ekim'den beri sayılıyorsa kullanım
  ~140 MB/gün demek; bu, yukarıdaki canlı tahminiyle uyumlu.

## Önerilen uygulama sırası

Her adım ayrı yapılır: önce localhost'ta gösterilir, onayından sonra önce
`DEPLOY_STATUS.md` güncellenir, sonra yerel commit atılır. Push yalnız sen
söyleyince yapılır.

1. **Öneri 1** (en yüksek etki, en düşük risk) → doğrulama: localhost'ta
   `next build && next start` ile `NEXT_PRIVATE_DEBUG_CACHE=1`; bir ürünün stoğu
   değişince yalnız o ürünün sayfası tazelenmeli.
2. **Öneri 3** (robots.txt; tek satırlık liste ekleme) → doğrulama:
   `/robots.txt` çıktısı.
3. **Öneri 2 + 7** (`select` daraltma) → doğrulama: aynı ölçüm betiğiyle bayt
   karşılaştırması; ana sayfa, katalog ve ürün sayfası ekran görüntüleri (1280 ve
   375 px) önce/sonra; feed XML diff; `tsc`, testler, lint.
4. **Öneri 4** (yerel Postgres) → doğrulama: localhost'ta gerçek ürünler ve
   fotoğraflar görünüyor; Neon Overview'da localhost açıkken transfer artmıyor.
5. **Öneri 5, 6, 8** → doğrulama: liste, sıra ve ekran karşılaştırması.
6. Bir hafta Neon Overview takibi. Gerekirse **öneri 9** tekrar konuşulur.

Kaba hedef: 1–3 ile canlı trafikte günde ~70–100 MB azalma, yani aylık ~2–3 GB.
4 ile localhost'un tamamı kalkar.
