# Dilvin Markası – Excel ile Ürün Aktarımı (Görsel Aramasız)

**Tarih:** 03.10.2026
**Örnek dosya:** `ornek-veriler/DILVIN02102026CHECKLIST.xls`
**Durum:** Uygulandı (2026-10-03)

## 1. İstek

Admin paneldeki "Excel'den Toplu Ürün Yükle" ekranına Dilvin markası eklenecek. Dilvin ürünleri
yalnızca ürün + varyant olarak aktarılacak. **Fotoğraf araması yapılmayacak**, fotoğraflar elle eklenecek.

## 2. Excel analizi (DİLVİN 02.10.2026 checklist)

- Kolon yapısı Koton/Slazenger ile **birebir aynı** (ÜRÜN KODU, ÜRÜN ADI, BARKOD, KOD3, KOD4, KOD6, RENK, BEDEN, AFIYATI, SFIYAT1, FIRMAADI, MİKTAR…). Parser'da değişiklik gerekmiyor.
- 83 satır → **21 ürün**, 83 varyant, toplam stok 258. Tekrarlanan barkod yok.
- FIRMAADI: tüm satırlarda `DİLVİN` (Türkçe büyük İ).
- ÜRÜN KODU: `DİLVİN 1267`, `DİLVİN 72353`… (marka adı + boşluk + numara). Mevcut kod bunu olduğu gibi kabul ediyor, değiştirmiyoruz.
- KOD3 (ürün grubu): `KAZAK`, `BLUZ`, `PANTOLON`, `YELEK`. Türkçe geliyor, `CATEGORY_MAP`'te yoklar (Koton İngilizce gönderiyor).
- KOD4: `KADIN` → mevcut GENDER_MAP'te var → "Kadın".
- KOD6: `2027 KIŞ` → sezon otomatik oluşur (seasons.ts).
- BEDEN: `STD` (tek beden triko/kazak), `S/M/L`, `34/36/38/40` (pantolon). Hepsi mevcut akışla Beden değeri olarak oluşur.
- Renkler: SİYAH, KOYU KAHVE, LACİVERT, EKRU, KOYU KIRMIZI, KAHVE, FÜME, AÇIK LACİVERT, MAVİ, BEJ, ANTRASİT, İNDİGO, KOYU VİZON.

## 3. Kod incelemesi: ne zaten hazır?

| Konu | Durum |
|---|---|
| Excel parse + ÜRÜN KODU'na göre gruplama | Hazır, marka bağımsız |
| Marka otomatik oluşturma (FIRMAADI) | Hazır, ama **İ harfi hatası var** (bkz. 4.2) |
| Görsel aramayı atlama | **Zaten hazır.** `brand-image-sources.ts` tablosunda olmayan markalar için `imageSourceStrategy = null` dönüyor; sihirbaz (`excel-import-wizard.tsx`) bu ürünlerde `gorsel-getir`'i hiç çağırmıyor, 900 ms bekleme de yapmıyor. Sonuç ekranında "Bu marka için otomatik görsel kaynağı tanımlı değil, görseller elle eklenmeli" yazıyor. |
| Yeni ürünler DRAFT olarak oluşur | Hazır. Fotoğraflar eklenip yayına alınana kadar sitede görünmezler. |
| Marka seçim ekranı | **Eksik:** `BRAND_OPTIONS` sadece Koton ve Slazenger |

**Sonuç:** DİLVİN, `BRAND_IMAGE_SOURCES`'a **EKLENMEMELİ**. Eklenmediği sürece hiçbir görsel isteği atılmaz.

## 4. Yapılacak değişiklikler (küçük ve cerrahi)

### 4.1 Sihirbaza "Dilvin" seçeneği
`src/components/admin/excel-import-wizard.tsx`
- `BRAND_OPTIONS`'a `{ key: "DILVIN", label: "Dilvin" }` ekle. `brand` state tipini ve `BRAND_OPTIONS` tipini `"KOTON" | "SLAZENGER" | "DILVIN"` yap.
- Dilvin seçiliyken 2. adımda (dosya seç) kısa bir bilgi notu göster: *"Dilvin ürünleri için otomatik fotoğraf araması yapılmaz. Ürünler taslak olarak oluşturulur, fotoğrafları ürün sayfasından elle ekleyin."*
- Görsel adımının mantığına **dokunma**. Strateji null olduğunda zaten atlanıyor.

`src/app/(admin)/admin/urunler/excel-yukle/page.tsx`
- Açıklama metnini güncelle: desteklenen markalar (Koton, Slazenger) için otomatik görsel; diğer markalar (ör. Dilvin) sadece ürün/varyant olarak aktarılır.

### 4.2 Hata düzeltme: "DİLVİN" ikinci yüklemede marka çakışması
`src/lib/excel-import.ts` → `resolveBrandId`

Sorun: İlk yüklemede marka `titleCaseTr("DİLVİN") = "Dilvin"` adıyla, `slug = "dilvin"` olarak oluşur.
İkinci Dilvin dosyasında `findFirst({ name: { equals: "DİLVİN", mode: "insensitive" } })`
Postgres'te `İ` ile `i` harflerini eşleştiremeyebilir (`lower('İ')` → `i̇`). Marka bulunamazsa
yeniden oluşturulmaya çalışılır, `slug` unique olduğu için **tüm aktarım hata verip geri alınır**.
Koton/Slazenger'da İ harfi olmadığından bu sorun şimdiye kadar çıkmadı.

Düzeltme: Arama önce `slug = slugifyTr(titleCaseTr(trimmed))` ile, sonra `name` (displayName) ile `insensitive` yapılsın. İkisinden biri eşleşirse mevcut marka kullanılsın, yeni marka oluşturulmasın. Başka davranış değişmez.

Ayrıca uygulamadan önce DB'de "Dilvin" adında (farklı yazımla) zaten bir marka var mı kontrol et (`/admin/markalar`). Varsa aktarım onu kullanmalı, ikinci bir marka açılmamalı.

### 4.3 Türkçe KOD3 değerlerini kategori haritasına ekle
`src/lib/excel-import.ts` → `CATEGORY_MAP`'e ekle:
```ts
KAZAK: "Kazak & Süveter",
BLUZ: "Bluz",
PANTOLON: "Pantolon",
YELEK: "Yelek",
```
Gerekçe: Ürün adı tahmini çoğu Dilvin ürününü zaten doğru buluyor (Kazak, Pantolon, Yelek).
Ama "Kayık Yaka Uzun Kollu Top" ve "Dantel Top" adlarında anahtar kelime yok. Bu ürünler
KOD3'e düşüyor ve `BLUZ` haritada olmadığı için AI önerisine kalıyor. Eşleme eklenince doğrudan "Bluz" olur.
Not: Bu kategori adları DB'de yoksa `mapCategoryName` sonucu önizlemede gösterilir; yönetici onaylarsa `getOrCreateCategoryId` oluşturur. Mevcut davranış korunuyor.

## 5. Kapsam dışı (bilerek yapılmıyor)

- Dilvin için görsel kaynağı/site araştırması yok (kullanıcı istemiyor).
- ÜRÜN KODU'ndaki "DİLVİN " ön ekini temizleme yok (mevcut ürün kodu davranışını bozmamak için).
- Açıklama metni şimdilik varsayılan ("… Detaylı ürün açıklaması yakında eklenecek.").

## 6. Test (localhost)

1. `npm run dev`, ardından `/admin/urunler/excel-yukle` → **Dilvin Ürünleri Ekle** → `ornek-veriler/DILVIN02102026CHECKLIST.xls`.
2. Önizleme: 21 ürün grubu, 83 varyant, hata satırı yok. Kategori kutuları: kazaklar → Kazak & Süveter, "Top"lar ve Triko Bluz → Bluz, pantolonlar → Pantolon, yelek → Yelek.
3. Aktar: 21 ürün oluştu / 83 varyant oluştu. Görsel adımı anında biter, ağ sekmesinde **hiç `gorsel-getir` isteği yok**. Sonuç listesinde her ürün için "otomatik görsel kaynağı tanımlı değil" notu var.
4. `/admin/markalar`: tek bir "Dilvin" markası var.
5. **Aynı dosyayı tekrar yükle:** hata yok, 0 ürün oluştu / 21 güncellendi, 83 varyant güncellendi. Hâlâ tek "Dilvin" markası var (4.2'nin testi).
6. Bir ürünü aç: marka Dilvin, cinsiyet Kadın, sezon 2027 KIŞ, durum Taslak, renk/beden varyantları ve stoklar doğru (ör. DİLVİN 1267 → 5 renk × STD, her biri 10 adet).
7. `npm run lint` ve `npx tsc --noEmit` temiz.

Test ürünleri localhost DB'si canlı DB ise (Neon tek DB kullanılıyorsa) bu ürünler DRAFT olduğu için sitede görünmez. Kullanıcı fotoğrafları elle ekleyip yayına alacak.

---

## 7. Claude Code prompt'u (kopyala-yapıştır)

```
Bollmark projesinde DILVIN_EXCEL_AKTARIM_PLANI.md dosyasını oku ve uygula. Yüklü skill'leri (özellikle karpathy-guidelines) kullan; değişiklikleri küçük ve cerrahi tut.

Özet:
1) src/components/admin/excel-import-wizard.tsx: BRAND_OPTIONS'a { key: "DILVIN", label: "Dilvin" } ekle, brand tiplerini genişlet. Dilvin seçiliyken dosya seçme adımında "otomatik fotoğraf araması yapılmaz, ürünler taslak oluşturulur, fotoğrafları elle ekleyin" bilgi notunu göster. Görsel adımı mantığına dokunma (strateji null iken zaten atlanıyor).
2) src/app/(admin)/admin/urunler/excel-yukle/page.tsx: açıklama metnini plandaki gibi güncelle.
3) src/lib/brand-image-sources.ts: DİLVİN'i EKLEME. Dosyaya dokunma.
4) src/lib/excel-import.ts:
   a) resolveBrandId: önce slug (slugifyTr(titleCaseTr(name))) ile, sonra displayName ile insensitive ara. "DİLVİN" ikinci kez yüklendiğinde slug unique hatası olmasın.
   b) CATEGORY_MAP'e KAZAK→"Kazak & Süveter", BLUZ→"Bluz", PANTOLON→"Pantolon", YELEK→"Yelek" ekle.
5) Başlamadan önce DB'de farklı yazımla bir Dilvin markası var mı kontrol et ve bana söyle.

Sonra planın 6. bölümündeki testleri localhost'ta sırayla yap. Özellikle aynı dosyanın ikinci kez yüklenmesini ve ağ sekmesinde hiç gorsel-getir isteği olmadığını doğrula. Test dosyası: ornek-veriler/DILVIN02102026CHECKLIST.xls. lint ve tsc'yi çalıştır.

Bitince DEPLOY_STATUS.md'ye not düş. Ben localhost'ta kontrol edip onaylamadan commit atma. Onayımdan sonra önce DEPLOY_STATUS.md'yi güncelle, sonra yerel commit at. Ben söylemeden push ETME.
```
