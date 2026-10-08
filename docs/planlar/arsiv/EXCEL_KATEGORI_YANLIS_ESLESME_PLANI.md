# Excel Aktarım — Yanlış Kategori Eşleşmesi (Tişört → Hırka, Bluz → Hırka) — Araştırma + Claude Code Promptu

Tarih: 19 Eylül 2026
Tetikleyen: `KOTON19092026CHECKLIST.xls` (194 satır, 30 ürün kodu) + ekran görüntüsü:
`7WAK50034EK` "Slim Fit Balıkçı Yaka Uzun Kollu **Tişört**" gibi ürünler yeşil
"Eşleşti" rozetiyle **Hırka** kategorisine düşüyor.

> Bu oturumda koda dokunulmadı; kod okunarak ve Excel dosyası analiz edilerek
> teşhis konuldu. Uygulama Claude Code ile yapılacak.

## 1) Teşhis

### 1a) Hırka'yı üreten şey: "öğrenilmiş KOD3 eşlemesi" (CategoryKodMapping)

Ekran görüntüsündeki rozet **yeşil "Eşleşti"** = `detectedCategory` dolu. Ürün adında
"hırka" kelimesi yok, yani kural tabanlı isim tahmini de Hırka üretemez. Geriye tek
kaynak kalıyor: `detectCategoryName()` → `resolveLearnedCategoryName()` — DB'deki
`CategoryKodMapping` tablosu (KOD3 → kategori).

Bu tablo `excel-aktar/route.ts` (satır ~109-124) içinde **her aktarımda otomatik
yazılıyor**: yönetici bir ürün için hangi kategoriyi seçtiyse, o ürünün KOD3'ü o
kategoriye `upsert` ediliyor (son yazan kazanır). Sonra:

- Bir kez bile `TSHIRT LS` KOD3'lü bir üründe (ya da toplu/yanlış seçimle) "Hırka"
  seçildiyse, KOD3 `TSHIRT LS` → Hırka **kalıcı** öğreniliyor.
- Öğrenilmiş eşleme, sabit `CATEGORY_MAP`'ten bile **önce** geliyor
  (`excel-import.ts` satır ~137) ve "kesin eşleşme" sayılıyor → AI/isim tahmini hiç
  çalışmıyor (`excel-yukle/route.ts`: `if (key && detectedCache.get(key)) continue`).
- Sonuç: o KOD3'e sahip **tüm gelecek ürünler** yeşil rozetle yanlış kategoriye
  gidiyor. Bu yüzden "çok hata yapıyor" gibi görünüyor.

(Doğrulama gerekli: DB'deki `CategoryKodMapping` satırlarına bakılmalı — bu oturumda
DB erişimimiz yok. Beklenen: `TSHIRT LS` → Hırka, muhtemelen başka yanlışlar da var.)

### 1b) Asıl kök neden: Koton KOD3'ü ürün tipini güvenilir şekilde ayırmıyor

Bu dosyadan (isimden çıkarılan gerçek tür ile KOD3 karşılaştırması):

| KOD3 | Ürünlerin gerçek türü (isimden) |
|---|---|
| `TSHIRT LS` | 7 Tişört **+ 1 Bluz** ("Slim Fit Uzun Kollu Büzgülü Dik Yaka Bluz") |
| `BLOUSE LS` | 3 Bluz **+ 1 Tişört** ("Slim Fit Bisiklet Yaka Uzun Kollu Çizgili Tişört") |
| `TROUSERS` | 1 düz Pantolon + 3 **Jean/Kot Pantolon** |
| `SWEATSHIRTS`, `JACKETS`, `BLAZERS`, `DRESSES`, `SKIRTS`, `SWEATERS` | tutarlı |

Yani "KOD3 → tek kategori" mantığı (hem sabit harita hem öğrenilen) doğası gereği hata
üretir. **Ürün adı KOD3'ten daha güvenilir bir sinyal** — 30 ürünün 29'unda isim
tahmini doğru türü veriyor.

### 1c) İsim tahmininde bulunan gerçek bir bug

`guessCategoryFromProductName` içinde `Tişört` kelime listesinde `"tshirt"` var ve
`Tişört` girdisi `Sweatshirt`'ten **önce** kontrol ediliyor. `"sweatshirt"` kelimesinin
içinde `tshirt` alt dizisi geçtiği için (`swea-TSHIRT`) Sweatshirt ürünleri **Tişört**
olarak tahmin ediliyor (bu dosyada 2 ürün: `7WAK10043EK`, `7WAK10064EK`). Ayrıca düz
`includes()` kullanıldığı için başka kelime içi tesadüflere de açık.

### 1d) Ek riskler

- İsim tahmini DB'de var olmayan bir kategori adı üretirse, aktarımda
  `getOrCreateCategoryId` bu ismi **otomatik yeni kategori olarak oluşturuyor** →
  "çöp kategori" riski. Tahminler sadece mevcut kategori adlarıyla sınırlanmalı.
- AI önerisi (`category-suggest.ts`) sadece KOD3 metnini görüyor, ürün adını görmüyor.

## 2) Önerilen çözüm

**Yeni öncelik sırası (ürün bazlı):**

1. **Ürün adından güçlü tahmin** (kelime bazlı, mevcut kategori adlarıyla sınırlı) →
   yeşil "Eşleşti" (ürün adından).
2. Sabit `CATEGORY_MAP` (KOD3) — yeni KOD3'ler eklenir (aşağıda).
3. Öğrenilmiş `CategoryKodMapping` — **sadece yedek** (isim tahmini boşsa).
4. AI önerisi — prompta **ürün adı da** eklenir, amber "AI önerisi".

**Çelişki uyarısı:** İsim tahmini ile KOD3 sonucu farklıysa (örn. isim "Bluz", KOD3
`TSHIRT LS`→Tişört) isim tahmini önceden doldurulur ve satırda küçük turuncu
"Kod ile çelişiyor: <KOD3 sonucu>" uyarısı gösterilir — yönetici gözle görür.

**Öğrenmeyi güvenli hale getir:** `excel-aktar` içindeki KOD3 öğrenme yalnızca (a)
yönetici öneriyi **elle değiştirdiyse** ve (b) aynı aktarımda o KOD3'e ait **tüm ürünler
aynı kategoride** toplandıysa yapılmalı. Karışık KOD3'ler (TSHIRT LS gibi) asla
öğrenilmemeli.

**Sabit CATEGORY_MAP'e eklenecekler (bu dosyadan):** `TSHIRT LS`→Tişört, `BLOUSE LS`→Bluz,
`JACKETS`→Ceket, `BLAZERS`→Ceket, `DRESSES`→Elbise, `SKIRTS`→Etek, `SWEATERS`→Kazak & Süveter,
`SWEATSHIRTS`→Sweatshirt (kategori adları DB'dekiyle birebir doğrulanacak). `TROUSERS`→Pantolon
kalır ama jean ürünleri isim tahminiyle Kot Pantolon'a gider.

**Veri temizliği:** (i) `CategoryKodMapping` tablosu listelenip yanlış satırlar
düzeltilecek/silinecek; (ii) daha önce yanlış kategoriye düşmüş ürünler için önce
**kuru çalıştırma (dry-run) raporu** çıkarılacak (ürün adından çıkan tür ≠ mevcut
kategori), yönetici onayından sonra düzeltilecek.

## 3) Verilen Claude Code promptu

```
Bollmark'ın Excel ürün aktarımında (admin > Ürünler > Excel'den Aktar) kategori
eşleşmesi yanlış çalışıyor: adında "Tişört" yazan ürünler, adında "Bluz" yazan
ürünler yeşil "Eşleşti" rozetiyle "Hırka" kategorisine düşüyor. Ayrıntılı teşhis:
EXCEL_KATEGORI_YANLIS_ESLESME_PLANI.md (bu klasörde) — önce onu oku. Ayrıca
yüklü skill'lerini kullan, KOTON19092026CHECKLIST.xls örnek dosyasını
ornek-veriler/ altına kopyala (kullanıcıdan iste) ve test için kullan.

Dosyalar: src/lib/excel-import.ts, src/lib/category-suggest.ts,
src/app/api/admin/urunler/excel-yukle/route.ts,
src/app/api/admin/urunler/excel-aktar/route.ts,
src/components/admin/excel-import-wizard.tsx, prisma/schema.prisma
(CategoryKodMapping).

### 0. Önce sadece OKU/RAPORLA (hiçbir veri değiştirme)
a) CategoryKodMapping tablosundaki tüm satırları (kod3 → kategori adı) listele.
   Beklenti: TSHIRT LS → Hırka gibi yanlış bir satır var. Raporla.
b) Product tablosunda, ürün adında "tişört/bluz/elbise/etek/ceket/sweatshirt/
   jean/pantolon/kazak" geçip mevcut kategorisi bununla uyuşmayan ürünleri
   (ürün kodu, ad, mevcut kategori, olması gereken kategori) tablo halinde çıkar.
c) Category tablosundaki tüm kategori adlarını çıkar; aşağıdaki anahtar kelime
   listesindeki kategori adlarını gerçek adlarla karşılaştır.
Bu raporu bana göster, DB'de düzeltme yapmadan önce onayımı bekle.
(Yedek al: backups/ klasörü kuralımıza uy.)

### 1. Ürün adı öncelikli tahmin (excel-import.ts)
- guessCategoryFromProductName'i düzelt: düz includes yerine kelime-başı eşleşmesi
  (tr-TR küçük harfe çevirip \b benzeri sınır: metin başı/boşluk/tire sonrası),
  böylece "sweatshirt" içindeki "tshirt" Tişört'e düşmez. Ek olarak Sweatshirt
  girdisini Tişört'ten ÖNCE koy. "jean" → Kot Pantolon, "pantolon" → Pantolon
  sıralaması korunsun (Kot Pantolon önce).
- Fonksiyon mevcut kategori adları listesini (existingCategoryNames) parametre
  alsın; tahmin edilen ad DB'de (case-insensitive) yoksa null dön — böylece
  getOrCreateCategoryId ile çöp kategori oluşması engellenir. DB'de gerçek adı
  neyse (ör. "Tişört" mü "T-shirt" mü) onu döndür.
- Tahmin, KOD3 sonucundan ÖNCE değerlendirilir.

### 2. Öncelik sırası + çelişki (excel-yukle/route.ts)
Ürün (productCode) bazında: isim tahmini → CATEGORY_MAP → öğrenilmiş
CategoryKodMapping (sadece yedek) → AI. Yeni alan: conflictCategory (isim tahmini
ile KOD3 kaynaklı sonuç farklıysa KOD3 sonucu buraya). AI önerisine (category-suggest.ts)
ürün adını da prompta ekle ("Ürün adı: ...; ürün tipi kodu: ..."); AI çağrısı
KOD3 yerine artık (KOD3 + ürün adı) bazında gerekiyorsa uygun cache anahtarı kullan.

### 3. CATEGORY_MAP'e ekle (excel-import.ts)
TSHIRT LS→Tişört, BLOUSE LS→Bluz, JACKETS→Ceket, BLAZERS→Ceket, DRESSES→Elbise,
SKIRTS→Etek, SWEATERS→Kazak & Süveter, SWEATSHIRTS→Sweatshirt (gerçek kategori
adlarıyla doğrula; TROUSERS→Pantolon zaten var).

### 4. Öğrenmeyi güvenli hale getir (excel-aktar/route.ts)
KOD3 öğrenmesi sadece (a) yönetici öneriyi elle değiştirdiyse VE (b) aynı aktarımda
o KOD3'e ait TÜM ürünler aynı kategoriye atanmışsa yapılsın. Aksi halde upsert etme.
Mevcut yanlış satırları benim onayımdan sonra düzelt/sil (adım 0a raporuna göre).

### 5. UI (excel-import-wizard.tsx)
Önizleme satırında isim tahmini kaynaklı eşleşme yeşil "Eşleşti" rozetinde
"ürün adından" ipucuyla; conflictCategory varsa küçük turuncu "Kod ile çelişiyor:
<X>" uyarısı. Mevcut nameGuessedCategory rozet mantığını bu yeni yapıya uyarla
(kafa karıştırmasın: yeşil = güvenli, amber = AI/kontrol et, turuncu = çelişki).

### 6. Veri düzeltme (ONAYDAN SONRA)
Adım 0b raporundaki yanlış kategorili ürünleri düzelt (önce dry-run çıktısı, sonra
ben onaylarsam gerçek güncelleme; her güncellenen ürün sayısını raporla).

### Doğrulama
1. npx tsc --noEmit, eslint (değişen dosyalar), npm run build temiz.
2. KOTON19092026CHECKLIST.xls ile önizleme aç. Beklenen (30 ürün): 7 Tişört ürünü
   Tişört; "…Dik Yaka Bluz" (KOD3 TSHIRT LS) Bluz + turuncu çelişki uyarısı;
   "…Çizgili Tişört" (KOD3 BLOUSE LS) Tişört + uyarı; 3 Jean → Kot Pantolon,
   "Düz Bol Paça Pantolon" → Pantolon; 2 Sweatshirt → Sweatshirt (Tişört DEĞİL);
   Ceketler/Blazer → Ceket; Elbise, Etek, Kazak doğru. Hiçbir ürün Hırka'ya düşmemeli.
3. Birim testi (varsa test altyapısı): guessCategoryFromProductName için
   "Sweatshirt"→Sweatshirt, "Jean Pantolon"→Kot Pantolon, "Tişört"→Tişört,
   "Blazer Ceket"→Ceket, "Triko Kazak"→Kazak & Süveter.
4. Önizleme ekranının ekran görüntüsünü paylaş.

Her iş bitince DEPLOY_STATUS.md'ye tarihli kısa bir not düş (ne değişti, neyle
doğrulandı, DB'de neye dokunuldu). Commit'i mesajıyla öner, ben onaylamadan push etme.
```

## 4) Sonraki oturumda kontrol edilecek

- Adım 0 raporundaki gerçek `CategoryKodMapping` satırları teşhisi (TSHIRT LS → Hırka) doğruluyor mu?
- Yeni öncelik sırasıyla 30 ürünün hepsi doğru kategoriye düşüyor mu, Hırka'ya giden var mı?
- Eski yanlış kategorili ürünlerin düzeltme raporu ve onayı.
