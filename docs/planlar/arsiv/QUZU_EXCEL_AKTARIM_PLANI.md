# Quzu Markası: Excel ile Ürün Aktarımı (Görsel Aramasız)

**Tarih:** 03.10.2026
**Örnek dosya:** `ornek-veriler/QUZU02102026CHECKLIST.xls`
**Durum:** Uygulandı (2026-10-04)
**Referans:** `DILVIN_EXCEL_AKTARIM_PLANI.md` (aynı kalıp, uygulandı)

## 1. İstek

Admin paneldeki "Excel'den Toplu Ürün Yükle" ekranına **Quzu** markası eklenecek. Kapsam yalnızca
**buton ve kod**. Quzu ürünleri sadece ürün + varyant olarak aktarılacak, **fotoğraf araması
yapılmayacak** (kullanıcı kararı). Fotoğrafları kullanıcı elle ekleyecek.

> ⚠️ **ÇOK ÖNEMLİ: Claude Code ürünleri KENDİSİ YÜKLEMEYECEK.**
> Yerel `.env` canlı Neon veritabanını kullanıyor. Dilvin oturumunda test yüklemesi canlı DB'de
> 21 ürün oluşturdu ve sonradan silinmesi gerekti. Bu sefer **ilk yüklemeyi kullanıcı kendisi
> test edecek**. Claude Code "Aktar" butonuna basmayacak, `/api/admin/urunler/excel-aktar`
> uç noktasını çağırmayacak, DB'ye yazan hiçbir script çalıştırmayacak.

## 2. Excel analizi (QUZU 02.10.2026 checklist)

- Kolon yapısı Koton/Slazenger/Dilvin ile **birebir aynı**. Parser'da değişiklik gerekmiyor.
- 80 satır, **19 ürün**, 80 varyant, toplam stok 140. Tekrarlanan barkod yok. (Sayfa2 boş.)
- FIRMAADI: tüm satırlarda `QUZU`. İ harfi yok, Dilvin'deki marka eşleşme riski burada yok.
  `titleCaseTr("QUZU")` → "Quzu", slug `quzu`.
- ÜRÜN KODU: `27KETK02919`, `26YGML01813`… (Koton tarzı kod, marka ön eki yok).
- KOD4: `KADIN` → "Kadın". KOD6: `2027 KIŞ` → sezon otomatik.
- BEDEN: `S/M/L`, triko hırkada `STD`.
- Renkler: ANTRASİT, LACİVERT, SİYAH, KAHVE, HAKİ, EKRU, MAVİ, BEJ, KIRMIZI.
- KOD3 (ürün grubu, Türkçe): `ETEK`, `PANTOLON`, `MONT`, `GÖMLEK`, `CEKET`, `KABAN`, `HIRKA`,
  `TRENÇKOT`, `YELEK`.

| Ürün kodu | Ürün adı | KOD3 | Renkler | Ad tahmini |
|---|---|---|---|---|
| 26KMNT03013 | Kapitone Gömlek Yaka Kısa Mont | MONT | HAKİ | Mont & Kaban |
| 26KPNT01246 | Kemerli Fitilli Pantolon | PANTOLON | KAHVE, SİYAH | Pantolon |
| 26YGML01813 | Büzgü Detaylı Gömlek | GÖMLEK | EKRU, MAVİ, SİYAH | Gömlek |
| 26YPNT01612 | Kemerli Pantolon | PANTOLON | KAHVE, SİYAH | Pantolon |
| 27KCKT02542 | Yaka Detaylı Ceket | CEKET | KAHVE | Ceket |
| 27KETK02637 | Kemerli Süet Etek | ETEK | KAHVE | Etek |
| 27KETK02919 | Düğme Detaylı Etek | ETEK | ANTRASİT | Etek |
| 27KGML02894 | Nakış Detaylı Gömlek | GÖMLEK | EKRU | Gömlek |
| 27KGML02931 | Düğme Detaylı Gömlek | GÖMLEK | EKRU | Gömlek |
| 27KKBN02895 | Nakış Detaylı Kaban | KABAN | BEJ | Mont & Kaban |
| **27KKRK02966** | **Fermuar Detaylı Kürk** | **KABAN** | BEJ, KAHVE | **YOK, KOD3'e düşer** |
| 27KPNT02733 | Ekose Palazzo Pantolon | PANTOLON | KAHVE | Pantolon |
| 27KPNT02789 | İspanyol Paça Pantolon | PANTOLON | SİYAH | Pantolon |
| 27KPNT02831 | Kemer Detaylı Pantolon | PANTOLON | LACİVERT, SİYAH | Pantolon |
| 27KPNT03009 | Kordon Detaylı Kadife Pantolon | PANTOLON | BEJ, SİYAH | Pantolon |
| 27KTRC02810 | Bağlama Detaylı Trençkot | TRENÇKOT | BEJ, SİYAH | Trençkot |
| 27KTRK02751 | Örgü Desen Triko Hırka | HIRKA | KIRMIZI, LACİVERT | Hırka |
| 27KYLK02754 | Cep Detaylı Şişme Yelek | YELEK | SİYAH | Yelek |
| 27KYLK02920 | Düğme Detaylı Yelek | YELEK | ANTRASİT | Yelek |

Not: Ad tahmini (`guessCategoryFromProductName`) yalnızca DB'de o adda kategori varsa sonuç
döndürür. Örneğin DB'de "Trençkot" veya "Hırka" yoksa ürün yine KOD3'e düşer.

## 3. Quzu sitesi araştırması (bilgi için, bu planda kullanılmıyor)

- quzu.com.tr bir **Shopify** mağazası. `/products.json?limit=250&page=N` tüm kataloğu veriyor
  (03.10.2026'da 917 ürün, 4 sayfa, ~2 sn).
- Varyant SKU'su = `ÜRÜN KODU-renkkodu-beden` (ör. `27KETK02928-198-S`). Görsel dosya adı
  `ÜRÜNKODU_renkkodu.jpg`. Excel ile eşleştirme kolay olurdu.
- **Ancak** bu Excel'deki 19 üründen yalnızca 2'si (26YGML01813, 27KGML02931) sitede yayında.
  2027 Kış ürünlerinin çoğu henüz yüklenmemiş.
- Kullanıcı bu yüzden **fotoğraf aramasını istemedi**. İleride istenirse `brand-image-sources.ts`'e
  yeni bir `"shopify"` stratejisi eklemek mümkün (SKU önekiyle eşleştirme, renk = Shopify "Renk"
  seçeneği). Bu ayrı bir plan konusu.

## 4. Yapılacak değişiklikler (küçük ve cerrahi)

### 4.1 Sihirbaza "Quzu" seçeneği
`src/components/admin/excel-import-wizard.tsx`
- `BRAND_OPTIONS`'a `{ key: "QUZU", label: "Quzu" }` ekle. `BRAND_OPTIONS` ve `brand` state
  tipini `"KOTON" | "SLAZENGER" | "DILVIN" | "QUZU"` yap.
- Dosya seçme adımındaki Dilvin bilgi notunu Quzu için de göster. Metin aynı kalsın, sadece marka
  adı değişsin (ör. `{brand === "DILVIN" || brand === "QUZU"}` koşulu ve `{brandLabel} ürünleri için…`).
  Yeni bir bileşen ya da soyutlama ekleme.
- Görsel adımının mantığına **dokunma**. Strateji null olduğunda zaten atlanıyor.

`src/app/(admin)/admin/urunler/excel-yukle/page.tsx`
- Açıklamada "Diğer markalar (ör. Dilvin)" → "Diğer markalar (ör. Dilvin, Quzu)".

### 4.2 `brand-image-sources.ts`: DOKUNMA
QUZU bu tabloya **eklenmeyecek**. Eklenmediği sürece hiçbir görsel isteği atılmaz, ürünler görselsiz
DRAFT olarak oluşur.

### 4.3 Türkçe KOD3 değerlerini kategori haritasına ekle
`src/lib/excel-import.ts` → `CATEGORY_MAP`'e ekle (Dilvin satırlarının altına):
```ts
ETEK: "Etek",
MONT: "Mont & Kaban",
KABAN: "Mont & Kaban",
GÖMLEK: "Gömlek",
CEKET: "Ceket",
HIRKA: "Hırka",
TRENÇKOT: "Trençkot",
```
Gerekçe: Asıl gerekli olan `KABAN`. "Fermuar Detaylı Kürk" adında anahtar kelime yok, KOD3 haritada
olmadığı için AI önerisine kalıyor. Diğerleri, ad tahmininin boş döndüğü durumlar (kategori DB'de
farklı yazılmış vb.) için güvence.
**Önce DB'deki kategori adlarını kontrol et** (sadece okuma: `prisma.category.findMany`). Haritadaki
değerler DB'deki yazımla birebir aynı olmalı (ör. "Mont & Kaban" mı, "Mont ve Kaban" mı?). Farklıysa
DB'deki yazımı kullan. Var olmayan bir kategori adı yazılırsa önizlemede görünür ve yönetici onaylarsa
oluşturulur (mevcut davranış), ama gereksiz kategori açılmasın.

### 4.4 Ön kontrol (yalnız okuma)
- DB'de farklı yazımla bir "Quzu" markası var mı? (`brand.findMany`, sadece okuma.) Sonucu raporla.
- Bu Excel'deki ürün kodlarından herhangi biri DB'de zaten var mı? Varsa raporla (yükleme
  güncelleme moduna geçer).

## 5. Kapsam dışı (bilerek yapılmıyor)

- **Ürünleri yükleme / test aktarımı yok.** İlk yüklemeyi kullanıcı yapacak.
- Quzu için görsel kaynağı / Shopify stratejisi yok (kullanıcı istemedi, bkz. bölüm 3).
- Açıklama metni varsayılan kalıyor.

## 6. Test (Claude Code, localhost, DB'ye YAZMADAN)

1. `npm run lint` ve `npx tsc --noEmit` temiz.
2. `npm run dev` → `/admin/urunler/excel-yukle`: 1. adımda "**Quzu Ürünleri Ekle**" butonu görünüyor.
3. Quzu'ya tıkla → 2. adımda "Quzu ürünleri için otomatik fotoğraf araması yapılmaz…" notu görünüyor.
   Dilvin'e tıklayınca Dilvin notu hâlâ doğru çıkıyor. Koton/Slazenger'da not yok.
4. **Önizleme (isteğe bağlı):** Önce önizleme route'unun (`excel-yukle`) DB'ye hiç yazmadığını koddan
   doğrula (create/update/upsert/categoryKodMapping yazımı yok). Yazmıyorsa dosyayı seçip önizlemeyi
   gör: 19 ürün grubu, 80 varyant, atlanan satır 0, "Fermuar Detaylı Kürk" → Mont & Kaban. Yazıyorsa
   bu adımı **atla** ve kullanıcıya bildir.
5. **"Aktar" butonuna BASMA.** Sihirbazı önizlemede bırak.

## 7. Kullanıcının yapacağı ilk yükleme testi

1. `/admin/urunler/excel-yukle` → **Quzu Ürünleri Ekle** → `ornek-veriler/QUZU02102026CHECKLIST.xls`.
2. Önizleme: 19 ürün / 80 varyant / stok 140, kategoriler tabloyla uyumlu → **Aktar**.
3. Sonuç: 19 yeni ürün, 80 yeni varyant. Görsel adımı anında bitmeli, her ürün için "otomatik görsel
   kaynağı tanımlı değil" notu çıkmalı.
4. `/admin/markalar`: tek bir "Quzu" markası var, 19 ürün.
5. Bir ürünü aç (ör. 27KPNT02831): marka Quzu, Kadın, 2027 Kış, Taslak, 2 renk × S/M/L, stoklar
   2/2/1.
6. Fotoğrafları ekleyip yayına al.

---

## 8. Claude Code prompt'u (kopyala-yapıştır)

```
Bollmark projesinde QUZU_EXCEL_AKTARIM_PLANI.md dosyasını oku ve uygula. Yüklü skill'leri (özellikle karpathy-guidelines) kullan; değişiklikleri küçük ve cerrahi tut. Referans: DILVIN_EXCEL_AKTARIM_PLANI.md (aynı kalıp).

ÇOK ÖNEMLİ: Ürünleri sen YÜKLEME. Yerel .env canlı Neon DB'ye bağlı. Sihirbazda "Aktar"a basma, /api/admin/urunler/excel-aktar'ı çağırma, DB'ye yazan hiçbir script/sorgu çalıştırma. İlk yüklemeyi ben test edeceğim. DB'de yalnızca okuma sorguları yapabilirsin.

Yapılacaklar:
1) src/components/admin/excel-import-wizard.tsx: BRAND_OPTIONS'a { key: "QUZU", label: "Quzu" } ekle, brand tiplerini genişlet. Dilvin'in "otomatik fotoğraf araması yapılmaz" notunu Quzu seçiliyken de göster (marka adı dinamik). Görsel adımı mantığına dokunma.
2) src/app/(admin)/admin/urunler/excel-yukle/page.tsx: açıklamada "(ör. Dilvin)" → "(ör. Dilvin, Quzu)".
3) src/lib/brand-image-sources.ts: QUZU'yu EKLEME, dosyaya dokunma.
4) src/lib/excel-import.ts CATEGORY_MAP'e ETEK, MONT, KABAN, GÖMLEK, CEKET, HIRKA, TRENÇKOT eşlemelerini ekle (plan 4.3). Önce DB'deki kategori adlarını OKU, haritadaki değerleri DB'deki yazımla birebir aynı yap.
5) Ön kontrol (sadece okuma): DB'de farklı yazımla Quzu markası var mı, Excel'deki 19 ürün kodundan DB'de olan var mı? Bana söyle.

Test: planın 6. bölümü. lint + tsc, butonun ve notun göründüğünü kontrol et. Önizlemeyi ancak önizleme route'unun DB'ye yazmadığını koddan doğruladıktan sonra dene; Aktar'a basma. Test dosyası: ornek-veriler/QUZU02102026CHECKLIST.xls.

Bitince DEPLOY_STATUS.md'ye not düş ("Ürün yüklemesi yapılmadı, ilk yüklemeyi kullanıcı test edecek" diye belirt). Ben localhost'ta kontrol edip onaylamadan commit atma. Onayımdan sonra önce DEPLOY_STATUS.md'yi güncelle, sonra yerel commit at. Ben söylemeden push ETME.
```
