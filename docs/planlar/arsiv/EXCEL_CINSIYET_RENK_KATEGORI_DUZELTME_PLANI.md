# Excel Ürün Aktarımı — Cinsiyet/Renk/Kategori Düzeltmeleri (Araştırma + Claude Code Promptu)

## Tetikleyen olay

Kullanıcı `KOTON20052025CHECKLIST.xls` dosyasını paylaştı (64 satır, 33 kolon,
Sayfa1). İncelemede üç sorun teyit edildi — hepsi `src/lib/excel-import.ts` ve
onun çevresindeki dosyalarda (`category-suggest.ts`,
`excel-yukle/route.ts`, `excel-import-wizard.tsx`), kod okunarak doğrulandı.

Bu dosyada gözlenen gerçek değerler:
- `KOD4` (cinsiyet): `WOMEN`, `TEENAGE` — `TEENAGE` şu an `GENDER_MAP`'te yok,
  `mapGender()` `null` dönüyor, `Product.gender` boş kalıyor.
- `RENK`: `FUŞYA/303`, `AÇIK İNDİGO/LGT`, `ORTA İNDİGO/MID`, `SİYAH/BLK`,
  `BEJ/052`, `HAKİ ÇİZGİLİ/8S5` gibi — hepsi `İSİM/KOD` formatında, kod kısmı
  gözlemlenen örneklerin tamamında **tam 3 karakter**. Şu an bu tam metin
  aynen `VariantAttributeValue` (Renk) ve SKU'da kullanılıyor.
- `KOD3` (ürün tipi): `SHORTS`, `TROUSERS`, `BIKINI BOTTOMS` — `CATEGORY_MAP`'te
  sadece `SHIRTS SS`/`SHIRTS LS BSC` var, bu üçü yok → kategori boş/AI önerisine
  düşüyor, önizlemede kırmızı "Eşleşmedi" ya da (API key varsa) amber "Öneri".

## 1) Cinsiyet: TEENAGE → Kadın

`src/lib/excel-import.ts` → `GENDER_MAP`'e `TEENAGE: "Kadın"` eklenmeli.
Sitede genç/teen'e özel ayrı bir `gender` değeri veya kategori dalı yok
(`UST_MENU_MEGA_MENU_PLANI.md`'de netleşen yapı: Kadın/Erkek/Aksesuar) —
teenage kadın ürünleri pratikte kadın kataloğuna giriyor, dolayısıyla Kadın'a
eşlemek doğru.

## 2) Renk kodu ayrıştırma

`RENK` hücresi `"AÇIK İNDİGO/LGT"` gibi geldiğinde şu an bu tam metin renk
adı olarak kaydediliyor (Renk attribute değeri + SKU + Koton görsel eşleştirme
için renk etiketi karşılaştırması — `EXCEL_URUN_AKTARIM_PLANI.md` bölüm 4'te
Koton'un kendi renk etiketleriyle **birebir aynı yazım** eşleştiği belirtiliyor,
yani kod son eki kalırsa Koton görsel eşleştirmesi de muhtemelen kırılıyor).
Çözüm: `parseExcelFile` içinde `RENK` okunurken son `"/"`'den sonrasını (kısa,
≤6 karakterlik bir kod ise) at, sadece isim kısmını kullan.

## 3) Kategori: KOD3 eşleşmezse ürün adından tahmin

Mevcut öncelik sırası (`EXCEL_KATEGORI_ESLEME_PLANI.md`): öğrenilmiş DB eşlemesi
→ sabit `CATEGORY_MAP` → AI önerisi (`category-suggest.ts`, KOD3 metnine göre)
→ yöneticinin elle girdiği/fallback. Bu dosyadaki `SHORTS`/`TROUSERS`/
`BIKINI BOTTOMS` hiçbirinde karşılık yok. İki parçalı çözüm önerildi:

- **Hızlı kazanç:** Bu üç kodu doğrudan `CATEGORY_MAP`'e ekle (`SHORTS` →
  "Şort", `TROUSERS` → "Pantolon", `BIKINI BOTTOMS` → "Mayo & Bikini") — tıpkı
  `SHIRTS SS`/`SHIRTS LS BSC` için yapıldığı gibi.
- **Genel mekanizma:** Yeni bir `guessCategoryFromProductName(productName)`
  fonksiyonu — ürün adında geçen anahtar kelimelere (şort, pantolon, etek,
  elbise, gömlek, tişört, mont, kazak, bikini/mayo, vb. — sitenin gerçek
  kategori ağacındaki isimlere karşılık gelecek şekilde) bakıp bir tahmin
  döner. KOD3 eşleşmezse, **AI önerisinden önce** bu denenir (ücretsiz,
  deterministik) — sadece o da başarısızsa AI'ya (`suggestCategory`) düşülür.
  AI önerisiyle aynı şekilde bu da **kesin eşleşme değil, onay bekleyen bir
  öneri** olarak gösterilir (yeni bir üçüncü rozet — mevcut yeşil "Eşleşti"/
  amber "AI Önerisi"/kırmızı "Eşleşmedi" rozetlerinin yanına).

## Verilen Claude Code promptu

Aşağıdaki prompt kullanıcıya verildi, kendisi Claude Code ile uygulayacak
(bu araştırma oturumu kod dosyalarına dokunmadı, sadece inceledi):

```
Bollmark'ın Excel ürün aktarımında (src/lib/excel-import.ts ve çevresi) üç
düzeltme yapacağız. Örnek dosya: ornek-veriler/ altına KOTON20052025CHECKLIST.xls
eklenebilir (kullanıcıda mevcut, gerekirse iste) — WOMEN/TEENAGE cinsiyet,
"FUŞYA/303" gibi kod son ekli renkler, SHORTS/TROUSERS/BIKINI BOTTOMS kategori
kodları içeriyor.

### 1. Cinsiyet: TEENAGE → Kadın

`src/lib/excel-import.ts` içindeki `GENDER_MAP` sabitine `TEENAGE: "Kadın"`
ekle. Yorumdaki "eşleşmeyen değerler boş bırakılır" notunu güncel tut.

### 2. Renk hücresindeki stok kodunu at

Aynı dosyada, `parseExcelFile`'ın hemen üstüne yeni bir export edilen
fonksiyon ekle:

```ts
// RENK hücresi bazen "AÇIK İNDİGO/LGT" gibi isim+stok kodu birlikte gelir
// (kod kısmı gözlemlenen örneklerde hep kısa, örn. 3 karakter: LGT, MID, BLK,
// 303, 052...). Sadece isim kısmını al - Renk attribute değeri, SKU ve Koton
// görsel eşleştirmesi (bkz. EXCEL_URUN_AKTARIM_PLANI.md bölüm 4, orada Koton
// etiketleriyle birebir aynı yazım eşleşmesi bekleniyor) hep bu temiz isimle
// çalışmalı.
export function parseColorName(raw: string): string {
  const trimmed = raw.trim();
  const slashIndex = trimmed.lastIndexOf("/");
  if (slashIndex <= 0) return trimmed;
  const suffix = trimmed.slice(slashIndex + 1).trim();
  if (!suffix || suffix.length > 6) return trimmed; // gerçek bir kod gibi görünmüyorsa dokunma
  return trimmed.slice(0, slashIndex).trim();
}
```

`parseExcelFile` içinde RENK okunan satırı güncelle:

```ts
const colorRaw = String(raw["RENK"] ?? "").trim();
const color = parseColorName(colorRaw);
```

(Boş kontrolü `colorRaw` üzerinden yapılmaya devam etsin: `if (!colorRaw) { ... "RENK boş olamaz." ... }` —
mevcut `color` değişkenine yapılan referansı `colorRaw`'a çevir, aşağıdaki
`rows.push`'ta temizlenmiş `color`'ı kullan.)

Bunun dışında `color` her yerde (ProductVariantRow, ProductGroup.colors, SKU
üretimi, Koton renk eşleştirmesi için `colorValueIdByLabel`) zaten bu tek
noktadan geldiği için başka bir değişiklik gerekmiyor.

### 3. Kategori eşleşmesi: KOD3 karşılığı yoksa ürün adına bak

**3a. Hızlı ek (kesin eşleşme, mevcut CATEGORY_MAP'e ekleme):**

```ts
const CATEGORY_MAP: Record<string, string> = {
  "SHIRTS SS": "Gömlek",
  "SHIRTS LS BSC": "Gömlek",
  "SHORTS": "Şort",
  "TROUSERS": "Pantolon",
  "BIKINI BOTTOMS": "Mayo & Bikini"
};
```

(Kategori adları DB'deki gerçek isimlerle - case-insensitive - eşleşmeli;
`resolveCategoryIdByName` zaten insensitive karşılaştırıyor, ama yine de
mevcut Kategoriler sayfasındaki tam yazımı kontrol et, örn. "Mayo & Bikini"
gerçekten böyle mi yazılı.)

**3b. Genel mekanizma (ürün adından tahmin, AI'dan önce denenir):**

`src/lib/excel-import.ts`'e yeni, export edilen bir fonksiyon ekle:

```ts
// KOD3 (öğrenilmiş eşleme + CATEGORY_MAP) karşılığı yoksa, AI önerisine
// gitmeden önce ürün adında geçen anahtar kelimeye bakarak ücretsiz/
// deterministik bir tahmin denenir. Bu bir KESİN eşleşme değildir - önizlemede
// "öneri" olarak gösterilir, yönetici onaylar/değiştirir (AI önerisiyle aynı
// güvenlik prensibi). Liste sitenin gerçek kategori ağacındaki isimlere göre
// güncel tutulmalı (bkz. UST_MENU_MEGA_MENU_PLANI.md'deki kategori listesi).
const PRODUCT_NAME_CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: "Şort", keywords: ["şort"] },
  { category: "Etek", keywords: ["etek"] },
  { category: "Kot Pantolon", keywords: ["jean", "kot pantolon", "denim pantolon"] },
  { category: "Pantolon", keywords: ["pantolon", "paça"] },
  { category: "Elbise", keywords: ["elbise"] },
  { category: "Bluz", keywords: ["bluz"] },
  { category: "Gömlek", keywords: ["gömlek"] },
  { category: "Tişört", keywords: ["tişört", "t-shirt", "tshirt"] },
  { category: "Sweatshirt", keywords: ["sweatshirt"] },
  { category: "Hırka", keywords: ["hırka"] },
  { category: "Kazak & Süveter", keywords: ["kazak", "süveter", "triko"] },
  { category: "Trençkot", keywords: ["trençkot", "trenchcoat"] },
  { category: "Mont & Kaban", keywords: ["mont", "kaban", "parka"] },
  { category: "Ceket", keywords: ["ceket"] },
  { category: "Yelek", keywords: ["yelek"] },
  { category: "Tulum", keywords: ["tulum"] },
  { category: "Tayt", keywords: ["tayt", "legging"] },
  { category: "Mayo & Bikini", keywords: ["mayo", "bikini"] },
  { category: "İç Giyim", keywords: ["sütyen", "külot"] },
  { category: "Pijama & Gecelik", keywords: ["pijama", "gecelik"] },
  { category: "Eşofman", keywords: ["eşofman", "jogger"] },
  { category: "Polo Yaka", keywords: ["polo yaka", "polo"] },
  { category: "Atlet", keywords: ["atlet"] },
  { category: "Boxer", keywords: ["boxer"] }
];

export function guessCategoryFromProductName(productName: string): string | null {
  const lower = productName.toLocaleLowerCase("tr-TR");
  for (const entry of PRODUCT_NAME_CATEGORY_KEYWORDS) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.category;
  }
  return null;
}
```

Not: Liste sırası önemli - daha spesifik türler (Kot Pantolon, Şort) genel
olanlardan (Pantolon) önce kontrol edilmeli ki "kot pantolon" ifadesi
yanlışlıkla sade "Pantolon"a düşmesin. `guessCategoryFromProductName`'i
`excel-import.ts`'ten export et.

**`src/app/api/admin/urunler/excel-yukle/route.ts` güncellemesi:**

`detectedCache` doldurulduktan sonra, `suggestionCache` doldurulmadan önce
yeni bir `nameGuessCache` ekle (bu, KOD3'e değil ÜRÜN KODU'na göre - çünkü
aynı KOD3 altında farklı ürün adları olabilir):

```ts
const nameGuessCache = new Map<string, string | null>();
for (const g of rawGroups) {
  const key = normalizeKod3(g.categoryRaw);
  if (key && detectedCache.get(key)) continue; // KOD3 zaten kesin eşleşti
  nameGuessCache.set(g.productCode, guessCategoryFromProductName(g.productName));
}
```

`suggestionCache` doldurma döngüsüne, AI'ya gitmeden önce isim tahmininin
başarılı olup olmadığını kontrol eden bir satır ekle:

```ts
const suggestionCache = new Map<string, CategorySuggestion | null>();
for (const g of rawGroups) {
  const key = normalizeKod3(g.categoryRaw);
  if (!key || detectedCache.get(key)) continue;
  if (nameGuessCache.get(g.productCode)) continue; // isimden tahmin başarılıysa AI'ya gitme
  if (suggestionCache.has(key)) continue;
  suggestionCache.set(key, await suggestCategory(g.categoryRaw, existingCategoryNames));
}
```

`groups` map'ini güncelle (yeni `nameGuessedCategory` alanı eklenir, AI önerisi
artık sadece hem KOD3 hem isim tahmini boşsa hesaplanır):

```ts
const groups = rawGroups.map((g) => {
  const key = normalizeKod3(g.categoryRaw);
  const detectedCategory = detectedCache.get(key) ?? null;
  const nameGuessedCategory = detectedCategory ? null : nameGuessCache.get(g.productCode) ?? null;
  const suggestedCategory = detectedCategory || nameGuessedCategory ? null : suggestionCache.get(key) ?? null;
  return {
    productCode: g.productCode,
    productName: g.productName,
    gender: mapGender(g.genderRaw),
    categoryRaw: g.categoryRaw,
    detectedCategory,
    nameGuessedCategory,
    suggestedCategory,
    // ...(diğer alanlar aynı kalır)
  };
});
```

**`src/components/admin/excel-import-wizard.tsx` güncellemesi:**

- `PreviewGroup` tipine `nameGuessedCategory: string | null;` ekle.
- `handleFileChange`'teki `categoryByCode` ön-doldurma satırını güncelle:
  `g.detectedCategory ?? g.nameGuessedCategory ?? g.suggestedCategory?.categoryName ?? ""`.
- Tablodaki kategori hücresinde, mevcut yeşil "Eşleşti" / amber "AI önerisi" /
  kırmızı "Eşleşmedi" rozetlerinin arasına, `detectedCategory` yoksa ama
  `nameGuessedCategory` varsa gösterilecek yeni bir ara rozet ekle (örn. mavi/
  indigo tonunda, "Öneri (ürün adından), kontrol et" metniyle - AI rozetiyle
  karışmasın diye farklı renk/ikon kullan, örn. `Sparkles` veya `Tag` ikonu).
- Üstteki özet banner'ın sayaç mantığını güncelle: "AI önerisi (kontrol
  bekliyor)" sayacını hem `nameGuessedCategory` hem `suggestedCategory` olan
  satırları kapsayacak şekilde genişlet (`!g.detectedCategory && (g.nameGuessedCategory || g.suggestedCategory)`),
  ya da üç ayrı sayaç yapıp ("isimden öneri" / "AI önerisi" / "eşleşmedi")
  banner'ı buna göre genişlet - hangisi UI'da daha temiz duruyorsa onu seç.

### Test/doğrulama

1. `npx tsc --noEmit` ve `npm run build` hatasız geçmeli.
2. Paylaşılan `KOTON20052025CHECKLIST.xls` (veya benzer WOMEN/TEENAGE +
   kod son ekli renk + SHORTS/TROUSERS/BIKINI BOTTOMS içeren bir dosya) ile
   `/admin/urunler/excel-yukle` üzerinden önizleme aç:
   - TEENAGE satırlarının cinsiyet kolonunda "Kadın" göründüğünü doğrula.
   - Renkler sütununda "FUŞYA", "AÇIK İNDİGO" gibi kod son eki OLMADAN
     göründüğünü doğrula.
   - SHORTS/TROUSERS/BIKINI BOTTOMS satırlarının yeşil "Eşleşti" (CATEGORY_MAP'e
     eklendiği için) geldiğini doğrula.
   - `CATEGORY_MAP`'te olmayan farklı bir KOD3 + ürün adında "elbise" geçen
     uydurma bir satır (mümkünse örnek dosyaya elle bir satır ekleyerek ya da
     ayrı bir test dosyasıyla) test edilip yeni "öneri (ürün adından)"
     rozetiyle "Elbise" kutucuğunun geldiğini doğrula.
3. İçe aktarımı gerçekten çalıştır (test/staging DB'de ya da kullanıcının
   onayıyla), oluşan üründe `gender="Kadın"`, `VariantAttributeValue` (Renk)
   değerlerinin kod son eki olmadan kaydedildiğini, kategorinin doğru
   atandığını Prisma Studio veya admin panelden kontrol et.

Commit'i mesajıyla birlikte öner ama benim onayım olmadan push etme. Bitince
git diff özetini ve önizleme ekranının (yeni rozetli hali) bir ekran
görüntüsünü paylaş.
```

## Sonraki oturumda kontrol edilecek

Bu promptun sonucu doğrulanmalı: TEENAGE→Kadın, renk kodu ayrıştırma ve yeni
"ürün adından öneri" rozetinin önizlemede beklendiği gibi çalışıp
çalışmadığı, `npm run lint`/`npm run build` durumu.
