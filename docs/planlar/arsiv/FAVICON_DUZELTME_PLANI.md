# Favicon Düzeltme Planı

## Sorun
Tarayıcı sekmesinde favicon net/doğru çıkmıyor. İncelemede şunlar görüldü:

- `public/` klasöründe sadece `logo.png` ve `logo-white.png` var (tam "bollmark" yazı logosu, "R" işaretli). Ayrı bir ikon/favicon dosyası (favicon.ico, icon.png vb.) yok.
- `src/app/` altında kök `layout.tsx` yok; proje 3 ayrı kök layout kullanıyor (route group'lar her biri kendi `<html>` etiketini basıyor):
  - `src/app/(site)/layout.tsx` — asıl mağaza
  - `src/app/(admin)/layout.tsx` — yönetim paneli
  - `src/app/(gate)/layout.tsx` — giriş/gate sayfası
- Hiçbirinde `metadata.icons` tanımlı değil, ve Next.js'in otomatik `icon.png`/`favicon.ico` dosya convention'ı da kullanılmıyor.
- Next.js favicon bulamayınca tarayıcı kendi varsayılan/bulanık ikonunu gösteriyor — kullanıcının "favicon sıkıntılı çıkıyor" dediği şey bu.

## Önerilen Çözüm
1. Logodaki ilk harf olan küçük "b" harfini (wordmark'ın başındaki kısım) ayrı bir kare ikon olarak kırp. Favicon'da tüm "bollmark" yazısı okunmaz, tek başına "b" harfi hem daha tanınır hem küçük boyutta (16x16, 32x32) daha net görünür.
2. Kırpılan "b" etrafında yeterli boşluk (padding) bırak ki 16x16 boyutta bile kesilmeden görünsün.
3. Birden fazla boyut/format üret:
   - `favicon.ico` (16x16, 32x32, 48x48 multi-size)
   - `icon.png` (32x32 veya 48x48, PNG, şeffaf arka plan)
   - `apple-icon.png` (180x180, iOS için — şeffaf değil, arka plan rengi olmalı çünkü iOS şeffaflığı siyaha çeviriyor)
   - `icon-512.png` (PWA/manifest için, opsiyonel)
4. Proje 3 ayrı kök layout kullandığı için Next.js'in "app klasörüne icon.png koy otomatik bağlansın" convention'ı **tek başına yeterli değil** (o convention dosyanın bulunduğu segment'e özel çalışır, `src/app/` kökünde layout olmadığı için). En sağlam yöntem: `public/` klasörüne favicon dosyalarını koyup her 3 layout'ta da `metadata.icons` alanını açıkça tanımlamak (ortak bir `metadata.ts`/sabit üzerinden tekrar kullanılabilir).
5. Renk: Logonun siyah versiyonu (`logo.png`) kullanılabilir; açık/koyu tema sekmelerinde okunabilirlik için arka planı şeffaf PNG + gerekirse koyu bir daire/kare arka plan denenebilir. Gerçek görsel çıktıyı üretip göz kontrolü yapmak lazım.

## Claude Code İçin Prompt

> Bollmark projesinde favicon eksik/hatalı görünüyor. `public/logo.png` dosyasındaki "bollmark" yazı logosunun başındaki küçük "b" harfini kullanarak favicon seti oluşturmanı istiyorum.
>
> Yapman gerekenler:
> 1. `public/logo.png` içinden sadece ilk "b" harfini (wordmark'ın soldaki ilk glифi) kırp. Kırpma işlemini Node.js `sharp` paketiyle (yoksa `npm install sharp --save-dev`) veya ImageMagick ile yap. Harfin etrafında ~%15-20 padding bırak, kare (1:1) canvas'a otur.
> 2. Bu kareden şu dosyaları üret ve `public/` klasörüne koy:
>    - `favicon.ico` (16x16 + 32x32 + 48x48 çok boyutlu ico)
>    - `icon.png` (48x48, şeffaf arka plan)
>    - `apple-icon.png` (180x180, arka planı beyaz veya markanın açık rengiyle doldur — şeffaf olmasın)
>    - `icon-512.png` (512x512, PWA/manifest için, şeffaf arka plan)
> 3. `src/app/(site)/layout.tsx`, `src/app/(admin)/layout.tsx`, `src/app/(gate)/layout.tsx` dosyalarındaki `metadata` (gate'te metadata export yoksa ekle) alanına `icons` ekle:
>    ```ts
>    icons: {
>      icon: [
>        { url: "/icon.png", type: "image/png", sizes: "48x48" },
>        { url: "/favicon.ico", sizes: "any" }
>      ],
>      apple: [{ url: "/apple-icon.png", sizes: "180x180" }]
>    }
>    ```
>    Tekrarı önlemek istersen ortak bir `src/lib/site-metadata.ts` içinde `siteIcons` sabiti tanımlayıp 3 layout'ta da import edip kullanabilirsin.
> 4. `npm run build` çalıştırıp hata olmadığını doğrula.
> 5. Yerel sunucuyu ayağa kaldırıp (`npm run dev`) tarayıcıda `/`, `/hesap` (site), admin ve gate rotalarında sekme ikonunun göründüğünü kontrol et; ekran görüntüsü almana gerek yok, sadece build/lint hatasız geçsin yeterli.
> 6. İşin sonunda her zamanki gibi `DEPLOY_STATUS.md` dosyasına yaptıklarını not düş.

## Notlar
- Kırpma sonucunu (üretilen `icon.png`/`favicon.ico`) gözle kontrol etmek gerekiyor — "b" harfinin gövdesi biraz ince/uzun olduğu için çok küçük boyutlarda (16x16) hafif kalınlaştırma/optik düzeltme gerekebilir. Claude Code sonucu paylaşırsa göz atıp gerekirse ince ayar istenebilir.
- Alternatif: "b" yerine marka simgesi olarak sağ üstteki "®" olmadan sade "b" + yuvarlak arka plan (marka rengi) da denenebilir; ilk denemeden memnun kalınmazsa bu seçenek konuşulabilir.
