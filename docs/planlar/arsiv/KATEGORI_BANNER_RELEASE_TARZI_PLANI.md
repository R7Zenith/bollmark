# Kategori Sayfalarına Release Tarzı Banner — Araştırma ve Claude Code Promptu

## Mevcut durum (src/app/(site)/urunler/page.tsx)

- Banner kodu zaten var ama yalnızca `kategori` seçiliyse VE o kategorinin
  `imageUrl` alanı doluysa render ediliyor. Görseli olmayan kategoride,
  "Tüm Ürünler" sayfasında ve sadece cinsiyet koleksiyonunda banner yok;
  sayfa düz başlıkla açılıyor. Bu yüzden siteyi gezerken bir kategoride banner
  var, diğerinde yok — tutarsız.
- Mevcut banner Release'den farklı: breadcrumb yok, koyu/gri tonlama yok
  (sadece %35 overlay), başlık üstünde cinsiyet etiketi var.
- Header saydamlığı `site-header.tsx` içinde aynı koşulu kontrol ediyor. Banner
  koşulu değişirse header koşulu da aynı anda değişmeli, yoksa banner olmayan
  sayfada beyaz zemin üstünde beyaz header yazısı çıkar.

## Release'deki banner (referans ekran görüntüsü, "Shorts" koleksiyonu)

- Tam genişlik, header'ın arkasına uzanan (header saydam, banner üstüne biner).
- Siyah-beyaz, koyu tonlu görsel + koyu overlay; beyaz yazılar okunaklı.
- Ortada: breadcrumb (HOME / SHORTS, 10px uppercase, tracking geniş, HOME
  altı çizili) ve altında büyük başlık (Poppins, ~47-64px, negatif letter-spacing).
- Altında toolbar: sol "Filters" butonu + "Showing 11 of 11 products", sağda
  "Featured" sıralama. (Bollmark'ta CatalogToolbar zaten var.)

## Öneri

1. Banner HER katalog görünümünde çıksın: kategori, cinsiyet koleksiyonu,
   Tüm Ürünler.
2. Görsel önceliği: kategori `imageUrl` → yoksa siteye ait tek bir varsayılan
   banner görseli → o da yoksa düz `bg-ink` üstüne ince gradient (asla rastgele
   stok yüz/fotoğraf uydurma).
3. Marka uyumu için görsele `grayscale` + `bg-ink/55` overlay (Release'in
   siyah-beyaz dili; sitedeki mono palet ink/cream/line ile birebir uyumlu).
4. Breadcrumb ekle: "Ana Sayfa / [Cinsiyet /] Kategori adı".
5. Cinsiyet etiketini ayrı satır yapmak yerine breadcrumb'a taşı.

## Claude Code'a verilecek prompt

```
Bollmark storefront'ta katalog sayfasının (src/app/(site)/urunler/page.tsx)
üstündeki banner'ı Release temasındaki koleksiyon banner'ı gibi yap ve TÜM
katalog görünümlerinde göster. Yüklü skill'leri (özellikle frontend/tasarım
skill'lerini) kullan. Kod yazmadan önce AGENTS.md'yi oku: bu Next.js sürümü
bildiğin sürümden farklı, ilgili rehberi node_modules/next/dist/docs/ içinden
kontrol et.

## Şu anki durum
- Banner sadece `kategori` seçili VE kategorinin `imageUrl` alanı doluysa
  render ediliyor (`bannerImageUrl`). Görseli olmayan kategoride, "Tüm
  Ürünler"de ve sadece `?cinsiyet=` koleksiyonunda banner yok.
- Header saydamlığı src/components/site-header.tsx içinde AYNI koşula bağlı.
  İkisi birbirinden bağımsız kaymamalı.

## Yapılacaklar
1. Banner koşulunu kaldır: kategori, cinsiyet koleksiyonu ve Tüm Ürünler dahil
   her /urunler görünümünde banner render et. Banner'a ait "var mı" kararını
   tek bir yardımcıdan (ör. src/lib/catalog-banner.ts) ver; page.tsx ve
   site-header.tsx aynı yardımcıyı/aynı koşulu kullansın (header her zaman
   saydam olacaksa koşul basitleşir — /urunler rotasında her zaman saydam).
2. Görsel seçimi (öncelik sırası):
   a) seçili kategorinin `imageUrl`'i,
   b) cinsiyet/tüm ürünler için: ilgili kategorilerden birinin görseli değil,
      site genelinde tek bir varsayılan banner görseli (public/ altına
      koyulacak; şimdilik Unsplash'ten ticari kullanıma uygun, siyah-beyaz
      moda/doku fotoğrafı ekle, marka fotoğrafı kopyalama),
   c) görsel yüklenemezse düz `bg-ink` + ince gradient.
3. Görünüm Release'e uysun (getComputedStyle ile Release demosunda
   koleksiyon sayfasını ölç, önceki plan dosyalarındaki yöntemle):
   - Tam genişlik, header'ın altına uzanan yükseklik (Release'de ekranın
     yaklaşık %60-70'i; ölçüp min-height ile uygula, mobilde daha kısa).
   - Görsel `object-cover` + `grayscale`, üstüne `bg-ink/55` overlay.
   - Ortada breadcrumb: "ANA SAYFA / [CİNSİYET /] KATEGORİ" — 10px, uppercase,
     tracking-[1px], "ANA SAYFA" altı çizili link, ayraç "/", son parça beyaz.
   - Altında büyük başlık: font-display, ~47-64px, negatif letter-spacing
     (site başlıklarıyla aynı: tracking-[-1.88px] mantığı), beyaz, ortalı.
   - Mevcut `cinsiyet` eyebrow satırını (küçük etiket) kaldır, breadcrumb'a taşı.
   - Hardcoded hex kullanma; ink/cream/line token'larını kullan.
4. Banner altındaki CatalogToolbar ve ürün gridine DOKUNMA (Filters, "Showing
   X of Y products", sıralama zaten var). Sadece banner ile toolbar arası
   boşluğun Release'deki gibi olduğunu doğrula.
5. Banner'daki görsel için düz <img> kullanmaya devam et (kategori imageUrl
   kaynağı Unsplash/Blob dışında da olabilir). LCP için banner görseline
   fetchPriority="high" ver, alt="" bırak (dekoratif).
6. `generateMetadata` ve boş-sonuç mesajlarına dokunma.

## Test
- /urunler, /urunler?cinsiyet=Kadın, /urunler?kategori=<görseli olan>,
  /urunler?kategori=<görseli OLMAYAN> sayfalarını 1440px ve 390px genişlikte
  ekran görüntüsü al; banner, breadcrumb ve saydam header'ın hepsinde aynı
  çıktığını doğrula. Görselsiz kategoride header yazısı okunur mu kontrol et.
- npm run lint ve typecheck temiz olsun.

## Bitince
DEPLOY_STATUS.md'ye bu iş için not düş (ne değişti, hangi dosyalar, test
sonucu). Commit'i öner ama benim onayım olmadan push etme.
```
