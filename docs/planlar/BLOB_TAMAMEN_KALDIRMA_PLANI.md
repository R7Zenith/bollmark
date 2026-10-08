# Vercel Blob'dan tamamen çıkış: eski görselleri R2'ye taşıma

**Tarih:** 7 Ekim 2026
**Durum:** Devam ediyor: 552 / 1.344 görsel taşındı (2026-10-08), Faz 3 kod temizliği bekliyor
**Önceki iş:** R2_GORSEL_DEPOLAMA_PLANI.md. Yeni görseller 4 Ekim'den beri R2'ye gidiyor ve canlıda.

## 1. Neden

- Eski ürün görselleri (~1.085 dosya, ~80 MB) hâlâ Vercel Blob'da duruyor. Ziyaretçi bir görseli açtığında Vercel önbelleğinde yoksa Blob "Simple Operations" sayacı 1 artıyor. Hobby limiti 10.000 / 30 gün. 4 Ekim'deki değer 8.100'dü.
- Bu limit aşılırsa Blob 30 gün kilitlenir ve sitedeki bütün eski fotoğraflar kırılır. Yazma sayacı (Advanced) için de aynı risk var.
- R2'de okuma ücretsiz ve pratikte limitsiz, veri çıkışı da ücretsiz. Taşıma bitince iki Blob sayacı da devreden çıkar.

## 2. İlkeler

- **Kalite değişmez:** Dosyalar **byte byte** kopyalanır. `sharp` veya `compressImage` çalışmaz, yeniden sıkıştırma ya da boyutlandırma yapılmaz. Content-Type aynı kalır.
- **Eşleşmeler bozulmaz:** Veritabanında sadece `url` (ve görsel adresi taşıyan diğer) alanlar güncellenir. Satırlar silinip yeniden yaratılmaz. `productId`, `valueId` (renk), `position`, `isCover`, `alt` değerlerine dokunulmaz.
- **Geri alınabilir:** Blob'daki dosyalar kullanıcı onaylayana kadar **silinmez**. Her DB değişikliği öncesi yedek dosyası yazılır, tek komutla eski adreslere dönülebilir.
- **Blob sayaçlarını boşa harcama:** Blob `list()` KULLANILMAZ (Advanced Operation). Liste veritabanından çıkarılır. Her dosya Blob'dan **en fazla bir kez** indirilir. R2'de zaten varsa tekrar indirilmez.
- **DB ortak:** Localhost'tan yapılan DB güncellemesi canlı siteye **anında** yansır. Bu yüzden önce küçük bir denemeyle başlanır.

## 3. Faz 0 — Envanter (salt okuma, Blob'a hiç istek atılmaz)

Script `scripts/blob-to-r2.ts`, `--envanter` modu:

1. Veritabanında hostu `*.public.blob.vercel-storage.com` olan adresler tablo ve alan bazında sayılır:
   - `ProductImage.url`
   - `ProductOptionImage.url`
   - `Category.imageUrl`
   - `Brand.logoUrl`
2. **Gözden kaçan alan kalmasın diye:** PostgreSQL'de `information_schema.columns` üzerinden tüm `text`/`varchar` kolonları gezilip `LIKE '%blob.vercel-storage.com%'` ile taranır. Ürün açıklaması (HTML), yasal sayfalar, mağaza ayarları, JSON tutan kolonlar vb. bu taramayla yakalanır. Bulunan her tablo/kolon raporlanır.
3. Kod ve dosyalar taranır: `grep -rn "blob.vercel-storage" src scripts public next.config.mjs`.
4. Rapor:
   - **benzersiz** Blob URL sayısı. Bu, indirmenin harcayacağı en fazla Simple Operation sayısıdır.
   - tablo/kolon bazında satır sayıları
   - koddaki sabit adresler

   Rapor DEPLOY_STATUS'a yazılır. **Hiçbir yazma yapılmaz.**

## 4. Faz 1 — R2'ye kopyalama (`--kopyala`)

- Hedef anahtar: `blob/<Blob URL'inin pathname'i>`. Örnek: `https://xxx.public.blob.vercel-storage.com/admin-upload/foo-AbC123.webp` → `https://img.bollmark.com/blob/admin-upload/foo-AbC123.webp`.
  - Blob adresleri zaten rastgele ekli ve benzersiz olduğu için çakışma olmaz.
  - Eşleme deterministik olduğu için script tekrar çalıştırılabilir.
  - Pathname'de Türkçe karakter ya da `%` kodlaması varsa anahtar decode edilmiş haliyle değil, **URL'deki haliyle** tutarlı şekilde kullanılır. Yeni URL tarayıcıda açılabiliyor olmalı (testte doğrula).
- Her benzersiz URL için sırayla şu adımlar uygulanır:
  1. R2'de anahtar var mı diye `HEAD` at. Varsa ve boyutu kayıtlıysa **atla** (Blob'a istek atılmaz).
  2. Yoksa Blob URL'inden **bir kez** `GET` yap.
  3. R2'ye `PUT` et. Content-Type orijinaliyle aynı olsun, `Cache-Control: public, max-age=31536000, immutable` eklensin.
  4. R2'den `HEAD` ile boyutu doğrula. Orijinalin byte sayısıyla birebir aynı olmalı. Değilse kaydı `hata` olarak işaretle.
- İmzalama `src/lib/image-storage.ts` içindeki yöntemle yapılır: `aws4fetch` `sign()` ve gövde `Uint8Array`. `client.fetch()` kullanılmaz, 411 hatası verir. Ortak kod gerekiyorsa küçük bir yardımcıya ayrılır.
- Eşzamanlılık 4 ile sınırlı. `--limit N` ile parça parça çalıştırılabilir.
- Sonuç `scripts/output/blob-r2-eslesme.json` dosyasına yazılır. Her kayıtta `eski`, `yeni`, `boyut`, `durum: ok | hata | atlandı` bulunur. Script yarıda kalırsa bu dosyadan devam eder.
- Bu fazda **veritabanına dokunulmaz.** Site Blob'dan çalışmaya devam eder.

## 5. Faz 2 — Veritabanı adreslerini güncelleme (`--db-guncelle`)

1. **Önce sayım anlık görüntüsü** alınır ve dosyaya yazılır:
   - `ProductOptionImage`: (productId, valueId) başına satır sayısı ve `isCover` sayısı
   - `ProductImage`: productId başına satır sayısı
   - Kategori ve marka görsel sayıları
2. **Yedek:** Güncellenecek her satır için `{tablo, id, kolon, eskiDeger}` kaydı `scripts/output/blob-r2-yedek-<zaman>.json` dosyasına yazılır.
3. Yalnızca eşleme dosyasında `durum: ok` olan adresler güncellenir. `hata` olanlar Blob'da kalır ve raporlanır.
   - URL kolonları `id` ile tek tek güncellenir. Batch'ler halinde transaction kullanılır.
   - Faz 0'da bulunan metin/HTML/JSON kolonlarında yalnızca eşleşen eski URL **tam metin olarak** yenisiyle değiştirilir.
4. **Önce deneme:** `--db-guncelle --urun <slug>` ile tek bir **taslak/test** ürün güncellenir. Kullanıcı bu ürünü localhost'ta ve canlıda kontrol eder. Onaydan sonra tümü güncellenir.
5. **Sonra sayım tekrar alınır**, öncekiyle birebir aynı olmalı. Fark varsa script durur ve raporlar.
6. **Geri alma:** `--geri-al <yedek-dosyasi>` komutu yedekteki eski değerleri geri yazar.
7. **Önbellek tazeleme:** Script Next.js dışında çalıştığı için önbelleği kendisi tazeleyemez. Güncellemeden sonra şunlardan biri yapılır:
   - Admin'den herhangi bir ürünü değiştirmeden kaydet. Bu `revalidateCatalog` ile ilgili sayfaları tazeler.
   - Ya da bir sonraki deploy'u bekle.

   CPU planındaki 1 saatlik önbellek süresi de en geç 1 saatte eski adresleri temizler. Bu sürede eski adresler çalışmaya devam eder, çünkü Blob silinmedi.

## 6. Faz 3 — Kod temizliği (taşıma onaylandıktan sonra, ayrı commit)

- `src/lib/image-storage.ts`: Blob'a düşen güvenlik ağı kaldırılır. R2 env'leri eksikse `uploadImage` açık bir hata fırlatır. Admin ekranında "Görsel deposu (R2) ayarları eksik" gibi anlaşılır bir mesaj görünmeli, sessizce Blob'a yazılmamalı. `@vercel/blob` `put` importu kalkar.
- `src/lib/blob.ts`: Blob silme dalı (`del`) kalkar, R2 silme aynen kalır. Fonksiyon adı (`deleteBlobUrls`) değişmez, çağıran yerlere dokunulmaz. Hiç Blob URL'i kalmayacağı için davranış değişmez.
- `next.config.mjs` → `remotePatterns` içinden `**.public.blob.vercel-storage.com` satırı **ancak** Faz 0/2 raporunda DB'de hiç Blob adresi kalmadığı doğrulandıysa kaldırılır. `hata` kaydı kaldıysa satır kalır.
- Blob'a özel tek seferlik script'ler kaldırılır: `scripts/temizle-yetim-blob.ts`, `scripts/sikistir-mevcut-gorseller.ts`. `scripts/blob-to-r2.ts` geri alma için Faz 4'e kadar kalır.
- `npm uninstall @vercel/blob`. `grep -rn "@vercel/blob\|BLOB_READ_WRITE_TOKEN" .` sonucu boş olmalı (node_modules hariç).
- `.env.example` içinden `BLOB_READ_WRITE_TOKEN` satırı kaldırılır.

## 7. Faz 4 — Blob deposunu kapatma (kullanıcı, en erken 2–3 gün sonra)

1. Vercel → Usage → **Blob Simple Operations** grafiği 1–2 gün boyunca **artmıyorsa** Blob'dan artık hiçbir şey okunmuyor demektir. Bu, taşımanın eksiksiz olduğunun kanıtıdır.
2. Vercel → Storage → Blob deposu → projeyle bağlantısını kes (Disconnect) → **Delete store**.
   - Depo silme ücretsiz ve dosyaları tek seferde siler.
   - Panelde depoyu gezmek Advanced Operation harcar. Gezinmeden doğrudan Settings'e girip sil.
3. Vercel → Project → Settings → Environment Variables: `BLOB_READ_WRITE_TOKEN` silinir. Yerel `.env` ve `.env.local` dosyalarından da silinir.
4. Bundan sonra `scripts/blob-to-r2.ts` ve `scripts/output/` silinebilir.

**Not:** Google Görseller'deki eski Blob adresleri depo silinince kırılır. Ürün sayfaları değişmediği için Google birkaç hafta içinde yeni adresleri alır. Eski sipariş e-postalarında görsel varsa onlar da görünmez olur. Satışa etkisi yok.

## 8. Test (localhost)

1. `--envanter` çıktısı: benzersiz URL sayısı, tablo/kolon dökümü, koddaki sabit adresler.
2. `--kopyala --limit 5`:
   - 5 dosya R2'de olmalı.
   - Yeni URL'ler tarayıcıda açılmalı.
   - Byte boyutları orijinalle aynı olmalı.
   - Biri indirilip `sha256` ile orijinaliyle karşılaştırılmalı.
3. `--kopyala` tamamı: `hata` sayısı 0 olmalı (ya da her biri tek tek açıklanmalı). Script ikinci kez çalıştırıldığında hiçbir dosyayı yeniden indirmemeli, hepsi `atlandı` olmalı.
4. `--db-guncelle --urun <test-urunu>`:
   - Kullanıcı ürün sayfasında tüm renkleri ve kapak fotoğraflarını kontrol eder.
   - Sayım karşılaştırması aynı çıkmalı.
   - `--geri-al` ile geri alma da bu üründe bir kez denenmeli, sonra tekrar ileri alınmalı.
5. Tümü güncellendikten sonra:
   - Anasayfa, katalog, kategori kartları, mega menü, ürün sayfaları ve admin ürün listesi görselleri düzgün görünmeli.
   - Tarayıcı Network sekmesinde `blob.vercel-storage.com` isteği **görünmemeli**.
6. Faz 3 sonrası:
   - `npx tsc --noEmit`, `npm run lint` ve `npm run build` temiz olmalı.
   - Admin'den taslak ürüne görsel yükleme ve silme R2 ile çalışmalı.

## 9. Ne kadar sürer

- Script yazımı ve testler: ~1 saat
- Kopyalama: ~5–10 dakika (~80 MB)
- DB güncelleme: 1–2 dakika
- Kullanıcı kontrolü: 15 dakika
- Faz 4: 2–3 gün sonra, 5 dakika

## 10. Claude Code prompt'ları

### Prompt 1 — Faz 0, 1, 2

```
Bollmark projesinde BLOB_TAMAMEN_KALDIRMA_PLANI.md dosyasını baştan sona oku. Yüklü skill'leri (özellikle karpathy-guidelines) kullan. Bu oturumda yalnızca Faz 0, 1 ve 2'yi yap; Faz 3 kod temizliğine DOKUNMA.

Önemli kurallar:
- Görseller byte byte kopyalanacak; sharp/compressImage/yeniden boyutlandırma YOK. Content-Type aynı kalsın.
- Blob list() KULLANMA. Liste veritabanından çıkarılacak. Her Blob dosyası en fazla bir kez indirilsin; R2'de varsa tekrar indirme.
- R2 imzalama image-storage.ts'teki yöntemle (aws4fetch sign + Uint8Array gövde). Secret'ları hiçbir yere yazdırma.
- Veritabanında sadece görsel adresi taşıyan alanları id ile güncelle; satır silme/yeniden yaratma yok, productId/valueId/position/isCover/alt'a dokunma. Güncellemeden önce yedek ve sayım anlık görüntüsü al, sonra sayımı karşılaştır.
- DB localhost ile canlı arasında ORTAK. Önce sadece Faz 0 envanterini çalıştır ve bana raporla (benzersiz URL sayısı = harcanacak en fazla Blob Simple Operation). Ben onaylamadan --kopyala çalıştırma. Kopyalamadan sonra da DB güncellemesini önce yalnızca benim söyleyeceğim tek bir test ürününde yap, onayımı bekle, sonra tümüne geç.
- Blob'daki hiçbir dosyayı SİLME.

Planın 8. bölümündeki 1–5 numaralı testleri sırayla yap ve her adımın sonucunu raporla. Bitince DEPLOY_STATUS.md'ye not düş (eşleşme ve yedek dosyalarının yerini de yaz). Ben localhost'ta onaylamadan commit atma; onayımdan sonra önce DEPLOY_STATUS.md'yi güncelle, sonra yerel commit at. Ben söylemeden push ETME.
```

### Prompt 2 — Faz 3 (taşıma onaylandıktan sonra, yeni oturum)

```
Bollmark projesinde BLOB_TAMAMEN_KALDIRMA_PLANI.md dosyasının 6. bölümünü (Faz 3 kod temizliği) uygula. Yüklü skill'leri kullan, değişiklikleri küçük tut. Önce DEPLOY_STATUS'taki taşıma notunu oku; veritabanında hâlâ Blob adresi kalıp kalmadığını salt okuma sorgusuyla tekrar kontrol et. Kalmışsa next.config'teki Blob remotePattern satırını SİLME ve bana raporla.

R2 env'leri eksikse uploadImage açık ve anlaşılır bir hata versin, sessizce Blob'a yazmasın. deleteBlobUrls adı ve çağıran yerler değişmesin. @vercel/blob paketini kaldır; grep ile hiçbir kullanım kalmadığını göster.

Test: tsc, lint, build temiz; admin'de taslak bir ürüne görsel yükle ve sil (R2'ye gitmeli, silinmeli). Bitince DEPLOY_STATUS.md'ye not düş. Ben localhost'ta onaylamadan commit atma; onayımdan sonra önce DEPLOY_STATUS.md'yi güncelle, sonra yerel commit at. Ben söylemeden push ETME.
```
