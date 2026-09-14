# Mobil Katalog — Ürün Başlığı/Fiyatı Kenara Çok Yaslanıyor (Takip Düzeltmesi)

## Durum

Önceki değişiklik (`-mx-4 gap-0.5`, bkz. `MOBIL_KATALOG_GORSEL_BOSLUK_PLANI.md`) görselleri istenen şekilde
kenara yapıştırdı. Ama negatif margin tüm grid hücresini (görsel + altındaki başlık/fiyat metnini) birlikte
kaydırdığı için, ürün başlığı ve fiyatı da görselle birlikte ekranın tam kenarına yapıştı — kullanıcının
paylaştığı yeni ekran görüntüsünde metin sol kenara/aradaki boşluğa neredeyse değiyor, okunması rahatsız
edici duruyor.

## İstenen davranış

Koton'da da (ve genel e-ticaret pratiğinde) görsel kenara/komşu görsele tam yapışık dururken, altındaki
başlık/fiyat metninin kendi küçük bir iç boşluğu (padding) olur — böylece metin ne ekran kenarına ne de yan
karttaki metne değer. Sadece GÖRSEL alanı "bleed" (taşma) yapıyor, metin bloğu değil.

## Kök neden

`src/components/product-card.tsx`: kart içindeki metin blokları (`h3` başlık satırı, renk etiketi `p`,
fiyat satırı) görsel `div`'iyle aynı seviyede, grid hücresinin tam genişliğini kaplıyor — grid'e uygulanan
`-mx-4` (bkz. `urunler/page.tsx`) görseli kenara yapıştırırken aynı zamanda bu metin bloklarını da kenara
yapıştırmış oluyor, çünkü aralarında ayrı bir iç boşluk hiç yok.

## Çözüm

Sadece metin bloklarına (görsele DOKUNMADAN) mobilde küçük bir yatay iç boşluk (`px-2`, 8px) ekle,
masaüstünde bunu kaldır (`md:px-0`) çünkü masaüstünde zaten `gap-6` (24px) var ve mevcut görünüm bozulmamalı.

`src/components/product-card.tsx` içinde üç yer:

1. Başlık satırı (`mt-4 flex items-baseline justify-between`) → `mt-4 flex items-baseline justify-between
   px-2 md:px-0`
2. Renk etiketi `<p>` (`mt-1 min-h-[15px] ...`) → aynı class'a `px-2 md:px-0` ekle
3. Fiyat satırı (`mt-2 flex items-center gap-2`) → `mt-2 flex items-center gap-2 px-2 md:px-0`

Görsel `div`'i (`relative aspect-[3/4] overflow-hidden bg-line` ve içindeki her şey — rozetler, kalp,
hızlı sepete ekle butonu) AYNEN kalıyor, hiçbir değişiklik yapılmıyor.

## Claude Code'a verilecek prompt

```
Önceki değişiklikte (`-mx-4 gap-0.5` ile mobil katalog grid'ini kenara yapıştırdık) görseller doğru boyuta
geldi ama yan etki olarak kart altındaki ürün BAŞLIĞI ve FİYATI da ekranın tam kenarına/aradaki dar boşluğa
yapıştı — kullanıcı ekran görüntüsüyle bunun rahatsız edici durduğunu bildirdi, metnin biraz "açılmasını"
(kenardan/komşu karttan biraz boşluk almasını) istiyor. Görsellerin kendisi (kenara tam yapışık hali) AYNEN
kalmalı, sadece metin bloğuna dokunulacak.

`src/components/product-card.tsx` dosyasında, görsel `div`'inden SONRA gelen üç metin bloğuna (başlık `h3`
satırı, renk etiketi `p`, fiyat satırı — üçü de görsel div'inin dışında, Link içinde art arda geliyor)
mobilde `px-2` (8px), masaüstünde `md:px-0` (masaüstünü değiştirme) ekle:

1. `<div className="mt-4 flex items-baseline justify-between">` → `className="mt-4 flex items-baseline
   justify-between px-2 md:px-0"`
2. Renk etiketi `<p className="mt-1 min-h-[15px] text-[12px] leading-[15px] text-ink/50 ...">` → aynı
   class string'ine `px-2 md:px-0` ekle (template literal'deki koşullu `invisible` kısmını bozma)
3. `<div className="mt-2 flex items-center gap-2">` (fiyat satırı) → `className="mt-2 flex items-center
   gap-2 px-2 md:px-0"`

Görsel `div`'ine (rozetler, kalp butonu, hızlı sepete ekle butonu dahil) VE `urunler/page.tsx`'teki grid
satırına (`-mx-4 grid grid-cols-2 gap-0.5 md:mx-0 md:grid-cols-4 md:gap-6`) DOKUNMA, onlar zaten doğru.

Test:
1. `npx tsc --noEmit` ve `npm run build` hatasız geçmeli.
2. Playwright ile 375-390px genişlikte ekran görüntüsü al: başlık ve fiyatın artık ekran kenarına/aradaki
   dar boşluğa değmediğini, ama görsellerin hâlâ kenara yapışık kaldığını doğrula. Kısa ve uzun ürün
   isimlerinde de metnin okunabilir kaldığını kontrol et.
3. Masaüstünde (1280px/1600px) hiçbir görsel değişiklik olmadığını doğrula.

Bitince DEPLOY_STATUS.md'ye her zamanki formatta not düş. Commit'i öner ama onayım olmadan push etme.
```
