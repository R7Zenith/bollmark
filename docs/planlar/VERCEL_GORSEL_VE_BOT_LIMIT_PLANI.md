# Vercel Görsel Dönüşümü + Bot Trafiği Limit Planı

## Ne oldu? (30 Eylül 2026 incelemesi)
- Vercel'den iki uyarı geldi: **Image Transformations 5.000/5.000 doldu** (6K) ve **Fluid Active CPU %75** (3sa 1dk / 4sa).
- Firewall → Traffic (son 24 saat, ~14 bin istek) incelendi:
  - **10,2 bini Facebook, Inc.** — User-Agent `meta-externalagent/1.1` (Meta'nın yapay zekâ eğitim tarayıcısı, link önizleme botu DEĞİL).
  - En çok istenen yol **`/_next/image` (6,5 bin)** → bot ürün sayfalarını gezip her fotoğrafın birçok boyutunu indirdi.
  - Google Cloud / Azure IP'lerinden gelen tarayıcıları Vercel DDoS koruması zaten engelledi (~2,1 bin denied).
- **Yapılan (dashboard):** Firewall → Bot Management → **AI Bots = Deny** açıldı (30 Eyl 00:37). Googlebot/Bingbot etkilenmiyor.
  Bot Protection (Challenge) bilerek AÇILMADI — iyzico callback/webhook, `/api/vega`, cron istekleri "tarayıcı olmayan" istek sayılıp takılabilir.
- Kullanım dönemi 30 Eylül ~14:00'te sıfırlanıyor.

## Koddaki kök nedenler (doğrulandı)
1. **`next.config.mjs` → `images` ayarı yok.** Next varsayılanı 8 `deviceSizes` (640…3840) + `imageSizes` kullanıyor; her `(görsel × genişlik × kalite × format)` ayrı bir dönüşüm sayılıyor.
2. **`minimumCacheTTL` varsayılan (Next 16'da 4 saat).** Blob URL'leri `addRandomSuffix` ile değişmez olduğu halde, önbellek 4 saatte bir düşüp aynı görsel **tekrar dönüştürülüyor** ve tekrar sayılıyor.
3. **`src/components/product-viewer.tsx` ~492. satır** — masaüstü 2 sütunlu galeri `<Image fill>` **`sizes` prop'u yok** → tarayıcı 100vw varsayıp 1920/2048/3840 gibi dev genişlikler istiyor (hem gereksiz dönüşüm hem büyük dosya).
4. Blob'daki görseller yüklenirken zaten 1600px WebP q78'e sıkıştırılıyor (`lib/image-compress.ts`), yani 1600'ün üstündeki genişlikler tamamen israf.
5. **`src/app/robots.ts`** yapay zekâ botlarını ayırt etmiyor; filtre/renk query parametreli URL'ler (`?renk=`, `?beden=`, `?fiyat-min=` …) sınırsız kombinasyonla taranabiliyor. Ürün sayfası `searchParams` (`?renk=`) okuduğu için dinamik → her bot isteği sunucuda render = CPU.

## Çözüm
### A) `next.config.mjs` → `images`
```js
images: {
  remotePatterns: [ /* mevcut iki satır aynen kalsın */ ],
  // Blob'daki kaynaklar zaten max 1600px; ustu israf.
  deviceSizes: [640, 828, 1200, 1600],
  imageSizes: [256, 384],
  qualities: [75],
  formats: ["image/webp"],
  // Blob URL'leri addRandomSuffix ile degismez -> 31 gun onbellekte kalsin,
  // ayni gorsel tekrar tekrar donusturulup sayaci doldurmasin.
  minimumCacheTTL: 2678400
}
```
Beklenen etki: görsel başına olası genişlik ~16'dan ~6'ya iner; önbellek süresi 4 saatten 31 güne çıktığı için aynı görsel ay içinde tekrar sayılmaz.

### B) Eksik / aşırı geniş `sizes` değerleri
- `product-viewer.tsx` masaüstü grid `<Image>` (~492): `sizes="(min-width: 768px) 30vw, 100vw"` ekle (galeri sayfanın ~sol yarısında 2 sütun; Claude Code gerçek düzene göre oranı doğrulasın).
- `product-viewer.tsx` mobil karusel (~434) `sizes="100vw"`: karusel yalnızca mobilde görünüyorsa (`md:hidden`) `100vw` doğru, olduğu gibi kalır.
- Diğer `next/image` kullanımları (`product-card.tsx`, `site-header.tsx`, `app/(site)/page.tsx`) zaten `sizes` içeriyor; hero (`/hero-model.jpg`, `priority`, `sizes` yok) için `sizes="100vw"` ekle.
- Lightbox varsa ve `<Image>` kullanıyorsa `sizes` kontrol et.

### C) `src/app/robots.ts`
- Mevcut `*` kuralı korunur, disallow listesine eklenir: `/api/`, `/sepet`, `/*?*renk=`, `/*?*beden=`, `/*?*fiyat-min=`, `/*?*fiyat-max=`, `/*?*stok=`, `/*?*indirimli=`, `/*?*ara=`.
  (`?kategori=` sitemap'te olduğu için ENGELLENMEZ.)
- Yapay zekâ botları için ayrı kural (tümüne `disallow: "/"`): `meta-externalagent`, `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `anthropic-ai`, `CCBot`, `Google-Extended`, `PerplexityBot`, `Bytespider`, `Amazonbot`, `Applebot-Extended`.
  Dokunulmayacak: `Googlebot`, `Bingbot`, `facebookexternalhit` (Instagram/Facebook link önizlemesi), `Twitterbot`, `WhatsApp`.
- Firewall zaten engelliyor; robots.txt ikinci katman (kibar botlar hiç gelmez).

### D) Ürün sayfası canonical
- `urunler/[slug]/page.tsx` `generateMetadata` içinde `alternates.canonical` = `/urunler/<slug>` (query'siz) yoksa ekle → `?renk=` varyasyonları ayrı sayfa gibi indekslenmesin.

### E) GEÇİCİ MOD — Görsel optimizasyonu kapalı (30 Eyl 2026 güncellendi)
**Mevcut durum:** A–D uygulandı ve push edildi. Aynı gece (00:50) ürün fotoğrafları canlıda bozuldu: kota dolu olduğu için
`/_next/image` önbellekte olmayan her genişlikte **402** dönüyordu (yeni deviceSizes/sizes, daha önce dönüştürülmemiş genişlikler
istedi). Claude Code `images.unoptimized: true` ekledi — şu an canlıda böyle çalışıyor.

**Düzeltme (önceki bilgi yanlıştı):** Hobby planında sayaçlar 30 Eylül 14:00'te **sıfırlanmıyor**. Fatura dönemi yok, **kayan
30 günlük pencere** var (Vercel docs: "Hobby billing cycle"). 30 Eyl 21:30 itibarıyla pencere 31 Ağu – 30 Eyl; Transformations
5.982/5.000. 29 Eylül bot dalgası pencereden ~**28–29 Ekim**'de çıkacak. O tarihe kadar `unoptimized: true` KALDIRILMAMALI.
Kullanıcı Pro yerine bu geçici modla devam etmeyi seçti.

Yapılacaklar:
1. `next.config.mjs` → `unoptimized: true` aynen kalsın; yanındaki yorumu güncelle:
   `// GECICI (30 Eyl 2026): Hobby sayaclari kayan 30 gunluk pencere; 29 Eyl bot dalgasi ~29 Ekim'de duser.`
   `// O tarihten sonra Usage > Image Transformations 5.000'in altina inince (veya Pro'ya gecilince) bu satiri kaldir.`
2. **`public/` görsellerini kalıcı olarak sıkıştır** (unoptimized modda olduğu gibi indiriliyorlar, çok büyükler):
   `hero-model.jpg` 1,4 MB, `menu/kadin-bluz.webp` 1,5 MB, `menu/erkek-gomlek.webp` 880 KB, `menu/erkek-ceket.webp` 750 KB,
   `anasayfa/lookbook-genis.jpg` 710 KB, `catalog-banner.jpg` 460 KB, `anasayfa/editoryal-*.jpg`, `anasayfa/koleksiyon-*.jpg`.
   - Orijinalleri önce `gorsel-kaynak/` klasörüne (public DIŞI, repo içinde) kopyala.
   - `sharp` ile: tam genişlik görseller (hero, lookbook, catalog-banner) uzun kenar max 1920px; menü/koleksiyon/editoryal
     kartları max 1000px; WebP kalite ~78. Hedef: her dosya ≤ 250 KB. Uzantı değişirse koddaki TÜM referansları güncelle
     (`outputFileTracingExcludes` listesi, `lib/mega-menu-cards.ts`, `lib/catalog-banner.ts`, `app/(site)/page.tsx` vb.).
   - Script `scripts/` altına konsun (ileride yeni public görsel eklenince tekrar çalıştırılabilsin).
3. DEPLOY_STATUS.md'deki "kota sıfırlanınca (~30 Eyl 14:00) unoptimized satırı kaldırılacak" notunu düzelt: tarih ~29 Ekim,
   koşul "Usage'da Image Transformations 5.000'in altına indiğinde veya Pro'ya geçilince".

**Yan etkiler (izlenecek):**
- Ürün fotoğrafları Blob'dan doğrudan (1600px WebP, ~60–190 KB) iner → **Blob Data Transfer** artar (Hobby 10 GB/30 gün,
  30 Eyl'de ~2,9 GB). Haftada bir Usage sayfasından kontrol edilmeli.
- Mobilde katalog sayfası biraz daha ağır açılır.
- Fotoğraf yükleme etkilenmez; ama her yükleme (ve Excel aktarımında otomatik çekilen her görsel) 1 Blob "Advanced
  Operation" harcar — Hobby 2.000/30 gün, 30 Eyl'de 1.376. Bu da kayan pencere; toplu yüklemeleri yaymak iyi olur.

**Geri alma (~29 Ekim sonrası, sayaç 5.000'in altındaysa, ya da Pro'ya geçince):** `unoptimized: true` satırını sil → deploy.
A bölümündeki deviceSizes/minimumCacheTTL ayarları o zaman devreye girer.

### Kapsam dışı (şimdilik)
- Ürün sayfasını ISR/statik yapmak (renk seçimini istemciye taşımak) CPU'yu çok düşürür ama büyük bir refactor; bot engeli sonrası CPU grafiği izlenip gerekirse ayrı plan yapılacak.
- Yükleme sırasında ayrıca küçük (ör. 600px) bir kopya üretip katalogda onu kullanmak: unoptimized moddaki mobil yükünü azaltır ama veri modeli değişikliği gerektirir; geçici mod uzarsa değerlendirilecek.
- Vercel Bot Protection (Challenge) — iyzico/Vega/cron için bypass kuralları yazılmadan açılmayacak.

---

## Claude Code Prompt'u (kopyala-yapıştır)

```
Bollmark projesindeyiz. Önce proje kökündeki VERCEL_GORSEL_VE_BOT_LIMIT_PLANI.md dosyasını baştan sona oku, sonra yüklü skill'leri (özellikle karpathy-guidelines) kullanarak planı uygula (A–D tamamlandıysa yalnızca E bölümünü ve aşağıdaki 5. maddeyi yap). Sadece planda yazan değişiklikleri yap, başka dosyaya/davranışa dokunma.

Bağlam: Vercel Hobby planında Image Transformations limiti (5.000) doldu, Fluid Active CPU %75'te. Sebep Meta'nın yapay zekâ botu (meta-externalagent) — /_next/image'e 6,5 bin istek attı. Dashboard'da AI Bots=Deny zaten açıldı; şimdi kod tarafında dönüşüm sayısını ve bot yükünü azaltıyoruz.

Yapılacaklar:
1) next.config.mjs → images: mevcut remotePatterns'i koru; deviceSizes [640, 828, 1200, 1600], imageSizes [256, 384], qualities [75], formats ["image/webp"], minimumCacheTTL 2678400 ekle. Next 16.3.3 dokümantasyonuna göre alan adlarını/geçerliliğini doğrula; 'quality' prop'u kullanan <Image> varsa ve qualities listesinde değilse build hatası vereceği için kontrol et.
2) src/components/product-viewer.tsx: masaüstü 2 sütunlu galeri <Image fill> (~492. satır) sizes prop'u yok — gerçek yerleşime uygun bir sizes ekle (ör. "(min-width: 768px) 30vw, 100vw"; galerinin ekranda kapladığı gerçek genişliği ölçüp oranı ayarla). Mobil karusel ve lightbox <Image>'lerini de kontrol et. app/(site)/page.tsx hero <Image src="/hero-model.jpg"> için sizes="100vw" ekle. Projedeki tüm next/image kullanımlarını tara, fill olup sizes'ı olmayan kalmasın.
3) src/app/robots.ts: plandaki C bölümündeki gibi iki kural grubu yap: (a) "*" için mevcut disallow'lar + /api/, /sepet ve filtre query parametreli URL desenleri (renk, beden, fiyat-min, fiyat-max, stok, indirimli, ara). ?kategori= ENGELLENMEYECEK. (b) Plandaki yapay zekâ bot listesi için disallow "/". Googlebot, Bingbot, facebookexternalhit, Twitterbot, WhatsApp'a dokunma. Sitemap satırı aynen kalsın.
4) src/app/(site)/urunler/[slug]/page.tsx generateMetadata: alternates.canonical query'siz ürün URL'i olacak şekilde ayarla (zaten varsa dokunma).
5) GEÇİCİ MOD (plandaki E bölümü) — NOT: A–D ve `unoptimized: true` zaten uygulandı/push edildi, onları tekrar yapma. Sadece E bölümündeki 3 maddeyi yap: next.config.mjs'teki unoptimized yorumunu güncelle (satırı SİLME), public/ görsellerini scripts/ altına koyacağın sharp script'iyle sıkıştır (orijinaller önce gorsel-kaynak/ klasörüne; uzantı değişirse tüm referansları güncelle), DEPLOY_STATUS.md'deki "~30 Eyl 14:00" notunu ~29 Ekim olarak düzelt.

Test (localhost):
- npm run build hatasız geçmeli; npm run dev ile anasayfa, /urunler, bir ürün sayfası (mobil ve masaüstü genişlikte), sepet açılır çekmecesi, arama önerileri ve admin ürün düzenleme sayfasındaki görseller düzgün görünmeli, bulanık/pikselli görsel olmamalı.
- (A–D için; unoptimized açıkken geçerli değil) Tarayıcı Network sekmesinde /_next/image isteklerinde w= değeri 1600'ü geçmemeli, q=75 olmalı; masaüstü ürün galerisinde 1920/2048/3840 genişlik istenmemeli.
- http://localhost:3000/robots.txt çıktısını kontrol et: AI botları bloklu, Googlebot serbest, /urunler?kategori=... serbest.
- Bir ürün sayfasının <head>'inde canonical link query'siz olmalı.
- unoptimized açıkken (npm run build && npm run start ile) Network sekmesinde /_next/image isteği HİÇ olmamalı; ürün fotoğrafları doğrudan *.public.blob.vercel-storage.com'dan, public görseller /hero-model... gibi doğrudan yoldan gelmeli. Anasayfa hero, lookbook, mega menü kartları ve katalog banner'ı sıkıştırma sonrası görsel olarak bozulmamış olmalı; her dosyanın yeni boyutunu listele.
- Admin'den yeni bir ürün fotoğrafı yükle (test ürünü üzerinde): yükleme çalışmalı ve fotoğraf sitede görünmeli.

Bitince:
- DEPLOY_STATUS.md'ye bugünün tarihiyle kısa bir not düş (ne değişti, neden: meta-externalagent botu + görsel limiti, dashboard'da AI Bots=Deny açıldığı bilgisi dahil).
- Bana localhost'ta neyi kontrol edeceğimi özetle ve onayımı bekle. Onaylayınca "yerel commit at" dediğimde önce DEPLOY_STATUS.md'yi güncelle, sonra yerel commit at. Ben söylemeden push etme.
```
