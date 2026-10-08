# Ürün Detay Sayfası — Header Boşluğu ve Release Tarzı Rozetler

## Sorun

İki ayrı istek, ikisi de ürün detay sayfasını (`src/app/(site)/urunler/[slug]/page.tsx`) referans
"release" temasına yaklaştırmak için:

1. Header ile ürün görseli arasında gereğinden fazla boşluk var. Referans "release" temasında bu
   boşluk çok az ve dar (ekran görüntülerinde net görülüyor).
2. "release" temasında ürün başlığının ÜZERİNDE, görsel alanının üstünde küçük rozetler var
   ("LAST FEW", "NEW", "SALE" gibi — koyu arka planlı, büyük harf, kalın, beyaz yazı). Bizim sitede
   zaten katalog/liste sayfasındaki ürün kartlarında bu tarz rozetler var (indirim %, "Son X Adet"
   gibi) — bunları ürün detay sayfasında da, biraz büyütülmüş ve release'deki gibi koyu arka planlı
   olarak kullanmak istiyoruz.

## Kök neden

### 1) Header-görsel arası boşluk

İki kaynak üst üste biniyor:

- `src/components/site-header.tsx` satır ~522: header `fixed inset-x-0 top-0 ...` ile normal akıştan
  çıkarılmış; satır ~604'te `{!isTransparentPage && <div aria-hidden className="h-[72px]" />}` ile
  header'ın gerçek yüksekliği (72px) sayfa akışında yer kaplasın diye bir "spacer" div ekleniyor.
  Ürün detay sayfası şeffaf olmayan bir sayfa olduğu için bu 72px'lik spacer her zaman render oluyor —
  buna dokunulmamalı, gerçek header yüksekliğini yansıtıyor.
- `src/app/(site)/urunler/[slug]/page.tsx` satır ~108: sayfanın dış sarmalayıcısı
  `<div className="w-full px-4 py-16 md:px-6 xl:px-9">` — `py-16` üstte 64px ekstra boşluk daha
  ekliyor. Toplamda header spacer (72px) + `py-16` (64px) ≈ 136px'lik bir boşluk oluşuyor, bu da
  release'deki dar boşluğa göre oldukça fazla.

Çözüm: bu sarmalayıcıdaki üst padding'i (`py-16`'nın top kısmını) belirgin şekilde azaltmak — alt
padding'e dokunmadan, sadece üstte örn. `pt-4` / `pt-6` gibi bir değere indirmek.

### 2) Rozetler — henüz paylaşılan/reusable bir bileşen değil

Katalog kartındaki rozetler `src/components/product-card.tsx` satır ~162-175'te, kart bileşenine
doğrudan gömülü (inline), ayrı bir `ProductBadge` bileşeni yok:

```tsx
{(discountPercent || product.lowStockCount != null) && (
  <div className="absolute left-2 top-2 flex flex-col items-start gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
    {discountPercent && (
      <span className="whitespace-nowrap rounded bg-sale px-1.5 py-1 text-[9px] font-medium uppercase leading-[11px] tracking-[1.2px] text-white sm:px-2 sm:py-1.5 sm:text-[10px] sm:leading-[12.5px] sm:tracking-[1.4px]">
        %{discountPercent} İndirim
      </span>
    )}
    {product.lowStockCount != null && (
      <span className="whitespace-nowrap rounded bg-white px-1.5 py-1 text-[9px] ... text-ink">
        Son {product.lowStockCount} Adet
      </span>
    )}
  </div>
)}
```

Bu iki varyant (`bg-sale` indirim rozeti, `bg-white` "son X adet" rozeti) mevcut ama release'in
istediği koyu (siyah/lacivert) arka planlı, beyaz yazılı üçüncü bir varyant henüz yok.

Ürün detay sayfası `src/components/product-viewer.tsx` içinde render ediliyor (görsel + bilgi
grid'i, satır ~304), ama bu bileşende rozet mantığı hiç yok — sıfırdan eklenmesi gerekiyor.

## Önerilen çözüm

1. Rozet JSX'ini `product-card.tsx`'ten ayırıp `src/components/product-badge.tsx` gibi paylaşılan
   küçük bir bileşene çıkar (örn. `variant: "discount" | "low-stock"` ve `size: "sm" | "lg"` prop'ları
   alsın). Böylece hem katalog kartı hem ürün detay sayfası aynı bileşeni kullanır, ileride
   tutarsızlık olmaz.
2. Mevcut renk paletine (`tailwind.config.ts`) release'deki koyu arka plana denk gelen bir renk
   ekle/kullan (örn. `bg-ink text-cream` gibi zaten var olan bir token, ya da yeni bir
   `bg-badge-dark` token) — release'deki gibi koyu arka plan + beyaz, büyük harf, kalın, küçük yazı.
3. Ürün detay sayfasında bu bileşeni `product-viewer.tsx` içinde başlığın hemen üzerine, "büyütülmüş"
   boyut varyantıyla (`size="lg"`) yerleştir — katalogdaki `text-[9-10px]`'e göre biraz daha büyük
   (örn. `text-[11-12px]`, biraz daha fazla padding).
4. Header-görsel boşluğu için `page.tsx`'teki sarmalayıcının üst padding'ini azalt (yukarıdaki kök
   neden bölümüne bakın).

## Claude Code'a verilecek prompt

```
Ürün detay sayfasında iki değişiklik yapacağız, referans "release" temasına yaklaştırmak için
(ekran görüntüleri elimde, gerekirse paylaşırım):

1) HEADER-GÖRSEL ARASI BOŞLUK
`src/app/(site)/urunler/[slug]/page.tsx` satır ~108'deki dış sarmalayıcı
`<div className="w-full px-4 py-16 md:px-6 xl:px-9">` — `py-16` hem üstte hem altta 64px boşluk
veriyor. Header zaten `fixed` olduğu için `src/components/site-header.tsx`'te ayrı bir 72px'lik
spacer div var (satır ~604, `h-[72px]`, BUNA DOKUNMA — header'ın gerçek yüksekliğini yansıtıyor).
Sadece ürün detay sayfasındaki sarmalayıcının ÜST padding'ini belirgin azalt (örn. `py-16` yerine
üstte `pt-4 md:pt-6`, alt padding'i olduğu gibi bırak — `pb-16` gibi ayrı yaz). Amaç: header ile
ürün galerisi arasındaki boşluğu release temasındaki kadar dar yapmak. Bu değişikliğin diğer
sayfaları etkilememesi için SADECE bu route'un wrapper'ını değiştir.

2) RELEASE TARZI ROZETLER ÜRÜN DETAY SAYFASINDA
Katalog/liste sayfasındaki ürün kartında (`src/components/product-card.tsx`, satır ~162-175) zaten
rozet mantığı var (indirim yüzdesi ve "Son X Adet" için), ama inline yazılmış, paylaşılan bir
bileşen değil:

```tsx
{(discountPercent || product.lowStockCount != null) && (
  <div className="absolute left-2 top-2 flex flex-col items-start gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
    {discountPercent && (
      <span className="whitespace-nowrap rounded bg-sale px-1.5 py-1 text-[9px] font-medium uppercase leading-[11px] tracking-[1.2px] text-white sm:px-2 sm:py-1.5 sm:text-[10px] sm:leading-[12.5px] sm:tracking-[1.4px]">
        %{discountPercent} İndirim
      </span>
    )}
    {product.lowStockCount != null && (
      <span className="whitespace-nowrap rounded bg-white px-1.5 py-1 text-[9px] ... text-ink">
        Son {product.lowStockCount} Adet
      </span>
    )}
  </div>
)}
```

Şunu yap:
a) Bu rozet `<span>` mantığını `src/components/product-badge.tsx` adında paylaşılan bir bileşene
   çıkar. Prop'lar: `variant` ("discount" | "low-stock" — ileride başka varyantlar da eklenebilir
   şekilde tasarla) ve `size` ("sm" varsayılan, katalog kartındaki mevcut boyutlarla aynı; "lg" yeni,
   ürün detay sayfası için ~%20-30 daha büyük font/padding, örn. `text-[11px] sm:text-[12px]`,
   `px-2.5 py-1.5`).
b) `product-card.tsx`'i bu yeni bileşeni kullanacak şekilde güncelle (`size="sm"`), davranış ve
   görünüm AYNEN korunmalı — regresyon olmamalı.
c) `tailwind.config.ts`'de mevcut renk token'larına bak (`bg-ink`, `text-cream` gibi koyu/açık
   tonlar var mı incele) ve release'deki koyu (siyah/çok koyu lacivert) arka plan + beyaz yazıya en
   yakın mevcut token'ı kullan; hiçbiri uymuyorsa yeni bir token ekleme yerine en yakın mevcut
   `bg-ink`/`text-cream` (veya benzeri) ikilisini kullan.
d) `src/components/product-viewer.tsx` içinde, ürün başlığının hemen üzerine (görsel/galeri alanının
   üst kısmına, release'deki gibi) bu bileşeni `size="lg"` ile yerleştir. Hangi ürünlerde
   gösterileceği katalogdaki mantıkla aynı olsun (indirim varsa indirim rozeti, düşük stok varsa
   "Son X Adet" rozeti) — ikisi aynı anda varsa alt alta göster (katalogdaki gibi `flex-col gap-`).

Test:
1. `npx tsc --noEmit` ve `npm run build` hatasız geçmeli.
2. Playwright ile hem mobil (375-390px) hem masaüstü (1280px+) ekran görüntüsü al:
   - Ürün detay sayfasında header ile görsel arası boşluğun belirgin şekilde azaldığını doğrula.
   - İndirimli ve düşük stoklu birer üründe rozetlerin başlığın üzerinde, büyütülmüş boyutta ve koyu
     arka planla göründüğünü doğrula.
   - Katalog sayfasında ürün kartlarındaki rozetlerin ESKİSİYLE AYNI göründüğünü (boyut, renk,
     konum) doğrula — regresyon olmamalı.

Bitince DEPLOY_STATUS.md'ye her zamanki formatta not düş. Commit'i öner ama onayım olmadan push etme.
```
