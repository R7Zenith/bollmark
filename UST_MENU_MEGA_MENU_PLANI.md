# Üst Menü (Header) Yeniden Tasarımı — Araştırma ve Claude Code Promptu

## Tespit edilen sorun

`src/components/site-header.tsx` şu an sadece 3 sabit link içeriyor:
"Tüm Ürünler", "Dış Giyim" (`/urunler?kategori=outerwear`) ve "Hikayemiz".
Hiçbir dropdown/mega-menu, hiçbir kategori ağacı bağlantısı yok.

İki önemli bulgu:

1. **"Dış Giyim" linki kırık.** `outerwear` slug'ı DB'de hiç yok (seed ve
   birleştirme scriptlerindeki tüm slug'lar Türkçe: `mont-kaban`, `ceket`
   vb.) — bu link muhtemelen hiçbir zaman çalışmadı ya da eski/silinmiş
   bir kategoriye işaret ediyordu.
2. **Önceki oturumda kategori ağacı büyütüldü ama menüye hiç yansımadı.**
   Kadın/Erkek/Aksesuar birleştirmesi sonrası kategori yapısı şu şekilde
   (39 kategori, `Product.gender` ayrı bir alan — kategori artık sadece
   ürün tipini temsil ediyor):
   - **Ortak ürün tipleri (9)**: Tişört, Gömlek, Pantolon, Kot Pantolon,
     Sweatshirt, Hırka, Ceket, Mont & Kaban, Eşofman
   - **Kadın'a özgü (14)**: Elbise, Bluz, Etek, Şort, Kazak & Süveter,
     Blazer Ceket, Trençkot, Yelek, Tulum, Tayt, Abiye & Davetiye,
     Mayo & Bikini, İç Giyim, Pijama & Gecelik
   - **Erkek'e özgü (6)**: Polo Yaka, Şort & Bermuda, Kazak, Blazer,
     Atlet, Boxer
   - **Aksesuar** (üst kategori) → Çanta, Ayakkabı, Şapka & Bere, Kemer,
     Şal & Atkı, Takı & Bijuteri, Çorap, Saç Aksesuarları

   Bu ~30 üst-seviye kategoriyi düz bir menüde göstermek mümkün değil —
   Koton/LC Waikiki gibi rakiplerin yaptığı gibi bir **mega-menu** (üstte
   Kadın/Erkek/Aksesuar sekmeleri, altında sütunlar halinde ürün tipleri)
   gerekiyor.

3. **Storefront'ta cinsiyet filtresi hiç yok.** `getCatalogEntries` /
   `getPublishedProducts` (`src/lib/catalog.ts`) ve `/urunler` sayfası
   sadece `kategori` slug'ına göre filtreliyor, `Product.gender` hiç
   kullanılmıyor. Mega-menu'de "Kadın" sekmesi altında bir kategoriye
   tıklandığında hem kategoriye hem cinsiyete göre filtrelemek için bu
   eksik tamamlanmalı.

## Önerilen çözüm

- Üst menü sekmeleri: **Kadın, Erkek, Aksesuar, Tüm Ürünler** (+ mevcut
  "Hikayemiz" linki sağda/ayrı kalabilir).
- Kadın/Erkek sekmeleri **veri odaklı** dolduruluyor: o cinsiyette en az
  1 yayınlanmış (`PUBLISHED`) ürünü olan kategoriler otomatik listeleniyor
  (sabit bir liste yerine `Product.gender` + `Category` join'i ile) — böylece
  katalog büyüdükçe menü kendiliğinden güncel kalır, yeni bir kategori
  eklenince kod değişikliği gerekmez.
- Aksesuar sekmesi kendi alt kategori ağacını (8 kategori) gösteriyor,
  cinsiyet süzgeci gerekmiyor.
- Bir kategoriye tıklanınca `/urunler?kategori=<slug>&cinsiyet=<Kadın|Erkek>`
  adresine gidiyor — `urunler` sayfası artık ikisini birlikte filtreliyor.
- Masaüstünde hover ile açılan, sütunlu bir mega-menu paneli; mobilde
  hamburger ikonu + tam ekran/off-canvas menü, sekmeler akordeon gibi
  açılıp kapanıyor (admin panelde daha önce yapılan mobil hamburger
  deseniyle aynı ruhta, ama storefront'un kendi tasarımına uyumlu, ayrı
  bir bileşen).
- Kırık "Dış Giyim" linki kaldırılıyor.

## Claude Code'a verilecek prompt

```
Bollmark storefront'unun üst menüsünü (header) yeniden tasarlayacağız —
şu an sadece 3 sabit link var (Tüm Ürünler, Dış Giyim, Hikayemiz),
"Dış Giyim" linki kırık (outerwear slug'ı DB'de yok) ve genişlettiğimiz
~30 kategoriye hiç yer yok. Koton/LC Waikiki tarzı bir mega-menu istiyoruz.

### 1. Cinsiyet filtresini storefront'a ekle

`src/lib/catalog.ts`:
- `getCatalogEntries` ve `getPublishedProducts` fonksiyonlarına opsiyonel
  bir `genderLabel?: string` parametresi ekle (mevcut `categorySlug`
  parametresiyle aynı seviyede), Prisma `where` koşuluna `gender: genderLabel
  ? genderLabel : undefined` ekle. Mevcut çağıranları bozma (parametre
  opsiyonel).

`src/app/(site)/urunler/page.tsx`:
- `searchParams`'a `cinsiyet?: string` ekle, `getCatalogEntries(kategori,
  { featuredFirst: ..., genderLabel: cinsiyet })` gibi ikisini birlikte
  geçir (fonksiyon imzasını buna göre ayarla — options objesine ekleyebilirsin).
- Kategori + cinsiyet ikisi de seçiliyse başlıkta/`generateMetadata`'da
  ikisini birlikte göster (örn. "Kadın Tişört | Bollmark"), sadece cinsiyet
  varsa "Kadın Koleksiyonu | Bollmark" gibi bir başlık kullan.
- Sonuç yoksa mevcut "Bu kategoride henüz ürün bulunmuyor." mesajını
  cinsiyet de seçiliyse uygun şekilde güncelle.

### 2. Mega-menu verisini hazırlayan bir fonksiyon yaz

Yeni bir dosya `src/lib/site-nav.ts` (veya `catalog.ts` içine ekleyebilirsin):
- `getMegaMenuData()` adında, `react.cache` ile sarılmış async bir fonksiyon.
- Kadın ve Erkek için ayrı ayrı: `Category` tablosunda, en az bir
  `PUBLISHED` ürünü olan VE o ürünlerden en az birinin `gender` alanı
  ilgili değere (`"Kadın"` / `"Erkek"`) eşit olan kategorileri bul
  (Prisma'da `category.findMany({ where: { isActive: true, products: {
  some: { status: "PUBLISHED", gender: "Kadın" } } }, orderBy: [{
  sortOrder: "asc" }, { name: "asc" }] })` gibi bir sorgu — parentId'ye
  bakma, çünkü artık cinsiyete özel kategoriler üst seviyede düz duruyor).
- Aksesuar için: `parentId: null, slug: "aksesuar"` olan kategoriyi bul,
  `buildCategoryOptions` yerine direkt `children` ilişkisiyle (isActive olan,
  sortOrder'a göre sıralı) alt kategori listesini çek.
- Dönen tip: `{ kadin: {id,name,slug}[]; erkek: {id,name,slug}[]; aksesuar:
  {id,name,slug}[] }`.
- Bu sorguları `Promise.all` ile paralel çalıştır.

### 3. Header'ı mega-menu ile yeniden yaz

`src/app/(site)/layout.tsx`: `getMegaMenuData()`'yı server component
içinde çağır, sonucu `<SiteHeader menuData={...} />` olarak prop geç.

`src/components/site-header.tsx` (client component, `"use client"` kalıyor):
- Props'tan gelen `menuData`'yı kullanarak masaüstünde her sekme
  (Kadın/Erkek/Aksesuar) `onMouseEnter`/`onMouseLeave` (veya tıklamayla
  toggle, klavye/erişilebilirlik için `onClick` de çalışsın) ile açılan bir
  mega-menu paneli göstersin:
  - Panel `absolute` konumlanır, header'ın altında tam genişlikte veya
    sekmeye hizalı, kategori linkleri 3-4 sütun halinde (12-15+ link
    kolon başına ~6-8 arası bölünsün), her link `/urunler?kategori=<slug>&cinsiyet=<Kadın|Erkek>`'e gider.
  - Panelin sağında opsiyonel bir görsel/CTA alanı olsun (örn. o
    cinsiyetin ilk kategorisinin `imageUrl`'i varsa göster, yoksa o
    alanı hiç render etme — placeholder görsel EKLEME).
  - Aksesuar sekmesinde tek sütun yeterli (8 link), cinsiyet parametresi
    OLMADAN sadece `?kategori=<slug>` kullan.
  - "Tüm Ürünler" sekmesi düz link olarak kalsın (`/urunler`), dropdown'u
    yok.
  - Kırık "Dış Giyim" linkini tamamen kaldır.
- Mobilde (`md:` altı): sekmeler görünmesin, sağda bir hamburger ikonu
  (basit inline SVG, üç çizgi) eklensin. Tıklanınca sağdan/soldan kayan
  ya da tam ekran açılan bir off-canvas menü açılsın:
  - Kadın/Erkek/Aksesuar başlıkları akordeon gibi tıklanınca altındaki
    kategori linklerini açıp kapatsın (client state, `useState`).
  - Menü açıkken arka planda `body` scroll'u kilitlensin (`overflow:
    hidden` veya benzeri), bir X/kapat butonu ve backdrop'a tıklayınca
    kapanma olsun.
  - Menü içinde ayrıca "Tüm Ürünler", "Hikayemiz", giriş/hesap ve sepet
    linkleri de bulunsun (şu an sağ üstte duran bu linkler mobilde
    menünün içine alınabilir, hamburger + sepet ikonu dışarıda kalabilir
    ki sepet sayısı her zaman görünür olsun).
- Aktif kategori/cinsiyet seçiliyse (URL'deki `kategori`/`cinsiyet` query
  param'larını `useSearchParams` ile oku) o linki görsel olarak
  vurgula (örn. `text-accent` veya alt çizgi).

### 4. Test

1. `npx tsc --noEmit` ve `npm run build` hatasız tamamlanmalı.
2. Geçici bir scratchpad dizininde Playwright kur, yerel dev sunucuyu
   sürerek:
   - 1280px genişlikte: Kadın/Erkek sekmelerine hover yapınca mega-menu
     açılıyor mu, doğru kategori sayısını gösteriyor mu (DB'deki gerçek
     PUBLISHED ürün/gender kombinasyonuna göre) kontrol et.
   - Bir kategori linkine tıkla, sonuç sayfasında hem `kategori` hem
     `cinsiyet` query param'ının URL'de olduğunu ve ürün listesinin
     buna göre filtrelendiğini doğrula.
   - 375px genişlikte: hamburger görünüyor mu, menü açılınca akordeon
     çalışıyor mu, body scroll kilitleniyor mu, kapatma çalışıyor mu,
     `document.documentElement.scrollWidth <= clientWidth` (yatay taşma
     yok) kontrol et.
   - Eski "Dış Giyim" linkinin artık hiçbir yerde olmadığını doğrula.
3. Bulguları ve öncesi/sonrası ekran görüntülerini (masaüstü + mobil)
   özetle paylaş.

Commit'i mesajıyla birlikte öner ama benim onayım olmadan push etme.
```
