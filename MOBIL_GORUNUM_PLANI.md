# Mobil Görünüm İyileştirme Planı

## Sorun

Admin paneli telefonda açıldığında sayfa ekrana oturmuyor (yatay taşma oluyor) ve menü (sidebar) ekranın büyük kısmını kaplıyor.

Kod incelemesiyle doğrulanan kök neden: admin panelindeki hiçbir bileşende Tailwind'in responsive breakpoint'leri (`sm:`, `md:`, `lg:`) kullanılmıyor. Panel tamamen tek bir (masaüstü) genişlik varsayımıyla yazılmış:

- `src/components/admin/sidebar.tsx` → `<aside className="w-60 flex-shrink-0 ...">` — sabit 240px, mobilde gizlenip açılan bir off-canvas mantığı yok.
- `src/app/(admin)/admin/layout.tsx` → `<div className="flex min-h-screen ...">` içinde Sidebar + içerik yan yana, responsive dallanma yok.
- `src/components/admin/topbar.tsx` → hamburger/menü açma butonu yok, arama kutusu sabit `max-w-sm`.
- `main` içerik alanı sabit `px-8 py-8` (32px yatay boşluk) — dar ekranda içerikten çalıyor.
- Filtre panelleri (`orders-filters.tsx` ve aynı kalıptaki `kampanyalar-filters.tsx`, `kargolar-filters.tsx`, `customers-filters.tsx`, `iadeler-filters.tsx`, `islem-gecmisi-filters.tsx`, `products-filters.tsx`, `raporlar-filters.tsx`) → `absolute` konumlu, sabit `w-72` (288px) panel; dar ekranda kenardan taşabilir.
- Form sayfaları (`urunler/yeni`, `urunler/[id]` ve benzerleri) → `grid grid-cols-2 gap-4` sabit iki kolon; mobilde alanlar sıkışıyor.
- `data-table.tsx` → `overflow-x-auto` var (bu kısmı zaten çalışıyor) ama 6-7 kolonlu tablolarda mobilde kullanım zahmetli, kolon önceliklendirme yok.

Repo genelinde `md:`/`lg:`/`sm:` için yapılan arama admin bileşenlerinde **sıfır** sonuç verdi — yani bu, tek bir sayfanın değil tüm admin panelinin yapısal eksiği.

## Kapsam (dokunulacak dosyalar)

**İskelet:**
- `src/app/(admin)/admin/layout.tsx`
- `src/components/admin/sidebar.tsx`
- `src/components/admin/topbar.tsx`

**Tablolar:**
- `src/components/admin/data-table.tsx`
- (dolaylı olarak tüm `*-table.tsx` dosyaları: orders-table, products-table, customers-table, returns-table, shipments-table, reviews-table, audit-log-table, top-products-table)

**Filtreler (aynı kalıp, hepsi tek tek düzeltilecek):**
- `orders-filters.tsx`, `kampanyalar-filters.tsx`, `kargolar-filters.tsx`, `customers-filters.tsx`, `iadeler-filters.tsx`, `islem-gecmisi-filters.tsx`, `products-filters.tsx`, `raporlar-filters.tsx`

**Formlar:**
- `src/app/(admin)/admin/urunler/yeni/page.tsx`
- `src/app/(admin)/admin/urunler/[id]/page.tsx`
- `grid-cols-2` (veya daha fazla) kullanan diğer tüm admin form sayfaları/bileşenleri (kampanyalar, bundle-kampanyaları, personel, ayarlar vb. — uygulama sırasında taranacak)
- `src/components/admin/variant-editor.tsx`, `product-images-field.tsx`, `tags-field.tsx` (içleri henüz detaylı incelenmedi, aynı mantıkla kontrol edilecek)

## Faz 1 — İskelet: off-canvas sidebar + hamburger menü (en kritik faz)

Bu faz tek başına "sayfa tam ekrana oturmuyor" ve "menü kocaman yer kaplıyor" şikayetlerinin ikisini de çözer.

- `layout.tsx` şu an server component; sidebar açık/kapalı state'i client tarafında tutulmalı. Yeni bir client wrapper (`AdminShell` gibi) eklenip Sidebar + Topbar + children bunun içine alınacak, mobil menü state'i (`isMobileNavOpen`) burada tutulacak ve Topbar'daki hamburger butonuyla Sidebar arasında paylaşılacak.
- Mobilde (`< md`, 768px altı) Sidebar varsayılan olarak ekran dışında (`-translate-x-full` + `fixed inset-y-0 left-0 z-40`), `md:` üzerinde eskisi gibi `static`/`translate-x-0`.
- Sidebar açıkken arkada yarı saydam bir backdrop (`fixed inset-0 bg-black/40 md:hidden`) — tıklanınca menü kapanır.
- Bir linke tıklanınca veya route değişince (`usePathname` değişimi) mobil menü otomatik kapanmalı.
- Topbar'a sadece mobilde görünen (`md:hidden`) bir hamburger (`Menu` ikonu, lucide-react) butonu eklenecek.
- `main` içerik boşluğu: `px-4 py-4 md:px-8 md:py-8`.
- Masaüstü görünüm (`md:` ve üzeri) birebir aynı kalmalı — bu bir ekleme, mevcut deneyimi bozmamalı.

## Faz 2 — Topbar ince ayar

- Arama kutusu mobilde `hidden md:block`; yerine mobilde bir arama ikonu, tıklanınca tam genişlikte açılan bir arama alanı/overlay.
- Kullanıcı menüsü butonunun dokunma alanı büyütülecek (min ~40px).

## Faz 3 — Tablolar

- Kart görünümüne tam dönüşüm bu turun kapsamı dışında (çok daha büyük ayrı bir iş); bunun yerine:
  - Mevcut `overflow-x-auto` korunur.
  - `DataTable`'a mobilde öncelik düşük kolonları CSS ile gizleyen bir mekanizma eklenir (örn. kolon tanımına `hideOnMobile?: boolean` eklenip `hidden md:table-cell` uygulanması) — her tabloda ikincil bilgiler (tarih, kargo durumu gibi) mobilde varsayılan gizli, "Sütunlar" panelinden geri açılabilir kalır.
  - Kaydırılabilir olduğunu belli eden hafif bir görsel ipucu (sağ kenarda gradient/gölge) eklenir.

## Faz 4 — Filtreler ve formlar

- Filtre panelleri: sabit `w-72` yerine `w-[calc(100vw-2rem)] max-w-72 md:w-72` gibi ekrana sığan bir genişlik + panelin ekran kenarını taşmayacağı bir konumlandırma (`right-0` / `left-0` duruma göre `md:` altında sabitlenecek).
- Form `grid-cols-2` (ve varsa `grid-cols-3` vb.) kullanılan tüm yerler → `grid-cols-1 md:grid-cols-2` (veya ilgili sayıda).
- `variant-editor.tsx`, `product-images-field.tsx`, `tags-field.tsx` içindeki olası sabit genişlik/grid kullanımları aynı mantıkla taranıp düzeltilecek.

## Test planı

- Chrome DevTools responsive modda 360px, 390px, 768px genişliklerinde şu sayfalar gezilecek: Panel (dashboard), Siparişler, Ürünler (liste + yeni + düzenle), Kampanyalar, Kategoriler, Personel, Raporlar, Terk Edilmiş Sepetler, Ayarlar.
- Senaryolar: sidebar aç/kapat, filtre paneli açma, tabloyu yatay kaydırma, form doldurma, bulk action bar görünümü.
- Body seviyesinde yatay scrollbar olmadığı doğrulanacak.

## Kabul kriterleri

- 375px genişlikte hiçbir admin sayfasında body seviyesinde yatay kaydırma olmayacak.
- Sidebar mobilde varsayılan kapalı, hamburger ile açılıp kapanabilecek, route değişince otomatik kapanacak.
- Dokunma hedefleri (buton, link, checkbox) en az ~40px yüksekliğinde olacak.
- `md:` (768px) ve üzeri masaüstü görünüm hiçbir şekilde değişmeyecek — bu tamamen mobil için eklenen bir katman.

## Notlar

- Bu iş tamamen layout/CSS değişikliği; veritabanı şeması veya iş mantığı değişmiyor, migration riski yok.
- Tek seferde geniş kapsamlı bir Claude Code promptu ile verilecek; Claude Code fazları sırayla uygulayıp her fazdan sonra (ideal olarak) ayrı commit atabilir.
