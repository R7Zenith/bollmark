# Excel Aktarımına Twister Markasını Ekleme Planı

Tarih: 2026-10-13
Örnek dosya: `ornek-veriler/TWISTER03102026CHECKLIST.xls` (253 satır, 22 ürün, 301 adet stok)

## Amaç

Admin > Ürünler > Excel Yükle sihirbazına **Twister** seçeneği eklemek. Twister
ürünleri için otomatik fotoğraf araması **yapılmayacak**; fotoğraflar ürün
sayfasından elle yüklenecek (Dilvin ile aynı davranış).

## Dosya incelemesi – ne farklı?

Dosyanın kolon yapısı Koton/Dilvin/Quzu/Sateen checklist'leriyle birebir aynı
(ÜRÜN KODU, ÜRÜN ADI, BARKOD, KOD1–KOD8, RENK, BEDEN, AFIYATI, SFIYAT1, FIRMAADI,
MİKTAR...). Parser değişikliği gerekmiyor. Farklar:

| Konu | Twister dosyasında | Etkisi |
|---|---|---|
| **FIRMAADI** | `HVS GİYİM` (tedarikçi firma), marka adı değil. Gerçek marka `KOD7 = TWISTER` | **Düzeltilmezse ürünler "Hvs Giyim" adlı yeni bir markayla oluşur.** Asıl düzeltme bu. |
| KOD3 | `SWEATSHIRT` (tekil), `EŞOFMAN`, `PANTOLON`, `GÖMLEK` | `SWEATSHIRT` ve `EŞOFMAN` CATEGORY_MAP'te yok. Ürün adı tahmini zaten yakalıyor (adların hepsi tür kelimesiyle bitiyor) ama yedek olarak haritaya eklenmeli. |
| KOD4 | `ERKEK` / `KADIN` | Mevcut GENDER_MAP karşılıyor. |
| KOD6 | `2027 KIŞ` | `normalizeSeason` karşılıyor → "2027 Kış". |
| BEDEN | Üst giyim S–XXL, pantolon `31/32`, `34/30` gibi | Yeni Beden değerleri otomatik oluşur, sorun yok. |
| Barkod | Tekrar yok | – |
| ÜRÜN ADI | `BG 857 GÖMLEK`, `PANAMA X 866-05 A PANTOLON` (kod + tür, büyük harf) | Sitede çirkin görünür. Bkz. "Açık kararlar". |
| Fiyat | 2 üründe renge göre farklı satış fiyatı: `ESW POLAR 2912` (Siyah 1490 / Füme 1590), `MARTIN 872 B` (Haki-Toprak 1590 / Kahve-Zeytin 1690) | Sistem ürün başına tek fiyat tutuyor, ilk satırın fiyatı alınır (1490 ve 1590). Bkz. "Açık kararlar". |

Not: Diğer tüm örnek dosyalarda KOD7 zaten doğru marka adını taşıyor (Sateen'de
FIRMAADI "SATEN" iken KOD7 "SATEEN"). Yine de kapsamı küçük tutmak için bu planda
sadece alias ekleniyor, marka kaynağı KOD7'ye taşınmıyor.

## Yapılacaklar

### 1. Marka alias'ı – `src/lib/excel-import.ts`
`BRAND_NAME_ALIASES` sözlüğüne `"HVS GİYİM": "TWISTER"` ekle (Sateen için yapılanın
aynısı). Anahtar `rawBrandName.toUpperCase()` ile karşılaştırılıyor; "HVS GİYİM"
zaten büyük harf, `İ` JS'de toUpperCase'te bozulmuyor – yine de testle doğrula.
Sonuç: `titleCaseTr("TWISTER")` → **Twister**, slug **twister**. DB'de Twister
markası varsa ona bağlanır, yoksa oluşturulur.

Yorum satırına not: HVS Giyim ileride başka marka gönderirse bu alias yanlış olur;
o zaman marka KOD7'den okunmalı.

### 2. KOD3 yedek eşlemeleri – `src/lib/excel-import.ts`
`CATEGORY_MAP`'e ekle:
- `SWEATSHIRT: "Sweatshirt"`
- `EŞOFMAN: "Eşofman"`

### 3. Sihirbaza Twister seçeneği – `src/components/admin/excel-import-wizard.tsx`
- `BRAND_OPTIONS`'a `{ key: "TWISTER", label: "Twister" }` ekle; `brand` state'inin
  ve BRAND_OPTIONS'ın union tipine `"TWISTER"` ekle.
- Yükleme adımındaki Dilvin bilgi kutusunu Twister'ı da kapsayacak şekilde genişlet
  (`brand === "DILVIN" || brand === "TWISTER"`): "otomatik fotoğraf araması yapılmaz,
  ürünler taslak oluşturulur, fotoğrafları ürün sayfasından elle ekleyin".

### 4. Görsel arama – değişiklik YOK
Twister `BRAND_IMAGE_SOURCES`'ta yok → `imageSourceStrategy` null → sihirbaz
`gorsel-getir`'i hiç çağırmadan atlıyor. `MANUAL_LINK_BRANDS`'e de **eklenmeyecek**
(fotoğraflar "Linkle Ekle" ile değil, elle yüklenecek).

### 5. Örnek dosya
`ornek-veriler/TWISTER03102026CHECKLIST.xls` klasöre konuldu; test için bu kullanılsın.

## Doğrulama (localhost)

1. `parseExcelFile` ile örnek dosyayı okuyan kısa bir script/test: 253 satır, 0 hata,
   tüm satırlarda `brandName === "TWISTER"`, 22 grup.
2. Admin > Excel Yükle > Twister > dosya seç → önizlemede:
   - Marka sütunu "TWISTER" (Hvs Giyim değil),
   - Kategoriler: Gömlek / Eşofman / Sweatshirt / Pantolon (DB'de olanlar),
   - Cinsiyet Erkek/Kadın, Sezon "2027 Kış".
3. **Aktarımı çalıştırmadan dur** – yerel ve canlı site aynı veritabanını kullanıyor.
   Gerçek aktarımı kullanıcı onaylayınca kullanıcı kendisi yapar.
4. `npm run lint` ve `npx tsc --noEmit` temiz.

## Açık kararlar (kullanıcıya sorulacak, bu planın kapsamında değil)

1. **Ürün adları:** "BG 857 GÖMLEK" olduğu gibi mi kalsın, yoksa aktarımda
   "Bg 857 Gömlek" gibi Title Case'e mi çevrilsin / elle mi düzeltilecek?
   Varsayılan: olduğu gibi bırak, ürünler zaten DRAFT oluşuyor.
2. **Renge göre farklı fiyat:** 2 üründe ilk satırın fiyatı tüm renklere uygulanır.
   Varsayılan: dokunma, kullanıcı aktarımdan sonra bu 2 ürünün fiyatını kontrol etsin.
