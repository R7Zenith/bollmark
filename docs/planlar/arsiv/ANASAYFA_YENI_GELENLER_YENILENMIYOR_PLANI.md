# Anasayfa "Yeni Gelenler" bölümü yeni ürün eklenince yenilenmiyor - Plan

## Bulgular (kod incelemesi, salt okunur)

1. **Kök neden (büyük ihtimal): anasayfa statik önbellekte.**
   `src/app/(site)/page.tsx` içinde `export const dynamic`, `export const revalidate`
   yok. `(site)/layout.tsx` içinde de `cookies()/headers()/getServerSession` gibi
   sayfayı dinamik yapan bir çağrı yok. Sayfa yalnızca Prisma sorguları yapıyor;
   Next.js bunu build sırasında statik olarak üretir ve yeni deploy'a kadar aynı HTML'i
   sunar. Yani DB'ye ürün eklenince anasayfa güncellenmez.
2. **Admin ürün ekleme/güncelleme/Excel aktarım route'larında `revalidatePath`
   çağrısı yok gibi görünüyor** (incelenen dosyalarda geçmiyor; Claude Code tüm
   `src/` altında doğrulamalı). Varsa da `"/"` yolunu kapsamıyor olabilir.
3. **İkincil etken: sıralama.** Anasayfa `getPublishedProducts(undefined, { featuredFirst: true })`
   kullanıyor: sıralama `isFeatured desc, createdAt desc`, sonra `slice(0, 8)`.
   Yani yeni ürün "Öne Çıkan" işaretli değilse, 8'den fazla öne çıkan ürün varsa
   listeye hiç giremez. Ayrıca stoğu biten ürünler listenin sonuna atılıyor.
   Bölümün adı "Yeni Gelenler" ise mantık "en yeni 8" olmalı.

## Öneri

- Ürün yazan her yerde (yeni ürün, düzenleme, silme/arşiv, toplu işlem, Excel aktarım,
  görsel ekleme, Vega senkronu) `revalidatePath("/")` (+ `/urunler`, ürün slug'ı) çağır.
  Merkezi bir yardımcı: `src/lib/revalidate-catalog.ts`.
- Yedek güvence: anasayfaya `export const revalidate = 60;` (en geç 1 dk'da tazelenir).
- Sıralama kararı (kullanıcıya soruldu, varsayılan): "Yeni Gelenler" = `featuredFirst: false`,
  yani en yeni 8 ürün. "Öne çıkanlar" ayrı bir bölüm olarak isteniyorsa ayrıca yapılır.

## Claude Code promptu

```
Bollmark anasayfasındaki "Yeni Gelenler" (FeaturedCarousel) bölümü, admin panelden
yeni ürün eklediğimde otomatik yenilenmiyor. Yüklediğimiz skill'leri kullan.
Önce AGENTS.md ve karpathy-guidelines.md'yi oku; kapsamı dar tut.

Teşhis (önce doğrula, sonra düzelt):
1. src/app/(site)/page.tsx'te dynamic/revalidate export'u yok ve layout dinamik API
   kullanmıyor; sayfa build'de statik üretiliyor olabilir. `npm run build` çıktısında
   "/" rotasının ○ (static) mı ƒ (dynamic) mı olduğuna bak.
2. src/ altında `revalidatePath` / `revalidateTag` geçen yerleri grep'le. Ürün yazan
   tüm route ve server action'ları listele: yeni ürün, ürün düzenleme, arşiv/silme,
   /api/admin/urunler/bulk, excel-aktar (ve gorsel-getir), gorsel-ekle/gorsel-yenile,
   vega senkronu. Hangisinde çağrı var/yok raporla.
3. Anasayfa `getPublishedProducts(undefined, { featuredFirst: true })` +
   `products.slice(0, 8)` kullanıyor. Sıralama isFeatured desc, createdAt desc olduğu
   için yeni ürün öne çıkan değilse görünmeyebilir; ayrıca stoğu biten ürünler sona
   itiliyor.

Düzeltme:
a. src/lib/revalidate-catalog.ts oluştur: `revalidateCatalog(slug?: string)` içinde
   revalidatePath("/"), revalidatePath("/urunler") ve slug varsa
   revalidatePath(`/urunler/${slug}`). Ürün yazan tüm yukarıdaki yerlerden başarılı
   yazımdan SONRA çağır (Excel aktarımda toplu işin sonunda bir kez).
b. src/app/(site)/page.tsx'e `export const revalidate = 60;` ekle (yedek güvence).
c. "Yeni Gelenler" bölümü için `featuredFirst` kullanma: `getPublishedProducts(undefined)`
   ile en yeni 8 ürünü göster (createdAt desc). Bölüm başlığı/yorum satırı buna uysun.
   Kategori sayıları (kadınCount vb.) da aynı revalidate ile tazelenecek.

Doğrulama:
- `npx tsc --noEmit`, `npm run lint`, `npm run build` hatasız geçmeli.
- Test: admin'den yeni bir test ürünü ekle (PUBLISHED), anasayfayı yenile; ürün
  "Yeni Gelenler" başında görünmeli. Sonra Excel ile 1 ürün aktar, aynı kontrol.
- Test ürünlerini sonra temizle.

Bitince DEPLOY_STATUS.md'ye tarih, yapılan değişiklikler ve doğrulama sonucunu not düş.
Commit mesajını öner ama benim onayım olmadan push etme.
```
