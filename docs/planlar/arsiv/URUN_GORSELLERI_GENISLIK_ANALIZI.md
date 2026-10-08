# Ürün Detay Sayfası — Galeri Görsel Genişlikleri (Release ile Piksel Karşılaştırması)

release-main.myshopify.com/products/top-8 ve Bollmark'ın kendi ürün detay
sayfası, aynı 1600px viewport'ta, tarayıcıda `getBoundingClientRect()` ile
ölçüldü (tahmini değil, gerçek DOM ölçümü).

## Release — gerçek yapı

Sayfanın tamamı **5 eşit sütunlu tek bir grid** üzerine oturuyor:

```
.product-grid.product-grid__size--large {
  grid-template-columns: 277px 277px 277px 277px 277px;
  column-gap: 32px;
}
```

- Toplam grid genişliği: **1513px** (5×277 + 4×32), sol kenar x=36 (36px
  sayfa dolgusu).
- **Galeri 3 sütunu kaplıyor** → 3×277 + 2×32 = **895px**. İçinde 2 görsel
  yan yana, aralarında **8px** boşluk: her görsel **443.5px** genişlik,
  591.3px yükseklik → oran tam **0.75 (3:4 dikey/portre)**.
- **Bilgi paneli 2 sütunu kaplıyor** → 2×277 + 32 = **586px**.
- Yani gerçek oran **895 / 586 ≈ 60 / 40** (galeri/bilgi) — daha önceki
  ölçümle (Adım 5, "60/40") birebir uyuşuyor.

## Bollmark — şu an ölçülen (aynı 1600px'te)

```
<div className="grid gap-x-11 gap-y-12 md:grid-cols-[60fr_40fr]">
```

- Toplam grid genişliği: **1513px**, x=36 — **Release ile birebir aynı**.
- Galeri sütunu: **881.4px** (881.39), içinde 2 görsel yan yana, **8px**
  boşluk, her görsel **436.7px × 582.3px**, oran **0.75** — **Release ile
  neredeyse birebir aynı** (895 vs 881, sadece 14px / %1.6 fark).
- Bilgi paneli: **587px** (Release'de 586px — 1px fark, önemsiz).

## Sonuç: Galeri zaten çok yakın, tek gerçek fark "ara boşluk"

Görsel oranı (0.75), görsel arası boşluk (8px) ve toplam 60/40 bölünme
**zaten doğru**. Aradaki 14px'lik küçük fark tek bir yerden geliyor:
Release'de galeri bloğu ile bilgi paneli arasındaki boşluk **32px**
(grid'in tek bir sütun-arası boşluğu kadar), Bollmark'ta ise **44px**
(`gap-x-11` = 2.75rem = 44px, Tailwind'in kendi spacing skalası — bu,
önceki mesajdaki rem/px kök-font sorunundan bağımsız, çünkü Tailwind'in
yerleşik `gap-x-11` sınıfı zaten px'e sabit çevriliyor, kök font-size'dan
etkilenmiyor).

**Düzeltme tek satır:** `gap-x-11` → `gap-x-8` (2rem = 32px — Tailwind'in
hazır bir sınıfı, arbitrary value bile gerekmiyor). Bu, galeri/bilgi
oranını 895/586'ya (yani birebir Release'in ölçüsüne) oturtur.

## Claude Code'a verilecek prompt

```
Ürün detay sayfasında (src/components/product-viewer.tsx, satır ~291)
galeri ile bilgi paneli arasındaki yatay boşluk şu an `gap-x-11` (44px).
release-main.myshopify.com/products/top-8'de bu boşluk gerçekte 32px
(sayfanın 5 eşit sütunlu grid'inde tek bir sütun-arası boşluk kadar - bu
tarayıcıda ölçülüp doğrulandı, tahmini değil). Görsellerin kendi eni/boyu/
oranı (436.7×582.3px, 0.75 oran) ve aralarındaki 8px boşluk zaten Release
ile birebir uyumlu, sadece bu tek değer farklı.

`<div className="grid gap-x-11 gap-y-12 md:grid-cols-[60fr_40fr]">`
satırındaki `gap-x-11` sınıfını `gap-x-8`'e çevir (gap-y-12 aynı kalsın -
o sadece mobilde galeriyle bilgi paneli alt alta dizilirken kullanılıyor,
Release'in ölçümüyle ilgisi yok).

Sonra:
1. npx tsc --noEmit ve npm run build hatasız geçmeli.
2. Yerel dev sunucuda 1600px'te ürün detay sayfasını aç, galeri grid
   genişliğinin ~895px, bilgi panelinin ~586px olduğunu getBoundingClientRect
   ile doğrula.
3. 1280px ve 390px'te de yatay taşma/bozulma olmadığını kontrol et (bu
   sadece bir boşluk değeri, responsive'i etkilememesi gerekir).

DEPLOY_STATUS.md'ye bu ince ayarı not düş. Commit'i öner ama onayım
olmadan push etme.
```

## Not

Görsellerin kendisiyle (kırpma, object-fit, boyut) ilgili şu an bilinen
bir sorun yok — bu kısım zaten doğru. Bir önceki analizdeki asıl sorun
(başlık/fiyat/accordion font boyutları) hâlâ ayrı bir konu; bu dosya
sadece galeri genişlik/oran karşılaştırmasını kapsıyor.
