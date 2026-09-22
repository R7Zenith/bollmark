# Çok Markalı Excel Aktarımı + Görsel Bulma (Slazenger ve sonrası) — Plan

Tarih: 2026-09-23
Durum: Araştırıldı, uygulama bekliyor (Claude Code ile hayata geçirilecek)
İlgili: `EXCEL_URUN_AKTARIM_PLANI.md` (Koton için ilk sürüm, uygulandı), `FOTOGRAFSIZ_URUNLER_PLANI.md`

## 1. Durum tespiti (mevcut kod incelendi)

Sevindirici haber: excel'den toplu ürün aktarımı zaten **marka bağımsız** çalışıyor.
`lib/excel-import.ts` her satırdaki `FIRMAADI` sütununu okuyup o isimle bir `Brand`
kaydı buluyor/oluşturuyor (`resolveBrandId`). Gönderdiğin `SLAZENGER31082026CHECKLIST.xls`
dosyasını inceledim: **kolon yapısı Koton'unkiyle birebir aynı** (ÜRÜN KODU, BARKOD, RENK,
BEDEN, SFIYAT1, FIRMAADI=SLAZENGER, KOD4=ERKEK/KADIN zaten Türkçe...) - yani bu dosyayı
şu an yüklesen bile ürünler/varyantlar/stoklar doğru şekilde içe aktarılır, marka olarak
"SLAZENGER" ataması da doğru yapılır.

**Asıl eksik ve tek gerçek sorun: görsel/açıklama bulma adımı (`lib/koton-images.ts`)
tamamen koton.com'a sabitlenmiş.** Excel aktarımı sırasında (ve ürün düzenleme
sayfasındaki "yeniden ara"/"linkle ekle" butonlarında) hangi markanın ürünü olursa
olsun her zaman koton.com'da aranıyor. Slazenger ürünleri için bu arama hep
"bulunamadı" dönüyor (base_code eşleşmesi kontrolü sayesinde yanlış ürünle eşleşmiyor,
ama hiç görsel de bulmuyor) - ürün görselsiz DRAFT olarak kalıyor.

İyi haber: **"bulamazsa link verebileyim" ve "yeniden arasın" istediğin özellikler zaten
var** - ürün düzenleme sayfasında "Fotoğrafları yeniden ara" ve "Ürün linkiyle ekle"
butonları (`gorsel-yenile`, `gorsel-ekle` route'ları) uygulanmış durumda. Sorun bunların
da koton.com'a kilitli olması (link doğrulaması `koton.com` domain'ini zorunlu kılıyor).

## 2. Araştırma: Slazenger'ın sitesi Koton ile aynı altyapıda mı?

slazenger.com.tr'yi test ettim. **Ürün sayfaları `?format=json` ile tıpkı koton.com gibi
JSON dönüyor** ve şema birebir aynı:

- `product.base_code` var (örn. bir üründe "SA14RE043-200")
- `product.attributes.urun_aciklama` var (hazır Türkçe açıklama)
- `variants` dizisi `attribute_name: "Renk"` / `"Beden"` grupları içeriyor, renk
  seçeneklerinin kendi `productimage_set`'i (tam görsel URL'leri) aynı şekilde geliyor

Yani **Koton'daki `fetchKotonProductData` mantığının aynısı slazenger.com.tr için de
çalışır** - sadece temel URL'i değiştirmek yeterli, ekstra parse mantığı gerekmiyor.
Muhtemelen ikisi de aynı e-ticaret altyapısını (aynı platform sağlayıcısı) kullanıyor.

**Doğrulanamayan tek nokta:** Koton'daki barkod→ürün sayfası adımı olan
`/autocomplete/?search_text=` uç noktasını slazenger.com.tr'de test ettiğimde 404 döndü
(hem barkodla hem genel kelimeyle). Bu, uzaktan yaptığım testin engellenmiş/farklı
user-agent'tan kaynaklanıyor olabilir, ya da gerçekten farklı bir yol kullanıyor
olabilir - kesin cevap için Claude Code'un kendi ortamından (veya senin localhost'undan
tarayıcı devtools ile) gerçek bir istek denemesi lazım. Bulunamazsa zaten koton-images.ts
içinde hazır bir **yedek plan** var: Google Custom Search API ile "site:marka-domaini"
araması (`fetchGoogleCseUrl`) - bu zaten koton.com için kod içinde duruyor, sadece
domain kontrolünü marka bazlı hale getirmek yeterli.

## 3. Çözüm: marka bazlı görsel kaynağı kayıt sistemi

Tek bir markaya (koton.com) kilitli kod yerine, **marka adına göre hangi sitede
aranacağını söyleyen küçük bir eşleme tablosu** eklenecek. Böylece Slazenger dahil,
ilerde ekleyeceğin her yeni marka (dükkanda sattığın başka markalar da olabilir) için
tek satırlık bir ekleme yeterli olacak - kod tekrar yazılmayacak.

```ts
// src/lib/brand-image-sources.ts
export const BRAND_IMAGE_SOURCES: Record<string, { baseUrl: string; displayName: string }> = {
  KOTON: { baseUrl: "https://www.koton.com", displayName: "Koton" },
  SLAZENGER: { baseUrl: "https://www.slazenger.com.tr", displayName: "Slazenger" },
  // Yeni marka eklemek için: önce <site>/<bir-ürün-url'i>?format=json'u tarayıcıda dene,
  // Koton'dakiyle aynı şemayı (base_code, urun_aciklama, variants[].productimage_set)
  // döndürüyorsa buraya tek satır eklemek yeterli. Farklı bir altyapıdaysa (şema
  // uyuşmuyorsa) bu markayı eklemeyin - kayıtlı olmayan markalarda otomatik arama
  // sessizce atlanır, ürün görselsiz DRAFT kalır, admin panelden "linkle ekle" her
  // zaman çalışır.
};
```

Ürünün markası DB'de zaten `Product.brand` ilişkisiyle duruyor - `koton-images.ts`
(muhtemelen `brand-images.ts` olarak yeniden adlandırılır) içindeki fonksiyonlar artık
sabit `KOTON_BASE` yerine, çağıran taraftan gelen `baseUrl` parametresini kullanacak.
4 çağrı noktası (excel aktarım, ürünler sayfasındaki "yeniden ara", ürün düzenleme
sayfasındaki "renk bazlı ara" ve "linkle ekle") ürünün `brand.name`'ini okuyup
`BRAND_IMAGE_SOURCES`'tan `baseUrl`'i çözecek.

## 4. Detaylı değişiklik listesi

1. **`src/lib/brand-image-sources.ts` (yeni dosya)** - yukarıdaki eşleme tablosu +
   `resolveImageSourceForBrand(brandName: string | null | undefined)` yardımcı fonksiyonu
   (marka adını büyük harfe çevirip tablodan arar, yoksa `null` döner).

2. **`src/lib/koton-images.ts`** - içindeki tüm fonksiyonlar (`fetchAutocompleteUrl`,
   `fetchKotonProductData`, `findKotonProductData`, `fetchGoogleCseUrl`, `enrichOne`,
   `enrichFromUrl`, `enrichProductsFromKoton`) sabit `KOTON_BASE` yerine parametre olarak
   `baseUrl` alacak şekilde güncellenir. `fetchGoogleCseUrl`'deki
   `/^https?:\/\/(www\.)?koton\.com\//i` domain kontrolü de `baseUrl`'den türetilecek
   şekilde genelleştirilir. `KotonEnrichmentTarget` tipine `imageSourceBaseUrl: string | null`
   eklenir - `null` ise (marka tabloda yoksa) hiç ağ isteği atılmadan doğrudan
   `found:false` dönülür (bugünkü gibi boşuna koton.com'a istek atılmaz).
   Dosya adı/export isimleri Claude Code'un kendi kararına bırakılabilir (örn.
   `brand-images.ts`'e taşımak isterse import'ları da günceller) - önemli olan davranış.

3. **4 çağrı noktası** (`excel-aktar/gorsel-getir`, `urunler/[id]/gorsel-yenile`,
   `urunler/[id]/gorsel-renk-ara`, `urunler/[id]/gorsel-ekle`) - ürünü çekerken
   `include: { brand: true }` eklenir, `resolveImageSourceForBrand(product.brand?.name)`
   ile `baseUrl` çözülür ve hedefe eklenir.

4. **`gorsel-ekle` route'undaki link doğrulaması** genelleşir: marka tabloda varsa o
   markanın domain'i zorunlu kılınır (örn. Slazenger ürününe koton.com linki
   yapıştırılamaz - yanlış eşleşmeyi baştan engeller); marka tabloda yoksa herhangi bir
   `https://` linki kabul edilir (kullanıcı elle bulduğu görseli/ürün sayfasını
   yapıştırabilsin).

5. **Metin/arayüz güncellemeleri** (`excel-import-wizard.tsx` sonuç ekranı,
   `urunler/[id]/page.tsx` içindeki buton metinleri) - "Koton'da arandı" / "Koton
   linkiyle ekle" gibi sabit metinler markaya göre değişecek ("Slazenger'da arandı" vb.,
   marka tabloda yoksa "Bu marka için otomatik görsel kaynağı tanımlı değil, linkle
   ekleyebilirsiniz" notu).

6. **Kategori eşleme boşluğu** - mevcut `CATEGORY_MAP` ve ürün adından kategori tahmini
   (`PRODUCT_NAME_CATEGORY_KEYWORDS`) listesinde hiç ayakkabı/spor ayakkabı yok (şu ana
   kadar sadece giyim geldiği için). Slazenger dosyasındaki KOD3 "SPOR AYAKKABI" - bu
   otomatik eşleşmez ama **zaten çökmez**: sistemde bu durumda devreye giren AI kategori
   önerisi (`category-suggest.ts`) önizlemede öneri olarak gösterilir, admin onaylar/yazar.
   İstersen ek olarak "Ayakkabı" ürün adı anahtar kelimesi ve KOD3 eşlemesi de eklenebilir
   (DB'de böyle bir kategori zaten varsa) - Claude Code mevcut kategori listesine bakıp
   karar versin.

7. **Marka adı büyük/küçük harf** - `FIRMAADI` hücresi excel'de hep büyük harfle geliyor
   ("SLAZENGER"), yeni marka ilk kez oluşturulurken bu haliyle kaydediliyor
   (`resolveBrandId`). Görünüm için Title Case'e çevrilmesi önerilir (örn. "Slazenger").

8. **Uçtan uca test** - `SLAZENGER31082026CHECKLIST.xls` dosyası `ornek-veriler/`
   klasörüne konuldu (Koton örneğiyle aynı yere). Claude Code, önce autocomplete
   uç noktasının slazenger.com.tr'de gerçekten çalışıp çalışmadığını doğrulasın
   (çalışmıyorsa Google CSE yedeğine güvenilecek ya da yalnızca manuel "linkle ekle"
   akışına düşülecek - iki durumda da içe aktarım kendisi bozulmaz, sadece otomatik
   görsel bulma etkilenir), sonra bu dosyayla localhost'ta gerçek bir içe aktarım
   deneyip sonucu (ürünler, varyantlar, bulunan/bulunamayan görseller) gözle
   doğrulasın.

## 5. Kapsam dışı / bilinen sınırlar

- Slazenger'ın kendi arama uç noktası hiç çalışmazsa (autocomplete de, Google CSE
  yedeği de sonuç vermezse) Slazenger ürünleri görselsiz DRAFT kalır - admin panelden
  linkle ekleme her zaman yedek olarak duruyor, bu senin zaten istediğin akış.
- Koton dışı bir markanın sitesi farklı bir altyapıdaysa (JSON şeması uyuşmuyorsa) o
  marka otomatik arama tablosuna eklenmez - ileride ayrı bir inceleme/plan gerekir.
- Ücretli genel görsel arama API'si (SerpApi vb.) hâlâ v1 kapsamı dışında (önceki
  kararın geçerli).

## 6. Claude Code prompt'u

Aşağıdaki prompt, projenin kök dizininde (`Bollmark/`) Claude Code'a verilmek üzere
hazırlandı. `SLAZENGER31082026CHECKLIST.xls` dosyası `ornek-veriler/` klasörüne
kondu (Koton örneğiyle aynı yere) - uçtan uca test için hazır.

```
Şu an admin panelde excel'den ürün içe aktarma (lib/excel-import.ts,
src/app/api/admin/urunler/excel-yukle ve excel-aktar route'ları,
excel-import-wizard.tsx) sadece Koton ürünleri için çalışan bir varsayımla kurulmuş
değil - excel'deki FIRMAADI sütunundan marka zaten doğru okunup Brand kaydı
oluşturuluyor (lib/excel-import.ts, resolveBrandId). Sorun sadece görsel/açıklama
bulma adımında: src/lib/koton-images.ts sabit KOTON_BASE = "https://www.koton.com"
kullanıyor, marka ne olursa olsun hep koton.com'da arıyor. Bunu marka bazlı hale
getir.

1) Yeni dosya src/lib/brand-image-sources.ts oluştur:
   - BRAND_IMAGE_SOURCES: Record<string, { baseUrl: string; displayName: string }>
     - KOTON: { baseUrl: "https://www.koton.com", displayName: "Koton" }
     - SLAZENGER: { baseUrl: "https://www.slazenger.com.tr", displayName: "Slazenger" }
       (slazenger.com.tr'nin ürün sayfalarının ?format=json ile koton.com ile AYNI
       JSON şemasını döndürdüğü doğrulandı: product.base_code,
       product.attributes.urun_aciklama, variants[].attribute_name "Renk"/"Beden" +
       options[].product.productimage_set - ekstra parse mantığı gerekmiyor)
   - resolveImageSourceForBrand(brandName: string | null | undefined): marka adını
     trim + toUpperCase edip tablodan arar, yoksa null döner.
   - Dosyanın başına, yeni marka eklemenin nasıl test edileceğini açıklayan bir yorum
     ekle (bir ürün URL'ini ?format=json ile açıp aynı şemayı kontrol et).

2) src/lib/koton-images.ts içindeki (istersen src/lib/brand-images.ts olarak yeniden
   adlandırabilirsin, import'ları da güncelle) tüm fonksiyonları KOTON_BASE sabitine
   bağımlı olmaktan çıkar - fetchAutocompleteUrl, fetchKotonProductData,
   findKotonProductData, fetchGoogleCseUrl, enrichOne, enrichFromUrl,
   enrichProductsFromKoton artık parametre olarak baseUrl (ve fetchGoogleCseUrl için
   domain kontrolü de baseUrl'den türetilecek) alsın. KotonEnrichmentTarget tipine
   (excel-import.ts'de tanımlı) imageSourceBaseUrl: string | null ekle - null ise
   enrichOne/enrichFromUrl hiç ağ isteği atmadan doğrudan found:false, missingColors
   dolu şekilde erken dönsün (bugün her markada koton.com'a boşuna istek atılıyor,
   bunu düzelt).

3) Şu 4 çağrı noktasında ürünü çekerken include: { brand: true } ekle, marka adını
   resolveImageSourceForBrand'e verip dönen baseUrl'i hedefe ekle:
   - src/app/api/admin/urunler/excel-aktar/gorsel-getir/route.ts
   - src/app/api/admin/urunler/[id]/gorsel-yenile/route.ts
   - src/app/api/admin/urunler/[id]/gorsel-renk-ara/route.ts
   - src/app/api/admin/urunler/[id]/gorsel-ekle/route.ts (ayrıca buradaki link
     doğrulama regex'i de değişsin: marka tabloda varsa sadece o markanın domain'i
     kabul edilsin, marka tabloda yoksa herhangi bir https:// linki kabul edilsin -
     böylece hem yanlış marka linkine karşı korunmuş oluruz hem de tabloda olmayan
     markalar için elle ekleme çalışmaya devam eder)

4) Arayüz metinlerini güncelle:
   - excel-import-wizard.tsx sonuç ekranındaki "Koton görsel eşleştirme" başlığını
     ve "Koton'da bulunamadı" mesajını marka bazlı/genel hale getir (örn. markanın
     displayName'i varsa kullan, yoksa "otomatik görsel kaynağı tanımlı değil" de).
   - src/app/(admin)/admin/urunler/[id]/page.tsx içindeki "Koton linkiyle ekle" /
     "Bu renk için Koton'da ara" gibi sabit metinleri markaya göre veya genel ifadeye
     çevir (bu dosyayı bul, mevcut bileşen yapısını koru).

5) src/lib/excel-import.ts'de resolveBrandId ile yeni oluşturulan Brand adının
   görünümü için Title Case'e çevrilmesini ekle (excel'den "SLAZENGER" gibi tamamen
   büyük harf geliyor, "Slazenger" olarak kaydedilsin) - Türkçe karakterleri bozmayan
   bir title-case yardımcı fonksiyonu yaz.

6) ornek-veriler/SLAZENGER31082026CHECKLIST.xls dosyasıyla localhost'ta gerçek bir
   içe aktarım dene. Önce autocomplete uç noktasının (https://www.slazenger.com.tr/
   autocomplete/?search_text=<barkod>) gerçekten JSON döndürüp döndürmediğini kontrol
   et (tarayıcıda veya bir fetch ile) - dönmüyorsa mevcut Google CSE yedeği
   (GOOGLE_CSE_API_KEY/GOOGLE_CSE_CX tanımlıysa) devreye girecek, o da yoksa ürünler
   görselsiz DRAFT kalıp "linkle ekle" ile elle tamamlanacak; bu normal bir sonuç,
   içe aktarımın kendisini durdurmamalı. Test sonucunu (kaç ürün/varyant aktarıldı,
   kaç üründe görsel otomatik bulundu, kaçında manuel eklenmesi gerekti) DEPLOY_STATUS.md'ye
   not düş.

Mevcut kod stiline (Türkçe route/param isimleri, admin-* tailwind class'ları, hata
yutup loglama, sıralı+hız sınırlı istek deseni) sadık kal. Değişiklik sonrası
`npm run build` veya `npx tsc --noEmit` ile tip hatası olmadığını doğrula.
```
