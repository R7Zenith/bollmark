# Ürün Detay Sayfası — Stoğu Bitmiş Beden/Renk Seçeneklerinin İşaretlenmesi

## İstek

Ürün detay sayfasında (hem mobil hem masaüstü) beden ve renk seçeneklerinden
stoğu bitmiş olanların üzeri çizili ve soluklaştırılmış görünmesi isteniyor —
ekran görüntüsünde örnek verilen L bedeni gibi, seçilemeyecek/stokta olmadığı
açıkça belli olacak şekilde (release'teki (Shopify temasındaki) davranışın
aynısı).

## Kod incelemesi

İlgili tüm mantık tek bir yerde: `src/components/product-viewer.tsx`
(`ProductViewer` bileşeni). Bu bileşen hem masaüstü hem mobil görünümü aynı
JSX'ten render ediyor (responsive grid, ayrı bir mobil bileşen yok) — yani tek
yerde yapılacak değişiklik otomatik olarak her iki görünümü de kapsayacak.

Şu an olan:

- `variants` prop'u her beden×renk kombinasyonu için ayrı `stock` alanı
  taşıyor (`type Variant = { size, color, stock, ... }`).
- Renk butonları (satır ~638-650) ve beden butonları (satır ~674-686) sadece
  `colors`/`sizes` dizisini map'liyor, **hiçbir stok kontrolü yapmadan**
  render ediyor. Tek koşullu stil, o an **seçili** olan renk/beden için
  (`color === c` / `size === s`) — stokta olup olmamasının görsel bir
  karşılığı yok.
- Stok bilgisi zaten hesaplanıyor ama sadece seçili kombinasyon için
  kullanılıyor: `selected = variants.find(v => v.size === size && v.color ===
  color)`, `outOfStock = !selected || selected.stock <= 0` → bu, "Sepete
  Ekle" butonunu (satır ~727-732) `disabled` yapıp "Stokta Yok" yazdırıyor,
  ve `outOfStock` true olduğunda muhtemelen `StockAlertForm` (satır 41-88,
  "Stok gelince size haber vereceğiz" formu) gösteriliyor.
- Renk bazında toplam stok da zaten var: `colorOutOfStock` (satır 235) — o
  rengin **tüm bedenlerinde** stok 0 mı diye bakıyor, ama şu an sadece "Son X
  adet" rozetini gizlemek için kullanılıyor, renk butonunun görünümüne hiç
  yansımıyor.

Yani veri zaten elde — eksik olan sadece buton render'ındaki koşullu stil.
Önemli bir tasarım notu: kullanıcı stoğu bitmiş bir bedeni **yine de
tıklayabilmeli** (disabled değil) — çünkü seçtiğinde `outOfStock` true olur ve
"stok gelince haber ver" formu görünür hale gelir (StockAlertForm). Bedeni
tamamen tıklanamaz yaparsak bu akış kırılır. Dolayısıyla çözüm sadece görsel
(üzeri çizili + soluk + `cursor-not-allowed`), buton işlevini
(`onClick`/`disabled` attribute) değiştirmemeli.

## Önerilen çözüm

1. **Beden butonları** — seçili renge göre stok kontrolü: her `s` için
   `variants`'ta `size === s && color === color(seçili renk) && stock > 0`
   olan bir varyant var mı bak. Yoksa (o renkte o beden hiç yok ya da stok 0
   ise) butonu "tükendi" stiliyle render et.
2. **Renk butonları** — o rengin **hiçbir** bedeninde stok kalmamışsa (zaten
   hesaplanan `colorOutOfStock` mantığının genellenmiş hali, her `c` için)
   "tükendi" stiliyle render et.
3. **"Tükendi" stili**: `opacity-40` (soluklaştırma — projede zaten
   `disabled:opacity-40` deseni başka butonlarda kullanılıyor, tutarlı) +
   `cursor-not-allowed` + üzerine köşeden köşeye çapraz bir çizgi. Çapraz
   çizgi için en sağlam yöntem, buton kare/dikdörtgen olduğu için (28×28px'ten
   büyüyebiliyor — "Standart" gibi uzun etiketlerde) buton içine mutlak
   konumlu, `rotate-45` verilmiş, genişliği butonun köşegenini kapsayacak
   kadar (`w-[141%]`) ince bir çizgi (`<span>`) eklemek — CSS
   `background-image: linear-gradient(...)` yerine bu, değişken buton
   genişliğinde de düzgün çalışır.
4. Tıklama davranışı **değişmiyor** — buton yine `onClick={() => setSize(s)}`
   / `onClick={() => setColor(c)}` çağırıyor, sadece `className` koşullu.

## Verilen Claude Code promptu

```
Bollmark'ın ürün detay sayfasında (src/components/product-viewer.tsx,
ProductViewer bileşeni — hem mobil hem masaüstü aynı JSX'i kullanıyor, ayrı
bir mobil bileşen yok) stoğu bitmiş beden ve renk seçeneklerini görsel olarak
işaretleyeceğiz: üzeri çizili + soluklaştırılmış, release'deki (referans
Shopify temasındaki) davranışın aynısı. Ekran görüntüsünde örnek: L bedeni
stokta yok, üzerinde çapraz bir çizgi var ve rengi soluk.

ÖNEMLİ: Stoğu bitmiş bir beden/renk hâlâ TIKLANABİLİR kalmalı (disabled
attribute EKLEME, onClick'i değiştirme) — çünkü kullanıcı stoksuz bir bedeni
seçtiğinde `outOfStock` true olup "stok gelince haber ver" formu
(StockAlertForm) görünüyor, bu akış korunmalı. Değişiklik sadece görsel
(className).

1. `ProductViewer` içinde, mevcut `colorVariants`/`colorOutOfStock`
   hesaplamalarının yakınına iki yardımcı fonksiyon ekle:

   ```tsx
   const isSizeOutOfStock = (s: string) =>
     !variants.some((v) => v.size === s && v.color === color && v.stock > 0);

   const isColorOutOfStock = (c: string) =>
     !variants.some((v) => v.color === c && v.stock > 0);
   ```

   (`isColorOutOfStock`, mevcut `colorOutOfStock` değişkeniyle aynı mantığı
   herhangi bir renk için genelliyor — sadece seçili renk için değil, o
   yüzden ayrı bir fonksiyon; mevcut `colorOutOfStock` değişkenine
   dokunma, "Son X adet" rozeti onu kullanmaya devam etsin.)

2. Renk butonlarını (yaklaşık satır 638-650, `colors.map((c) => ...)`)
   güncelle — her buton için `const outOfStockColor = isColorOutOfStock(c);`
   hesapla ve className'i koşullu yap:

   ```tsx
   {colors.map((c) => {
     const unavailable = isColorOutOfStock(c);
     return (
       <button
         key={c}
         onClick={() => setColor(c)}
         className={`relative flex h-7 min-w-[28px] items-center justify-center rounded-none border px-3 text-xs uppercase leading-none tracking-[1px] transition duration-300 ${
           color === c ? "bg-ink text-cream border-ink" : "bg-transparent text-ink border-ink hover:bg-ink/5"
         } ${unavailable ? "opacity-40 cursor-not-allowed" : ""}`}
       >
         {c}
         {unavailable && (
           <span className="pointer-events-none absolute inset-0 overflow-hidden">
             <span className="absolute left-1/2 top-1/2 h-px w-[141%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
           </span>
         )}
       </button>
     );
   })}
   ```

3. Beden butonlarını (yaklaşık satır 674-686, `sizes.map((s) => ...)`) aynı
   desenle güncelle:

   ```tsx
   {sizes.map((s) => {
     const unavailable = isSizeOutOfStock(s);
     return (
       <button
         key={s}
         onClick={() => setSize(s)}
         className={`relative flex h-7 min-w-[28px] items-center justify-center rounded-none border px-1 text-xs leading-none tracking-[1px] transition duration-300 ${
           size === s ? "bg-ink text-cream border-ink" : "bg-transparent text-ink border-ink hover:bg-ink/5"
         } ${unavailable ? "opacity-40 cursor-not-allowed" : ""}`}
       >
         {s}
         {unavailable && (
           <span className="pointer-events-none absolute inset-0 overflow-hidden">
             <span className="absolute left-1/2 top-1/2 h-px w-[141%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
           </span>
         )}
       </button>
     );
   })}
   ```

   (Not: eski className'lerde `border-ink` her zaman sabitti, opacity ile
   soluklaştığında çizgi de otomatik solacak şekilde `border` class'ını
   `border-ink`/koşullu hale ayırdım ki hem yazı hem çerçeve birlikte
   solsun — üstteki kodda bunu uyguladım, aynen kopyala.)

4. Test: bir ürünün admin panelinden bir bedeninin/renginin stoğunu 0 yap,
   ürün detay sayfasında (hem mobil hem masaüstü genişlikte) o seçeneğin
   üzeri çizili ve soluk göründüğünü, hâlâ tıklanabildiğini ve
   tıklandığında "Sepete Ekle" butonunun "Stokta Yok" olup stok bildirimi
   formunun göründüğünü doğrula.

Her zamanki gibi işin sonunda DEPLOY_STATUS.md'ye not düş.
```
