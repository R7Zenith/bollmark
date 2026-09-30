# Bollmark — Teknik SEO Denetimi ve Uygulama Planı

Tarih: 30 Eylül 2026
Kapsam: Kod tabanı incelemesi (robots.ts, sitemap.ts, layout, ürün/katalog/yasal sayfalar, next.config) + canlı site erişim testi.

---

## 1. Mevcut durum — özet karne

| Alan | Durum | Not |
|---|---|---|
| robots.txt | 🟢 İyi | Admin/hesap/ödeme/sepet ve filtre parametreleri kapalı |
| sitemap.xml | 🟡 Orta | Var ama kategoriler `?kategori=` parametreli, görsel sitemap yok |
| Ürün sayfası title/desc/canonical | 🟡 Orta | Var ama title zayıf, description uzunluğu kontrolsüz |
| Ürün JSON-LD | 🟡 Orta | Temel Product var; marka, SKU/GTIN, çoklu görsel, yorum puanı, kargo/iade bilgisi yok |
| Breadcrumb JSON-LD | 🔴 Yok | Görsel breadcrumb var ama şema yok |
| Organization / WebSite / Mağaza şeması | 🔴 Yok | |
| Kategori sayfaları | 🔴 Zayıf | Temiz URL yok, canonical yok, kategori metni yok |
| Varsayılan OpenGraph / Twitter kartı | 🔴 Yok | `metadataBase` ve title şablonu yok |
| Yasal sayfalar metadata | 🔴 Yok | Title "Bollmark | Modern Giyim" olarak tekrar ediyor |
| Görsel performansı (Core Web Vitals) | 🔴 Risk | `unoptimized: true` (kota nedeniyle geçici) → LCP kötüleşir |
| Tekil içerik | 🔴 Risk | Açıklamalar Koton.com'dan çekiliyor → kopya içerik |
| Canlı erişim | ⚠️ Kontrol | Dışarıdan istek 403 döndü — Googlebot'un engellenmediği doğrulanmalı |

---

## 2. Bulgular ve öneriler (öncelik sırasıyla)

### 🔴 P0 — Hemen (dizine eklenmeyi doğrudan etkiler)

**2.1 Googlebot erişim kontrolü**
Siteye dışarıdan yapılan istek 403 döndü. Bu, Vercel Firewall / Bot Protection / Attack Challenge ya da önizleme kapısı (`proxy.ts`) kaynaklı olabilir. Meta bot olayından sonra bir koruma açıldıysa Google'ı da engelliyor olabilir.
- Vercel → Firewall'da "Verified bots" (Googlebot, Bingbot) izinli olmalı.
- Google Search Console → URL Denetleme → "Canlı URL'yi test et" ile doğrula.
- Önizleme kapısı (`/yapim-asamasinda`) canlıda aktifse, site açılana kadar SEO'nun hiçbiri işe yaramaz.

**2.2 Google Search Console + Bing Webmaster Tools**
- Domain mülkü (DNS TXT ile) ekle, sitemap'i gönder.
- Bing Webmaster'dan "GSC'den içe aktar" tek tıkla yapılır (Yandex de Türkiye için eklenebilir).

**2.3 Kopya içerik (en büyük sıralama riski)**
Ürün adı + açıklama Koton.com ile birebir aynı. Google aynı metni gördüğünde orijinal kaynağı (Koton) gösterir, Bollmark'ı filtreler. Ayrıca `koton-scraping-tespit-hukuki-risk` planındaki riskle de örtüşüyor.
- Öneri: Her ürün için Bollmark'a özgü kısa bir giriş paragrafı (2–3 cümle: kullanım önerisi, kombin, kumaş hissi) + teknik özellikler listesi. Admin panele "AI ile özgün açıklama üret" butonu (Claude API) — insan onayıyla kaydedilir.
- Ürün başlığında Bollmark şablonu: `{Marka} {Ürün Adı} {Renk}` (ör. "Koton Bisiklet Yaka Pamuklu Tişört Siyah").

**2.4 Kategori sayfaları için temiz URL**
Şu an: `/urunler?kategori=tisort&cinsiyet=Erkek`. Google parametreli URL'leri dizinler ama zayıf sinyal verir, canonical yok, `?goster=48`, `?sirala=` gibi varyasyonlar kopya sayfa üretir.
- Öneri: `/erkek`, `/kadin`, `/erkek/tisort`, `/kadin/elbise`, `/kategori/ayakkabi` gibi kalıcı yollar.
- Eski `?kategori=` URL'leri 301 ile yenilerine yönlensin.
- Her kategori sayfasında: özgün H1 ("Erkek Tişört Modelleri"), 80–150 kelimelik giriş metni (admin panelden düzenlenebilir alan), canonical, sayfa altı SSS.
- `?goster=`, `?sirala=` ve filtre parametreli tüm varyasyonlarda canonical → temiz kategori URL'si.

### 🟠 P1 — Kısa vadede (zengin sonuçlar & tıklama oranı)

**2.5 Ürün yapısal verisini (JSON-LD) Google Merchant standardına getir**
Eklenecek alanlar:
- `brand` (Brand modeli var), `sku`, `gtin13` (barkodlar Excel'den geliyor — büyük avantaj), `color`, `size`, `material`, `itemCondition: NewCondition`
- `image`: tek görsel yerine tüm galeri
- Varyantlar için `ProductGroup` + `hasVariant` (Google'ın giyim için önerdiği yapı, renk/beden varyantları)
- Fiyat: kampanya aktifse indirimli fiyat (şu an `priceCents` ham fiyat, ekranda görünenle uyuşmazsa Google uyarı verir)
- `aggregateRating` + `review` (ürün yorumu altyapısı zaten var)
- `shippingDetails` (kargo ücreti / süresi) ve `hasMerchantReturnPolicy` (iade süresi) — Google alışveriş sonuçlarında "Ücretsiz kargo / 14 gün iade" rozetleri için gerekli
- Sabit Unsplash yedek görseli kaldır; görsel yoksa `image` alanı hiç olmasın.

**2.6 BreadcrumbList şeması** — Ürün ve kategori sayfalarında. Arama sonucunda "bollmark.com › Erkek › Tişört" görünür.

**2.7 Organization + WebSite (+ SearchAction) + ClothingStore şeması** — Anasayfada. Logo, sosyal hesaplar (Instagram), fiziksel mağaza adresi/telefonu/çalışma saatleri. Sitelinks arama kutusu ve marka paneli için.

**2.8 Global metadata**
- `metadataBase: new URL(getSiteUrl())`
- Title şablonu: `{ template: "%s | Bollmark", default: "Bollmark | Modern Giyim" }` (sayfalarda elle " | Bollmark" yazmaya gerek kalmaz)
- Varsayılan OpenGraph (site adı, `tr_TR` locale, 1200×630 paylaşım görseli) + `twitter: summary_large_image`
- Ürün sayfası OG: `type: "product"` benzeri fiyat meta'ları (`product:price:amount`, `product:price:currency`) — WhatsApp/Instagram paylaşımlarında fiyat görünür
- Description: HTML'den arındırılmış metni 150–160 karakterde kelime sınırında kes
- Yasal sayfalar ve iletişim için `generateMetadata` + canonical

**2.9 Google Merchant Center (ücretsiz listelemeler)** — Giyimde en hızlı trafik kaynağı. Google Alışveriş sekmesinde ücretsiz görünürlük.
- `/feed/google.xml` (veya `.tsv`) ürün feed'i: id, title, description, link, image_link, price, sale_price, availability, brand, gtin, color, size, gender, age_group, item_group_id, google_product_category.
- Barkodlar (GTIN) sende olduğu için onay oranı yüksek olur.
- Aynı feed ile ileride Meta (Instagram Shopping) kataloğu da beslenebilir.

### 🟡 P2 — Orta vade (performans & tarama bütçesi)

**2.10 Görsel optimizasyonu (Core Web Vitals)**
Vercel Image kotası dolduğu için `unoptimized: true` yapıldı; tam boy görseller mobilde LCP'yi ciddi yavaşlatır (Google sıralama sinyali).
- Kalıcı çözüm: Yükleme anında `sharp` ile 400 / 800 / 1600 px WebP (ve AVIF) sürümlerini üretip Blob'a kaydet, `<img srcset>` ile kendimiz sunalım → Vercel dönüşüm kotasına hiç bağlı kalmaz.
- Alternatif: Cloudflare Images / Cloudflare önünde görsel dönüşümü.
- Ürün galerisinin ilk görseline `priority` / `fetchpriority="high"`, diğerlerine lazy.
- Her görselde anlamlı `alt`: "Koton siyah bisiklet yaka tişört – ön görünüm".

**2.11 Sitemap iyileştirmeleri**
- Kategori URL'leri temiz yollara geçince güncelle.
- Görsel sitemap (`images` alanı — Next.js destekliyor) → Google Görseller trafiği (giyimde önemli).
- Stoğu biten ama yayında olan ürünler kalsın; arşivlenen ürünler çıksın.
- 1000+ ürüne çıkılırsa `generateSitemaps` ile bölme.

**2.12 Stok & silinen ürün politikası**
- Stok yok → sayfa 200 kalsın, `OutOfStock` + "Stoğa gelince haber ver" (zaten var).
- Arşivlenen / silinen ürün → 404 yerine ilgili kategoriye 301.
- Slug değişirse eski slug → yeni slug 301 (bir `Redirect` tablosu).

**2.13 Alan adı tekilliği** — `www.bollmark.com` → `bollmark.com` 301 olduğunu doğrula (iyzico notu nedeniyle birincil alan ciplak domain).

**2.14 Yapay zeka arama motorları (bilinçli karar)**
robots.ts'te `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot` da engelli. Bunlar eğitim botu değil, *arama/yanıt* botları — ChatGPT/Perplexity'de "Bollmark"ın önerilmesini engeller.
- Öneri: `GPTBot`, `CCBot`, `Bytespider`, `meta-externalagent` gibi eğitim botları engelli kalsın; `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot` için yalnızca `/_next/image` ve görsel yolları kapatılıp sayfalar açılsın. (Görsel kota riski olmadan görünürlük.)

### 🟢 P3 — Uzun vade (içerik & yerel SEO)

**2.15 Google İşletme Profili** — Fiziksel mağaza için şart. "Yakınımdaki giyim mağazası" aramaları, harita, yorumlar. Siteye link + aynı NAP (ad-adres-telefon) footer'da.

**2.16 İçerik / blog (Stil Rehberi)** — "Erkek keten gömlek kombin önerileri", "Beden nasıl seçilir" gibi yazılar; kategori ve ürünlere iç link. Long-tail trafik.

**2.17 İç linkleme** — Ürün sayfasında "Diğer {Kategori} ürünleri", "Aynı markadan"; kategori sayfalarında alt kategori linkleri; footer'da ana kategoriler.

**2.18 Takip** — GA4 (veya Vercel Analytics) + e-ticaret olayları; GSC'de haftalık: dizinlenen sayfa sayısı, tıklama/gösterim, Core Web Vitals raporu.

---

## 3. Önerilen uygulama sırası

| Faz | İçerik | Tahmini süre |
|---|---|---|
| **Faz 1** | 2.1 erişim kontrolü (sen, panelden) + 2.8 global metadata + 2.6 breadcrumb + 2.7 Organization/Store şeması + yasal sayfa metadata | 1 oturum |
| **Faz 2** | 2.5 ürün JSON-LD (ProductGroup, GTIN, marka, yorum, kargo/iade) + ürün title/description şablonu | 1 oturum |
| **Faz 3** | 2.4 temiz kategori URL'leri + 301'ler + kategori açıklama alanı + canonical'lar + sitemap güncellemesi | 1–2 oturum |
| **Faz 4** | 2.9 Google Merchant feed | 1 oturum |
| **Faz 5** | 2.10 görsel ön-üretim (sharp + srcset) | 1–2 oturum |
| **Faz 6** | 2.3 AI destekli özgün açıklama butonu + 2.12 redirect tablosu | 1–2 oturum |

Senin yapacakların (kod dışı): Search Console + Bing kurulumu, Vercel Firewall'da verified bot izni, Google İşletme Profili, Merchant Center hesabı, kargo/iade politikasının netleşmesi (şemaya yazılacak).

---

## 4. Claude Code promptları

> Her promptun sonunda standart kurallarımız geçerli: yüklü skill'leri kullan, değişiklikleri önce localhost'ta göster, onayımdan sonra önce DEPLOY_STATUS.md'yi güncelle sonra yerel commit at, ben söylemeden push etme.

### Prompt — Faz 1: Global metadata + temel şemalar

```
SEO_TEKNIK_DENETIM_VE_PLAN.md dosyasını oku, Faz 1'i uygula (bölüm 2.6, 2.7, 2.8).

1. src/app/(site)/layout.tsx metadata'sını genişlet:
   - metadataBase: new URL(getSiteUrl())  (src/lib/site-url.ts)
   - title: { default: "Bollmark | Modern Giyim", template: "%s | Bollmark" }
   - openGraph: siteName "Bollmark", locale "tr_TR", type "website", varsayılan 1200x630 paylaşım görseli (public/og-default.jpg — yoksa mevcut hero görselinden sharp ile üret)
   - twitter: { card: "summary_large_image" }
   Sonra ürün/katalog sayfalarındaki elle yazılmış " | Bollmark" eklerini kaldır (şablon eklesin), çift "| Bollmark" oluşmadığını kontrol et.
2. Tüm dosyalardaki sabit BASE_URL = "https://bollmark.com" kullanımlarını getSiteUrl()'e çevir (robots.ts, sitemap.ts, ürün sayfası).
3. src/components/json-ld.tsx adında küçük bir yardımcı bileşen oluştur (script type="application/ld+json", "<" karakterini < olarak kaçır).
4. Anasayfaya Organization + WebSite (SearchAction: /urunler?ara={search_term_string}) + ClothingStore şeması ekle. Mağaza adres/telefon/çalışma saatleri/Instagram için src/lib/store-info.ts adlı tek bir sabit dosya oluştur; bilmediğin değerleri TODO olarak bırak ve bana listele, uydurma.
5. Ürün sayfasına ve kategori sayfasına BreadcrumbList şeması ekle (görsel breadcrumb ile aynı veriden üret).
6. src/app/(site)/sayfa/[slug]/page.tsx ve iletisim sayfasına generateMetadata ekle (title = sayfa başlığı, description = içeriğin ilk ~155 karakteri kelime sınırında, canonical).
7. Ürün description'ını 155-160 karakterde kelime sınırında kesen bir yardımcı yaz (src/lib/seo.ts), ürün ve katalog metadata'sında kullan.

Bitince: localhost'ta anasayfa, bir ürün, bir kategori ve bir yasal sayfanın <head> çıktısını göster; JSON-LD'leri Google Rich Results Test'e yapıştırabileceğim şekilde bana ver.
```

### Prompt — Faz 2: Ürün yapısal verisi (Merchant standardı)

```
SEO_TEKNIK_DENETIM_VE_PLAN.md bölüm 2.5'i uygula. src/app/(site)/urunler/[slug]/page.tsx içindeki productJsonLd'yi src/lib/seo.ts'te buildProductJsonLd(product, displayPrice, reviews) fonksiyonuna taşı ve genişlet:

- Birden fazla renk/beden varyantı varsa ProductGroup (productGroupID = ürün id/kod, variesBy: color/size) + hasVariant[] her varyant için Product: sku, gtin13 (varyant barkodu 13 haneli ve geçerliyse), color, size, image (o rengin galerisi), offers (fiyat, stok durumu, url ?renk= ile).
- Tek varyantlıysa düz Product.
- brand: { "@type": "Brand", name } (Brand modeli), material, itemCondition NewCondition, audience/gender (product.gender'dan: Erkek→male, Kadın→female, Unisex→unisex).
- image: sabit Unsplash FALLBACK_IMAGE'ı kaldır; tüm galeri görselleri, görsel yoksa alanı hiç ekleme. OpenGraph'ta da aynı.
- Fiyat: ekranda gösterilen fiyatla birebir aynı olmalı — resolveProductDisplayPrice ile otomatik kampanya indirimi uygulanıyorsa indirimli fiyatı yaz; priceValidUntil ekle (kampanya bitişi varsa o, yoksa +1 yıl).
- Ürün yorumları varsa aggregateRating + son 5 review (onaylanmış yorumlar).
- shippingDetails (Türkiye, TRY, kargo ücreti ve ücretsiz kargo eşiği src/lib/shipping.ts'ten, teslim süresi store-info.ts'ten) ve hasMerchantReturnPolicy (TR, gün sayısı yasal sayfalardaki iade süresinden — store-info.ts sabitine koy).
- Ürün title şablonu: "{Marka} {Ürün adı}" (marka adı zaten ürün adında geçiyorsa tekrar etme).
- OpenGraph'a product:price:amount / product:price:currency ve og:availability meta'larını other alanıyla ekle.

Bitince 3 farklı ürün (tek varyant, çok renkli, indirimli) için üretilen JSON-LD'yi bana göster ve schema.org doğrulayıcısında hata çıkmaması için kontrol et.
```

### Prompt — Faz 3: Temiz kategori URL'leri

```
SEO_TEKNIK_DENETIM_VE_PLAN.md bölüm 2.4 ve 2.11'i uygula. Önce bir plan yaz ve bana onaylat, sonra kodla.

Hedef:
- Cinsiyet sayfaları: /erkek, /kadin, /cocuk (mevcut cinsiyet değerlerine göre slug'la, Türkçe karakterleri sadeleştir)
- Cinsiyet+kategori: /erkek/tisort, /kadin/elbise
- Cinsiyetsiz kategori: /kategori/{slug} (ayakkabı, valiz vb.)
- Mevcut /urunler sayfasının render mantığını ortak bir bileşene çıkar, yeni rotalar onu kullansın; filtre çekmecesi, sıralama, "Daha fazla göster" aynen çalışsın.
- Eski /urunler?kategori=x&cinsiyet=y URL'leri next.config redirects veya proxy ile 301 → yeni URL. (Ara/filtre parametreli URL'ler korunarak taşınsın.)
- Mega menü, breadcrumb, footer, kategori kartları, sitemap yeni URL'leri kullansın.
- Her kategori sayfasında canonical = temiz URL (goster, sirala, filtre parametreleri canonical'a girmesin).
- Category modeline seoTitle, seoDescription ve introText (kısa giriş metni, sayfanın H1'inin altında gösterilsin) alanları ekle; admin kategori düzenleme sayfasından düzenlenebilsin. Boşsa otomatik: H1 "{Cinsiyet} {Kategori} Modelleri".
- Sitemap: yeni kategori URL'leri + ürünlere images alanı (ilk 5 görsel). Ürünü olmayan kategoriler sitemap'e girmesin.
- Rota çakışması kontrolü: /erkek gibi üst seviye rotalar mevcut rotalarla (hesap, sepet, odeme, sayfa, iletisim, urunler, admin, api) çakışmamalı; kategori slug'ı rezerve bir kelimeyse uyar.

Localhost'ta eski bir URL'nin 301 ile yönlendiğini curl -I ile göster.
```

### Prompt — Faz 4: Google Merchant feed

```
SEO_TEKNIK_DENETIM_VE_PLAN.md bölüm 2.9'u uygula. /feed/google.xml adında Google Merchant Center RSS 2.0 (g: namespace) ürün feed'i oluştur:
- Her varyant ayrı item: g:id (varyant sku/barkod), g:item_group_id (ürün), title ("{Marka} {Ürün} {Renk} {Beden}"), description (düz metin, 5000 karakter sınırı), link (?renk= ile), image_link + additional_image_link, price / sale_price (kampanya), availability, brand, gtin (geçerli EAN-13 ise, değilse identifier_exists=no), color, size, gender, age_group (adult/kids), condition new, google_product_category (Kategori modeline googleCategoryId alanı ekle, admin'den seçilebilsin; bilinmiyorsa "Apparel & Accessories" 166), shipping (TR, ücret).
- Görseli olmayan ya da yayında olmayan ürünleri atla.
- revalidate = 3600 (her istekte DB'yi yormasın, Vercel function kullanımını düşük tut).
- robots.ts'te /feed/ Googlebot'a açık olsun.
Bitince localhost'ta ilk 3 item'ı göster.
```

### Prompt — Faz 5: Görsel ön-üretim (Vercel Image kotasından bağımsız)

```
SEO_TEKNIK_DENETIM_VE_PLAN.md bölüm 2.10'u uygula. Önce plan yaz, onaylat.
Amaç: next.config'teki geçici images.unoptimized: true'yu kalıcı olarak gereksiz kılmak, mobil LCP'yi düzeltmek.
- Görsel yüklenirken (admin upload, Excel/Koton görsel çekme, gorsel-ekle/yenile) sharp ile 400, 800, 1600 px WebP sürümleri üret, Blob'a {ad}-400.webp vb. olarak kaydet. Veritabanı şemasına dokunmadan URL kalıbından türetilebilir olsun.
- Ürün kartı ve galeride next/image yerine (veya unoptimized loader ile) srcset + sizes kullanan bir <ResponsiveImage> bileşeni; ilk ekran görseli fetchPriority="high", diğerleri loading="lazy". width/height verilsin (CLS olmasın).
- Mevcut görseller için bir kerelik scripts/gorsel-surumleri-uret.ts backfill scripti (kesintiye dayanıklı, kaldığı yerden devam etsin, önce --dry-run).
- alt metinleri: "{Marka} {Ürün adı} {Renk} - {n}. görsel".
- Bitince Lighthouse mobil skorunu (öncesi/sonrası) localhost production build'de ölç ve bana raporla.
```

### Prompt — Robots: AI arama botları (küçük iş, istersen Faz 1'e eklenir)

```
src/app/robots.ts'i güncelle: GPTBot, CCBot, Bytespider, meta-externalagent, Google-Extended, Applebot-Extended, anthropic-ai, ClaudeBot, Amazonbot tamamen engelli kalsın. OAI-SearchBot, ChatGPT-User ve PerplexityBot için sayfalar açık olsun ama /_next/image, /api/, /admin, /hesap, /odeme, /sepet ve filtre parametreleri kapalı olsun. Yorumdaki gerekçeyi güncelle.
```
