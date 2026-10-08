# Ürün Kartı — Başlık ile Fiyat Arasındaki Boşluk Fazla

## Sorun

Hem masaüstü hem mobil görünümde, ürün kartında başlık ile fiyat arasında gereğinden fazla boşluk var —
özellikle tek satırlık başlıklarda göze batıyor (ekran görüntüsünde net görülüyor).

## Kök neden

`src/components/product-card.tsx`, görselin altındaki üç blok art arda geliyor:

1. Başlık (`h3`, `line-clamp-2 min-h-[30px]`) — 2 satırlık sabit yükseklik AYRIL(mal)ı, satır sayısı farklı
   ürünlerde komşu kartların fiyat satırının aynı hizada kalması için bilinçli olarak eklenmişti
   (bkz. `MOBIL_KATALOG_KARTI_VE_URUN_GALERISI_SORUNLARI_PLANI.md` madde 3) — BUNA DOKUNULMAYACAK, aksi
   halde farklı satır sayılı iki ürün yan yana geldiğinde fiyatlar tekrar hizasız kalır.
2. Renk etiketi `<p className="mt-1 min-h-[15px] ...">` — renk yoksa bile `invisible` ile aynı yüksekliği
   koruyan bir satır (aynı hizalama amacıyla eklendi) — bu da hizalama için gerekli, kalacak.
3. Fiyat satırı `<div className="mt-2 flex items-center gap-2 ...">`.

Toplam boşluk = başlık ile renk etiketi arası (`mt-1`, 4px) + renk etiketi ile fiyat arası (`mt-2`, 8px) —
bu iki saf boşluk değeri (hizalama için gerekli olan sabit yükseklikler DEĞİL, sadece aralarındaki margin)
gereğinden büyük duruyor ve sıkıştırılabilir.

## Önerilen çözüm

SADECE iki margin değerini küçült, hizalama için kullanılan `min-h` değerlerine (30px, 15px) DOKUNMA —
onlar kalmazsa farklı satır sayılı ürünler yan yana geldiğinde fiyatlar tekrar kayar:

- Renk etiketi satırı: `mt-1` → `mt-0.5`
- Fiyat satırı: `mt-2` → `mt-1`

Bu, hem masaüstünde hem mobilde (responsive olmayan, tek bir değer olduğu için ikisini birden etkiler)
başlık-fiyat arasındaki boşluğu belirgin şekilde azaltır, hizalama garantisini bozmadan.

## Claude Code'a verilecek prompt

```
Ürün kartında (`src/components/product-card.tsx`) başlık ile fiyat arasındaki boşluk hem masaüstünde hem
mobilde gereğinden fazla duruyor, kullanıcı ekran görüntüsüyle bildirdi. Kartta görselin altında sırayla üç
blok var: başlık (`h3`, `line-clamp-2 min-h-[30px]`), renk etiketi (`<p className="mt-1 min-h-[15px] ...">`
— rengi olmayan ürünlerde bile `invisible` ile aynı yüksekliği koruyor), fiyat satırı
(`<div className="mt-2 flex items-center gap-2 px-2 md:px-0">`).

`min-h-[30px]` (başlık) ve `min-h-[15px]` (renk etiketi) değerlerine DOKUNMA — bunlar bilinçli olarak
eklenmiş, farklı satır sayılı başlıklı ürünler yan yana geldiğinde fiyat satırlarının aynı hizada kalmasını
sağlıyor; kaldırılırsa hizalama bozulur.

Sadece şu iki margin değerini küçült:
1. Renk etiketi `<p>` elemanının class'ında `mt-1` → `mt-0.5` yap.
2. Fiyat satırının sarmalayıcı `<div>`'inde `mt-2` → `mt-1` yap.

Test:
1. `npx tsc --noEmit` ve `npm run build` hatasız geçmeli.
2. Playwright ile hem mobil (375-390px) hem masaüstü (1280px) ekran görüntüsü al: başlık-fiyat arası
   boşluğun daha az olduğunu, ama tek satırlı ve iki satırlı başlıklı iki ürün yan yana geldiğinde fiyat
   satırlarının HÂLÂ aynı hizada olduğunu (`getBoundingClientRect()` ile ölçerek) doğrula.

Bitince DEPLOY_STATUS.md'ye her zamanki formatta not düş. Commit'i öner ama onayım olmadan push etme.
```
