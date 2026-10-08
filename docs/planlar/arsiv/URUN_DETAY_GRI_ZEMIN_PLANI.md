# Ürün Detay Sayfası — Gri Zemin (mix-blend-multiply) Planı

## İstek

Katalog kartında uygulanan ve beğenilen gri zemin + `mix-blend-multiply` görünümünün (bkz. `BEYAZ_ARKAPLAN_GRI_ZEMIN_TEST_PLANI.md`, DEPLOY_STATUS "Katalog kartinda gri zemin testi — onaylandi") **aynısı ürün detay sayfasında** da uygulansın.

## Mevcut Durum (kod incelendi)

- Katalog kartında uygulanan hali: `--image-bg: #f2f1ef` (globals.css), Tailwind'de `bg-image-bg`, görsellere `mix-blend-multiply`. **Tüm ürünlere** uygulanmış durumda (Slazenger'e özel filtre sürümü uygulanmadı, onaylanan sürüm bu).
- Ürün detay galerisi `src/components/product-viewer.tsx` içinde iki ayrı yerde:
  1. **Mobil** (≈ satır 422–435): Embla carousel, her slayt `aspect-[3/4] ... bg-line` buton + `<Image className="object-cover">`.
  2. **Masaüstü** (≈ satır 475–488): 2 sütunlu grid, her kutu `aspect-[3/4] ... bg-line` + `<Image className="object-cover transition-transform ... group-hover:scale-[1.03]">`.
- Mobilde fotoğrafın alt kenarında ilerleme çizgileri var: aktif `bg-white`, diğerleri `bg-white/40`. **Gri zeminde bunlar neredeyse görünmez olacak** (beyaz fotoğraflarda zaten görünmüyordu).
- Lightbox (büyütülmüş görünüm, `yet-another-react-lightbox`) koyu arkaplanlı (`rgba(17,17,17,0.95)`), orada beyaz fotoğraf zaten belirgin. **Değiştirilmiyor.**

## Claude Code için Prompt

> Katalog kartında uyguladığımız ve onayladığım gri zemin + `mix-blend-multiply` görünümünü ürün detay sayfası galerisine de uygula. Plan dosyası: `URUN_DETAY_GRI_ZEMIN_PLANI.md`. Katalog kartındakiyle birebir aynı mantık: yeni renk/değişken EKLEME, mevcut `bg-image-bg` (`--image-bg`) ve `mix-blend-multiply`'ı kullan.
>
> 1. `src/components/product-viewer.tsx` **mobil galeri** (Embla, ≈ satır 429): slayt butonundaki `bg-line` → `bg-image-bg`. İçindeki `<Image>`'ın `className`'ine `mix-blend-multiply` ekle (`object-cover` kalsın).
> 2. **Masaüstü galeri** (≈ satır 480): kutudaki `bg-line` → `bg-image-bg`. `<Image>`'a `mix-blend-multiply` ekle; mevcut `transition-transform duration-300 group-hover:scale-[1.03]` hover büyümesini KORU. Hover'da büyürken blend'in bozulmadığını (beyaz kenar/parlama çıkmadığını) kontrol et; bozuluyorsa kutuya `isolate` ekle.
> 3. **Mobil ilerleme çizgileri** (≈ satır 443–455): gri zeminde beyaz çizgiler kayboluyor. Renklerini değiştirme, bunun yerine her çizgiye hafif bir gölge ekle ki hem gri zeminde hem koyu mankenli fotoğraflarda okunsun: örn. `shadow-[0_0_2px_rgba(0,0,0,0.35)]`. Localhost'ta hâlâ zor seçiliyorsa bana söyle, alternatif konuşalım.
> 4. Mobil galerideki favori kalbi (`bg-cream/90`) ve masaüstündeki büyüteç rozeti (`bg-cream/90`) blend'den ETKİLENMEMELİ, normal görünmeli (bunlar `<Image>`'ın kardeşi, blend sadece `<Image>`'da olmalı).
> 5. **DOKUNMA:** Lightbox (koyu zemin, olduğu gibi kalsın), rozetler (`product-badge.tsx`), bilgi paneli, renk swatch'ları, beden seçimi, sepet çekmecesi. Galeride yükleme iskeleti (skeleton) veya boş görsel durumu `bg-line` kullanıyorsa onu da `bg-image-bg` yap ki yüklenirken renk zıplaması olmasın; yoksa ekleme.
> 6. Ürün detayındaki başka küçük resimler (örn. varsa renk seçici küçük resimleri) `bg-line` + ürün fotoğrafı kullanıyorsa bana listele, şimdilik DOKUNMA.
> 7. `npm run lint` ve `npx tsc --noEmit` ile hata olmadığını doğrula.
> 8. `npm run dev` ile localhost'ta aç; bana (a) beyaz arkaplanlı bir Slazenger ayakkabının, (b) mankenli bir Koton ürününün detay sayfası adresini ver ki masaüstü ve mobilde karşılaştırayım.
> 9. Proje kuralları: **Ben localhost'ta onaylamadan commit atma.** Onaylarsam YEREL commit at, **ben söylemeden push etme**. Yüklü skill'leri kullan (karpathy-guidelines dahil: minimum, cerrahi değişiklik). İş bitince `DEPLOY_STATUS.md`'ye not düş.

## Localhost'ta Neye Bakmalı

- **Masaüstü:** 2 sütunlu galeride Slazenger ayakkabılar gri kutu içinde, katalog kartıyla aynı tonda mı?
- Masaüstünde fotoğrafın üzerine gelince hafif büyüme düzgün mü, kenarda beyaz çizgi/parlama var mı?
- **Mobil (telefon genişliği):** Kaydırarak fotoğraf değiştirme sorunsuz mu? Alttaki ilerleme çizgileri gri zeminde seçiliyor mu?
- Favori kalbi ve büyüteç rozeti normal mi?
- Fotoğrafa tıklayınca açılan büyük görünüm (lightbox) değişmedi mi?
- Mankenli Koton ürünlerinde fazla koyulaşma var mı?
- Katalogdan ürüne geçerken renk tonu tutarlı mı (kart ve detay aynı gri)?
