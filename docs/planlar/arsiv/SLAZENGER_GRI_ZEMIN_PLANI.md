# Gri Zemin — Sadece Slazenger Markası (Katalog Kartı + Ürün Detay) Planı

> Bu plan `BEYAZ_ARKAPLAN_GRI_ZEMIN_TEST_PLANI.md` ve `URUN_DETAY_GRI_ZEMIN_PLANI.md`'nin yerine geçer. O ikisini ayrıca uygulama.

## İstek

Gri zemin + `mix-blend-multiply` görünümü **sadece Slazenger markalı ürünlerde** (ayakkabıyla sınırlı değil, markanın tüm ürünleri) olsun. **Koton ve diğer tüm markalar** gri zemin öncesindeki haline (`bg-line`, blend yok) geri dönsün. Görünüm hem katalog kartında hem ürün detay sayfasında uygulansın.

## Mevcut Durum (kod + DEPLOY_STATUS incelendi)

- Katalog kartında gri zemin **tüm ürünlere** uygulanmış ve yerel commit'lenmiş (DEPLOY_STATUS: "Katalog kartinda gri zemin testi — onaylandi"). `--image-bg: #f2f1ef` (globals.css), Tailwind `image-bg` rengi, `product-card.tsx`'te kapsayıcı `bg-image-bg` + iki `<Image>`'da `mix-blend-multiply`.
- `ProductCardData` tipinde **marka bilgisi yok**. Kartı besleyen sunucu tarafı yerlere (`lib/catalog.ts`, `lib/home-products.ts`, `urunler/[slug]/page.tsx` benzer ürünler, favoriler vb.) marka eklenmesi gerekiyor.
- Ürün detay (`product-viewer.tsx`) zaten `brandName` prop'u alıyor (`page.tsx` satır ~105: `brandName={product.brand?.name ?? null}`). Ekstra sorgu gerekmez.
- Ürün detay galerisi iki yerde: mobil Embla slaytları (≈ satır 429) ve masaüstü 2 sütunlu grid (≈ satır 480), ikisi de `bg-line` + `object-cover`. `URUN_DETAY_GRI_ZEMIN_PLANI.md` daha önce uygulandıysa bunlar zaten `bg-image-bg` olabilir, o durumda koşula bağlanacak.

## Claude Code için Prompt

> Gri zemin + `mix-blend-multiply` görünümünü **sadece Slazenger markalı ürünlere** (markanın TÜM ürünleri, kategori fark etmez) kısıtla ve ürün detay sayfasına da aynı koşulla uygula. Koton ve diğer tüm markalar gri zemin ÖNCESİNDEKİ haline dönmeli (`bg-line`, blend yok). Plan dosyası: `SLAZENGER_GRI_ZEMIN_PLANI.md` (`BEYAZ_ARKAPLAN_GRI_ZEMIN_TEST_PLANI.md` ve `URUN_DETAY_GRI_ZEMIN_PLANI.md`'nin yerine geçer). `--image-bg` değişkenine ve Tailwind `image-bg` rengine DOKUNMA, onlar kalsın.
>
> 1. **Kural tek yerde:** `src/lib/image-backdrop.ts` oluştur: `export function usesGreyBackdrop(brandName: string | null | undefined): boolean` → marka adı trim edilip Türkçe duyarsız küçük harfe çevrildiğinde (`toLocaleLowerCase("tr")`) `"slazenger"` ise `true`. Kısa bir yorumla neden var olduğunu yaz (Slazenger fotoğrafları beyaz arkaplanlı, beyaz sayfa ve rozetlerle kaynaşıyor). Önce veritabanındaki marka adını OKU (yazma) ve eşleştiğini doğrula; Slazenger'in kaç ürünü olduğunu bana söyle.
> 2. **Katalog kartı:** `ProductCardData` tipine (`src/components/product-card.tsx`) opsiyonel `greyBackdrop?: boolean` ekle (kısa yorumla). `ProductCardData` / `<ProductCard>` verisi üreten TÜM sunucu tarafı yerleri grep ile bul (`lib/catalog.ts`, `lib/home-products.ts`, `urunler/[slug]/page.tsx` benzer ürünler, favoriler vb.). Her birinde Prisma sorgusuna minimum `select` ile marka adını ekle (`brand: { select: { name: true } }`) ve `greyBackdrop: usesGreyBackdrop(brand?.name)` doldur. Ürün başına ekstra sorgu atma (N+1 olmasın).
> 3. `product-card.tsx` (≈ satır 169): kapsayıcı `product.greyBackdrop ? "bg-image-bg" : "bg-line"`. Ana `<Image>`, hover'daki ikinci `<Image>` (`secondImage`) ve swatch'a tıklanınca gösterilen görsel `mix-blend-multiply`'ı SADECE `greyBackdrop` true ise alsın. `greyBackdrop` false/undefined olan kartların sınıfları gri zemin commit'inden ÖNCEKİ haliyle birebir aynı olmalı (git diff ile karşılaştırıp doğrula).
> 4. **Ürün detay:** `product-viewer.tsx`'te zaten gelen `brandName` prop'uyla `const greyBackdrop = usesGreyBackdrop(brandName)` hesapla.
>    - Mobil galeri (Embla, ≈ satır 429) ve masaüstü galeri (≈ satır 480) kutuları: `greyBackdrop ? "bg-image-bg" : "bg-line"`; içlerindeki `<Image>`'lar sadece `greyBackdrop` true ise `mix-blend-multiply` alsın. Masaüstündeki `group-hover:scale-[1.03]` hover büyümesini KORU; büyürken blend bozuluyorsa kutuya `isolate` ekle.
>    - Mobil ilerleme çizgileri (≈ satır 443–455, `bg-white` / `bg-white/40`): sadece `greyBackdrop` true ise her çizgiye `shadow-[0_0_2px_rgba(0,0,0,0.35)]` ekle ki gri zeminde görünsün. Renklere dokunma.
>    - Favori kalbi ve büyüteç rozeti blend'den etkilenmemeli (blend sadece `<Image>`'da).
>    - Daha önce `URUN_DETAY_GRI_ZEMIN_PLANI.md` uygulanıp bu alanlar koşulsuz `bg-image-bg` yapıldıysa, onları da bu koşula bağla.
> 5. **DOKUNMA:** Lightbox (koyu zemin), rozetler (`product-badge.tsx`), sepet çekmecesi, admin paneli, `globals.css`/`tailwind.config.ts`'teki `image-bg` tanımları.
> 6. `npm run lint` ve `npx tsc --noEmit` ile hata olmadığını doğrula.
> 7. `npm run dev` ile localhost'ta aç ve bana şu adresleri ver: (a) Slazenger ve Koton ürünlerinin YAN YANA göründüğü katalog sayfası, (b) bir Slazenger ürünü detay sayfası, (c) bir Koton ürünü detay sayfası, (d) varsa Slazenger ayakkabı dışı bir ürün.
> 8. Proje kuralları: **Ben localhost'ta onaylamadan commit atma.** Onaylarsam YEREL commit at, **ben söylemeden push etme**. Yüklü skill'leri kullan (karpathy-guidelines dahil: minimum, cerrahi değişiklik). İş bitince `DEPLOY_STATUS.md`'ye not düş (önceki "tüm ürünler" kararının Slazenger'e daraltıldığını belirt).

## Localhost'ta Neye Bakmalı

- **Koton ürünleri** (katalog + detay) gri zemin öncesindeki haline döndü mü?
- **Slazenger ürünleri** (ayakkabı ve diğer ürünler) katalogda ve detay sayfasında gri zeminde mi?
- Slazenger ürününde rozetler gri zeminde belirgin mi?
- Detay sayfasında: mobilde kaydırma ve alttaki çizgiler, masaüstünde hover büyümesi, favori kalbi, büyüteç rozeti normal mi?
- Fotoğrafa tıklayınca açılan büyük görünüm değişmedi mi?
- Anasayfa karuselleri, Çok Satanlar sekmeleri, favorilerim ve "benzer ürünler"de de aynı kural geçerli mi?
