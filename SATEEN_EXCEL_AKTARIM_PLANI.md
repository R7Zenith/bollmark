# Sateen Markası: Excel Aktarımı + "Linkle Ekle" (Quzu ile aynı kalıp)

**Tarih:** 04.10.2026
**Örnek dosya:** `ornek-veriler/SATEEN02102026CHECKLIST.xls`
**Durum:** Uygulama bekliyor
**Referans:** `QUZU_EXCEL_AKTARIM_PLANI.md` ve DEPLOY_STATUS'taki "Quzu için renk seçmeli Linkle Ekle" ve "3:4 dolgu" notları (uygulandı, canlıda)

## 1. İstek

- Admin "Excel'den Toplu Ürün Yükle" ekranına **Sateen** butonu eklenecek. Ürünler sadece ürün + varyant olarak aktarılacak, **otomatik fotoğraf araması yok**.
- Ürünler tablosundaki **"Linkle Ekle"** butonu Sateen ürünlerinde de Quzu'daki gibi çalışacak: renk seç + link yapıştır. Kullanıcı fotoğrafları şu iki siteden çekecek:
  - `https://www.saten.com/` (perakende; `sateen.com` buraya yönlendiriyor)
  - `https://toptan.sateen.com/` (toptan)

> ⚠️ **Claude Code ürünleri KENDİSİ YÜKLEMEYECEK** (Quzu'daki kural aynen geçerli). Yerel `.env` canlı Neon DB'ye bağlı.
> "Aktar"a basma, `/api/admin/urunler/excel-aktar`'ı çağırma, DB'ye yazan script çalıştırma, "Linkle Ekle" ile gerçek ürüne fotoğraf ekleme.
> İlk yüklemeyi ve ilk "Linkle Ekle"yi kullanıcı yapacak.

## 2. Excel analizi (SATEEN 02.10.2026 checklist)

- Kolon yapısı diğer markalarla **birebir aynı**. 161 satır, **30 ürün**, 161 varyant, toplam stok 205. Tekrarlanan barkod yok. Sayfa2 boş.
- **DİKKAT: FIRMAADI = `SATEN`** (tek E). KOD2 ve KOD7 ise `SATEEN`, ürün kodları `SATEEN 2349-6637` biçiminde.
  Mevcut kod markayı FIRMAADI'den oluşturduğu için marka **"Saten"** adıyla açılır. Doğru marka adı **"Sateen"** (sitenin ve markanın adı; "saten" ayrıca bir kumaş adı, karışıklık yaratır). Bkz. 4.1.
- KOD4: `KADIN`. KOD6: `2027 KIŞ`. Bedenler: `36/38/40/42` (bazı üründe 36-40).
- Renkler: SİYAH, KAHVE, KAHVERENGİ, VİZON, EKRU, BEJ, MÜRDÜM, LACİVERT, ANTRASİT, GRİ, MAVİ, BORDO.
- KOD3 değerleri: `CEKET, PANTOLON, BLUZ, GÖMLEK, KABAN, ETEK, ELBİSE, TAKIM`. İlk 6'sı `CATEGORY_MAP`'te zaten var (Dilvin/Quzu ile eklendi).
  **Eksikler:** `ELBİSE` ("Düğme Detaylı Elbise", ad tahmini zaten "Elbise" bulur, güvence için) ve `TAKIM` ("Linda Takım", adda tanınan bir anahtar kelime yok).
- "Leopar Kürk" → KABAN → Mont & Kaban (mevcut harita).

## 3. Site araştırması (04.10.2026, tarayıcıda test edildi)

| | saten.com | toptan.sateen.com |
|---|---|---|
| Altyapı | Ticimax | Ticimax |
| Ürün sayfası | Her renk ayrı sayfa, ör. `/bedene-oturan-kadife-ceket-kahve-138080` | Her renk ayrı sayfa, ör. `/dugmeli-klasik-ceket-siyah-9396` |
| `ld+json` Product | Var, `image` dizisi (6 fotoğraf) | Var, `image` dizisi (5 fotoğraf), fiyat yok |
| Fotoğraf boyutu | 1200x1800 (2:3) | static.ticimax.cloud, aynı yapı |
| SKU | `STN139KCE2365-01436` (Excel'deki `2365-6641`'in `2365` kısmını içeriyor) | `STN139KCE2240-5` |

**Sonuç:** Mevcut `src/lib/link-images.ts` içindeki "Diğer (Ticimax): ld+json Product image" yolu bu iki siteyi **kod değişikliği olmadan** okuyabiliyor. Fotoğraflar 2:3 olduğu için Quzu'daki `padToCardRatio` (3:4 ayna dolgu) aynen uygun, baş/ayak kırpılmaz.
Tarayıcıda test edildi. Sunucudan, `BollmarkImportBot` User-Agent'ıyla da çalıştığını Claude Code ayrıca doğrulamalı (bkz. 6.4). Ticimax bazı botları engelleyebiliyor. Quzu wholesale (Ticimax) ile sorun çıkmamıştı.

## 4. Yapılacak değişiklikler (küçük ve cerrahi)

### 4.1 Marka adı düzeltmesi: SATEN → Sateen
`src/lib/excel-import.ts` → satırları okuyan yer (`const brandName = String(raw["FIRMAADI"] ...`):
- Küçük bir eşleme ekle: `const BRAND_NAME_ALIASES: Record<string, string> = { SATEN: "SATEEN" };`
  `brandName = BRAND_NAME_ALIASES[brandName.toUpperCase()] ?? brandName`
- Böylece marka "Sateen" (slug `sateen`) olarak oluşur. Önizleme, `resolveBrandId`, `resolveImageSourceForBrand` ve `isManualLinkBrand` hep `SATEEN` görür.
- **Önce DB'yi oku (sadece okuma):** "Saten" veya "Sateen" adında bir marka zaten var mı? Varsa hangi adla olduğunu bana söyle. "Saten" adıyla varsa ve ürünü yoksa ne yapılacağını bana sor, kendin silme/yeniden adlandırma.

### 4.2 "Linkle Ekle" Sateen'de de çalışsın
`src/lib/brand-image-sources.ts`: `MANUAL_LINK_BRANDS`'e `"SATEEN"` ekle → `new Set(["QUZU", "SATEEN"])`.
**`BRAND_IMAGE_SOURCES`'a EKLEME** (otomatik arama tetiklenir).

Sonra kodda `QUZU`'nun **elle yazıldığı** başka yer var mı kontrol et:
`grep -rn "QUZU\|Quzu" src`
Örneğin ürünler tablosundaki renk seçmeli pencere, `gorsel-ekle` route'undaki `body.color` kontrolü. Bunlar `isManualLinkBrand(...)` yerine `"QUZU"` ile karşılaştırma yapıyorsa `isManualLinkBrand`'e çevir. Böylece ileride yeni marka eklemek tek satır olur. Arayüz metinlerinde "Quzu" geçiyorsa marka adını dinamik yap.

`src/lib/link-images.ts`: Mantığa dokunma. Sadece en üstteki açıklama yorumuna `saten.com` ve `toptan.sateen.com` (Ticimax, ld+json) eklenebilir.

### 4.3 Excel sihirbazına "Sateen" butonu
`src/components/admin/excel-import-wizard.tsx`:
- `BRAND_OPTIONS`'a `{ key: "SATEEN", label: "Sateen" }` ekle, tipleri genişlet.
- Dosya seçme adımındaki bilgi notu Sateen için de görünsün (Dilvin/Quzu koşuluna ekle).
- Quzu ve Sateen için not metni: *"{Marka} ürünleri için otomatik fotoğraf araması yapılmaz. Ürünler taslak olarak oluşturulur. Fotoğrafları Ürünler listesindeki 'Linkle Ekle' butonuyla, ürün sayfasının linkini yapıştırarak ekleyin."*
  Dilvin'in metni aynı kalsın ("elle ekleyin"), çünkü Dilvin'de link yok.

`src/app/(admin)/admin/urunler/excel-yukle/page.tsx`: açıklamada "(ör. Dilvin, Quzu)" → "(ör. Dilvin, Quzu, Sateen)".

### 4.4 Kategori haritası
`src/lib/excel-import.ts` → `CATEGORY_MAP`:
- `ELBİSE: "Elbise"` ekle.
- `TAKIM`: **Önce DB'de "Takım" (veya benzeri) kategori var mı OKU.** Varsa DB'deki yazımla ekle. Yoksa ekleme. Önizlemede yönetici seçer, bana durumu bildir.
- Not: `normalizeKod3` `toUpperCase()` kullanıyor, "ELBİSE" anahtarı İ ile aynen eşleşir. Yine de önizlemede doğrula.

## 5. Kapsam dışı

- Ürün yükleme veya gerçek ürüne fotoğraf ekleme yok (kullanıcı yapacak).
- Sateen için otomatik görsel arama yok. SKU ile eşleştirme mümkün görünse de istenmedi.
- Ürün kodundaki "SATEEN " ön eki temizlenmiyor (Dilvin'deki gibi mevcut davranış).

## 6. Test (Claude Code, localhost, DB'ye YAZMADAN)

1. `npx tsc --noEmit`, `npm run lint` temiz.
2. `/admin/urunler/excel-yukle`: "Sateen Ürünleri Ekle" butonu var. Tıklayınca Linkle Ekle'yi anlatan not çıkıyor. Quzu notu da yeni metinde. Dilvin notu değişmedi.
3. **Önizleme (isteğe bağlı):** Önizleme route'unun DB'ye yazmadığını koddan doğrula, sonra dosyayı seç. 30 ürün / 161 varyant / stok 205, atlanan 0. **Marka sütunu "Sateen"** (Saten değil). Elbise → Elbise, Takım durumu raporlanacak. **Aktar'a BASMA.**
4. **Link okuma testi (DB'ye ve depoya YAZMADAN):** Geçici bir tsx script ya da node REPL ile yalnız `fetchImageUrls` mantığını (gerekirse export etmeden kopyalayarak) `BollmarkImportBot` User-Agent'ıyla şu iki linkte çalıştır:
   - `https://www.saten.com/bedene-oturan-kadife-ceket-kahve-138080`
   - `https://toptan.sateen.com/dugmeli-klasik-ceket-siyah-9396`
   Her biri için fotoğraf URL sayısını raporla (beklenen ~6 ve ~5).
   **Görsel indirme/R2 yükleme/DB yazma YOK.** Script'i test sonunda sil.
   403 veya 0 sonuç çıkarsa bana bildir, kendi başına User-Agent'ı tarayıcı taklidine çevirme, önce sor.
5. Ürünler listesinde mevcut bir Quzu ürününde "Linkle Ekle" penceresinin hâlâ açıldığını gör (pencereyi açıp **İptal** et, kaydetme).

## 7. Kullanıcının yapacağı ilk test

1. `/admin/urunler/excel-yukle` → **Sateen Ürünleri Ekle** → `ornek-veriler/SATEEN02102026CHECKLIST.xls` → önizleme (marka **Sateen**, 30 ürün) → **Aktar**.
2. `/admin/markalar`: tek "Sateen" markası, 30 ürün.
3. Ürünler listesinde ör. **SATEEN 2365-6641 Bedene Oturan Kadife Ceket** → **Linkle Ekle** → renk KAHVE → link: `https://www.saten.com/bedene-oturan-kadife-ceket-kahve-138080` → 6 fotoğraf eklenmeli (3:4 dolgulu, `img.bollmark.com` adresli).
4. Toptan siteden de bir tane dene.
5. Fotoğrafları kontrol edip ürünleri yayına al.

---

## 8. Claude Code prompt'u (kopyala-yapıştır)

```
Bollmark projesinde SATEEN_EXCEL_AKTARIM_PLANI.md dosyasını oku ve uygula. Yüklü skill'leri (özellikle karpathy-guidelines) kullan; değişiklikleri küçük ve cerrahi tut. Referans: QUZU_EXCEL_AKTARIM_PLANI.md ve DEPLOY_STATUS'taki Quzu "Linkle Ekle" notları (aynı kalıp).

ÇOK ÖNEMLİ: Ürünleri sen YÜKLEME. Yerel .env canlı Neon DB'ye bağlı. Sihirbazda "Aktar"a basma, /api/admin/urunler/excel-aktar'ı çağırma, "Linkle Ekle" ile gerçek ürüne fotoğraf ekleme, DB'ye veya R2/Blob'a yazan hiçbir script çalıştırma. DB'de yalnızca okuma sorguları yapabilirsin. İlk yüklemeyi ve ilk Linkle Ekle'yi ben yapacağım.

Yapılacaklar (ayrıntılar planın 4. bölümünde):
1) excel-import.ts: FIRMAADI "SATEN" geliyor, BRAND_NAME_ALIASES ile "SATEEN"e çevir. Marka "Sateen" olarak oluşsun. Önce DB'de Saten/Sateen markası var mı oku ve bana söyle.
2) brand-image-sources.ts: MANUAL_LINK_BRANDS'e "SATEEN" ekle. BRAND_IMAGE_SOURCES'a EKLEME. grep -rn "QUZU\|Quzu" src ile elle yazılmış Quzu kontrollerini bul, isManualLinkBrand'e çevir. link-images.ts mantığına dokunma.
3) excel-import-wizard.tsx: BRAND_OPTIONS'a Sateen. Bilgi notu Quzu+Sateen için "Linkle Ekle" yönlendirmeli metin, Dilvin için mevcut metin. excel-yukle/page.tsx açıklamasına Sateen ekle.
4) CATEGORY_MAP: ELBİSE→"Elbise" ekle. TAKIM için önce DB'de Takım kategorisi var mı OKU, varsa DB yazımıyla ekle, yoksa ekleme ve bana söyle.

Test: planın 6. bölümü. lint + tsc. Önizlemeyi ancak önizleme route'unun DB'ye yazmadığını doğruladıktan sonra dene, marka sütununun "Sateen" olduğunu gör, Aktar'a BASMA. Link okuma testini (6.4) sadece URL listesini çekerek yap, indirme/yükleme/DB yazma yok, geçici script'i sil. 403 olursa User-Agent'ı değiştirmeden önce bana sor.

Bitince DEPLOY_STATUS.md'ye not düş ("Ürün yüklemesi ve Linkle Ekle denemesi yapılmadı, ilk denemeyi kullanıcı yapacak" diye belirt). Ben localhost'ta kontrol edip onaylamadan commit atma. Onayımdan sonra önce DEPLOY_STATUS.md'yi güncelle, sonra yerel commit at. Ben söylemeden push ETME.
```
