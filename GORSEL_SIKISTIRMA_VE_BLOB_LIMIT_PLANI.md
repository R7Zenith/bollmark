# Ürün Görselleri — Sıkıştırma, Yetim Blob Temizliği ve Toplu Silme Açığı (Araştırma + Claude Code Promptu)

## Soruya kısa cevap

Vercel Blob'un Hobby (ücretsiz) plandaki dahil kotası aylık ortalama
**1 GB depolama + 10 GB veri transferi**. Her ay yenilenen bir kota ama
aşarsan otomatik ücret binmiyor — Blob'a erişim kilitleniyor, 30 gün
beklemen ya da Pro'ya geçmen gerekiyor. (Kaynak: Vercel'in resmi Blob
fiyatlandırma sayfası — aşağıda linkli.)

## Tespit edilen üç ayrı sorun

### 1. Yeni yüklenen görseller hiç sıkıştırılmıyor

- `src/app/api/admin/upload/route.ts`: admin panelden PC'den yüklenen
  görseller sıkıştırma/yeniden boyutlandırma olmadan doğrudan Blob'a
  yükleniyor.
- `src/lib/koton-images.ts` → `reuploadImageToBlob()`: Excel aktarımında
  Koton'dan otomatik çekilen görseller de aynen, sıkıştırılmadan Blob'a
  kopyalanıyor. Bu en çok görsel biriktiren akış.

### 2. Toplu ürün silme, Blob'daki dosyaları silmiyor (bug)

Kontrol ettim: **tekli** ürün silme ve düzenleme doğru çalışıyor —
`admin/urunler/[id]/page.tsx` içindeki `deleteProduct` ve `updateProduct`
aksiyonları, artık kullanılmayan görsel URL'lerini `deleteBlobUrls()` ile
gerçekten Blob'dan siliyor.

Ama **toplu silme** (Ürünler sayfasında birden fazla seçip "Seç ve Sil")
`src/app/api/admin/urunler/bulk/route.ts` üzerinden sadece
`prisma.product.deleteMany(...)` çağırıyor — veritabanı kayıtları
(ürün + görsel satırları, cascade ile) siliniyor ama karşılık gelen
Blob dosyaları için `deleteBlobUrls()` hiç çağrılmıyor. Toplu silinen
her ürünün fotoğrafları Blob'da yetim olarak kalmaya devam ediyor.

### 3. Şu an Blob'da muhtemelen zaten yetim (kullanılmayan) dosyalar var

Sorun 2 muhtemelen bir süredir aktifti, yani şu an Blob deposunda hiçbir
ürün/kategori/marka/yorum kaydında referans edilmeyen dosyalar birikmiş
olabilir. Bunları tespit edip silmek, hiçbir şeyi bozmadan (hiçbir yerde
kullanılmadıkları için) kotadan hemen yer açacak en risksiz adım.

Blob'daki bir dosyanın "hâlâ kullanılıyor" sayılması için referans
edilebileceği **tüm** yerler (şemayı kontrol ettim):

- `ProductImage.url`
- `ProductOptionImage.url`
- `Category.imageUrl`
- `Brand.logoUrl`
- `ProductReview.imageUrls` (satır başına bir URL, `\n` ile ayrılmış)

Bir Blob dosyası bu beş kaynaktan **hiçbirinde** geçmiyorsa yetimdir ve
güvenle silinebilir.

## Önerilen sıkıştırma parametreleri

- Genişliği max **1600px**'e sınırla (orantılı küçült, zaten küçükse
  büyütme yapma).
- **WebP**'e çevir, kalite **~78**.
- Bu genelde dosya boyutunu orijinalin %10-20'sine indirir, gözle fark
  edilmez.
- Standart kütüphane: **`sharp`** (Node.js, Vercel'in serverless
  fonksiyonlarında native binary desteği var).

## Yapılacakların sırası

1. **Yeni yüklemelere sıkıştırma ekle** (upload route + koton-images.ts)
   — büyümeyi durdurur.
2. **Toplu silme bug'ını düzelt** (bulk route'a `deleteBlobUrls` ekle)
   — yeni yetimlerin oluşmasını durdurur.
3. **Yetim dosya temizliği** (bir kerelik script) — hiçbir yerde referans
   edilmeyen Blob dosyalarını bulup siler. Risksiz, önce sadece
   rapor/dry-run ile "şu kadar dosya, şu kadar MB silinecek" gösterip,
   onaydan sonra gerçek silme yapılmalı.
4. **Mevcut (hâlâ kullanılan) görsellerin geriye dönük sıkıştırılması**
   (bir kerelik migration script) — her referanslı görseli indirip
   sıkıştırıp yeniden yükler, DB'deki URL'i yeni adrese günceller, eski
   (sıkıştırılmamış) dosyayı siler. En büyük kazancı bu sağlar çünkü
   halihazırda Blob'da duran tüm eski görseller de küçülür.

3 ve 4 numaralı adımlar DB'yi ve Blob'u kalıcı değiştirdiği için ikisi de
önce **dry-run** (sadece rapor, hiçbir şey silmeden/değiştirmeden) modda
çalıştırılıp sonuç bana gösterilmeli, ben onaylayınca gerçek modda tekrar
çalıştırılmalı.

## Verilen Claude Code promptu

```
Bollmark'ta ürün görselleri Vercel Blob'a hiç sıkıştırılmadan yükleniyor
ve Hobby plandaki 1GB'lık ücretsiz depolama kotasını hızla dolduruyor.
Ayrıca toplu ürün silmede bir bug var ve muhtemelen Blob'da şu an
kullanılmayan (yetim) dosyalar birikmiş durumda. Bunların hepsini sırayla
çözeceğiz. `sharp` paketini kullan (yoksa `npm install sharp` ile ekle).

### Faz 1 — Yeni yüklemelerde sıkıştırma

`src/app/api/admin/upload/route.ts` ve `src/lib/koton-images.ts` içindeki
`reuploadImageToBlob()`'da, Blob'a `put()` ile yazmadan hemen önce görseli
sharp ile işle:
- Genişliği max 1600px'e sınırla (orantılı küçült, zaten küçükse
  büyütme yapma).
- WebP'e çevir, kalite ~78.
- content-type'ı `image/webp`, dosya uzantısını `.webp` yap.

Admin panel yüklemesindeki mevcut 5MB boyut sınırı ve tip kontrolü aynen
kalsın, sıkıştırma bu kontrolden SONRA uygulansın.

### Faz 2 — Toplu silme bug'ını düzelt

`src/app/api/admin/urunler/bulk/route.ts`'deki DELETE aksiyonu şu an
sadece `prisma.product.deleteMany(...)` çağırıyor, Blob'daki görselleri
silmiyor (tekli silmedeki `admin/urunler/[id]/page.tsx` -> `deleteProduct`
fonksiyonundaki davranışla aynı hizaya getir). Silinecek ürünlerin
`images` (ProductImage.url) ve `optionImages` (ProductOptionImage.url)
url'lerini deleteMany'den ÖNCE oku, silme işlemi başarılı olduktan sonra
`src/lib/blob.ts`'deki `deleteBlobUrls()` ile bu url'leri Blob'dan da sil.

### Faz 3 — Yetim (kullanılmayan) Blob dosyalarını temizle

Bir kerelik script yaz (örn. `scripts/temizle-yetim-blob.ts`, projede
`scripts/` klasörü zaten var, oradaki mevcut scriptlerin çalıştırma
şekliyle - tsx/ts-node - tutarlı olsun):

1. `@vercel/blob`'un `list()` fonksiyonuyla store'daki TÜM blob'ları
   sayfalama ile (`cursor`) gez, tüm url/pathname'leri topla.
2. Veritabanından şu 5 kaynaktaki TÜM url'leri topla (referans edilen
   kümeyi oluştur):
   - `ProductImage.url`
   - `ProductOptionImage.url`
   - `Category.imageUrl` (null olmayanlar)
   - `Brand.logoUrl` (null olmayanlar)
   - `ProductReview.imageUrls` (her satır `\n` ile ayrılmış, her satırı
     ayrı url say)
3. Blob'daki url kümesinden referans kümesini çıkar - geriye kalanlar
   yetim.
4. Script `--dry-run` argümanıyla çalıştığında (varsayılan davranış bu
   olsun) SADECE rapor bassın: kaç dosya yetim, toplam kaç MB/GB,
   birkaç örnek url. HİÇBİR ŞEY SİLMESİN.
5. `--execute` argümanıyla çalıştırıldığında gerçekten `del()` ile silsin
   ve özet rapor bassın (kaç dosya silindi, kaç MB boşaldı).

Önce bana sadece dry-run raporunu göster, ben onaylamadan --execute ile
ÇALIŞTIRMA.

### Faz 4 — Mevcut (kullanılan) görselleri geriye dönük sıkıştır

Bir kerelik migration scripti yaz (örn. `scripts/sikistir-mevcut-gorseller.ts`):

1. Yukarıdaki 5 kaynaktaki (ProductImage, ProductOptionImage,
   Category.imageUrl, Brand.logoUrl, ProductReview.imageUrls) TÜM
   referanslı url'leri gez.
2. Her url için: zaten `.webp` uzantılı VE 1600px altındaysa (veya daha
   önce bu scriptle işlendiğini anlayacak bir işaret varsa) ATLA -
   script tekrar çalıştırılırsa aynı görseli ikinci kez işlemesin.
3. Diğerlerini indir, Faz 1'deki aynı sharp ayarlarıyla (max 1600px,
   WebP, kalite ~78) işle, YENİ bir Blob path'ine yükle, ilgili DB
   satırındaki url alanını yeni adrese güncelle, işlem başarılıysa eski
   Blob dosyasını sil. Bir görselde herhangi bir adım (indirme/işleme/
   yükleme) hata verirse o görseli ATLA, script durmasın, hatayı logla,
   sonda "şu kadar görsel başarısız, urlleri şunlar" diye raporla.
4. Blob'un dakikalık işlem limitlerini zorlamamak için görselleri küçük
   gruplar halinde (örn. 20'şerli) işleyip gruplar arasına kısa bir
   bekleme (örn. 300ms) koy.
5. Script `--dry-run` (varsayılan, sadece "şu kadar görsel işlenecek,
   toplam şu kadar MB, tahmini şu kadar MB'a inecek" raporu - hiçbir
   şey indirmeden/yüklemeden, sadece mevcut Blob boyutlarına bakarak
   tahmini rapor) ve `--execute` (gerçek işlem) modlarını desteklesin.

Önce dry-run raporunu göster, ben onaylamadan --execute ile ÇALIŞTIRMA.
Faz 4 canlı veritabanını ve Blob'u kalıcı değiştirdiği için özellikle
dikkatli ol - execute modunda da isteğe bağlı bir `--limit N` argümanı
ekle ki önce küçük bir grupla (örn. 20 görsel) test edip sonucu kontrol
edebileyim, sorun yoksa tüm görsellerle çalıştırayım.

### Genel

Her fazdan sonra `npx tsc --noEmit` ve `npm run build` hatasız geçmeli.
Faz 1'i admin panelden gerçek bir görsel yükleyip önce/sonra boyutunu
karşılaştırarak test et. Faz 2'yi birkaç test ürünü toplu silip Blob
dashboard'unda gerçekten silindiğini kontrol ederek test et.

Bitince DEPLOY_STATUS.md'ye her fazın sonucunu ayrı ayrı not düş (Faz 3
ve 4 için: dry-run'da bulunan sayı/MB, execute sonrası gerçekleşen
sayı/MB, varsa başarısız olan görsel sayısı).

Commit'i mesajıyla birlikte öner ama benim onayım olmadan push etme.
```

## Sonraki oturumda kontrol edilecek

- Faz 3 dry-run raporu: kaç yetim dosya, kaç MB. Onaydan sonra execute
  sonucu.
- Faz 4 dry-run raporu ve küçük gruptaki (`--limit`) ilk test sonucu -
  sorunsuzsa tüm görsellerle tam çalıştırma onayı.
- Blob dashboard'unda toplam depolama kullanımının tüm fazlar sonunda
  ne kadar düştüğü.
