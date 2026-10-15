# Excel Aktarımına WE Company Markasını Ekleme Planı

Durum: uygulandı (2026-10-15), kod push edildi. Kalan: kullanıcının WE dosyasını aktarması
Tarih: 2026-10-15
Örnek dosya: `ornek-veriler/WE14102026CHECKLIST.xls` (7 satır, 1 ürün: `7S79002H`
LENA KADIN KOL VE OMUZ ÇANTA, 7 renk, beden STD, toplam 12 adet stok)

## Amaç

Admin > Ürünler > Excel Yükle sihirbazına **WE Company** seçeneği eklemek. Otomatik
fotoğraf araması **yapılmayacak**; fotoğrafları kullanıcı ürün sayfasından elle
yükleyecek (Dilvin / Twister ile aynı davranış).

## Dosya incelemesi – ne farklı?

Kolon yapısı diğer checklist'lerle birebir aynı (ÜRÜN KODU … MİKTAR), parser'da
kolon değişikliği gerekmiyor. Farklar:

| Konu | WE dosyasında | Etkisi |
|---|---|---|
| **FIRMAADI** | `KOTON` (tedarikçi Koton). Gerçek marka `KOD2 = KOD7 = WE COMPANY` | **Düzeltilmezse ürün mevcut "Koton" markasına bağlanır.** Twister'daki gibi alias ile çözülemez: `KOTON → WE` alias'ı gerçek Koton dosyalarını bozar. Asıl düzeltme bu. |
| KOD3 | `AKSESUAR` | Çok genel, CATEGORY_MAP'e **eklenmemeli**. Ürün adında "ÇANTA" geçiyor ama ad tahmini listesinde "çanta" yok → kategori eşleşmez, AI önerisine/fallback'e düşer. |
| KOD4 | `UNISEX` | Ürün adı "**KADIN** … ÇANTA" diyor. UNISEX → "Unisex" olur; Kadın mega menüsünde görünmez. |
| KOD6 | `HER SEZON` | `normalizeSeason` tanımıyor → "HER SEZON" adlı, rank 0 sezon oluşur, önizlemede uyarı çıkar. Çalışır. |
| RENK | SÜET HAKİ, SÜET SİYAH, SÜET VİZON, KAHVERENGİ, BORDO, SİYAH, VİZON | Normal; "SİYAH" ile "SÜET SİYAH" ayrı renk olur (doğru). |
| BEDEN | `STD` | Normal. |
| AFIYATI | 2 belge, 2 farklı maliyet (584,78 / 526,30) | Ürün başına tek maliyet, ilk satırınki alınır (584,78). Satış fiyatı hepsinde 1190. |
| Barkod | Tekrar yok | – |

### KOD7 kontrolü (tüm örnek dosyalar)

| Dosya | FIRMAADI | KOD7 |
|---|---|---|
| Koton | KOTON | KOTON |
| Dilvin | DİLVİN | DİLVİN |
| Quzu | QUZU | QUZU |
| Sateen | SATEN | SATEEN |
| Slazenger (2 dosya) | SLAZENGER | SLAZENGER |
| Twister | HVS GİYİM | TWISTER |
| **WE** | **KOTON** | **WE COMPANY** |

KOD7 her dosyada doğru markayı taşıyor. Twister planında "HVS Giyim başka marka
gönderirse marka KOD7'den okunmalı" notu düşülmüştü; o durum şimdi Koton
tedarikçisi için gerçekleşti.

## Yapılacaklar

### 1. Marka kaynağını KOD7'ye taşı – `src/lib/excel-import.ts` (`parseExcelFile`)
- `rawBrandName = KOD7 || FIRMAADI || "Koton"` (KOD7 boşsa eski davranış).
- `BRAND_NAME_ALIASES` sonuca uygulanmaya devam etsin. **`TWISTER: "Twister"`
  alias'ı eklenmeli**: aksi halde `titleCaseTr("TWISTER")` → "Twıster" olur, slug
  `twıster` mevcut `twister` markasını bulamaz, yeni marka oluşur. Mevcut
  `SATEN` ve `HVS GİYİM` alias'ları KOD7 boş gelirse yedek olarak kalsın.
- `ExcelImportRow` yorumundaki `brandName: FIRMAADI` notu ve alias yorumu güncellensin.
- **Kullanıcı kararı (2026-10-15): WE Company ürünlerinin markası "Bollmark" olacak.**
  `BRAND_NAME_ALIASES`'a `"WE COMPANY": "Bollmark"` ekle. Sonuç: marka **Bollmark**,
  slug **bollmark** (DB'de varsa ona bağlanır, yoksa oluşur). KOD7'ye geçiş yine
  gerekli: FIRMAADI "KOTON" olduğu için alias tek başına yetmez.

### 2. Kategori: "çanta" anahtar kelimesi – aynı dosya
`PRODUCT_NAME_CATEGORY_KEYWORDS`'e `{ category: "Çanta", keywords: ["çanta"] }` ekle.
`guessCategoryFromProductName` yalnız DB'de var olan adı döndürdüğü için, DB'de
"Çanta" kategorisi yoksa etkisi olmaz. **Önce DB'de salt-okuma ile kontrol et**:
"Çanta" kategorisi var mı, `aksesuar` slug'lı üst kategorinin altında mı? (Aksesuar
mega menüsü yalnız `aksesuar`'ın alt kategorilerini gösteriyor, `site-nav.ts`.)
Yoksa **oluşturma**, kullanıcıya söyle; kullanıcı admin'den açar.

### 3. Cinsiyet: UNISEX + ürün adında KADIN/ERKEK – aynı dosya
`mapGender`'ın yanına ürün adını da alan küçük bir yardımcı: KOD4 `UNISEX` ise ve
ürün adında bağımsız kelime olarak `KADIN` (→ Kadın) ya da `ERKEK` (→ Erkek) geçiyorsa
onu kullan; aksi halde mevcut eşleme. Ürün oluşturmada (`importProductGroups`) ve
önizleme cinsiyeti nerede hesaplanıyorsa orada aynı yardımcı kullanılsın.
Regresyon: Slazenger'deki 14 UNISEX satır (çoraplar) adında KADIN/ERKEK içermiyor →
etkilenmez; test et.

### 4. Sihirbaza WE Company seçeneği – `src/components/admin/excel-import-wizard.tsx`
- `BRAND_OPTIONS`'a `{ key: "WE_COMPANY", label: "WE Company" }`, union tiplerine
  `"WE_COMPANY"`.
- Dilvin/Twister bilgi kutusunun koşuluna `brand === "WE_COMPANY"` ekle ("otomatik
  fotoğraf araması yapılmaz… fotoğrafları ürün sayfasından elle ekleyin").

### 5. Görsel arama – değişiklik YOK
"WE COMPANY" `BRAND_IMAGE_SOURCES`'a ve `MANUAL_LINK_BRANDS`'e **eklenmeyecek**.

### 6. Örnek dosya
`ornek-veriler/WE14102026CHECKLIST.xls` klasöre konuldu.

## Doğrulama (localhost)

1. Kısa script/test ile `parseExcelFile`: **tüm 8 örnek dosyada** marka adı eskisiyle
   aynı çıkmalı (KOTON, DİLVİN, QUZU, SATEEN, SLAZENGER, Twister) ve WE dosyasında
   7 satır, 0 hata, `brandName` "WE COMPANY", 1 grup. `titleCaseTr`+`slugifyTr`
   sonucu Twister için `twister`, WE için `we-company`.
2. Cinsiyet yardımcısı: WE ürünü → Kadın; Slazenger UNISEX çoraplar → Unisex;
   Koton MEN → Erkek.
3. Admin > Excel Yükle > WE Company > dosya seç → önizlemede marka We Company
   (Koton değil), kategori Çanta (DB'de varsa), cinsiyet Kadın, sezon uyarısı
   "HER SEZON".
4. **Aktarımı çalıştırmadan dur** – yerel ve canlı site aynı veritabanını kullanıyor.
   Gerçek aktarımı kullanıcı onaylayınca kendisi yapar.
5. `npm run lint` ve `npx tsc --noEmit` temiz.

## Açık kararlar (varsayılanlar parantez içinde)

1. **Marka görünen adı:** "We Company" mı, "WE Company" mi? (Varsayılan: "We Company",
   otomatik Title Case; istenirse marka adı admin > Markalar'dan düzeltilir, slug
   zaten `we-company`.)
2. **"HER SEZON" sezonu:** olduğu gibi rank 0 kalsın mı? (Varsayılan: evet; istenirse
   Sezonlar ekranından ad/sıra düzenlenir.)
3. **Ürün adı büyük harf** ("LENA KADIN KOL VE OMUZ ÇANTA"): Twister'daki gibi olduğu
   gibi bırakılır, ürün DRAFT oluşur, kullanıcı elle düzeltir.
