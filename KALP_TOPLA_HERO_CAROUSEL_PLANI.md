# Anasayfa Hero Carousel + Kalp Topla Hareketli Slaytı — Plan

Durum: Uygulandı (2026-11-09). Kullanıcı kararıyla plandan farklı: prefers-reduced-motion kontrolü yok, hover'da otomatik geçiş durmaz.

## Mevcut durum (kod incelendi)

- `src/app/(site)/page.tsx` içindeki hero tek bir statik görsel: `/hero-model.jpg`,
  üstte "2026 Sonbahar / Kış" etiketi, "Her gün için, her parça için" başlığı,
  "Keşfet" butonu. Metinler `.hero-reveal` (globals.css) ile aşağıdan kayarak giriyor.
- Mobilde metin sol-altta (`items-end`, `text-3xl`), masaüstünde altta ortalı
  (Release teması ölçüleri). Bu yerleşim kullanıcı onaylı, bozulmamalı.
- `embla-carousel-react` zaten package.json'da var: yeni paket gerekmiyor.
- Anasayfa ISR (`revalidate = 3600`), yani kişiye özel değil. Kalp Topla slaytı
  sadece `KalpToplaSettings.mode === "LIVE"` iken gösterilmeli
  (`getKalpSettings()`, `src/lib/kalp-topla/settings.ts`). Eşik ve indirim oranı
  da buradan (`threshold`, `discountPercent`) gelmeli, sabit yazılmamalı.

## Araştırma bulgusu: ChatGPT artık video üretmiyor

OpenAI Mart 2026'da Sora'yı kapatma kararı aldı; Sora uygulaması 26 Nisan 2026'da,
API 24 Eylül 2026'da kapandı ve ChatGPT içindeki video özelliği de kaldırıldı.
Görsel üretimi (resim) ChatGPT'de devam ediyor. Yani "ChatGPT ile hareketli görsel"
mümkün değil.

## Karar önerisi: Hareket kodla, fotoğraf ChatGPT ile

- ChatGPT ile **yazısız** bir arka plan fotoğrafı üretilir (masaüstü 16:9 + mobil 9:16).
- Hareket sitede kodla yapılır: yükselen kalpler + 10 parçalı bar'ın dolması +
  "%50" kilit açıldı vurgusu, döngü halinde.
- Neden video değil:
  - Çok hafif (birkaç KB CSS/SVG), mobilde video kadar veri yemez, LCP'yi bozmaz.
  - Yazılar keskin, Türkçe karakter hatası yok (yapay zekâ görsellerinde yazı sık bozulur).
  - Eşik/oran admin'den değişince animasyon da kendiliğinden güncellenir.
  - `prefers-reduced-motion` kullanıcılarında animasyon kapatılabilir.
- İleride gerçek video istenirse: ChatGPT fotoğrafı Google Veo (Gemini) veya Kling
  ile image-to-video yapılır; hero için sessiz, döngülü, 5-8 sn, 3 MB altı mp4/webm +
  poster görseli. Bu ilk sürümün kapsamı dışında.

## Carousel kuralları

- Slaytlar kod içinde bir dizi (ilk sürümde admin paneli yok, gerekirse sonra).
- Slayt 1: mevcut sezon hero'su (aynen). Slayt 2: Kalp Topla (yalnız LIVE iken).
- Tek slayt kalırsa carousel kontrolleri/otomatik geçiş hiç render edilmez.
- Otomatik geçiş 6 sn; fare üstündeyken, odakta ya da kullanıcı kaydırınca durur.
  WCAG 2.2.2 gereği görünür durdur/oynat butonu.
- Masaüstünde ok + nokta, mobilde kaydırma (swipe) + nokta.
- Sayfada tek `h1`: sadece ilk slayt; diğerleri `h2`.
- İlk slayt görseli `priority`, diğerleri lazy.
- Görseller `public/anasayfa/` altında statik dosya (Vercel function storage'ı etkilemez).

## Görsel dosyaları (kullanıcı ChatGPT'den indirip koyacak)

- `public/anasayfa/kalp-topla-desktop.jpg` (yatay, ~2400×1350)
- `public/anasayfa/kalp-topla-mobile.jpg` (dikey, 1080×1920)

ChatGPT promptları sohbette verildi; görsellerde yazı/logo yok, masaüstünde
özne sağda (sol taraf metin + bar için boş), mobilde özne üst yarıda (alt kısım boş).
