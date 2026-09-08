# Bollmark – Kategoriler Sayfası Uygulama Planı (Faz 1)

Bu dosya, `KATEGORILER_SAYFASI_ARASTIRMA_VE_ONERILER.md`'de önerilen üç
rotadan (A/B/C) **en yüksek etki / en düşük risk** olan maddelerin
birleştirilmiş, uygulamaya hazır planıdır: Rota A'nın tamamı + Rota B'nin
en değerli iki maddesi (manuel sıralama, SEO/açıklama alanları). Repo
(`prisma/schema.prisma`, `src/app/(admin)/admin/kategoriler/page.tsx`,
`src/components/admin/category-row.tsx`, `src/lib/category-tree.ts`,
`src/components/admin/products-filters.tsx`, `src/components/admin/image-field.tsx`)
okunarak hazırlandı; mevcut kod stiliyle (Türkçe yorumlar, server actions,
`redirect` ile başarı/hata query param'ı + toast, mevcut admin
bileşenlerinin yeniden kullanımı) tutarlı.

**Kapsam dışı bırakılanlar (bu pakette değil, ayrı faz olarak bekliyor):**
kategori için ayrı detay sayfası (`/admin/kategoriler/[id]`), toplu seçim/
toplu işlem (`bulk-action-bar.tsx`), kural bazlı otomatik ("akıllı")
kategoriler, zamanlanmış görünürlük, kategori bazlı satış analitiği, çoklu
kategori desteği (ürünün birden fazla kategoriye ait olabilmesi — veri
modelinde kırılma değişikliği gerektirir). Bunlar `ARASTIRMA_VE_ONERILER`
dosyasındaki Rota B'nin geri kalanı ve Rota C.

## 0) Veri modeli değişiklikleri

`prisma/schema.prisma`'da `Category` modeline şu alanlar eklenecek:

```prisma
model Category {
  id              String     @id @default(cuid())
  name            String
  slug            String     @unique
  parentId        String?
  parent          Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children        Category[] @relation("CategoryHierarchy")
  sizeGuide       String?
  imageUrl        String?
  description     String?
  metaTitle       String?
  metaDescription String?
  isActive        Boolean    @default(true)
  sortOrder       Int        @default(0)
  products        Product[]
  createdAt       DateTime   @default(now())
}
```

Proje `prisma migrate` değil **`npm run db:push`** kullanıyor (bkz.
`package.json`), migration dosyası oluşturulmayacak, doğrudan push
edilecek.

**Geriye dönük sıralama (backfill):** `sortOrder` yeni alan olduğu için
tüm mevcut kategoriler `0` ile başlayacak — bu, aynı üst kategori altındaki
kardeşlerin sırasını belirsizleştirir. `db:push` sonrası **tek seferlik**
bir script (`scripts/backfill-kategori-sira.ts`, mevcut `prisma/seed.ts`
paternine benzer) yazılıp çalıştırılmalı: her `parentId` grubunu şu anki
alfabetik sırayla (`name.localeCompare(..., "tr")`) gezip `sortOrder`'ı
0, 10, 20, 30... gibi aralıklı ata (aralıklı olması ileride araya ekleme
kolaylığı sağlar). Script çalıştıktan sonra silinebilir ya da
`scripts/`'te bırakılabilir.

## 1) Sıralama mantığı — `src/lib/category-tree.ts`

`buildCategoryOptions` içindeki

```ts
list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
```

satırı

```ts
list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"));
```

olarak değiştirilecek (`sortOrder` eşitse isme göre kararlı sıralama).
`CategoryTreeNode` tipine `sortOrder: number` eklenmeli, `page.tsx`'teki
`prisma.category.findMany` çağrısının `orderBy`'ı da `sortOrder`'a göre
güncellenmeli (`orderBy: [{ sortOrder: "asc" }, { name: "asc" }]`).

## 2) Sürükle-bırak ile sıralama

**Karar:** `@dnd-kit/core` + `@dnd-kit/sortable` kullanılacak (proje
React 19 kullanıyor, dnd-kit React 19 ile uyumlu ve halihazırda kurulu
`react-beautiful-dnd` gibi eski/bakımsız alterniflere göre daha güvenli).
`npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.

- **Kısıtlama:** Sürükleme sadece **aynı üst kategori altındaki
  kardeşler arasında** sıralama değiştirir (yeniden ebeveynleme —
  bir kategoriyi başka bir üst kategorinin altına taşıma — bu fazın
  kapsamı dışında, Rota B'nin geri kalanına bırakıldı). Bu, `category-tree.ts`'in
  ürettiği düz listede her depth grubunu ayrı sürüklenebilir liste olarak
  ele almayı gerektirir; en basit uygulama: kategori listesini `page.tsx`'te
  `depth`'e göre değil, `parentId`'ye göre gruplayıp her grubu ayrı bir
  `SortableContext` içine almak.
- Yeni API route: `POST /api/admin/kategoriler/sirala` — body:
  `{ ids: string[] }` (yeni sıradaki id listesi, hepsi aynı `parentId`'ye
  ait olmalı). Route içinde `requireAdmin()` çağrılır, `prisma.$transaction`
  ile her id'ye `sortOrder = index * 10` yazılır. Mevcut
  `src/app/api/admin/urunler/bulk/route.ts` ile aynı desende (auth kontrolü,
  zod ile body validasyonu, `NextResponse.json`).
- `category-row.tsx`'e sürükleme tutamacı (`GripVertical` — `lucide-react`'te
  zaten var) eklenir, satır `dnd-kit`'in `useSortable` hook'una bağlanır.
  Sürükleme bittiğinde (`onDragEnd`) yeni sıra client tarafında iyimser
  (optimistic) güncellenir, arka planda yukarıdaki API route'a `fetch` ile
  yeni sıra gönderilir; hata olursa eski sıraya geri alınıp toast ile
  hata gösterilir (`useToast`, `components/admin/toast.tsx` zaten var).

## 3) Kategori formunu genişletme — görsel, açıklama, SEO, aktif/pasif

`page.tsx`'teki `createCategory`/`updateCategory` server action'ları:

```ts
const imageUrl = String(formData.get("imageUrl") || "").trim() || null;
const description = String(formData.get("description") || "").trim() || null;
const metaTitle = String(formData.get("metaTitle") || "").trim() || null;
const metaDescription = String(formData.get("metaDescription") || "").trim() || null;
const isActive = formData.get("isActive") === "on";
```

alanlarını okuyup `prisma.category.create`/`update`'e ekleyecek şekilde
genişletilecek.

**"Yeni Kategori" formu** (page.tsx) ve **satır düzenleme formu**
(`category-row.tsx`, `editing` state'i `true` iken): ikisi de aynı alan
setini içermeli —

- Görsel: mevcut `ImageField` bileşeni birebir kullanılır (`value={imageUrl}`,
  `onChange`, `uploadEndpoint="/api/admin/upload"` — zaten var, değişiklik
  gerekmez).
- Açıklama: `<textarea name="description">` (kategori sayfası/SEO için,
  `sizeGuide` textarea'sının hemen altına, aynı stil).
- SEO: `metaTitle` (kısa `<input>`), `metaDescription` (`<textarea rows=2>`),
  ikisi de "opsiyonel, boş bırakılırsa kategori adı/açıklaması kullanılır"
  yardımcı metniyle, katlanır bir "SEO ayarları" alt bölümü içinde (`<details>`
  ya da basit bir toggle) — form daha da kalabalıklaşmasın diye varsayılan
  kapalı.
- Aktif/Pasif: `<input type="checkbox" name="isActive" defaultChecked={isActive ?? true}>`
  + "Bu kategori mağazada gösterilsin" etiketi. Satır listesinde pasif
  kategoriler için gri `Badge tone="gray"` ile "Pasif" rozeti (mevcut
  `Badge` bileşeni).

Görünüm listesinde (editing değilken) küçük bir kare thumbnail (`imageUrl`
varsa `<img>`, yoksa mevcut boş-durum ikonlu kutu) satırın en soluna,
sürükleme tutamacından sonra eklenir.

## 4) Sayfa düzeni ve arama — `page.tsx`

- `max-w-md` kaldırılır, sayfa Ürünler/Siparişler sayfalarıyla tutarlı
  tam genişlik bir düzene taşınır: üstte başlık + "Yeni Kategori" birincil
  buton (formu artık sürekli açık bir kart yerine bir modal/slide-over'a
  taşımak da düşünülebilir, ama bu fazda basit tutmak için "Yeni Kategori"
  kartı sayfanın üstünde, liste altında geniş genişlikte kalabilir —
  asıl darlık sorunu `max-w-md`'den kaynaklanıyordu).
- Arama kutusu: kategori sayısı tipik olarak küçük/orta olacağı ve tam
  hiyerarşi (üst kategori bağlamı) korunması gerektiği için **server-side
  `searchParams` filtresi değil, client-side filtre** önerilir — zaten
  tüm ağaç `parentId` dropdown'ları için tam olarak çekiliyor. Yeni bir
  `"use client"` bileşeni (`category-search.tsx` veya mevcut listeyi
  saran bir client wrapper) mevcut `SearchInput` bileşenini kullanıp
  eşleşmeyen ama eşleşen bir alt kategorinin **atası olan** satırları da
  (bağlam için) görünür tutacak şekilde filtreler.

## 5) Ürün sayısını tıklanabilir yapma

`category-row.tsx`'teki `<Badge tone="gray">{productCount} ürün</Badge>`,
`productCount > 0` olduğunda `<Link href={`/admin/urunler?kategori=${id}`}>`
ile sarmalanır (Ürünler sayfası zaten `kategori` query param'ını
`ProductsFilters`/`page.tsx` üzerinden destekliyor, ek değişiklik
gerekmez).

## 6) Silme akışını iyileştirme — "ürünleri taşı ve sil"

Şu an `deleteCategory` server action'ı ürün varsa direkt `hata=urun-bagli`
ile engelliyor. Bunun yerine:

- `category-row.tsx`'te sil butonuna tıklanınca, `productCount > 0` ise
  `window.alert` yerine küçük bir modal açılır: "Bu kategoriye bağlı N ürün
  var" + bir `<select>` (diğer kategoriler, `parentOptions` zaten prop
  olarak var) + "Ürünleri taşı ve sil" onay butonu.
- Yeni server action `reassignProductsAndDeleteCategory(id, targetCategoryId, formData)`
  eklenir (`page.tsx`'te, `deleteCategory`'nin yanına): `prisma.$transaction`
  içinde önce `prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: targetCategoryId } })`,
  sonra kategori silinir. Alt kategori bağlıysa (`children` > 0) davranış
  **değişmiyor** — bu fazda hâlâ engellenir (otomatik yeniden ebeveynleme
  kapsam dışı).
- `category-feedback.tsx`'e yeni başarı mesajı: `tasindi-ve-silindi: "Ürünler taşındı, kategori silindi."`

## 7) Test/doğrulama checklist

- [ ] `npm run db:push` sonrası mevcut kategoriler bozulmadan (isim/üst
      kategori/beden tablosu aynı) listeleniyor mu?
- [ ] Backfill script'i çalıştıktan sonra kategori sırası önceki alfabetik
      sırayla birebir aynı mı (görünür bir sıçrama olmamalı)?
- [ ] Sürükle-bırak: aynı üst kategori altında iki kardeşi yer
      değiştirince sayfa yenilendiğinde sıra kalıcı mı? Farklı `parentId`
      gruplarına sürüklemeye izin verilmiyor mu (ya da güvenli şekilde
      engelleniyor mu)?
- [ ] Görsel/açıklama/SEO alanları boş bırakılınca `null` olarak kaydediliyor
      mu (mevcut `sizeGuide` alanındaki pattern gibi)?
- [ ] Pasif işaretlenen bir kategori mağaza tarafında (storefront'ta ilgili
      sorgularda) gerçekten filtreleniyor mu — **not:** storefront tarafında
      `Category` sorgusu yapan yerler (`src/lib/catalog.ts` vb.) bu fazda
      `isActive` kontrolü eklenmesi için ayrıca gözden geçirilmeli, aksi
      halde alan sadece admin'de görünüp storefront'u etkilemez.
- [ ] Ürün sayısı linkine tıklayınca Ürünler sayfası doğru kategoriyle
      filtreleniyor mu?
- [ ] "Ürünleri taşı ve sil" akışı: N ürün gerçekten hedef kategoriye
      taşınıyor mu, kategori siliniyor mu, işlem yarıda kesilirse (hata)
      hiçbir şey yarım kalmıyor mu (`$transaction` doğru sarılmış mı)?
- [ ] `npm run lint` ve `npm run build` hatasız geçiyor mu?

## 8) Sırada ne var (bu fazdan sonra)

Bu faz bittikten sonra doğal sıradaki adımlar: kategori detay sayfası
(`/admin/kategoriler/[id]`, form kalabalığını satır-içi düzenlemeden
çıkarır), toplu işlemler (`bulk-action-bar.tsx` ile çoklu seçip
gizle/taşı/sil), ardından Rota C'nin akıllı koleksiyon/analitik/çoklu
kategori maddeleri — bunlar `KATEGORILER_SAYFASI_ARASTIRMA_VE_ONERILER.md`'de
duruyor, hazır olduğunuzda ayrı bir plan olarak çıkarabiliriz.
