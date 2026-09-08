# Bollmark – Kategoriler Sayfası Uygulama Planı (Faz 2)

Faz 1 (`KATEGORILER_SAYFASI_UYGULAMA_PLANI.md`) tamamlandı — repo kontrol
edildi: `sortOrder`/`imageUrl`/`description`/`metaTitle`/`metaDescription`/
`isActive` alanları şemada, sürükle-bırak sıralama (`@dnd-kit`,
`/api/admin/kategoriler/sirala`), arama (`CategoryManager`), "ürünleri taşı
ve sil" akışı hepsi çalışır durumda. Bu dosya, `KATEGORILER_SAYFASI_ARASTIRMA_VE_ONERILER.md`'deki
Rota B'nin kalan iki maddesini (kategori detay sayfası, toplu işlemler)
kapsar — **artı, kod okunurken fark edilen bir Faz 1 eksiği**: `isActive`
alanı şu an sadece admin'de bir rozet, storefront'ta hiçbir sorguyu
etkilemiyor.

**Kapsam dışı (bu pakette değil):** akıllı/kural bazlı kategoriler,
zamanlanmış görünürlük, kategori bazlı satış analitiği, çoklu kategori
desteği (Rota C — ayrı, daha sonraki bir faz). Toplu "taşı" (başka üst
kategoriye toplu taşıma) da bu fazda **kapsam dışı** — tekli sürükle-bırak
ve tekli düzenleme zaten var, toplu taşımada döngü/geçerlilik kontrolü
ayrı bir iş; istenirse sonra eklenir.

## 0) Önce düzeltilmesi gereken: `isActive` storefront'ta hiç uygulanmıyor

Kontrol edildi: `src/lib/catalog.ts`'teki `getCatalogEntries`,
`getPublishedProducts`, `getCategories` fonksiyonları kategori sorgularında
`isActive` kontrolü yapmıyor; `src/app/sitemap.ts` tüm kategorileri
(pasif olanlar dahil) sitemap'e ekliyor; `src/app/(site)/urunler/page.tsx`'teki
`generateMetadata` da pasif kategoriler için SEO başlığı üretmeye devam
ediyor. Sonuç: admin'de bir kategoriyi "Pasif" işaretlemek şu an **hiçbir
şeyi gizlemiyor** — `/urunler?kategori=<slug>` linki (sitemap'te de var)
hâlâ tam olarak çalışıyor. Bu, Faz 1'in doğrulama checklist'inde
işaretlenmiş ama uygulanmamış bir madde; Faz 2'nin ilk işi bu.

**Yapılacaklar:**
1. `src/lib/catalog.ts`: `getCatalogEntries` ve `getPublishedProducts`
   içindeki `category: categorySlug ? { slug: categorySlug } : undefined`
   satırları `category: categorySlug ? { slug: categorySlug, isActive: true } : undefined`
   olarak güncellenir (pasif kategori slug'ıyla gelen istek boş sonuç
   dönsün). `getCategories()` içine `where: { isActive: true }` eklenir.
2. `src/app/(site)/urunler/page.tsx` → `generateMetadata`'daki
   `prisma.category.findUnique({ where: { slug: kategori }, ... })`
   sorgusuna `isActive: true` eklenir (pasif kategori için "Tüm Ürünler"
   başlığına düşsün).
3. `src/app/sitemap.ts`: `prisma.category.findMany({ select: { slug: true } })`
   → `prisma.category.findMany({ where: { isActive: true }, select: { slug: true } })`.
4. **Dokunulmayacaklar:** admin tarafındaki sorgular (`kategoriler/page.tsx`,
   `products-filters.tsx`, ürün formundaki kategori dropdown'ı) — yönetici
   pasif kategorileri de görebilmeli/ürün atayabilmeli, sadece storefront
   tarafı filtrelenecek.

## 1) Kategori detay sayfası — `/admin/kategoriler/[id]/page.tsx`

- Yeni route eklenir. Ürün detay sayfasıyla (`src/app/(admin)/admin/urunler/[id]/page.tsx`)
  aynı iskelet: `requireAdmin()`, `notFound()` (kategori bulunamazsa),
  `Card` içinde form, mevcut `updateCategory`/`deleteCategory`/
  `reassignProductsAndDeleteCategory` server action'ları yeniden kullanılır.
  Bu action'lar şu an `kategoriler/page.tsx` içinde tanımlı — iki sayfa da
  kullanacağı için `src/lib/category-actions.ts` gibi ortak bir dosyaya
  taşınması (aynı `readCategoryFields` yardımcı fonksiyonuyla birlikte)
  mantıklı bir refactor.
- Form alanları birebir aynı (`CategoryFormFields` zaten paylaşılan bir
  bileşen, doğrudan kullanılır): isim, üst kategori, beden tablosu, görsel,
  açıklama, SEO, aktif/pasif.
- Liste sayfasında (`CategoryRow`) kalem/düzenle ikonu artık inline formu
  açmak yerine bu sayfaya yönlendiren bir `Link` olur
  (`href={`/admin/kategoriler/${id}`}`). Satırdaki inline düzenleme modu
  tamamen kaldırılabilir — `editing` state'i, `CategoryFormFields`'in
  satır içi kullanımı vs. `category-row.tsx`'ten silinir, satır artık
  sadece görüntüleme + sürükleme + sil + "detaya git" linkinden ibaret,
  belirgin şekilde sadeleşir.
- Kaydet/sil butonları için mevcut `SaveBar` bileşeni (`src/components/admin/save-bar.tsx`,
  ürün detay sayfasında kullanılan patern) burada da kullanılır.

## 2) Toplu işlemler

- `CategoryManager`'a çoklu seçim eklenir: her satırın başına (sürükleme
  tutamacından sonra) bir checkbox, listenin üstüne mevcut `BulkActionBar`
  bileşeni (`components/admin/bulk-action-bar.tsx`, `ProductsTable`'daki
  kullanımıyla aynı desen).
- Yeni API route: `POST /api/admin/kategoriler/bulk` —
  `src/app/api/admin/urunler/bulk/route.ts` ile aynı desende
  (`getServerSession`/`role === "ADMIN"` kontrolü, zod ile
  `{ ids: string[], action: "SET_ACTIVE" | "SET_INACTIVE" | "DELETE" }`
  body doğrulaması).
- **Aktif yap / Pasif yap:** basit `updateMany({ where: { id: { in: ids } }, data: { isActive: ... } })`.
- **Sil:** seçilenler arasında ürünü **veya** alt kategorisi olanlar
  atlanır (tek tek silme akışındaki kurallarla tutarlı — otomatik "taşı"
  yapılmaz, bu toplu işlemde belirsizlik yaratır). Route, kaç tanesinin
  silindiğini/atlandığını `{ deleted: number, skipped: number }` olarak
  döner; `CategoryManager` sonucu toast'ta "X kategori silindi, Y kategori
  ürün/alt kategori içerdiği için atlandı" şeklinde gösterir (bulk action
  UX'te önerilen "belirsiz sonuç verme, açıkla" ilkesine uygun).
- Seçim sırasında ürünü/alt kategorisi olan satırların "Sil" toplu
  işleminde otomatik olarak atlanacağı, seçim yapılırken değil sonuçta
  bildirilir (ön-uyarı için her satırın ürün sayısı zaten görünür durumda).

## 3) Test/doğrulama checklist

- [ ] Bir kategori "Pasif" yapılınca `/urunler?kategori=<slug>` gerçekten
      boş/`404` benzeri bir deneyime mi düşüyor (ürün sayısı 0 gösteriliyor
      mu)?
- [ ] Sitemap'te pasif kategorinin `kategori=` linki artık yok mu?
- [ ] Admin tarafında pasif kategoriler hâlâ tam görünüyor mu (listede,
      ürün formundaki kategori dropdown'ında)?
- [ ] `/admin/kategoriler/[id]` sayfası: isim boşsa, kendine
      bağlanmaya çalışılırsa, döngü oluşturulmaya çalışılırsa aynı
      hata mesajları (`isim-gerekli`, `kendine-bagli`, `dongu`) doğru
      tetikleniyor mu?
- [ ] Toplu "Aktif yap"/"Pasif yap" seçili tüm kategorilere uygulanıyor mu?
- [ ] Toplu "Sil": ürünü olan bir kategori seçime dahilse atlanıp
      kullanıcıya bildiriliyor mu, diğerleri siliniyor mu?
- [ ] `npm run lint` ve `npm run build` hatasız geçiyor mu?

## 4) Sırada ne var (bu fazdan sonra)

Rota C — kural bazlı otomatik kategoriler, zamanlanmış görünürlük,
kategori bazlı satış analitiği, çoklu kategori desteği — hâlâ ayrı bir
faz olarak bekliyor (`KATEGORILER_SAYFASI_ARASTIRMA_VE_ONERILER.md`).
Ayrıca storefront'ta henüz bir kategori menüsü/navigasyonu yok
(`site-header.tsx` kategori kullanmıyor, kategoriler sadece `?kategori=`
query param'ıyla erişiliyor) — bu, kategori yönetiminden çok site
navigasyonu/tasarımıyla ilgili ayrı bir iş, istenirse ayrıca ele alınabilir.
