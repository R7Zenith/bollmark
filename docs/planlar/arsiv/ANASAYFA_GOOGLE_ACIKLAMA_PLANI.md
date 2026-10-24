# Anasayfa Google Açıklaması (Snippet) Düzeltme Planı

Tarih: 2026-10-24 · Durum: tamamlandı (2026-10-24)

## Sorun

Google'da `bollmark.com` aramasında anasayfanın altındaki açıklama, meta
description yerine sayfadaki "Ne arıyorsun?" bölümünden derleniyor:

> Ne arıyorsun? · Bluz · Gömlek · Ayakkabı · Elbise · Tişört · Pantolon ·
> Sweatshirt · Ceket · 178 ürünKadın 85 ürünErkek 6 ürünÇocuk 14 ürünAyakkabı 28 ürün ...

## Neden

1. **Meta description zayıf.** `src/app/(site)/page.tsx` içindeki açıklama
   ("özenle seçilmiş kumaşlar, minimal kesimler...") kısa ve genel; mağazayı,
   ürün gruplarını, şehri anlatmıyor. Google, açıklamayı sorguyla az ilgili
   bulduğunda kendi seçtiği sayfa metnini gösterir.
2. **"Ne arıyorsun?" bölümü sayfanın en üstündeki metin bloklarından biri.**
   23 Ekim'de canlıya çıkan bu bölüm, kategori adları ve sayılarla dolu olduğu
   için Google'a "özet" gibi görünüyor.
3. **Bitişik metin.** Kutularda sayı rozeti (`85 ürün`) ile etiket (`Kadın`)
   arasında DOM'da ayraç yok; metin olarak "85 ürünKadın" diye okunuyor (ekran
   okuyucular da aynı şekilde okur).

## Çözüm

### 1) Meta description'ı yeniden yaz (asıl düzeltme)
- `src/app/(site)/page.tsx` → `metadata.description`
- `src/app/(site)/layout.tsx` → varsayılan `description` (aynı metin veya kısa hâli)
- 140–160 karakter, somut, marka adıyla başlayan. Önerilen metin:

  > Karacabey'deki Bollmark mağazasının online adresi. Kadın, erkek, çocuk giyim ve ayakkabıda sezonun yeni parçaları; siteden aldığını mağazada değiştir.

- "Koton" ve diğer marka adları açıklamaya **yazılmaz**
  (bkz. `KOTON_IBARELERI_KALDIRMA_PLANI.md`).
- `openGraph.description` anasayfada da aynı metni kullanmalı (WhatsApp /
  Instagram link önizlemesi).

### 2) Snippet'e girmemesi gereken bölümlere `data-nosnippet`
Google'ın desteklediği HTML özelliği; bölüm dizinde kalır, linkler taranır,
yalnız arama sonucundaki açıklamaya alınmaz.
- `src/components/home/shop-by-category.tsx` → `<section>` etiketine `data-nosnippet`
- Aynı mantıkla sayı/fiyat içeren tekrar eden bloklar: `trust-marquee.tsx`,
  `budget-tiles.tsx`, kampanya geri sayımı (`campaign-or-colors.tsx`).
- Yeni Gelenler / Çok Satanlar ürün kartlarına dokunulmaz.

### 3) Bitişik metni düzelt
- `shop-by-category.tsx` kutularında etiket DOM'da sayıdan **önce** gelsin
  (görsel konum `absolute` olduğu için görünüm değişmez) ya da Link'e
  `aria-label="Kadın, 85 ürün"` verilsin ve rozet/etiket arasına ayraç girsin.
- Görünüm birebir aynı kalmalı.

### 4) Yayından sonra (kullanıcı)
- Search Console → URL Denetimi → `https://bollmark.com/` → "Dizine eklenmesini iste".
- Google'ın yeni açıklamayı göstermesi birkaç gün – birkaç hafta sürebilir.
- Not: Google açıklamayı yine de değiştirebilir; iyi bir meta description +
  `data-nosnippet` bu ihtimali ciddi biçimde düşürür ama garanti değildir.

## Doğrulama
- `localhost`'ta sayfa kaynağında `<meta name="description">` ve
  `og:description` yeni metni göstermeli; tek bir description etiketi olmalı.
- "Ne arıyorsun?" bölümünün HTML'inde `data-nosnippet` görünmeli.
- Masaüstü ve mobilde anasayfa görünümü değişmemiş olmalı.
- `npm run build` / lint hatasız.
