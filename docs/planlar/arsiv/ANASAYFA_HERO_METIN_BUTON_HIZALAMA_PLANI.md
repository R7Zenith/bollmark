# Anasayfa Hero — Metin/Buton Hizalama (Release'e Birebir Uyum) Planı

Bu dosya, anasayfadaki ilk (tam ekran) hero bölümünün metin bloğu ve
"Keşfet" butonunun konumunu Shopify "Release" temasının canlı demosuyla
(release-main.myshopify.com) **birebir aynı** yapmak için çıkarılan plandır.
Değerler tahmini değil — demo tarayıcıyla açılıp `getComputedStyle` /
`getBoundingClientRect` ile 390px (mobil), 749px (mobil eşik), 1024px ve
1600px (masaüstü) genişliklerde ölçülüp doğrulandı; görsel karşılaştırma
kullanıcının gönderdiği iki ekran görüntüsüyle de teyit edildi.

## 1. Release'de ölçülen gerçek değerler

### 1.1 Yapı

Hero içerik bloğunun (`.hero__content`) sınıfı şu:

```
align-center text-center justify-end
align-center--mobile text-center--mobile justify-center--mobile
```

Yani üç metin öğesi (eyebrow etiket → başlık → buton) her zaman **dikey bir
flex kolonu** içinde, **her zamanyatay ortalanmış** (`align-items: center`,
`text-align: center`) duruyor. Değişen tek şey **dikey konum**:

- **Masaüstü (≥750px): `justify-content: flex-end`** — blok kutunun ALTINA
  yaslanıyor (dikey ortalanmıyor).
- **Mobil (≤749px): `justify-content: center`** — blok kutunun ortasında.

Bu, Bollmark'ın şu anki mantığının **tam tersi**: Bollmark'ta mobilde
`items-end` (alta yaslı) + masaüstünde `md:items-center` (dikey ortalı)
kullanılıyor — geçmişte kullanıcı geri bildirimiyle bilinçli değiştirilmişti
(bkz. `page.tsx` içindeki yorum), ama Release referansı tam tersini yapıyor.
Bu plan Release'e birebir uyumu hedeflediği için mobil/masaüstü mantığını
**tersine çeviriyor**.

### 1.2 Ölçülen değerler (viewport genişliğine göre)

| Viewport | `justify-content` | İç dolgu (padding) | Başlık font-size / line-height |
|---|---|---|---|
| 390px (mobil) | `center` | `89px 24px 64px` (üst/yan/alt) | 47px / 47px, letter-spacing -1.88px |
| 749px (mobil eşiği) | `center` | `89px 24px 64px` | ~47–61px arası (fluid) |
| 1024px | `flex-end` | `97px 54px 64px` | 61px / 61px |
| 1600px (masaüstü) | `flex-end` | `97px 54px 64px` | 80px / 80px, letter-spacing -3.2px |

Notlar:
- Alt boşluk (`padding-bottom: 64px`) **hem mobilde hem masaüstünde sabit
  64px** — viewport'a göre değişmiyor. Bu, butonun alt kenardan her zaman
  tam 64px yukarıda durmasını sağlıyor (1600px'te ölçülen: buton alt
  kenarı = hero alt kenarından 64px yukarıda, birebir).
- Üst/yan dolgu masaüstünde `97px 54px`, mobilde `89px 24px` — breakpoint
  750px'de (standart Dawn/Release kırılma noktası) değişiyor.
- Başlık font-size viewport'a göre akıcı (fluid/clamp) ölçekleniyor: 390px'te
  47px, 1024px'te 61px, 1600px'te 80px. Line-height her zaman font-size'a
  eşit (1:1 satır yüksekliği), letter-spacing negatif ve boyutla orantılı
  büyüyor (mobil -1.88px → masaüstü -3.2px).

### 1.3 Üç metin öğesi (ölçülen detaylar)

1. **Eyebrow etiket** (`.hero__subheading`, örn. "SS26 STATEMENT PIECES"):
   `font-size: 12px`, `letter-spacing: 2px`, `line-height: 15px`,
   `text-transform: uppercase`, `margin-top: 12px`, `margin-bottom: 28px`,
   renk beyaz. Boyut mobil/masaüstü aynı, sadece üstündeki `margin-top: 12px`
   ile eyebrow'un üstünde küçük bir boşluk var (kolonun en üstünde ama
   flex-end'de olduğu için pratikte görünmüyor, mobilde göze çarpabilir).
2. **Başlık** (`.hero__heading p`, örn. "Bold by design"): yukarıdaki tablo,
   `font-weight: 400` (kalın değil — ince/normal ağırlık), `margin-bottom:
   20px`.
3. **Buton** (`.hero__button a`, "Discover More" / "DISCOVER MORE"):
   **outline stil** (`background: transparent`, `border: 1px solid
   rgb(255,255,255)`, `border-radius: 50px` — tam yuvarlak hap), `padding:
   16px 24px`, `font-size: 10px`, `letter-spacing: 1px`, `text-transform:
   uppercase`. **Bollmark'ta şu an dolu/beyaz arka planlı buton var — Release
   referansı sadece ince beyaz çerçeveli, şeffaf arka planlı.** (Ekran
   görüntüsünde beyaz dolu görünmesi ilk bakışta yanıltıcı olabilir ama
   `getComputedStyle` ile doğrulandı: `background-color: rgba(0,0,0,0)`.)

## 2. Bollmark'ın şu anki durumu (`src/app/(site)/page.tsx`, satır 62-84)

```tsx
<section className="relative flex min-h-screen items-end overflow-hidden bg-ink text-cream md:items-center">
  ...
  <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-14 md:pb-0">
    <p className="text-[10px] uppercase tracking-widest2 text-cream/70 md:text-xs">2026 Sonbahar / Kış</p>
    <h1 className="mt-2 max-w-[13rem] font-display text-3xl font-light leading-[1.05] md:mt-6 md:max-w-3xl md:text-8xl md:leading-[0.95]">
      Her gün için, her parça için
    </h1>
    <Link href="/urunler" className="mt-5 inline-flex items-center rounded-full bg-cream px-6 py-2.5 text-xs uppercase tracking-wide text-ink transition hover:bg-clay hover:text-cream md:mt-10 md:px-8 md:py-3.5 md:text-sm">
      Keşfet
    </Link>
  </div>
</section>
```

Fark listesi:

- Metin bloğu **sola yaslı** (`text-left` varsayılan, ortalanmamış) — Release
  her zaman `text-center` + yatay ortalı.
  Ayrıca dış sarmalayıcı `mx-auto w-full max-w-7xl px-6` ile sabit genişlikte
  bir container'a oturuyor; içindeki metin o container'ın SOL kenarına
  yaslanıyor. Release'de ise böyle bir container yok — metin bloğu tüm hero
  genişliğinde ortalanıyor.
- Dikey konum mantığı ters: Bollmark mobilde alt (`items-end`), masaüstünde
  orta (`md:items-center`); Release mobilde orta, masaüstünde alt.
- Buton dolu/beyaz arka planlı (`bg-cream`); Release'de şeffaf + ince beyaz
  çerçeveli (outline).
- Alt boşluk (`pb-14` mobil / `pb-0` masaüstü) sabit 64px değil, Tailwind
  adımlarına (`pb-14` = 56px) denk düşüyor ve masaüstünde `items-center`
  olduğu için zaten alta yaslı değil.

## 3. Önerilen değişiklik (öneri — nihai karar kullanıcıda)

**Kapsam notu: kullanıcı mobilde değişiklik istemedi.** Mobildeki mevcut
hali (sol-alta yaslı metin, dolu beyaz buton, mevcut boşluklar/font
boyutları) AYNEN korunacak. Aşağıdaki değişiklikler sadece **masaüstü
(`md:` ve üzeri) breakpoint'inde** uygulanacak; mobil (`md:` öncesi)
sınıflarına dokunulmayacak.

1. Masaüstünde metin bloğunu `mx-auto max-w-7xl` container'ından çıkarıp
   hero'nun tam genişliğinde **yatayda ortalı** (`md:items-center` +
   `md:text-center`) yapmak. Mobil sınıflar (container, sol hizalama)
   olduğu gibi kalır.
2. Masaüstünde dikey hizalamayı alta yaslamak: `md:justify-end` /
   `md:items-end` (şu anki `md:items-center` yerine) — Release ile birebir.
   Mobildeki `items-end` zaten değişmiyor.
3. Masaüstü iç dolgusunu Release'deki gibi ayarlamak:
   `md:pt-[97px] md:px-[54px] md:pb-16` (64px ≈ `pb-16`). Mobil `px-6 pb-14`
   dolgusu değişmez.
4. Butonu **sadece `md:` breakpoint'inde** outline/şeffaf stile çevirmek:
   `md:border md:border-cream md:bg-transparent md:text-cream
   md:hover:bg-cream md:hover:text-ink`, dolgu `md:px-8 md:py-3.5` gibi
   Release'in `16px 24px`'ine yakın bir değer. Mobildeki mevcut dolu beyaz
   buton (`bg-cream`, `text-ink`) aynen kalır.
5. Başlık font-size'ı: mobil (`text-3xl`) dokunulmaz; masaüstü
   (`md:text-8xl`) zaten Release'in ~80px ölçeğine yakın, gerekirse ince
   ayar yapılabilir.
6. Koddaki mevcut açıklama yorumu, artık sadece masaüstü davranışının
   Release'e göre değiştiğini, mobilin kasıtlı olarak dokunulmadan
   bırakıldığını belirtecek şekilde güncellenmeli.

Asıl istenen "ortaya ve alta doğru hizalama" — sadece masaüstünde — 1-4 ile
karşılanıyor.

## 4. Claude Code için hazır prompt

Aşağıdaki promptu olduğu gibi Claude Code'a verebilirsiniz:

---

`src/app/(site)/page.tsx` dosyasındaki ilk hero `<section>`'ını (satır ~62-84,
"Tam ekran hero" yorumuyla başlayan blok) Shopify "Release" temasının canlı
demosundaki (release-main.myshopify.com) hero ile **SADECE MASAÜSTÜNDE
(`md:` ve üzeri breakpoint)** birebir aynı metin/buton hizalamasına getir.
**Mobil görünüme (md: öncesi) HİÇ DOKUNMA** — mobildeki mevcut sol-alta
yaslı metin, mevcut dolu beyaz buton, mevcut boşluklar ve font boyutları
aynen kalacak; sadece `md:` ve üzeri sınıfları değiştir/ekle.

Ölçülen referans değerler (masaüstü, ≥750px):

- İçerik bloğu masaüstünde **yatayda ortalı** (`md:text-center`,
  `md:items-center`) olmalı; sabit `max-w-7xl` container'ın masaüstü
  davranışını buna göre ayarla (metin container'ın solunda değil, hero'nun
  tam genişliğinde ortalanmalı). Mobil sınıflar aynı kalsın.
- Dikey hizalama masaüstünde **alta yaslı** olmalı: `md:justify-end` /
  `md:items-end` (şu anki `md:items-center` yerine). Mobildeki `items-end`
  zaten aynı yönde olduğu için mobil davranışta fark yaratmıyor, sadece
  masaüstü sınıfını değiştir.
- Masaüstü iç dolgusu: üst ~97px / yan ~54px / alt 64px
  (`md:pt-[97px] md:px-[54px] md:pb-16`). Mobil dolgu (`px-6 pb-14`)
  değişmeyecek.
- Buton ("Keşfet") **sadece masaüstünde** outline/şeffaf olmalı: şeffaf
  arka plan, ince beyaz (`cream`) çerçeve, tam yuvarlak (`rounded-full`),
  hover'da içi dolabilir (`md:border md:border-cream md:bg-transparent
  md:text-cream md:hover:bg-cream md:hover:text-ink`). Mobildeki mevcut
  dolu beyaz buton (`bg-cream`, `text-ink`) AYNEN kalacak — bunu masaüstü
  varyantıyla override et, mobil sınıfları silme.
- Başlık ve eyebrow etiket font boyutlarına mobilde dokunma; masaüstü
  (`md:text-8xl`) zaten Release'in ~80px ölçeğine yakın, gerekirse orada
  ince ayar yapılabilir.

Değişikliği yaptıktan sonra hem mobil (≈390px — DEĞİŞMEDİĞİNİ doğrulamak
için) hem masaüstü (≥1280px) genişlikte görsel olarak kontrol et (ekran
görüntüsü al), koddaki açıklama yorumunu güncelle (artık sadece masaüstünün
Release'e göre değiştiğini, mobilin kasıtlı olarak dokunulmadığını belirt),
ve iş bitince her zamanki gibi `DEPLOY_STATUS.md`'ye not düş.

---

## 6. Doğrulama notu — plan Claude Code'a verildi ama UYGULANMADI (yanlış "zaten yapılmış" cevabı)

Kullanıcı bu planı Claude Code'a verdi, Claude Code "zaten yapılmış" dedi.
Bu kontrol edildi ve **doğru değil**: `src/app/(site)/page.tsx` dosyası
plan verilmeden önceki haliyle **bayt bayt aynı** (değişiklik zamanı
değişmemiş, satır 62-84 hâlâ eski hali — `md:items-center`, `bg-cream` dolu
buton, `mx-auto max-w-7xl` container). `DEPLOY_STATUS.md`'de de bu işe dair
hiçbir not yok (son giriş tamamen alakasız bir konu — ürün kartı beden
seçim popover'ı). Yani Claude Code muhtemelen dosyayı okumadan veya
Bollmark'ın Release'e zaten yeterince yakın olduğunu varsayarak yanlış
cevap verdi.

**Claude Code'a verilecek düzeltme promptu:**

---

Az önce verdiğim "Anasayfa Hero — Metin/Buton Hizalama" planını "zaten
yapılmış" dedin ama kontrol ettim: `src/app/(site)/page.tsx` dosyası hâlâ
eski hali — satır 62-84'te hâlâ `md:items-center`, `bg-cream` dolu buton,
`mx-auto max-w-7xl` container duruyor, hiçbiri değişmemiş. Lütfen önce bu
dosyayı gerçekten aç ve şu anki 62-84. satırları bana göster, sonra planı
GERÇEKTEN uygula (sadece `md:` ve üzeri sınıfları değiştir, mobile
dokunma). Bitince diff'i göster ve `DEPLOY_STATUS.md`'ye not düş.

---

## 5. Kaynaklar

- Canlı referans: https://release-main.myshopify.com/ (hero bölümü,
  `.hero-banner` / `.hero__content` / `.hero__heading` / `.hero__button`
  sınıfları, tarayıcı ile `getComputedStyle` kullanılarak ölçüldü).
- Bollmark mevcut kod: `src/app/(site)/page.tsx`, satır 62-84.
- Kullanıcının gönderdiği iki ekran görüntüsü (Release hero vs Bollmark
  hero) — görsel karşılaştırma için kullanıldı.
