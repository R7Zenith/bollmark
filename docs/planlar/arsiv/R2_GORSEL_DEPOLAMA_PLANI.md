# Ürün Görselleri: Vercel Blob → Cloudflare R2 (yeni yüklemeler)

**Tarih:** 03.10.2026
**Durum:** Uygulandı (2026-10-04)

## 1. Neden

- Vercel Blob Hobby: son 30 günde **2.000 yazma (Advanced Operation)** hakkı var. 3 Ekim'de kullanım **1.603 / 2.000**.
- Bu sınır aşılırsa Blob **30 gün kilitlenir**. Sitedeki bütün fotoğraflar Blob'da durduğu için bu, fotoğrafların kırılması demek.
- Sayaç her yeni fotoğrafla doluyor (admin yükleme + Koton/Slazenger otomatik çekme). Katalog büyüdükçe her ay sınıra dayanılacak.
- Cloudflare R2 ücretsiz planı: ayda **1.000.000 yazma**, 10 GB depolama, **ücretsiz veri çıkışı**. Silme ücretsiz. Bugünkü depo yaklaşık 1.085 görsel / ~80 MB.
- DNS zaten Cloudflare'de, yani `img.bollmark.com` gibi bir özel alan adı tek tıkla bağlanabilir.

## 2. Yaklaşım: sadece YENİ görseller R2'ye

- Yeni yüklenen her görsel R2'ye gider ve `https://img.bollmark.com/...` adresiyle kaydedilir.
- **Eski görseller Blob'da kalır, taşınmaz.** Ziyaretçilerin görüntülemesi Advanced Operation harcamaz. Taşıma yapılmadığı için kırık görsel riski de yok.
- Silme işlemi URL'e bakar: Blob URL'i ise Vercel `del()` (ücretsiz), R2 URL'i ise R2 DELETE (ücretsiz).
- R2 ortam değişkenleri tanımlı değilse kod eskisi gibi Vercel Blob'a yazar. Bu güvenlik ağı sayesinde env eksikliği yüzünden yükleme hiçbir zaman tamamen kırılmaz.
- Eski Blob görsellerinin R2'ye taşınması ileride ayrı ve isteğe bağlı bir iş olabilir. Bu planın kapsamında değil.

## 3. Kod incelemesi: Blob'a dokunan yerler

| Dosya | Ne yapıyor | Değişiklik |
|---|---|---|
| `src/app/api/admin/upload/route.ts` | Admin panel fotoğraf yükleme, `put()` | Yeni `uploadImage()`'a geçer |
| `src/lib/koton-images.ts` → `reuploadImageToBlob()` | Koton/Slazenger ve "linkle ekle" görsellerini indirip `put()` | Yeni `uploadImage()`'a geçer. Slazenger de bunu kullandığı için otomatik kapsanır |
| `src/lib/blob.ts` → `deleteBlobUrls()` | Kullanılmayan görselleri siler (tekli/toplu ürün silme, upload DELETE) | Blob + R2 URL'lerini ayırıp ikisini de siler. Fonksiyon adı aynı kalır, çağıran yerler değişmez |
| `next.config.mjs` → `images.remotePatterns` | İzinli görsel host'ları | `img.bollmark.com` eklenir |
| `scripts/temizle-yetim-blob.ts`, `scripts/sikistir-mevcut-gorseller.ts` | Tek seferlik Blob scriptleri | **Dokunulmaz.** R2 URL'leri Blob listesinde olmadığı için yetim sayılmaz. Not: bu scriptlerin `list()` çağrıları da Advanced Operation harcar, gereksiz çalıştırılmamalı |

Proxy/CSP içinde `img-src` kısıtı yok. Bileşenler URL'i olduğu gibi kullanıyor, değişiklik gerekmiyor.

## 4. Cloudflare tarafı (kullanıcı yapacak, ~10 dk)

1. Cloudflare panel → **R2 Object Storage** → R2'yi etkinleştir. Ücretsiz planda bile bir ödeme yöntemi istenebilir. Ücretsiz limitler içinde ücret çıkmaz.
2. **Create bucket**:
   - ad: `bollmark-images`
   - location: Automatic. İstersen "Eastern Europe (EEUR)" ipucu seçilebilir.
   - storage class: **Standard**. Ücretsiz kota sadece Standard sınıfında geçerli.
3. Bucket → **Settings → Custom Domains → Connect Domain** → `img.bollmark.com` (DNS kaydını Cloudflare otomatik ekler, durum "Active" olana kadar bekle).
   - `r2.dev` herkese açık adresini **açma**. Cloudflare bunu sadece geliştirme için öneriyor, hız sınırı var.
4. R2 ana sayfa → **Manage R2 API Tokens → Create API token**:
   - İzin: **Object Read & Write**
   - Kapsam: sadece `bollmark-images` bucket'ı
   - Oluşunca **Access Key ID**, **Secret Access Key** ve **Account ID**'yi kopyala. Secret sadece bir kez gösterilir.
5. Bu değerleri **kendin** proje kökündeki `.env.local` dosyasına ekle. Sohbete yapıştırma.
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=bollmark-images
   R2_PUBLIC_BASE_URL=https://img.bollmark.com
   ```
   Vercel'e ekleme işini Claude Code yapacak (prompt'ta var).

## 5. Uygulama detayı (Claude Code)

### 5.1 Paket
- `aws4fetch` ekle (~10 KB, Cloudflare'in R2 için önerdiği imzalı fetch istemcisi).
- **`@aws-sdk/client-s3` KULLANMA.** Çok büyük bir paket ve daha önce Vercel "Functions Storage" kotasıyla uğraşıldı (bkz. DEPLOY_STATUS 22 Eyl analizi).

### 5.2 Yeni `src/lib/image-storage.ts`
- `uploadImage({ folder, nameHint, buffer, contentType, ext }): Promise<string>`
  - **R2 env'leri tamamsa:**
    - anahtar: `${folder}/${asciiSlug(nameHint)}-${randomId(8)}.${ext}`
    - `asciiSlug` Türkçe karakterleri ve boşlukları temizler. Örnek: "DİLVİN 1267-SİYAH-0" → `dilvin-1267-siyah-0`. Böylece URL encode sorunu çıkmaz.
    - `PUT https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`
    - header'lar: `Content-Type`, `Cache-Control: public, max-age=31536000, immutable`
    - Yanıt `ok` değilse hata fırlat.
    - Döndürür: `${R2_PUBLIC_BASE_URL}/${key}`
  - **R2 env'leri eksikse:** mevcut davranış, yani `@vercel/blob` `put(..., { access: "public", addRandomSuffix: true })` ve `blob.url`. Bir kez `console.warn` ile "R2 tanımlı değil, Vercel Blob'a yazılıyor" logla.
- `isR2Url(url)`: hostname, `R2_PUBLIC_BASE_URL`'in hostname'i ile aynı mı.

### 5.3 `src/lib/blob.ts` → `deleteBlobUrls(urls)`
- Mevcut Blob filtresi aynen kalır (`del()`).
- Ek olarak R2 URL'lerini ayıkla, her biri için anahtarı (path) çıkar ve imzalı `DELETE` at. `Promise.allSettled` kullan.
- Hatalar mevcut davranış gibi yutulup loglanır. Silme asla asıl işlemi engellememeli.
- İki tür URL de olmayanlara (Unsplash vb.) dokunulmaz.

### 5.4 Çağıranlar
- `api/admin/upload/route.ts`: `put(...)` yerine `uploadImage({ folder: "admin-upload", ... })`.
- `koton-images.ts` → `reuploadImageToBlob`: `put(...)` yerine `uploadImage({ folder, nameHint: pathHint, ... })`. Fonksiyon adı ve imzası aynı kalır, Slazenger çağrıları değişmez.
- **Güncelleme (04.10.2026):** Quzu için eklenen `src/lib/link-images.ts` de `reuploadImageToBlob`'u kullanıyor (`link-import/` klasörü). Ayrı bir değişiklik gerekmez, otomatik kapsanır. Kodda `@vercel/blob` `put()` yalnızca bu iki yerde (`admin/upload/route.ts`, `koton-images.ts`) olmalı. Uygulamadan önce `grep -rn "@vercel/blob" src scripts` ile doğrula, yeni bir yer çıkarsa onu da `uploadImage`'a geçir.
- **Kalite aynı kalmalı:** `compressImage()` (1600px, WebP q78) adımı `uploadImage`'dan ÖNCE aynen çalışmaya devam etmeli. Sıkıştırma ayarlarına, `sharp` kullanımına ve `next.config.mjs` images ayarlarına (`unoptimized` dahil) dokunma. Sadece dosyanın yazıldığı depo değişiyor.

### 5.5 `next.config.mjs`
- `remotePatterns`'a `{ protocol: "https", hostname: "img.bollmark.com" }` ekle.
- `unoptimized: true` olduğu için şu an zorunlu değil, ama ileride kapatılırsa görseller kırılmasın.

### 5.6 Env
- `.env.example`'a 5 değişkeni (değersiz) ve kısa açıklamayı ekle.
- Vercel'e production + preview için `vercel env add` ile ekle. Değerleri `.env.local`'den oku, **çıktıya/loga secret yazdırma**.

## 6. Test (localhost)

1. `npm run dev`. Admin → bir ürünü aç → bir fotoğraf yükle.
   - Dönen URL `https://img.bollmark.com/admin-upload/...webp` olmalı.
   - Görsel tarayıcıda açılmalı, yanıtta `cache-control: public, max-age=31536000, immutable` header'ı olmalı.
2. Kaydetmeden fotoğrafı kaldır (upload DELETE). Aynı URL birkaç saniye sonra 404 vermeli.
3. Test için mevcut bir **taslak** ürün kullan, yayındaki ürünlere dokunma.
   - Koton/Slazenger ürününde "linkle ekle" ile tek bir görsel ekle. URL R2 olmalı, fotoğraf görünmeli.
   - Sonra o görseli ürün kaydında kaldırıp kaydet. R2'den silinmeli.
4. **Güvenlik ağı testi:** `.env.local`'de `R2_BUCKET`'ı geçici olarak boşalt ve dev'i yeniden başlat. Yükleme Vercel Blob'a düşmeli ve çalışmalı. Sonra geri al.
   - Bu test 1 Blob yazma işlemi harcar, kabul edilebilir.
5. Eski (Blob'daki) ürün fotoğrafları anasayfa, katalog ve ürün detayda aynen görünmeli.
6. `npx tsc --noEmit`, `npm run lint`, `npm run build` temiz olmalı.
7. Vercel'de 5 env'in production + preview'da olduğunu `vercel env ls` ile doğrula. Değerleri yazdırma.

## 7. Canlıya alma

- Kullanıcı localhost'ta onaylayınca: DEPLOY_STATUS güncelle, sonra yerel commit at. **Push kullanıcı söyleyince.**
- Push sonrası canlıda bir taslak ürüne 1 fotoğraf yükleyip URL'in `img.bollmark.com` olduğunu kontrol et. Ardından Vercel Usage'da Blob Advanced Operations'ın artmadığını kontrol et.
- Canlıya kadar (ve sonrasında) Vercel panelinde Blob deposunu açıp gezinme. O da Advanced Operation sayılıyor.
- **Önemli:** Bu değişiklik **canlıya push edilene kadar** Vercel'deki site hâlâ Blob'a yazar. Localhost ise `.env.local`'de R2 bilgileri olduğu anda R2'ye yazar. Yani Quzu fotoğrafları localhost'tan eklenirse, commit/push beklemeden R2'ye gider (localhost kodu da yeni koddur).

## 8. Claude Code prompt'u (kopyala-yapıştır)

```
Bollmark projesinde R2_GORSEL_DEPOLAMA_PLANI.md dosyasını oku ve uygula. Yüklü skill'leri (özellikle karpathy-guidelines) kullan, değişiklikleri küçük ve cerrahi tut.

Önemli kurallar:
- Yeni görseller Cloudflare R2'ye gidecek, ESKİ Blob görsellerine dokunma, taşıma yapma.
- @aws-sdk/client-s3 değil, aws4fetch kullan (function storage boyutu).
- R2 env'leri eksikse eski Vercel Blob davranışına düş (güvenlik ağı).
- R2 bilgileri .env.local'de hazır. Hiçbir secret'ı terminal çıktısına, loga, commit'e ya da DEPLOY_STATUS'a yazma. .env.local'in git'e girmediğini kontrol et.
- Vercel'e 5 R2 env'ini production + preview için vercel env add ile ekle (değerleri .env.local'den oku).
- Test sırasında yayındaki ürünlere fotoğraf ekleme/silme yapma, sadece taslak bir ürün kullan. Vercel Blob'a gereksiz yazma yapma (kalan hak az: ~400). list() içeren scriptleri çalıştırma.

Ek: src/lib/link-images.ts (Quzu linkle ekle) reuploadImageToBlob üzerinden otomatik kapsanıyor; başka @vercel/blob put() kalmadığını grep ile doğrula. compressImage (1600px WebP q78) ve next.config images ayarlarına DOKUNMA, görsel kalitesi birebir aynı kalmalı. Testte yüklenen R2 görselinin boyutunun/çözünürlüğünün eski bir Blob görseliyle aynı formatta (webp, max 1600px) olduğunu doğrula.

Planın 6. bölümündeki testleri localhost'ta yap, sonuçları bana raporla. Bitince DEPLOY_STATUS.md'ye not düş. Ben localhost'ta onaylamadan commit atma; onayımdan sonra önce DEPLOY_STATUS.md'yi güncelle, sonra yerel commit at. Ben söylemeden push ETME.
```
