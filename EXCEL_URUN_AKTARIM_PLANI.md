# Excel'den Toplu Ürün Aktarımı + Koton Görsel Eşleştirme Planı

Tarih: 2026-09-02
Durum: Uygulama bekliyor (Claude Code ile hayata geçirilecek)

## 1. Amaç

Dükkanda kullanılan sistemden alınan "checklist" excel'i (örnek: `KOTON11052026CHECKLIST.xls`)
admin panelden yüklenip, satırlar otomatik olarak ürün + varyant (beden/renk) kayıtlarına
dönüştürülecek. Ardından her ürün için Koton'un kendi sitesinden (koton.com), ürün koduna
göre renk bazlı fotoğraflar bulunup otomatik olarak ürüne yüklenecek.

Kullanıcı kararları (netleşti):
- Görsel kaynağı: önce koton.com, bulunamazsa (v1'de) boş bırakılır - ücretli genel görsel
  arama API'si (SerpApi vb.) şimdilik eklenmiyor (aylık maliyeti var, gerek görülürse sonra
  ayrı bir faz olarak eklenebilir).
- Bulunan fotoğraflar admin onayı beklemeden otomatik kaydedilir.
- İçe aktarma admin panelde "Excel Yükle" ekranından, kullanıcı tarafından yapılır.
- Aynı ürün/varyant (barkod) tekrar yüklenirse mevcut kayıt güncellenir (stok/fiyat), yeni
  barkod ise yeni varyant olarak eklenir. Ürün fotoğrafı/açıklaması zaten varsa dokunulmaz.

## 2. Örnek excel yapısının analizi

Sayfa: `Sayfa1`, 33 kolon, ürün başına bir renk+beden kombinasyonu = 1 satır.

| Excel kolonu | Örnek değer | Anlamı |
|---|---|---|
| ÜRÜN KODU | 6SAM60012HW | Stil/ürün kodu - aynı üründeki tüm renk+beden satırlarında aynı, ürünleri gruplamak için kullanılır |
| ÜRÜN ADI | Regular Fit Klasik Yaka Pamuklu Kısa Kollu Gömlek | Ürün adı |
| BARKOD | 8684846234816 | Her renk+beden kombinasyonuna özel benzersiz barkod |
| KOD4 | MEN | Cinsiyet (MEN/WOMEN vb.) |
| RENK | EKRU, LACİVERT, BEYAZ, SİYAH... | Varyant rengi (Koton'un kendi sitesindeki renk etiketleriyle birebir aynı yazım - bkz. bölüm 4) |
| BEDEN | S, M, L, XL, XXL, 3XL | Varyant bedeni |
| KDV | 10 | KDV oranı - bilgi amaçlı, DB'ye yazılmıyor (fiyatlar zaten KDV dahil) |
| AFIYATI | 488.2855 | Alış (maliyet) fiyatı - ürün başına sabit |
| SFIYAT1 | 990 | Satış fiyatı - ürün başına sabit |
| MİKTAR | 2 | O renk+beden kombinasyonunun stok adedi |
| FIRMAADI | KOTON | Tedarikçi/marka |

Diğer kolonlar (KOD1/2/3/5/6/7/8/11/12, BIRIM, A.FIYATITUTAR, SFIYAT2-6, ETICARET,
FIRMAKODU, TARIH, BELGENO, ALTBELGENO, HAREKETDEPOSU) içe aktarımda kullanılmıyor.

Aynı ÜRÜN KODU'na sahip satırlar tek bir Product kaydına, her satır da o ürünün bir
ProductVariant'ına karşılık gelir (örnek dosyada 6 farklı ürün kodu, toplam 49 varyant satırı).

## 3. Veri eşleme (excel → veritabanı)

Mevcut şema (`prisma/schema.prisma`) değişmeden kullanılabiliyor - yeni migration gerekmiyor.

- **Product** (ÜRÜN KODU'na göre gruplanan her benzersiz kod için bir kayıt):
  - `name` ← ÜRÜN ADI
  - `slug` ← ÜRÜN ADI'ndan otomatik üretilir (Türkçe karakter normalize edilir, çakışırsa
    `-2`, `-3` eklenir)
  - `description` ← boş bırakılmaz: Koton'dan görsel/detay çekilirken (bkz. bölüm 4)
    Koton'un kendi ürün açıklaması (`urun_aciklama` alanı, düzgün yazılmış Türkçe HTML)
    da birlikte gelir - bulunursa otomatik description olarak kullanılır, bulunamazsa
    ürün adından türetilen kısa bir taslak metin yazılır (admin sonradan düzenler)
  - `priceCents` ← SFIYAT1 × 100
  - `costCents` ← AFIYATI × 100 (yuvarlanır)
  - `brandId` ← FIRMAADI'ndan upsert edilen Brand ("Koton")
  - `gender` ← KOD4'ten eşlenir (MEN→"Erkek", WOMEN→"Kadın", KIDS→"Çocuk" vb. - eşleşmeyen
    değerler boş bırakılır)
  - `status` ← "DRAFT" (admin görselleri/açıklamayı kontrol edip yayına alır - otomatik
    PUBLISHED yapılmaz, hatalı/eksik veri canlıya sızmasın)
  - `categoryId` ← v1'de otomatik atanmaz, admin içe aktarma önizlemesinde ürün grubu
    başına tek seferde kategori seçer (checklist'ler genelde tek kategoriden geldiği için
    pratikte tek tıkla tüm grup için seçilir)

- **ProductVariant** (her excel satırı için bir kayıt):
  - `sku` ← `{ÜRÜN KODU}-{RENK kısaltması}-{BEDEN}` (örn. `6SAM60012HW-EKRU-L`) - benzersiz
    ve stok koduyla eşleşecek şekilde okunaklı
  - `barcode` ← BARKOD
  - `stock` ← MİKTAR
  - `priceCents`/`compareAtCents` ← boş (Product'tan miras alınır)
  - **Upsert anahtarı: `barcode`.** Aynı barkod tekrar yüklenirse stock/sku güncellenir,
    yeni barkod ise yeni varyant eklenir.

- **VariantAttributeValue** (Renk/Beden):
  - RENK ve BEDEN, mevcut `resolveOptionValueIds` yardımcı fonksiyonu (`lib/variant-attributes.ts`)
    ile "Renk" (isColor:true) ve "Beden" attribute'larına upsert edilir - kod tekrarı yok,
    varyant editörünün kullandığı aynı mekanizma.

- **ProductOptionImage** (renk bazlı galeri): bkz. bölüm 4.

## 4. Koton'dan görsel + açıklama bulma (araştırıldı, çalışıyor)

Koton'un genel görsel arama kutusunun barkod/ürün koduyla nasıl çalıştığı tarayıcı üzerinden
test edildi (örnek üründe doğrulandı):

1. `GET https://www.koton.com/autocomplete/?search_text={barkod}` → JSON döner, `entries[0].url`
   alanında ürünün sayfa adresi (örn. `/regular-fit-klasik-yaka-pamuklu-kisa-kollu-gomlek-ekru-4095133/`).
   Ürün kodu ile değil barkodla aramak daha güvenilir sonuç veriyor (kod ile aratıldığında
   sonuç gelmeyebiliyor).
2. `GET {ürün-url}?format=json` → tam ürün detayını JSON olarak döner:
   - `product.base_code` → ÜRÜN KODU ile karşılaştırılıp doğru ürünü bulduğumuzdan emin olunur
   - `product.attributes.urun_aciklama` → hazır Türkçe açıklama HTML'i (description için kullanılır)
   - `variants` içinde `attribute_name: "Renk"` olan grup, o ürünün **tüm renklerini** listeler;
     her renk seçeneğinin (`options[].product`) **kendi `productimage_set`'i** (o renge ait
     tüm fotoğrafların tam URL'leri) doğrudan aynı response içinde geliyor - renk başına ayrı
     istek atmaya gerek yok.
   - Renk etiketleri (`options[].label`, örn. "EKRU", "LACİVERT", "SİYAH") **excel'deki RENK
     sütunuyla birebir aynı yazımda** - ekstra bir eşleştirme/normalize mantığı gerekmiyor,
     direkt string eşleşmesi yeterli. (Test edilen üründe excel'deki EKRU/LACİVERT/BEYAZ/SİYAH
     renklerinin dördü de Koton'un döndürdüğü renk listesinde birebir bulundu.)

Akış (her ürün kodu için, sadece 1 defa - aynı ürünün tüm varyant satırları için tekrar
aranmaz):
1. O ürünün ilk barkoduyla `/autocomplete/` çağrılır.
2. Sonuç varsa ürün sayfası `?format=json` ile çekilir, `base_code` excel'deki ÜRÜN KODU ile
   karşılaştırılır (yanlış eşleşmeyi önlemek için).
3. Eşleşiyorsa: `variants` içindeki Renk grubu gezilir, **excel'de o ürün için gerçekten
   var olan renkler** (BEYAZ, SİYAH gibi) için `productimage_set`'teki görseller Vercel Blob'a
   indirilip yeniden yüklenir (Koton'un CDN'ine hotlink yapılmaz - `lib/blob.ts`'teki `put()`
   ile aynı depoya taşınır) ve `ProductOptionImage` olarak o rengin `VariantAttributeValue.id`'sine
   bağlanır. Excel'de olmayan renkler (Koton'da satılan ama dükkanda stoklanmayan renkler)
   atlanır.
4. `urun_aciklama` varsa Product.description olarak kaydedilir.
5. Koton'da bulunamazsa (barkod aramada sonuç yok / base_code eşleşmiyor) ürün görselsiz
   DRAFT olarak kalır, admin panelden mevcut "Görseller" alanından elle eklenir.

**Önemli not (şeffaflık için):** koton.com'un `robots.txt` dosyası `?search_text=` ile biten
adresleri (arama sonucu sayfalarını) arama motoru botlarına kapatmış durumda - bu genelde
"sonsuz arama sonucu sayfalarını indeksleme" amaçlı bir kural, kişisel/düşük hacimli tekil
sorgulama için konulmuş bir engel değil. Yine de temkinli davranmak için:
- İçe aktarma sırasında istekler **art arda, hız sınırlı** (ürün başına ~1 istek, aralarda
  kısa bekleme) atılacak - toplu/paralel tarama yapılmayacak.
- Bulunan görseller **kendi Blob deposuna indirilip taşınacak** (Koton sunucusuna sürekli
  hotlink yapılmayacak), yani bu sorgu sadece içe aktarma anında bir kere çalışır.
- Bu bir "toplu site taraması" değil, dükkanın zaten kendi deposunda bulunan ürünler için
  tekil ürün sayfası görüntüleme hacminde bir kullanım - ama site sahibinin ileride bunu
  engellemesi (hız sınırı, IP engeli) ihtimaline karşı görselsiz kalan ürünler için elle
  ekleme yolu (mevcut özellik) her zaman yedek olarak duruyor.

## 5. Yeni bağımlılık

- `xlsx` (SheetJS) npm paketi eklenecek - hem `.xls` hem `.xlsx` dosyalarını okuyabiliyor,
  ek sistem bağımlılığı gerektirmiyor.

## 6. Admin UI

Yeni sayfa: `/admin/urunler/disa-aktar` yerine **`/admin/urunler/excel-yukle`**
(Ürünler sekmesinden erişilen, ürün listesi üstündeki "Excel'den Yükle" butonuyla açılır).

Akış:
1. Dosya seçilir (`.xls`/`.xlsx`), sunucuya yüklenir ve satırlar ayrıştırılır.
2. **Önizleme** gösterilir: kaç benzersiz ürün, kaç varyant, toplam stok adedi; ürün grubu
   başına ad + renk listesi + fiyat özeti tablo halinde listelenir. Bu ekranda tek bir ortak
   **kategori** seçimi yapılır (opsiyonel, boş geçilebilir).
3. "İçe Aktar" butonuna basılınca sunucu tarafında transaction içinde ürün/varyant
   upsert edilir, ardından (ayrı bir arka plan adımı olarak) her yeni/güncellenen ürün için
   Koton görsel arama sırayla çalıştırılır.
4. **Sonuç raporu**: kaç ürün eklendi, kaç ürün güncellendi, kaç varyant eklendi/güncellendi,
   hangi ürünlerde görsel bulunamadı (elle eklenmesi gerekenler ayrıca listelenir).

## 7. Uygulama fazları (Claude Code ile sırayla)

- **Faz A** - `xlsx` paketini ekle, excel'i okuyup satır satır tip güvenli bir listeye
  çeviren `lib/excel-import.ts` yaz (kolon adları örnek dosyadaki gibi sabit kabul edilir,
  eksik/bozuk satır olursa satır no'suyla hata biriktirilir, tüm dosya reddedilmez).
- **Faz B** - Aynı dosyada: satırları ÜRÜN KODU'na göre grupla, Product+ProductVariant+
  Renk/Beden upsert mantığını yaz (transaction, `resolveOptionValueIds` kullan, barkod
  bazlı upsert). Unit-test niteliğinde örnek dosyayla manuel doğrulama yapılır.
- **Faz C** - `lib/koton-images.ts`: barkod→ürün sayfası→görsel+açıklama çekme fonksiyonu,
  hız sınırlı sıralı çalışacak şekilde, hataları yutup loglayacak şekilde (bir ürün
  bulunamazsa/koton hata verirse diğer ürünlerin aktarımı durmaz).
- **Faz D** - `/api/admin/urunler/excel-yukle/route.ts` (parse+önizleme) ve
  `/api/admin/urunler/excel-aktar/route.ts` (asıl aktarım) API route'ları + `AdminUser`
  yetkisi kontrolü (mevcut `require-admin.ts` deseniyle).
- **Faz E** - `/admin/urunler/excel-yukle/page.tsx` ve önizleme/sonuç bileşenleri (mevcut
  admin bileşen kütüphanesi - `card.tsx`, `button.tsx`, `data-table.tsx` vb. - kullanılarak).
  Ürünler sayfasına "Excel'den Yükle" butonu eklenir.
- **Faz F** - Uçtan uca test: örnek `KOTON11052026CHECKLIST.xls` dosyasıyla gerçek (veya
  staging) veritabanında içe aktarma denenir, sonuç admin panelde gözle doğrulanır (ürünler,
  varyantlar, stoklar, renk galerileri).

Kullanıcı tercihi (önceki fazlardan hatırlanıyor): çok fazlı planlarda her fazdan sonra onay
beklenmesin, testler geçtikçe otomatik bir sonraki faza geçilsin - sadece geri dönüşsüz/riskli
adımlarda (burada: gerçek veritabanına yazan Faz F'nin ilk denemesi) durup kullanıcıya
sorulsun.

## 8. Bilinen sınırlar / v1 kapsamı dışı

- Koton dışı marka/tedarikçi ürünleri için görsel bulma yok (yalnızca elle ekleme).
- Koton'da satışı bitmiş/siteden kaldırılmış ürünler için görsel bulunamaz.
- Genel (Koton dışı) görsel arama, ücretli API gerektirdiği için v1'e dahil değil.
- Görseller admin onayı beklemeden otomatik kaydedilir - yanlış eşleşme ihtimaline karşı
  admin panelden ürün fotoğrafları her zaman elle değiştirilebilir/silinebilir (mevcut özellik).
