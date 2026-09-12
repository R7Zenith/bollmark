# Soft/Modern Tasarım Yönü — Araştırma ve Claude Code Promptu

## Referans ve hedef görünüm

Konuşmada birçok site denendi (Boyner, John Lewis, Nordstrom, Zalando,
ASOS) ama hepsi "kullanışlı ama soğuk/kalabalık" bulundu. Sonunda karar
verilen yön, aşağıdaki sitelerin ortak karakteri:

- **Aritzia.com** — ana referans. Nötr/soft renk paleti, bol boşluk,
  büyük ve sakin ürün fotoğrafları, agresif kampanya bandı yok.
- **Sezane.com** — editoryal/dergi hissi veren ürün fotoğrafçılığı,
  ince tipografi.
- **Away.com** — pastel/sıcak tonlar, az öğe, göz yormayan sayfa
  yoğunluğu.

Ortak payda: doygun olmayan renkler, büyük nefes alan görseller, az
sayıda ama büyük öğe, ince/hafif tipografi, agresif "İNDİRİM" bantları
yerine sakin vurgular.

## Mevcut durum (tailwind.config.ts incelendi)

İyi haber: mevcut renk paleti zaten bu yöne oldukça yakın başlamış —
sıfırdan değil, **üzerine inşa edilecek**:

```
ink:    #111111   (neredeyse siyah metin)
paper:  #faf9f7   (kırık beyaz zemin — Sezane/Aritzia'daki ton)
accent: #c9a24b   (sıcak gold — agresif kırmızı değil, iyi seçim)
line:   #e6e2da   (yumuşak bej ayraç rengi)
```

Font yapısı da uygun: `display` için serif (`var(--font-display)`) ve
`sans` için sistem fontu ayrılmış, `widest2` (0.25em) letter-spacing
token'ı zaten var — bu, editoryal/soft bir görünüm için doğru altyapı.

Eksik olan şey renk değil; **boşluk, oran, fotoğraf büyüklüğü ve
detay/mikro-etkileşim** kalitesi. Yani bu bir "yeniden renklendirme"
değil, mevcut paleti daha cömert ve sakin bir düzende kullanma işi.

İncelenen dosyalar: `src/app/(site)/page.tsx` (ana sayfa),
`src/components/product-card.tsx`, `src/components/site-header.tsx`,
`src/components/site-footer.tsx`, `tailwind.config.ts`. Üst menü
mega-menu yapısı ayrı bir planda (`UST_MENU_MEGA_MENU_PLANI.md`) zaten
tanımlı — kategori öncelikli (Kadın/Erkek/Aksesuar) yapı korunacak,
sadece görsel/boşluk tarafı yumuşatılacak.

## Önerilen tasarım yönü

1. **Tipografi**: Serif `display` fontu başlıklarda daha baskın
   kullanılsın (ürün adı, kategori başlığı, hero başlığı); `sans` gövde
   metninde ince/regular ağırlıkta kalsın. Büyük harf + geniş
   letter-spacing (`widest2`) kategori etiketlerinde ve "Yeni Sezon"
   gibi küçük başlıklarda kullanılsın — Sezane'deki editoryal hissi
   verir.
2. **Boşluk**: Mevcut spacing skalası muhtemelen standart Tailwind
   varsayılanı — bölümler arası (`section`) boşluk, ürün grid'i
   sütunlar arası boşluk (`gap`) ve kartların iç padding'i artırılsın.
   "Az öğe, büyük öğe" prensibi: mobilde bile ürün fotoğrafları küçük
   kalmasın.
3. **Köşe/gölge dili**: Sert köşe + ince border yerine yumuşak köşe
   (`rounded-xl`/`2xl`) ve çok hafif, yayılan gölge (`shadow-sm` /
   custom soft shadow) — kartlar ve butonlarda tutarlı kullanılsın.
4. **Ürün kartı**: Fotoğraf alanı büyütülsün, hover'da yumuşak bir
   geçiş (ikinci görsele soft fade veya hafif zoom, sert efekt değil),
   fiyat/isim arasında nefes alan boşluk, indirim rozeti varsa kırmızı
   yerine mevcut `accent` (gold) veya yumuşak nötr bir rozet stiliyle.
5. **Ana sayfa düzeni**: Büyük, sakin bir hero görseli + minimal metin
   üstte; altında kategori kısayolları yuvarlak köşeli büyük
   kartlar/görseller halinde (Kadın/Erkek/Aksesuar); ardından öne
   çıkan ürünler grid'i — kampanya bandı/pop-up hissi veren yoğun
   öğelerden kaçınılsın.
6. **Mega-menu paneli**: Fonksiyonu (kategori/cinsiyet filtreleme)
   `UST_MENU_MEGA_MENU_PLANI.md`'de tanımlandığı gibi kalsın, sadece
   panel görünümü yumuşatılsın: daha cömert padding, ince gölge, aktif
   link vurgusu kalın renk bloğu yerine ince alt çizgi/accent rengi.

## Claude Code'a verilecek prompt

```
Bollmark storefront'unun genel görünümünü "soft/modern, rahat alışveriş
hissi veren" bir yöne çekeceğiz. Referans aldığımız siteler Aritzia.com,
Sezane.com ve Away.com — ortak özellikleri: doygun olmayan renkler, bol
boşluk, büyük/sakin ürün fotoğrafları, agresif kampanya bandı yok, ince
tipografi. Bu bir yeniden renklendirme DEĞİL: mevcut palet (tailwind.config.ts
içindeki ink/paper/accent/line) zaten bu yöne yakın, onu koru. Asıl iş
boşluk/oran/detay kalitesini yükseltmek.

Değiştirmeden ÖNCE mevcut `tailwind.config.ts`, `src/app/(site)/page.tsx`,
`src/components/product-card.tsx`, `src/components/site-header.tsx` ve
`src/components/site-footer.tsx` dosyalarını incele, mevcut yapıyı bozma
(fonksiyonellik, veri çekme, mega-menu kategori/cinsiyet filtreleme mantığı
aynen kalsın).

### 1. tailwind.config.ts — boşluk/köşe/gölge token'ları ekle

`theme.extend` içine (mevcut colors/fontFamily/letterSpacing'i SİLME):
- `borderRadius`: kartlar ve butonlar için `xl`/`2xl` değerlerini
  standartlaştıracak bir token seti (gerekirse Tailwind'in varsayılanı
  yeterliyse yeni token eklemene gerek yok, ama kod genelinde tutarlı
  `rounded-xl`/`rounded-2xl` kullanımı sağla).
- `boxShadow`: `soft: "0 8px 30px -12px rgba(17,17,17,0.08)"` gibi çok
  hafif, yayılan bir gölge token'ı ekle.
- Gerekirse `spacing` içine büyük bölüm boşlukları için ek token (örn.
  `section: "6rem"`) ekle.

### 2. Ana sayfa (`src/app/(site)/page.tsx`)

- Hero bölümünü büyüt: tam genişlik, büyük görsel + üstte minimal
  başlık (serif `display` font, geniş letter-spacing küçük bir üst
  etiketle — örn. "YENİ SEZON").
- Kategori kısayolları (Kadın/Erkek/Aksesuar) yuvarlak köşeli
  (`rounded-2xl`), büyük görselli kartlar halinde, aralarında cömert
  boşluk (`gap-6`/`gap-8`).
- Öne çıkan ürün grid'i: sütun sayısını mobilde 2, masaüstünde 3-4'e
  sabitle, kartlar arası boşluğu artır (`gap-6` veya üstü).
- Var olan yoğun/kalabalık banner alanlarını sadeleştir, gereksiz
  metin bloklarını azalt.

### 3. Ürün kartı (`src/components/product-card.tsx`)

- Görsel alanının en-boy oranını büyüt/tutarlılaştır (örn. 3:4),
  `rounded-xl` köşe ver.
- Hover durumunda (varsa ikinci görsel) yumuşak `transition-opacity`
  veya hafif `scale-105` — ani/sert efekt yok, `duration-300 ease-out`.
- Fiyat/ürün adı arasındaki boşluğu artır, indirim rozetini (varsa)
  kırmızı yerine `bg-accent/10 text-accent` gibi yumuşak bir stile
  çevir.

### 4. Header ve mega-menu (`src/components/site-header.tsx`)

- Header'a hafif `shadow-soft` (yeni token) veya çok ince `border-line`
  alt çizgi, arka plan `bg-paper`.
- Mega-menu panelinin padding'ini artır, `rounded-2xl` + `shadow-soft`
  ver, aktif kategori/cinsiyet vurgusunu kalın renk bloğu yerine ince
  alt çizgi (`border-b-2 border-accent`) ile yap.
- Mevcut kategori/cinsiyet filtreleme mantığına DOKUNMA, sadece görsel
  sınıfları güncelle.

### 5. Footer (`src/components/site-footer.tsx`)

- Aynı boşluk/tipografi diliyle sadeleştir, gereksiz görsel yoğunluk
  varsa azalt.

### 6. Test

1. `npx tsc --noEmit` ve `npm run build` hatasız tamamlanmalı.
2. Geçici bir scratchpad dizininde Playwright ile yerel dev sunucuyu
   çalıştır, 1280px ve 375px genişliklerde ana sayfa, ürün listeleme ve
   ürün detay sayfalarının öncesi/sonrası ekran görüntülerini al.
3. Mega-menu ve kategori filtrelemenin (cinsiyet dahil) hâlâ doğru
   çalıştığını doğrula — bu prompt'un amacı SADECE görsel/boşluk
   iyileştirmesi, fonksiyon değişikliği değil.
4. Bulguları ve ekran görüntülerini özetle paylaş.

Commit'i mesajıyla birlikte öner ama benim onayım olmadan push etme.
```
