# Mobil Ürün Katalog Sayfası — Görsel Boşlukları (Koton Karşılaştırması)

## Sorun

Mobil görünümde `/urunler` sayfasında ürün fotoğrafları küçük görünüyor çünkü kenarlarda ve kartlar
arasında gereğinden fazla boşluk var. Kullanıcı Koton'un mobil sitesinden bir ekran görüntüsü paylaştı;
orada görseller neredeyse ekran kenarına kadar uzanıyor ve iki sütun arasında sadece ince bir boşluk var.

## Ekran görüntüsü karşılaştırması

**Koton (mobil, /urunler tarzı liste):**
- Görseller ekranın sol/sağ kenarına neredeyse tamamen yapışık (kenar boşluğu ~0).
- İki sütun arasında sadece ince bir çizgi kadar boşluk var (~2-4px), görseller birbirine neredeyse
  değiyor.
- Sonuç: her görsel ekran genişliğinin yaklaşık yarısını dolduruyor, ürün gerçekten büyük ve net görünüyor.

**Bollmark (mobil, /urunler, mevcut durum):**
- Görsellerin sol/sağ kenarla arasında belirgin bir beyaz boşluk var.
- İki sütun arasında da belirgin bir boşluk var.
- Sonuç: her görsel Koton'a kıyasla gözle görülür şekilde daha dar/küçük duruyor.

## Kök neden (kod incelemesiyle doğrulandı)

`src/app/(site)/urunler/page.tsx`:
- Satır 127: sayfanın tüm içeriğini saran konteynerde mobilde `px-4` (16px) kenar boşluğu var — bu boşluk
  hem başlık/toolbar metnine hem de ürün grid'ine uygulanıyor.
- Satır 152: grid `grid-cols-2 gap-4` (mobilde 16px kart arası boşluk) kullanıyor.

Yani mobilde bir görsel, iki yanında (kenar boşluğu + yarım gap) toplam ciddi bir boşluk kaybediyor;
Koton'da bu boşluklar neredeyse sıfıra yakın.

## Önerilen çözüm

Başlık/toolbar metninin kenar boşluğunu bozmadan (Koton'da da "FİLTRELERİ GÖSTER" gibi metinlerin küçük bir
kenar boşluğu var, sadece görsel grid'i tam kenara yapışık), SADECE ürün grid'ini mobilde negatif margin ile
konteynerin `px-4`'ünü iptal edip kenara yapıştırmak + `gap`'i belirgin şekilde küçültmek:

```tsx
<div className="mt-8 -mx-4 grid grid-cols-2 gap-0.5 md:mx-0 md:grid-cols-4 md:gap-6">
```

- `-mx-4` (mobilde): üst konteynerin `px-4`'ünü tam olarak iptal ediyor, görseller ekran kenarına yapışıyor.
- `gap-0.5` (2px, mobilde): Koton'daki ince çizgi kadar boşluğu taklit ediyor.
- `md:mx-0 md:grid-cols-4 md:gap-6`: masaüstü tamamen mevcut haliyle korunuyor, sadece mobil (`< md`)
  etkileniyor.

Kart içindeki metin (başlık, fiyat) `mt-4` ile görselin altında kalıyor ve kendi içinde zaten okunabilir
boşluğa sahip — grid `gap-0.5`'e düşünce görsel ile yan karttaki görsel arasında (aynı satırda) çok az
boşluk kalacak ama dikeyde (bir sonraki satırdaki karta kadar) satır arası zaten `gap-0.5` ile aynı küçük
değer olacağından kartın metin bloğu bir sonraki satırın görseline çok yakın durabilir. Bunu Claude Code
ekran görüntüsüyle kontrol edip gerekirse SADECE dikey boşluk için `gap-y-3 gap-x-0.5` gibi ayrı bir değer
kullanmalı (Koton'da da satırlar arası dikey boşluk, sütunlar arası yatay boşluktan belirgin şekilde daha
fazla — çünkü kart metni satırlar arasında yer kaplıyor).

## Claude Code'a verilecek prompt

```
Bollmark storefront'unda mobil /urunler (ürün katalog) sayfasında görseller kenarlarda ve kartlar arasında
çok fazla boşluk bıraktığı için küçük görünüyor. Kullanıcı Koton'un mobil sitesinden bir ekran görüntüsü
paylaştı: orada görseller ekran kenarına neredeyse tam yapışık, iki sütun arasında sadece ince (birkaç
piksellik) bir boşluk var — buna benzer bir görünüm istiyor.

Kod incelemesi: `src/app/(site)/urunler/page.tsx` satır 127'de sayfa konteynerinde mobilde `px-4` (16px)
kenar boşluğu var (hem başlığa hem grid'e uygulanıyor), satır 152'de grid `grid-cols-2 gap-4` (16px kart
arası boşluk mobilde) kullanıyor.

İstenen değişiklik — SADECE ürün grid'ini mobilde tam kenara yapıştır, başlık/toolbar metninin kenar
boşluğuna dokunma:

1. Grid div'ini şu şekilde güncelle (satır 152 civarı):
   `<div className="mt-8 -mx-4 grid grid-cols-2 gap-0.5 md:mx-0 md:grid-cols-4 md:gap-6">`
   - `-mx-4` üst konteynerin `px-4`'ünü mobilde iptal edip görselleri ekran kenarına yapıştırıyor.
   - `gap-0.5` (2px) sütunlar arası boşluğu Koton'daki ince çizgiye yaklaştırıyor.
   - `md:mx-0 md:grid-cols-4 md:gap-6` ile masaüstü davranışı BİREBİR korunuyor (bunu değiştirme).

2. `gap-0.5` hem yatay hem dikey boşluğu etkiler — ekran görüntüsüyle kontrol et: eğer bir kartın altındaki
   metin (başlık/fiyat) bir alt satırdaki görsele çok yakın/bitişik duruyorsa, `gap-0.5` yerine
   `gap-x-0.5 gap-y-3 md:gap-y-6` gibi yatay/dikey ayrı değerler kullan (Koton'da da satırlar arası boşluk
   sütunlar arasındakinden belirgin şekilde fazla, çünkü kart metni oraya sığıyor) — masaüstü `md:gap-6`
   değerini her durumda koru.

3. Görsellerin artık kenara tam yapıştığı için, üstteki banner (varsa) ve başlık/toolbar alanının kenar
   boşluğunun DEĞİŞMEDİĞİNİ doğrula (sadece grid etkilenmeli).

4. `npx tsc --noEmit` ve `npm run build` hatasız geçmeli.

5. Playwright ile 375-390px genişlikte ekran görüntüsü al, kullanıcının paylaştığı Koton ekran görüntüsüyle
   karşılaştır: görseller kenara yapışık mı, sütunlar arası boşluk ince mi, kart metni okunabilir kalmış mı,
   yatay taşma (`scrollWidth` vs `clientWidth`) yok mu. Ayrıca masaüstünde (1280px/1600px) grid'in eskisi
   gibi 4 sütun + 24px boşlukla değişmeden kaldığını doğrula.

6. Bitince DEPLOY_STATUS.md'ye her zamanki formatta not düş (sorun, kök neden, çözüm, doğrulama). Commit'i
   öner ama onayım olmadan push etme.
```
