# Bollmark – Ürün Bilgisi Paketi: Şema + Admin Panel Plani (netleşti)

Bu dosya, marka + alt kategori + ürün detay alanları paketinin son halidir.
Açık noktalar netleşti, sıradaki adım bu planı Claude Code ile uygulamaya
başlamak (önce şema/migration, sonra admin formları, sonra mağaza gösterimi).

**Kapsam dışı bırakılanlar (ayrı, sonraki iş):** SEO altyapısı
(`generateMetadata`, sitemap.xml, robots.txt, JSON-LD) — site henüz
"yapım aşamasında" perdesinin arkasında olduğu için lansmana yakın ayrı bir
iş. İkna/dönüşüm unsurları (yorum-puanlama, stok azlığı mesajı, ilgili
ürün, arama/sıralama/sayfalama, wishlist) — ayrı bir özellik paketi. Yasal
uyum (checkout onay kutusu, İade/Kargo/Gizlilik/Hakkımızda sayfaları) —
satışa açılmadan önce ayrı ele alınacak.

## 1) Şema değişiklikleri

**Yeni `Brand` modeli** (isim yeterli; logo alanı şimdiden nullable olarak
eklenir ki ileride "istersen logo da eklenir" dediğinizde ayrı bir migration
gerekmesin — admin formunda logo için bir yükleme alanı şu an yok, sadece
isim girilecek):
```prisma
model Brand {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  logoUrl   String?   // şimdilik kullanılmıyor, ileride admin'e eklenir
  products  Product[]
  createdAt DateTime  @default(now())
}
```

**`Category` modeline hem alt kategori hem de kategori bazlı beden tablosu:**
```prisma
model Category {
  id        String     @id @default(cuid())
  name      String
  slug      String     @unique
  parentId  String?
  parent    Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryHierarchy")
  sizeGuide String?    // "Elbise" gibi bir kategoriye ait ortak beden tablosu metni
  products  Product[]
  createdAt DateTime   @default(now())
}
```
Beden tablosu kategori bazlı tutulacağı için `Product` üzerinde ayrı bir
`sizeGuide` alanı YOK — ürün sayfasında ürünün bağlı olduğu kategorinin
`sizeGuide`'ı gösterilir (kategori boşsa hiçbir şey gösterilmez; üst
kategoriden otomatik miras alma bu pakete dahil değil, istenirse V2).

**Yeni `Tag` modeli** (aşağıda "Etiketler nasıl çalışacak" bölümünde
açıklandı):
```prisma
model Tag {
  id       String    @id @default(cuid())
  name     String    @unique
  slug     String    @unique
  products Product[]
}
```

**`Product` modeline yeni alanlar:**
```prisma
model Product {
  // ...mevcut alanlar...
  brandId          String?
  brand            Brand?   @relation(fields: [brandId], references: [id])
  material         String?  // "%95 Pamuk, %5 Elastan"
  origin           String?  // "Türkiye'de üretilmiştir"
  careInstructions String?  // "30°C'de yıkayın, ütülemeyin"
  gender           String?  // "Kadın" | "Erkek" | "Unisex" | "Çocuk" (admin'de sabit dropdown)
  tags             Tag[]    // çoka-çok, aşağıya bakın
  isFeatured       Boolean  @default(false) // ana sayfa "Öne Çıkanlar" artık buna göre seçilecek
}
```
Hepsi opsiyonel eklenir ki mevcut ürünler için migration sorun çıkarmasın.

**Görsel alt metni:** `ProductImage.alt` zaten var ama admin formunda hiç
girilemiyor — input eklenir. `ProductOptionImage`'a (renk bazlı galeri) ise
`alt String @default("")` alanı yeni eklenir, şu an orada hiç yok.

## 2) Etiketler (tags) nasıl çalışacak — karar ve gerekçe

Serbest metin yerine ("sezon-kis", "Sezon Kış", "sezon kış" gibi üç farklı
yazımın üç ayrı etiket sayılması riskine karşı) kategoriler ve markalar
gibi **yönetilen bir liste** seçtim: `Tag` diye ayrı bir tablo var, admin
formunda ürüne etiket eklerken serbest yazmak yerine mevcut etiketlerden
arayıp seçiyorsunuz (admin panelinde zaten "Beden/Renk" seçiminde kullanılan
`searchable-multi-select` bileşeni burada da kullanılabilir — yeniden
yazmaya gerek yok). Yeni bir etiket lazımsa listeye ekleniyor ve o andan
sonra tüm ürünlerde tutarlı görünüyor. Bu şekilde "Oversize" hem sezon hem
kalıp hem stil için ortak bir etiket havuzu oluyor, filtreleme (mağaza
tarafında "Oversize ürünler" gibi bir sayfa/filtre) güvenilir kalıyor.
Ayrı bir "admin/etiketler" sayfasına gerek yok — etiketler sadece ürün
formunda seç/ekle şeklinde yönetilebilir (kategoriler gibi ayrı bir yönetim
sayfası bu pakette gereksiz karmaşıklık olur).

## 3) Admin panel form değişiklikleri

Ürün formuna yeni bir "Ürün Detayları" kartı eklenir: materyal, menşei,
bakım talimatı, cinsiyet (Kadın/Erkek/Unisex/Çocuk sabit dropdown), etiket
seçimi (yukarıdaki gibi arama+seç). "Kategori ve Durum" kartına marka
dropdown'u ve "Öne Çıkan Ürün" checkbox'ı eklenir. Kategori dropdown'u
hiyerarşiyi yansıtır (girintili alt kategori seçenekleri). Görsel ekleme
alanlarına her URL'nin yanına opsiyonel "Alt metin" input'u eklenir.

**Kategoriler sayfası:** kategori formuna "Üst Kategori" dropdown'u ve
"Beden Tablosu" çok satırlı metin alanı eklenir. Liste üst-alt ilişkisini
girintili gösterir.

**Marka yönetimi:** Kategoriler sayfasına çok benzer yeni bir
"admin/markalar" sayfası (ekleme/düzenleme/silme, ürün sayısı badge'i) —
mevcut `category-row.tsx` neredeyse birebir marka için de kullanılabilir.

## 4) Mağaza tarafı gösterim değişiklikleri

Ürün sayfasında marka adı kategori adının yanına eklenir; materyal/menşei/
bakım bilgisi açıklamanın altına yeni bir bölüm olarak eklenir; ürünün
bağlı olduğu kategoride `sizeGuide` doluysa "Beden Tablosu" bölümü gösterilir
(boşsa bölüm hiç görünmez). Ana sayfadaki "Öne Çıkanlar" sorgusu artık
`isFeatured: true` olan ürünleri öncelikli gösterir (hiç işaretlenmemişse
mevcut davranışa, en yeni ürünlere düşer).

## 5) Sonraki adım

Plan netleşti. Uygulama sırası: (1) şema değişikliği + migration
(`Brand`, `Tag`, `Category.parentId`/`sizeGuide`, `Product` yeni alanları,
`ProductOptionImage.alt`), (2) admin form güncellemeleri (Ürün Detayları
kartı, marka/kategori/etiket seçimi, admin/markalar sayfası), (3) mağaza
tarafı gösterim güncellemeleri. SEO altyapısı, ikna/dönüşüm unsurları ve
yasal uyum maddeleri ayrı birer sonraki iş olarak bekliyor (bkz. giriş).
