# Bollmark – Excel Aktarımında Otomatik Kategori Eşleme Planı

## Güncelleme notu (2. tur)

Bu belgenin 1. turu (aşağıdaki "Bağlam" ve devamı) tamamlandı: `KOD3` sabit
`CATEGORY_MAP` üzerinden otomatik kategoriye eşleniyor, eşleşmezse global
fallback dropdown'a düşüyordu. Bu tur o akışı genişletiyor: haritada karşılığı
olmayan `KOD3` değerleri için bir **AI önerisi** katmanı ve yöneticinin
**satır satır elle düzeltebileceği** bir kategori kutucuğu eklendi. Aşağıdaki
"2) Tasarım kararları" ve "3) Teknik değişiklikler" bölümleri bu ikinci turun
**güncel** hâlini yansıtıyor; 1. turdaki karar metni tarihsel bağlam için
korunuyor ama uygulanan son davranış budur.

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

- **Öncelik sırası (kesinleşen, 2. tur):** her ürün grubunun kategorisi şu
  sırayla belirlenir: **(a)** yöneticinin önizleme tablosundaki satır
  kutucuğuna elle yazdığı/onayladığı değer (bu kutucuk zaten `CATEGORY_MAP`
  kesin eşleşmesi ya da AI önerisiyle önceden dolu gelir — yönetici üstüne
  yazıp değiştirebilir), **(b)** kutucuk boş bırakılırsa global "eşleşmeyenler
  için kategori" fallback dropdown'ı, **(c)** o da seçilmediyse kategorisiz.
  Eski akıştaki "sadece `CATEGORY_MAP` otomatik eşler, gerisi hep fallback'e
  düşer" davranışı, artık satır kutucuğu üzerinden yönetici onayına açıldı.
- **AI önerisi ne zaman devreye girer:** `CATEGORY_MAP`'te karşılığı olmayan
  bir `KOD3` değeri geldiğinde, otomatik ve sessizce bir kategoriye
  **bağlanmaz** — Anthropic API'ye (`src/lib/category-suggest.ts`,
  `suggestCategory`) o `KOD3` değeri ve DB'deki mevcut kategori adları
  listesi verilip "en olası eşleşme hangisi" sorulur. Dönen kategori adı +
  güven düzeyi (`high`/`medium`/`low`) + kısa gerekçe **ÖNERİ** olarak
  işaretlenir (`suggestedCategory`), asla kesin eşleşme gibi davranılmaz:
  önizleme kutucuğunu doldurur ama farklı bir rozetle ("öneri, kontrol et")
  gösterilir ve içe aktarımda **her zaman** yöneticinin son onayladığı metin
  kullanılır (AI'nin çıktısı hiçbir zaman doğrudan DB'ye yazılmaz). `ANTHROPIC_API_KEY`
  tanımlı değilse bu katman sessizce devre dışı kalır, davranış 1. turdaki
  gibi kalır ("—" / eşleşmedi).
- **Eşleşen isimde kategori DB'de yoksa otomatik oluşturulsun mu?**
  **Hayır**, bu 1. turdaki kararla aynı — ne `CATEGORY_MAP`/AI önerisi ne de
  yöneticinin elle girdiği isim otomatik kategori **oluşturmaz**. Elle girilen
  isim `excel-aktar` route'unda DB'deki kategorilerle (case-insensitive) tek
  tek karşılaştırılır; eşleşmeyen bir isim varsa **içe aktarım hiç
  başlamadan** (herhangi bir yazma işleminden önce) 400 döner ve hangi ürün
  kodu/kategori adının eşleşmediği listelenir — yönetici ya adı düzeltir ya
  da kategoriyi önce Kategoriler sayfasından oluşturur.
- **Harita nerede tutulur:** `GENDER_MAP` ile birebir aynı desende, kod
  içinde sabit bir `CATEGORY_MAP: Record<string, string>` — yeni bir ürün
  tipi (T-shirt, pantolon, elbise...) geldikçe elle genişletilecek. Haritada
  olmayan `KOD3` değerleri önizleme ekranında görünür olmalı (aşağıdaki
  UI maddesi) ki yönetici hangi kodun haritaya eklenmesi gerektiğini görsün.
  `CATEGORY_MAP`'in kod deploy etmeden (bir DB tablosuyla) genişletilebilir
  hale getirilmesi ayrı bir öneri olarak "6) Sonraki adım (onay bekliyor)"
  bölümünde ele alınıyor, bu turda **uygulanmadı**.

## 3) Teknik değişiklikler

### `src/lib/excel-import.ts`

- `ExcelImportRow.categoryRaw` (`KOD3`), `CATEGORY_MAP`, `mapCategoryName` 1.
  turdan aynen korunuyor.
- `resolveCategoryIdByName(tx, categoryName)` artık **export** ediliyor —
  hem `importProductGroups` içinde hem de `excel-aktar` route'unda
  yöneticinin elle girdiği isimleri doğrulamak için kullanılıyor.
- **Kategori çözümlemesi artık `importProductGroups`'un dışına taşındı.**
  Fonksiyon imzası `importProductGroups(groups, fallbackCategoryId)` yerine
  `importProductGroups(groups, categoryIdByProductCode: Map<string, string | null>)`
  oldu — `CATEGORY_MAP`/AI önerisi/fallback öncelik zinciri artık burada
  değil, çağıran route'ta (`excel-aktar`) kuruluyor; bu fonksiyon sadece
  kendisine verilen kesin id'yi yeni ürün oluştururken uyguluyor
  (`categoryId: categoryIdByProductCode.get(group.productCode) ?? null`).
  Neden: yöneticinin önizlemede onayladığı satır bazlı değer artık tek
  otorite olduğu için, aynı çözümlemeyi iki yerde (önizleme + aktarım)
  tekrarlamak yerine tek bir yerde (route) yapılıyor.
- **Mevcut ürün güncellemesi (barkod eşleşen satır) davranışı korunur:**
  `matchedExisting` durumunda kategori hiç güncellenmiyor — bu değişmedi,
  aksi halde yönetici elle düzenlediği bir ürünün kategorisi sessizce
  değişebilir.

### `src/lib/category-suggest.ts` (yeni dosya)

- `suggestCategory(categoryRaw, existingCategoryNames): Promise<CategorySuggestion | null>`
  — Anthropic Messages API'ye (`https://api.anthropic.com/v1/messages`, model
  `claude-haiku-4-5-20251001`, düz `fetch`, ek SDK bağımlılığı yok) `KOD3`
  değeri ve DB'deki kategori adları listesiyle "en olası eşleşme hangisi"
  sorulur; cevaptan JSON çıkarılır (`{categoryName, confidence, reason}`).
  Dönen `categoryName` mevcut kategori adları listesinde **birebir**
  (case-insensitive) yoksa `null` döner — model listede olmayan bir isim
  uydurursa öneri sessizce reddedilir. `ANTHROPIC_API_KEY` tanımlı değilse
  ya da ağ/parse hatası olursa `null` döner ve hata sadece `console.error`
  ile loglanır (`sendMail`'deki "asıl işlemi asla durdurmaz" prensibiyle
  aynı) — önizleme akışı bu yüzden hiç kesilmez.

### `src/app/api/admin/urunler/excel-yukle/route.ts` (önizleme)

- `groups` map'ine `detectedCategory: mapCategoryName(g.categoryRaw)` (1.
  turdan) yanında `suggestedCategory: CategorySuggestion | null` eklendi.
- Öneri sadece `detectedCategory` yoksa istenir; aynı `KOD3` değeri birden
  fazla grupta geçebileceği için önce `rawGroups` üzerinden **benzersiz**
  `KOD3` değerleri toplanır (`suggestionCache`), her biri için `suggestCategory`
  **tek kez** çağrılır, sonra gruplara dağıtılır — bir dosyada aynı ürün
  tipi kodu 40 kez geçse bile 40 ayrı API çağrısı atılmaz.
- DB'deki mevcut kategori adları listesi (`prisma.category.findMany({ select: { name: true } })`)
  bu route'ta bir kez çekilip hem AI önerisine hem (dolaylı olarak) önizleme
  ekranındaki autocomplete'e temel oluşturuyor.

### `src/components/admin/excel-import-wizard.tsx`

- `PreviewGroup` tipine `suggestedCategory: { categoryName; confidence; reason } | null` eklendi.
- Önizleme adımı yüklendiğinde, her ürün grubu için bir `categoryByCode`
  state'i (`productCode -> string`) `detectedCategory ?? suggestedCategory?.categoryName ?? ""`
  ile önceden dolduruluyor.
- Tablodaki "Kategori" hücresi artık **her zaman düzenlenebilir bir metin
  kutucuğu** (`<input list="excel-import-category-options">`, DB'deki
  kategori adlarını içeren bir `<datalist>` ile autocomplete) + üstünde
  durumu gösteren bir rozet:
  - Kesin eşleşme (`detectedCategory`) → yeşil "Eşleşti" rozeti.
  - Sadece AI önerisi (`suggestedCategory`, `detectedCategory` yok) → amber
    "Öneri, kontrol et (güven düzeyi)" rozeti, `title` özniteliğinde AI'nin
    gerekçesi.
  - İkisi de yoksa → kırmızı "Eşleşmedi" rozeti, kutucuk boş başlar.
  Rozet, satırın **orijinal tespit durumunu** gösterir (yönetici kutucuğu
  düzenlese de rozet değişmez) — amaç yöneticiye "bu değer nereden geldi,
  ne kadar güvenilir" bilgisini vermek.
- Tablonun üstüne, `preview.groups` üzerinden hesaplanan üç sayaçla
  ("kesin eşleşti" / "AI önerisi (kontrol bekliyor)" / "eşleşmedi, elle
  girilmeli") bir özet banner eklendi.
- Mevcut "Kategori (tüm ürünlere uygulanır, opsiyonel)" dropdown'ının
  etiketi **"Eşleşmeyenler için kategori (opsiyonel)"** olarak kaldı (1.
  turda yapıldı) — artık anlamı "satır kutucuğu boş bırakılan ürünler için
  fallback" (bkz. bölüm 2, öncelik sırası).
- `handleImport`, `rows`/`categoryId` yanında artık `categoryOverrides:
  categoryByCode` (tüm satırların o anki kutucuk değerleri) gönderiyor.
  `excel-aktar` 400 + `unresolvedCategories` döndürürse (elle girilen isim
  DB'de yoksa), toast'ta hangi kategori adlarının bulunamadığı gösteriliyor
  ve yönetici önizleme ekranından ayrılmadan düzeltebiliyor.

### `src/app/api/admin/urunler/excel-aktar/route.ts`

- `body?.categoryOverrides` (`Record<productCode, string>`, önizlemedeki
  satır kutucuklarının o anki değerleri) okunuyor.
- Tüm gruplardaki **benzersiz**, boş olmayan override isimleri toplanıp
  `resolveCategoryIdByName` ile tek tek DB'de aranıyor (`categoryIdByName`
  cache'i — aynı isim birden fazla satırda geçse de tek sorgu).
- Herhangi bir override ismi DB'de bulunamazsa (`unresolved.length > 0`),
  **hiçbir yazma işlemi başlamadan** 400 dönülüyor:
  `{ error, unresolvedCategories: [{ productCode, categoryName }, ...] }`.
- Bulunamayan yoksa, her grup için öncelik sırası uygulanıyor: override
  varsa `categoryIdByName.get(override)`, yoksa `fallbackCategoryId` — sonuç
  `categoryIdByProductCode: Map<string, string | null>` olarak
  `importProductGroups(groups, categoryIdByProductCode)`'a geçiriliyor.

## 4) Test/doğrulama checklist

- [ ] `ornek-veriler/KOTON11052026CHECKLIST.xls` yüklendiğinde önizlemede
      "SHIRTS SS"/"SHIRTS LS BSC" satırları yeşil "Eşleşti" rozetiyle
      "Gömlek" değeriyle geliyor mu?
- [ ] Haritada olmayan bir `KOD3` değeri (örn. "TROUSERS") için,
      `ANTHROPIC_API_KEY` tanımlıyken amber "Öneri, kontrol et" rozeti ve
      DB'deki kategorilerden biriyle dolu bir kutucuk geliyor mu (rozete
      hover'da gerekçe görünüyor mu)?
- [ ] `ANTHROPIC_API_KEY` tanımsızken/AI hata dönerken aynı satır kırmızı
      "Eşleşmedi" rozetiyle boş kutucuk gösteriyor mu (akış kesilmeden)?
- [ ] Önizleme tablosundaki özet banner'daki üç sayı (kesin/AI önerisi/
      eşleşmedi) `preview.groups` ile tutarlı mı?
- [ ] Bir satırın kutucuğuna DB'de **olmayan** bir isim yazıp içe
      aktarmayı denediğinde, hiçbir ürün/varyant yazılmadan 400 + hangi
      satırın hangi isimle eşleşmediğini gösteren bir toast görünüyor mu?
- [ ] Aynı satırı DB'de **var olan** bir isimle (örn. farklı harf
      büyüklüğüyle) düzeltip tekrar denediğinde içe aktarım başarıyla
      tamamlanıyor mu?
- [ ] Kutucuk boş bırakılan bir satır, global "eşleşmeyenler için kategori"
      fallback dropdown'ındaki (ya da hiç seçilmediyse kategorisiz)
      kategoriye düşüyor mu?
- [ ] Barkodu zaten var olan bir satır güncellendiğinde (mevcut ürün),
      ürünün kategorisi **değişmiyor** mu?
- [ ] Aynı dosyada birden fazla ürün grubu, farklı `KOD3` değerleriyle
      farklı kategorilere doğru dağılabiliyor mu (tek dosyada karışık
      ürün tipi olduğunda)?
- [ ] `npm run lint` ve `npm run build` hatasız geçiyor mu?

## 5) Kapsam dışı (bu tur)

Eşleşen isimde kategori yoksa otomatik oluşturma (bilinçli olarak kapsam
dışı — hem `CATEGORY_MAP`/AI önerisi hem yöneticinin elle girdiği isim için
geçerli), bir üründen birden fazla kategoriye atama, AI önerisinin
kullanıcı onayı olmadan doğrudan DB'ye yazılması (asla yapılmıyor — bkz.
bölüm 2).

## 6) Öğrenilmiş eşlemeler (uygulandı)

Kullanıcı onayıyla uygulandı. `CategoryKodMapping { kod3: String @unique,
categoryId: String }` modeli eklendi (`prisma/schema.prisma`, `Category`'ye
`kodMappings CategoryKodMapping[]` ters ilişkisiyle birlikte — Prisma 7 bu
ilişkiyi iki taraflı tanımlanmadan kabul etmiyor). `npx prisma db push` ile
Neon veritabanına uygulandı (bu proje migration dosyası tutmuyor, `db:push`
akışını kullanıyor).

- **Lookup sırası (kesinleşen):** `src/lib/excel-import.ts`'teki
  `detectCategoryName(tx, categoryRaw)` önce `resolveLearnedCategoryName`
  (DB'deki `CategoryKodMapping`) sonra sabit `CATEGORY_MAP`'i dener; ikisi de
  yoksa `null` döner ve çağıran taraf (`excel-yukle` route'u) AI önerisine
  başvurur. Bu sayede yönetici `CATEGORY_MAP`'teki bir hatayı da kod deploy
  etmeden, sadece bir sonraki dosyayı içe aktarırken düzeltebiliyor —
  öğrenilmiş kayıt her zaman sabit haritanın önüne geçiyor.
- **Ne zaman öğrenilir:** `excel-aktar` route'unda içe aktarım başarıyla
  tamamlandıktan **sonra**, önizlemede yöneticinin **gerçekten bir isim
  yazdığı/onayladığı** (`categoryOverrides` içinde boş olmayan bir değer
  olan ve DB'de başarıyla çözülen) her satır için `categoryRaw`'ın
  normalize edilmiş hâli (`normalizeKod3` — `CATEGORY_MAP` ile aynı
  `trim().toUpperCase()` kuralı) → çözülen `categoryId` eşlemesi
  `prisma.categoryKodMapping.upsert(...)` ile kalıcı hale getiriliyor.
  **Kutucuğu boş bırakıp global fallback'e düşen satırlar asla
  öğrenilmiyor** — aksi halde rastgele bir `KOD3` değeri, o dosyada bir kez
  seçilmiş fallback kategoriye kalıcı olarak bağlanırdı, bu istenmeyen bir
  yan etki olurdu.
- **Hata toleransı:** öğrenme adımı `importProductGroups` başarıyla
  tamamlandıktan sonra, ayrı ve best-effort şekilde çalışıyor
  (`Promise.all` + her upsert için `.catch` ile hatayı sadece logluyor) —
  bir öğrenme kaydı yazılamazsa bile asıl ürün/varyant aktarımı sonucu
  hiçbir şekilde etkilenmiyor, yanıt her zaman aktarım özetini döner.
