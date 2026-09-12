# Soft/Modern Tasarım — V2 (Radikal Görünüm Değişikliği)

Bu dosya `SOFT_MODERN_TASARIM_YONU_PLANI.md`'nin YERİNE geçer.

## Neden ilk deneme fark yaratmadı?

Gerçek kod incelendi (`src/app/(site)/page.tsx`, `product-card.tsx`,
`site-header.tsx`). Ortaya çıkan şey: site zaten önceki bir oturumda
`rounded-2xl`, `shadow-soft`, `py-section`, yumuşak `accent/10` rozetler,
serif `font-display` gibi "soft" izler taşıyor hale getirilmiş. Yani ilk
promptumuz zaten var olan şeyi tekrar istemiş oldu — bu yüzden görünürde
neredeyse hiçbir şey değişmedi. Sorun palet/köşe/gölge değil; **genel
kompozisyon, oran ve görsel kimlik hâlâ jenerik** duruyor (ortalanmış tek
sütun hero, standart 3 eşit sütun grid, altın/gold `accent` rengi, stok
Unsplash görselleri). Aritzia'ya benzemesi için ince ayar değil, **kod
seviyesinde büyük bir kısmın silinip yeniden yazılması** gerekiyor.

Bu V2 planı, Claude Code'un yorum payını en aza indirmek için somut renk
kodları, somut piksel/rem değerleri ve neredeyse hazır JSX blokları
içeriyor. Aşağıdaki prompt'u aynen ver.

## Yeni görsel kimlik (net kararlar — tartışmaya açık değil)

**Renk paleti** — mevcut `accent` (altın #c9a24b) TAMAMEN kaldırılıyor,
yerine daha sakin/toprak bir vurgu rengi geliyor:

```
cream:  #f3ede3   (ana zemin — mevcut "paper"tan belirgin daha sıcak/koyu)
ink:    #1c1917   (neredeyse siyah, sıcak ton — mevcut ink'ten biraz daha sıcak)
clay:   #a9765a   (vurgu rengi — toprak/kiremit tonu, altın değil)
stone:  #8a8478   (ikincil metin/ayraç rengi)
line:   #e2dcd0   (ayraç — cream'e uyumlu)
```

`tailwind.config.ts`'te `accent` yerine `clay` kullan, `paper` yerine
`cream` kullan (isim değişikliği kasıtlı — kodda `accent`/`paper` geçen
HER yeri `clay`/`cream` ile değiştir, eskisini bırakma).

**Tipografi** — hero başlığı ÇOK daha büyük ve iddialı olacak
(`text-6xl md:text-8xl`, `font-light`, `leading-[0.95]`), gövde
metinlerde büyük harf yerine normal cümle düzeni ağırlıklı kullanılacak
(şu an her yerde `uppercase tracking-wide` var, bu çok kullanılınca
"kurumsal katalog" hissi veriyor — sadece nav ve küçük etiketlerde kalsın,
ürün adı/başlıklarda KALDIR).

**Buton dili** — pill/border buton (`rounded-full border`) yerine iki
stil: birincil aksiyon = düz dolu dikdörtgen (`bg-ink text-cream`, köşe
`rounded-none` veya çok hafif `rounded-sm`), ikincil aksiyon = alt çizgili
düz metin + ok ikonu (`underline underline-offset-4` + `→`). Pill buton
tamamen kaldırılıyor.

**Kompozisyon** — eşit 3 sütunlu grid'ler yerine ASİMETRİK düzen: büyük
+ küçük blok kombinasyonu (bkz. aşağıdaki JSX).

## Claude Code'a verilecek prompt

```
Bollmark storefront'unun görsel kimliğini KÖKTEN değiştireceğiz. Önceki bir
oturumda "soft/modern" yönünde küçük ayarlar yapılmış (rounded-2xl,
shadow-soft, accent/10 rozetler) ama sonuç hâlâ jenerik duruyor — bu görev
o küçük ayarların devamı DEĞİL, üzerine yazılması. Aşağıdaki talimatları
harfiyen uygula, "zaten buna benziyor" diye atlama.

KABUL KRİTERİ: Değişiklik bittiğinde öncesi/sonrası ekran görüntüsü yan
yana konduğunda birbirinden belirgin şekilde farklı görünmeli (renk paleti,
tipografi ölçeği, düzen). Sadece class isimlerinde kozmetik oynama YETMEZ.

### 1. tailwind.config.ts — renk sistemini değiştir

`colors` bloğunda: `accent` (#c9a24b) ve `paper` (#faf9f7) token'larını
KALDIR, yerlerine ekle:
  cream: "#f3ede3"
  ink: "#1c1917"
  clay: "#a9765a"
  stone: "#8a8478"
  line: "#e2dcd0"
(admin-* token'larına dokunma, onlar ayrı bir panel için.)

Sonra REPO GENELİNDE `bg-paper`→`bg-cream`, `text-paper`→`text-cream`,
`border-paper`→`border-cream`, `bg-accent`/`text-accent`/`border-accent`
→ `bg-clay`/`text-clay`/`border-clay` şeklinde TÜM kullanımları değiştir
(grep ile `paper` ve `accent` geçen her dosyayı bul — muhtemelen
site-header.tsx, product-card.tsx, page.tsx, site-footer.tsx ve admin
DIŞINDAKİ diğer storefront bileşenleri).

### 2. Ana sayfa hero (`src/app/(site)/page.tsx`)

Şu anki hero'yu (h-[90vh], ortalanmamış alt-sol yerleşim) şu şekilde
değiştir: tam viewport genişliği/yüksekliği (min-h-screen), başlık çok
daha büyük ve düzen ortaya çekilsin:

```tsx
<section className="relative flex min-h-screen items-center overflow-hidden bg-ink text-cream">
  <Image src="..." alt="..." fill priority className="object-cover opacity-60" />
  <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
    <p className="text-xs uppercase tracking-widest2 text-cream/70">2026 Sonbahar / Kış</p>
    <h1 className="mt-6 max-w-3xl font-display text-6xl font-light leading-[0.95] md:text-8xl">
      Her gün için, her parça için
    </h1>
    <Link href="/urunler" className="mt-10 inline-flex items-center gap-2 border-b border-cream pb-1 text-sm uppercase tracking-wide transition hover:gap-3">
      Koleksiyonu Keşfet <span aria-hidden>→</span>
    </Link>
  </div>
</section>
```

Kategori kısayolları bölümünü eşit 3 sütun yerine ASİMETRİK yap: sol
tarafta 1 büyük dikey kart (2 satır yüksekliğinde), sağda üst üste 2 küçük
kart. `grid grid-cols-2 grid-rows-2 gap-4` ile ilk kartı `row-span-2`
yaparak bunu elde et. Kart içindeki köşeleri `rounded-none` yap (yumuşak
köşe artık burada kullanılmıyor, sadece ürün kartlarında kalıyor) ve etiket
stilini büyük harften çıkarıp `font-display text-3xl font-light` yap.

Öne Çıkanlar grid'ini `md:grid-cols-3`'ten `md:grid-cols-4`'e çıkar, gap'i
küçült (`gap-x-4 gap-y-10`) — Aritzia'daki gibi daha yoğun ama düzenli bir
ürün duvarı hissi ver.

"Hikayemiz" bölümündeki `rounded-2xl` görseli `rounded-none` yap, bu
bölümün arka planını `bg-white`den `bg-cream`e çevir.

### 3. Ürün kartı (`src/components/product-card.tsx`)

- İndirim rozetini `bg-clay/10 text-clay`, "Stokta Yok" rozetini aynı
  paletle güncelle.
- Hover davranışını `scale-105`den, varsa ikinci ürün görseline geçiş
  yapan bir `opacity` çaprazlamasına çevir (ikinci görsel yoksa mevcut
  scale efektini koru).
- Ürün adını `uppercase tracking-wide` yerine normal cümle düzeni
  (`text-sm text-ink`) yap — sadece kategori/etiket metinlerinde büyük
  harf kalsın.

### 4. Header (`src/components/site-header.tsx`)

- Header arka planını `bg-paper/90 backdrop-blur`den düz `bg-cream`e,
  gölgeyi kaldır (`shadow-soft` çıkar), sadece ince `border-b border-line`
  kalsın — çok daha "flat" ve sakin bir üst menü.
- Mega-menu panellerinde (`GenderPanel`, `AksesuarPanel`) sağdaki görsel
  alanını (`w-64`) büyüt (`w-80`), `rounded-xl` yerine `rounded-none`
  kullan, panel arka planını `bg-cream` yap.
- Sepet butonundaki `rounded-full border` pill stilini kaldır, düz
  `bg-ink text-cream px-4 py-2` dikdörtgen buton yap.
- Tüm `accent`/`paper` referanslarını adım 1'deki gibi değiştirmeyi
  unutma (bu dosyada çok sayıda var).

### 5. Footer (`src/components/site-footer.tsx`)

Aynı palet değişikliklerini uygula, `bg-white`yi `bg-cream`e çevir.

### 6. Test

1. `npx tsc --noEmit` ve `npm run build` hatasız tamamlanmalı.
2. `grep -rn "accent\|paper" src/` çalıştırıp storefront tarafında (admin
   hariç) hiç eski token kalmadığını doğrula.
3. Playwright ile 1280px ve 375px genişlikte ana sayfa, ürün listeleme ve
   ürün detay sayfalarının ÖNCESİ/SONRASI ekran görüntülerini al, yan yana
   karşılaştır — belirgin bir fark yoksa (yukarıdaki KABUL KRİTERİ) işi
   bitmiş sayma, eksik kalan adımı tamamla.
4. Mega-menu ve kategori/cinsiyet filtrelemesinin hâlâ çalıştığını
   doğrula — bu görev görsel, fonksiyon değişmiyor.
5. Bulguları ve ekran görüntülerini özetle paylaş.

Commit'i mesajıyla birlikte öner ama benim onayım olmadan push etme.
```
