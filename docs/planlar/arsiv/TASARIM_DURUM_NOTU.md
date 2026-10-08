# Tasarım Güncelleme — Durum Notu

Bu dosya, kaldığımız yerden devam edebilmek için oturum özetidir.

## Yapılan denemeler (kronolojik)

1. **V1 (`SOFT_MODERN_TASARIM_YONU_PLANI.md`)** — spacing/shadow/rounded-corner
   kozmetiği. Kullanıcı: fark görünmüyor.
2. **V2 (`SOFT_MODERN_TASARIM_YONU_PLANI_V2_RADIKAL.md`)** — tüm renk paleti
   değişti (`accent`/`paper` → `clay`/`cream`/`ink`/`stone`), asimetrik grid,
   dev hero, pill buton kaldırıldı. Kullanıcı: "resmen sadece renk değişmiş,
   geri kalan aynı."
3. **V3 (şu anki commit)** — kullanıcı Aritzia.com'u referans gösterdi
   ("menüsüne bak, saydam görsel üzerine logo, aşağı indikçe şekilleniyor,
   tam sayfa genişliğinde menü, katalog ve ürün detay sayfası güzel").
   Playwright ile Cloudflare korumasını aşıp gerçek Aritzia sayfalarını
   (ana sayfa, kategori listeleme, ürün detay) inceledik, ekran görüntüleri
   `scratchpad/aritzia-shots/` klasöründe duruyor (oturum sonunda silinebilir,
   kalıcı değil — gerekirse tekrar çekilir).

## V3'te yapılan yapısal değişiklikler

- **Header** (`src/components/site-header.tsx`): `fixed` + scroll'a duyarlı.
  Ana sayfada hero üzerinde saydam + beyaz metin, scroll'da veya menü
  açılınca katı `bg-cream`. (Not: `fixed` ve `relative` sınıflarını aynı anda
  kullanmak Tailwind'de `position` çakışmasına yol açıyor — `relative` CSS'te
  sonra geldiği için kazanıyor ve `fixed`'i eziyor; bu yüzden header'da
  sadece `fixed` bırakıldı, mega-menu paneli için ayrıca `relative`'e gerek
  yok çünkü `fixed` de positioning context sağlıyor.)
- **Ana sayfa** (`src/app/(site)/page.tsx`): Kategori kısayolları artık
  container/boşluk olmadan kenardan kenara ("görüntü duvarı"); hemen
  ardından tam genişlik koyu editoryal blok (Hikayemiz, `bg-ink`); en altta
  "Zamansız Rahatlık" tek satırlık nefes alma bölümü.
- **Ürün listeleme** (`src/app/(site)/urunler/page.tsx`): Başlık büyüdü,
  ürün sayısı üst simge; grid köşeleri keskinleşti, boşluk sıkılaştı.
- **Ürün kartı** (`src/components/product-card.tsx`): `rounded-xl` kaldırıldı
  (Aritzia'da hiç yuvarlak köşe yok). İkinci görsel varsa crossfade hover
  altyapısı var ama hiçbir çağıran şu an ikinci görsel geçmiyor (veri
  katmanında `secondImage` alanı yok) — fallback olarak scale efekti çalışıyor.
- **Ürün detay** (`src/components/product-viewer.tsx`): Sağdaki bilgi paneli
  artık `md:sticky md:top-24` — galeri kaydıkça sabit kalıyor. Detaylar ve
  Beden Tablosu native `<details>/<summary>` accordion'a çevrildi.
- **Footer** (`src/components/site-footer.tsx`): `bg-cream` → `bg-ink
  text-cream` (Aritzia'nın siyah footer'ı gibi).

## Bilinçli olarak YAPILMADI (dürüstçe not düşüyorum)

- **PLP filtre çipleri** (Size/Color/Fabric/Sort) — gerçek filtreleme mantığı
  gerektirir, sahte/çalışmayan buton eklemek istemedim.
- **Ürün kartında renk topu (swatch)** — veri modelinde ürün başına renk
  listesi aggregate edilmiyor (`getCatalogEntries` her rengi ayrı satır
  olarak döndürüyor), bu değişikliği yapmak backend sorgu değişikliği
  gerektirir.
- **Tek "Beden Seç" dropdown'u** — Aritzia'da böyle ama mevcut pill-grid
  (34/36/38...) stok görünürlüğü açısından daha iyi bir UX, bilerek
  korundu.

## Git durumu

- V2 commit: `448596f`
- V3 commit: `eebb37f`
- Push edilmedi, kullanıcı onayı bekleniyor.
- `SOFT_MODERN_TASARIM_YONU_PLANI.md` ve `_V2_RADIKAL.md` repoda untracked
  duruyor (plan dosyaları, isterse silinebilir/commit'lenebilir).

## Devam ederken

- Dev sunucusu `localhost:3000`'de çalışıyor, önizleme şifresi:
  `onizleme2026!` (`?preview=onizleme2026!` ile bir kez açılıp cookie
  bırakılıyor, 30 gün geçerli).
- Sıradaki olası adımlar: mega-menu içeriğini Aritzia'daki gibi
  zenginleştirmek (öne çıkan kategoriler/renkler sütunu — şu an sadece düz
  kategori linkleri var), ürün kartına gerçek renk swatch'i eklemek için
  `getCatalogEntries`/`getPublishedProducts` sorgularını genişletmek,
  mobil mega-menu/hamburger deneyimini gözden geçirmek.
