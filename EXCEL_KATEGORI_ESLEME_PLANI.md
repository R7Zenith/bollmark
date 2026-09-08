# Bollmark – Excel Aktarımında Otomatik Kategori Eşleme Planı

## Güncelleme notu (3. tur)

Bu belgenin 1. turu (aşağıdaki "Bağlam" ve devamı) tamamlandı: `KOD3` sabit
`CATEGORY_MAP` üzerinden otomatik kategoriye eşleniyor, eşleşmezse global
fallback dropdown'a düşüyordu. 2. tur o akışı genişletti: haritada karşılığı
olmayan `KOD3` değerleri için bir **AI önerisi** katmanı, yöneticinin **satır
satır elle düzeltebileceği** bir kategori kutucuğu ve **öğrenilmiş eşlemeler**
(`CategoryKodMapping`) eklendi. 3. tur ise gerçek kullanımda ortaya çıkan bir
sürtünmeyi giderdi: yönetici onayladığı bir kategori adı DB'de henüz yoksa
(ör. "Gömlek" hiç oluşturulmamışsa) artık **400 ile durup yöneticiyi Kategoriler
sayfasına yönlendirmiyor, kategoriyi kendisi otomatik oluşturuyor**. Aşağıdaki
"2) Tasarım kararları" ve "3) Teknik değişiklikler" bölümleri bu üçüncü turun
**güncel** hâlini yansıtıyor; önceki tur kararları tarihsel bağlam için
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
  **Evet (3. tur değişikliği).** 1. ve 2. turda bilinçli olarak "hayır"
  kararı verilmişti (yeşil eşleşme yoksa 400 ile durdurup yöneticiye kategori
  adını düzeltmesini/önceden oluşturmasını isteme) — ama pratikte gereksiz
  bir sürtünme çıkardı: yönetici zaten önizlemede o ismi (kesin eşleşme, AI
  önerisi ya da kendi yazdığı) görüp onaylıyor, bu son bir onay adımıyken
  aktarımda ayrıca "önce git kategoriyi oluştur" diye durdurmanın ek bir
  güvenlik değeri yoktu. Kullanıcı isteğiyle davranış değişti: `excel-aktar`
  route'u artık DB'de bulamadığı bir kategori adını **otomatik olarak
  oluşturuyor** (`getOrCreateCategoryId`, `src/lib/excel-import.ts` —
  marka için zaten var olan `resolveBrandId`'yle birebir aynı pattern: ad +
  otomatik üretilen benzersiz slug, üst kategorisiz/tepe seviye). Hâlâ
  geçerli olan güvenlik: bu sadece yöneticinin önizlemede **görüp onayladığı**
  metin için çalışır — AI'nin çıktısı hiçbir zaman kullanıcı onayı olmadan
  buraya ulaşmaz (bkz. yukarıdaki AI önerisi maddesi).
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

### `src/app/api/admin/urunler/excel-aktar/route.ts`

- `body?.categoryOverrides` (`Record<productCode, string>`, önizlemedeki
  satır kutucuklarının o anki değerleri) okunuyor.
- Tüm gruplardaki **benzersiz**, boş olmayan override isimleri toplanıp
  `getOrCreateCategoryId` ile tek tek DB'de aranıyor; bulunamayan isim
  **otomatik olarak yeni bir kategori olarak oluşturuluyor** (3. tur, bkz.
  bölüm 2) — `categoryIdByName` cache'i sayesinde aynı isim birden fazla
  satırda geçse de tek sorgu/tek oluşturma yapılıyor, artık hiçbir 400
  dönmüyor (o kısım tamamen kaldırıldı).
- Her grup için öncelik sırası uygulanıyor: override varsa
  `categoryIdByName.get(override)`, yoksa `fallbackCategoryId` — sonuç
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
      aktardığında (3. tur), hata almadan tamamlanıyor mu ve Kategoriler
      sayfasında o isimle yeni bir kategori (tepe seviye, benzersiz slug)
      otomatik oluşmuş mu?
- [ ] Aynı ismi ikinci bir dosyada tekrar kullandığında (ya da aynı dosyada
      iki farklı satırda) **ikinci bir kategori oluşturmadan**, var olanla
      eşleşiyor mu (case-insensitive)?
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

Bir üründen birden fazla kategoriye atama, AI önerisinin kullanıcı onayı
olmadan doğrudan DB'ye yazılması (asla yapılmıyor — bkz. bölüm 2). ("Eşleşen
isimde kategori yoksa otomatik oluşturma" 1-2. turda kapsam dışıydı, 3. turda
kullanıcı isteğiyle uygulandı — bkz. bölüm 2.)

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
