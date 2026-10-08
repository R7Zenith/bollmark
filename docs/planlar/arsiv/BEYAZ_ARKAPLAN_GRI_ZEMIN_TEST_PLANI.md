# Beyaz Arkaplanlı Ürün Fotoğrafları — Gri Zemin (mix-blend-multiply) TEST Planı

## Sorun

Yeni eklenen ayakkabı fotoğraflarının arkaplanı beyaz. Sayfa arkaplanı (`cream = #ffffff`) ve katalog kartındaki "Son 1 adet" / "Yeni" rozetleri de (`bg-white text-ink`) beyaz. Bu yüzden ürünler birbirinden ve sayfadan ayrışmıyor, rozetler zeminle kaynaşıyor.

## Bu adımın kapsamı (sadece test)

Sadece **katalog ürün kartında** (`src/components/product-card.tsx`) görsel alanına açık gri zemin verilecek ve fotoğraflara `mix-blend-multiply` uygulanacak. Böylece fotoğraftaki beyaz, arkadaki griye dönüşecek, ürünün kendisi değişmeyecek. Rozetlere, ürün detay sayfasına, Blob'a ve veritabanına dokunulmayacak. Tamamen görsel bir değişiklik ve tek commit'le geri alınabilir.

Kullanıcı localhost'ta görüp beğenirse sonraki adımlar planlanacak: ayakkabılara boşluklu yerleşim, sadece beyaz arkaplanlı fotoğraflara otomatik uygulama, ürün detay galerisi.

## Claude Code için Prompt

> Katalogdaki ürün kartlarında beyaz arkaplanlı ürün fotoğrafları beyaz sayfa ve beyaz rozetlerle kaynaşıyor. **Sadece localhost'ta TEST etmek için** görsel alanına açık gri zemin + `mix-blend-multiply` uygula. Plan dosyası: `BEYAZ_ARKAPLAN_GRI_ZEMIN_TEST_PLANI.md`.
>
> 1. `tailwind.config.ts` → `colors` içine yeni bir renk ekle: `"image-bg": "var(--image-bg)"`. `src/app/globals.css` içinde `:root`'a `--image-bg: #f2f1ef;` tanımla. (Ton denemesi için sonra sadece bu tek değeri değiştireceğim.) Mevcut `line`, `cream` vb. renklere DOKUNMA.
> 2. `src/components/product-card.tsx` (≈ satır 169): görsel kapsayıcısındaki `bg-line`'ı `bg-image-bg` yap. Aynı kapsayıcıdaki ana `<Image>` ve hover'da görünen ikinci `<Image>` (`secondImage`) bileşenlerinin ikisine de `mix-blend-multiply` sınıfı ekle. Mevcut crossfade/opacity/hover/transition sınıflarını KORU, sadece ekle.
> 3. `mix-blend-multiply`'ın çalışması için kapsayıcının kendi arkaplanı olmalı ve arada `isolation`/opacity katmanı blend'i bozmamalı. Crossfade sırasında (opacity geçişi) görselin griye karışması korunuyor mu kontrol et. Bozuluyorsa kapsayıcıya `isolate` ekle. Gerekirse görselleri saran ara bir div'e `bg-image-bg` ver.
> 4. **DOKUNMA:** `product-badge.tsx` (rozet renkleri aynı kalacak), favori butonu, "Tükendi" katmanı (`bg-cream/60` overlay'i ve içindeki etiket blend'den etkilenmemeli, üstte normal görünmeli), ürün detay sayfası (`product-viewer.tsx`), sepet çekmecesi. Bu sadece katalog kartı testi.
> 5. Kontrol: anasayfadaki ürün karuselleri/sekmeler ve `/urunler` kataloğu aynı `ProductCard`'ı kullanıyorsa hepsinde tutarlı görünmeli. Farklı bir kart bileşeni varsa ona DOKUNMA, sadece bana listele.
> 6. `npm run lint` ve `npx tsc --noEmit` ile hata olmadığını doğrula.
> 7. `npm run dev` ile localhost'ta aç. Bana hem beyaz arkaplanlı ayakkabıların hem de mankenli (dolu arkaplanlı) Koton ürünlerinin göründüğü bir sayfanın adresini söyle ki ikisini karşılaştırayım.
> 8. Proje kuralları: **Ben onaylamadan commit atma.** Onaylarsam YEREL commit at, **ben söylemeden push etme**. Yüklü skill'leri kullan (karpathy-guidelines dahil: minimum, cerrahi değişiklik). İş bitince `DEPLOY_STATUS.md`'ye "gri zemin testi — onay bekliyor" notu düş.

## Localhost'ta Neye Bakmalı

- Beyaz arkaplanlı ayakkabılar artık açık gri bir kutu içinde mi görünüyor, kartlar birbirinden ayrışıyor mu?
- "Son 1 adet" / "Yeni" rozetleri gri zeminde belirgin mi?
- Ayakkabının kendi renkleri (özellikle beyaz ayakkabı!) doğru mu? Beyaz bir ayakkabı da hafif griye döner. Bu kabul edilebilir mi?
- Mankenli / dolu arkaplanlı Koton fotoğrafları fazla koyulaştı mı? (Yaklaşık %5 kararma beklenir.)
- Hover'da ikinci fotoğrafa geçiş düzgün mü, geçiş sırasında beyaz parlama oluyor mu?
- "Tükendi" katmanı ve favori kalbi normal mi?
- Mobil görünüm.

## Gri Ton Denemesi

Sadece `globals.css` → `--image-bg` değerini değiştirip sayfayı yenile:

| Ton | Kod | His |
|---|---|---|
| Sıcak açık gri (varsayılan) | `#f2f1ef` | Yumuşak, butik |
| Nötr açık gri | `#f3f3f3` | Nike / Zalando tarzı |
| Biraz daha belirgin | `#ebebeb` | Mevcut `line` rengi, en net ayrışma |
| Bej / taş | `#efebe6` | Daha sıcak, doğal |

## Geri Alma

Beğenilmezse commit atılmadığı için `git checkout -- src/components/product-card.tsx tailwind.config.ts src/app/globals.css` yeterli.
