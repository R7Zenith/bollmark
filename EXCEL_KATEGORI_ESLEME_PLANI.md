# Bollmark – Excel Aktarımında Otomatik Kategori Eşleme Planı

## Bağlam (yeni bir Claude Code oturumu için)

Bu belge, önceki bir oturumda kategoriler sayfası üzerinde yapılan çalışmayla
(`KATEGORILER_SAYFASI_ARASTIRMA_VE_ONERILER.md`, `KATEGORILER_SAYFASI_UYGULAMA_PLANI.md`
= Faz 1, `KATEGORILER_SAYFASI_FAZ2_UYGULAMA_PLANI.md` = Faz 2 — ikisi de
tamamlandı) sırasında ortaya çıkan ayrı bir iş. O oturumda şu mimari karar
netleşti: **kategori ağacı tekil kalıyor** (Tişört, Pantolon, Elbise gibi —
cinsiyete göre tekrar etmiyor), **cinsiyet (`Product.gender`) tamamen ayrı,
bağımsız bir alan**. Bu belge o kararı değiştirmiyor; sadece kategori
alanının Excel içe aktarımında **hâlâ elle dolduruluyor olmasını** ele alıyor
— tıpkı cinsiyetin `KOD4` sütunundan otomatik eşlendiği gibi, kategorinin de
`KOD3` sütunundan otomatik eşlenebileceği fark edildi.

## 1) Tespit — mevcut durum

`src/lib/excel-import.ts` şu an `KOD4`'ü (cinsiyet) `GENDER_MAP` ile otomatik
`Kadın/Erkek/Unisex/Çocuk`'a çeviriyor (`mapGender` fonksiyonu). Ama
**kategori hiç Excel'den okunmuyor** — `src/components/admin/excel-import-wizard.tsx`'teki
önizleme adımında yönetici, **tüm dosyaya uygulanan tek bir kategori**
seçiyor ("Kategori (tüm ürünlere uygulanır, opsiyonel)" dropdown'ı),
bu `categoryId` olarak `/api/admin/urunler/excel-aktar`'a gidip
`importProductGroups(groups, categoryId)` içinde her yeni ürüne aynen
uygulanıyor.

`ornek-veriler/KOTON11052026CHECKLIST.xls` incelendi (49 satır, tek bir
gönderi). Sütunlar arasında `KOD1` ("TEKSTİL"), `KOD2`/`KOD7` ("KOTON" —
marka, zaten `FIRMAADI`'yla aynı), `KOD3` (**"SHIRTS SS", "SHIRTS LS BSC"**
— Koton'un kendi ürün grubu/tip kodu), `KOD4` ("MEN" — cinsiyet, zaten
kullanılıyor), `KOD6` ("2026 YAZ" — sezon) var. `KOD3` tam olarak `KOD4`
gibi bir "ürün tipi kodu" — kategoriye eşlenebilir.

## 2) Tasarım kararları

- **Eşleşmezse ne olur:** Mevcut global "kategori seç" dropdown'u
  **kaldırılmıyor**, anlamı değişiyor: artık "eşleşmeyenler için kategori
  (opsiyonel)" fallback'i oluyor. Yani her ürün grubu için önce `KOD3`
  haritadan otomatik kategoriye çevrilmeye çalışılır; başarısız olursa
  (harita bilmiyor ya da eşleşen isimde kategori DB'de yok) yöneticinin
  seçtiği fallback kategori kullanılır (hiç seçilmediyse kategorisiz kalır
  — bugünkü davranışla aynı).
- **Eşleşen isimde kategori DB'de yoksa otomatik oluşturulsun mu?**
  **Hayır.** `resolveBrandId` (aynı dosyada, marka için) bulamayınca otomatik
  marka oluşturuyor, ama kategori için bunu önermiyorum: harita içinde bir
  yazım hatası ya da beklenmedik bir `KOD3` değeri olursa sessizce çöp
  kategori üretebilir. Bunun yerine sadece **var olan** kategoriyle isme
  göre (case-insensitive) eşleştirilir; yoksa fallback'e düşer. Yönetici
  isterse kategoriyi zaten Kategoriler sayfasından (Faz 1-2'de kurulan
  akışla) önceden oluşturabilir.
- **Harita nerede tutulur:** `GENDER_MAP` ile birebir aynı desende, kod
  içinde sabit bir `CATEGORY_MAP: Record<string, string>` — yeni bir ürün
  tipi (T-shirt, pantolon, elbise...) geldikçe elle genişletilecek. Haritada
  olmayan `KOD3` değerleri önizleme ekranında görünür olmalı (aşağıdaki
  UI maddesi) ki yönetici hangi kodun haritaya eklenmesi gerektiğini görsün.

## 3) Teknik değişiklikler

### `src/lib/excel-import.ts`

- `ExcelImportRow` arayüzüne `categoryRaw: string; // KOD3` eklenir;
  `parseExcelFile` içinde `const categoryRaw = String(raw["KOD3"] ?? "").trim();`
  okunup `rows.push({ ..., categoryRaw })`'a eklenir (zorunlu alan değil,
  boşsa sorun değil — sadece eşleşme başarısız sayılır).
- `GENDER_MAP`'in hemen altına, aynı desende:
  ```ts
  // Koton checklist'lerindeki KOD3 (urun grubu) degerlerinin Bollmark kategori
  // adina karsiligi. Haritada olmayan bir deger gelirse mapCategoryName null
  // doner, ithalat onizlemede "eslesmedi" olarak gosterilir - yoneticinin
  // secili fallback kategoriye duser. Yeni bir urun tipi geldikce buraya
  // eklenir.
  const CATEGORY_MAP: Record<string, string> = {
    "SHIRTS SS": "Gömlek",
    "SHIRTS LS BSC": "Gömlek"
    // ... yeni KOD3 degerleri geldikce eklenecek
  };

  export function mapCategoryName(categoryRaw: string): string | null {
    return CATEGORY_MAP[categoryRaw.trim().toUpperCase()] ?? null;
  }
  ```
  **Not:** `CATEGORY_MAP` anahtarları büyük harfle karşılaştırılacağı için
  ya anahtarları `.toUpperCase()` yazın ya da `mapGender`'daki gibi lookup
  anında normalize edin — `GENDER_MAP`'teki mevcut yaklaşım (`GENDER_MAP[genderRaw.trim().toUpperCase()]`,
  anahtarlar zaten büyük harf) ile tutarlı olsun.
- `ProductGroup` arayüzüne `categoryRaw: string` eklenir, `groupExcelRows`
  grup oluştururken (`genderRaw` ile aynı yerde) `categoryRaw: row.categoryRaw`
  atanır.
- Yeni yardımcı fonksiyon (`resolveBrandId`'nin hemen yanına):
  ```ts
  async function resolveCategoryIdByName(tx: Tx, categoryName: string): Promise<string | null> {
    const existing = await tx.category.findFirst({ where: { name: { equals: categoryName, mode: "insensitive" } } });
    return existing?.id ?? null;
  }
  ```
- `importProductGroups(groups, categoryId)` imzası `importProductGroups(groups, fallbackCategoryId)`
  olarak yeniden adlandırılır (anlam netliği için). Yeni ürün oluşturma
  bloğunda (`categoryId: categoryId || null` satırı), her grup için önce
  `mapCategoryName(group.categoryRaw)` denenir, eşleşirse `resolveCategoryIdByName`
  ile gerçek id aranır; bulunamazsa `fallbackCategoryId` kullanılır. Bu
  çözümleme, `brandIdByProductCode`/`slugByProductCode` gibi **transaction
  açılmadan önce** (dosyadaki mevcut yorum bunu özellikle vurguluyor —
  Neon pooled bağlantıda transaction içinde çok sayıda sıralı sorgu P2028
  zaman aşımına yol açıyor) bir `Map<string, string | null>` içinde
  önceden çözülüp transaction içinde sadece okunmalı, aynı `brandIdByProductCode`
  paterninde.
- **Mevcut ürün güncellemesi (barkod eşleşen satır) davranışı korunur:**
  `matchedExisting` durumunda kategori hiç güncellenmiyor (kod bunu zaten
  yapmıyor) — bu değişmemeli, aksi halde yönetici elle düzenlediği bir
  ürünün kategorisi sessizce değişebilir.

### `src/app/api/admin/urunler/excel-yukle/route.ts` (önizleme)

- `groups` map'ine `categoryRaw: g.categoryRaw` ve `detectedCategory: mapCategoryName(g.categoryRaw)`
  eklenir (import: `mapCategoryName` de `excel-import`'tan alınır).

### `src/components/admin/excel-import-wizard.tsx`

- `PreviewGroup` tipine `categoryRaw: string | null` ve `detectedCategory: string | null` eklenir.
- Önizleme tablosuna "Kategori" kolonu eklenir (Cinsiyet kolonunun yanına):
  `detectedCategory` varsa yeşil bir tik/rozet ile isim gösterilir, yoksa
  "—" (eşleşmedi).
- Mevcut "Kategori (tüm ürünlere uygulanır, opsiyonel)" dropdown'ının
  etiketi **"Eşleşmeyenler için kategori (opsiyonel)"** olarak güncellenir,
  açıklama metni de buna göre değişir (örn. "Yukarıda kategorisi otomatik
  tespit edilemeyen ürünler için kullanılır.").

### `src/app/api/admin/urunler/excel-aktar/route.ts`

- `body?.categoryId` okunan değişken `fallbackCategoryId` olarak yeniden
  adlandırılabilir (opsiyonel, sadece okunabilirlik) — `importProductGroups`
  çağrısına aynı şekilde geçirilir.

## 4) Test/doğrulama checklist

- [ ] `ornek-veriler/KOTON11052026CHECKLIST.xls` yüklendiğinde önizlemede
      tüm satırlar için "Kategori" kolonunda "Gömlek" görünüyor mu (harita
      "SHIRTS SS"/"SHIRTS LS BSC" → "Gömlek" içeriyorsa)?
- [ ] DB'de "Gömlek" adında bir kategori **varsa**, içe aktarılan yeni
      ürünler otomatik o kategoriye mi düşüyor?
- [ ] DB'de "Gömlek" kategorisi **yoksa**, ürünler otomatik kategori
      oluşturmadan fallback dropdown'daki (ya da hiç seçilmediyse
      kategorisiz) kategoriye mi düşüyor?
- [ ] Haritada olmayan bir `KOD3` değeri (örn. "TROUSERS") önizlemede
      "—" (eşleşmedi) gösteriyor mu, fallback'e doğru düşüyor mu?
- [ ] Barkodu zaten var olan bir satır güncellendiğinde (mevcut ürün),
      ürünün kategorisi **değişmiyor** mu?
- [ ] Aynı dosyada birden fazla ürün grubu, farklı `KOD3` değerleriyle
      farklı kategorilere doğru dağılabiliyor mu (tek dosyada karışık
      ürün tipi olduğunda)?
- [ ] `npm run lint` ve `npm run build` hatasız geçiyor mu?

## 5) Kapsam dışı

`CATEGORY_MAP`'in otomatik/AI ile genişletilmesi (şimdilik elle bakım —
yeni bir Koton ürün tipi geldikçe haritaya elle eklenecek), eşleşen isimde
kategori yoksa otomatik oluşturma (yukarıda bilinçli olarak kapsam dışı
bırakıldı), bir üründen birden fazla kategoriye atama.
