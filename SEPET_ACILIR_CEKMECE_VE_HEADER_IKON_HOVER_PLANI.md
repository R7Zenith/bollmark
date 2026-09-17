# Sepet Açılır Çekmece (Cart Drawer) + Header İkon Hover Animasyonu — Araştırma ve Uygulama Planı

Kaynak: release-main.myshopify.com/products/top-13 (17 Eylül 2026, canlı sayfa üzerinde
Chrome DevTools/computed style ile ölçüldü — tahmin YOK, tüm değerler gerçek). Ekran
görüntüsü kullanıcı tarafından iletildi (ürün sayfasında sağdan açılan "Your cart" paneli).

## Tespit edilen sorun (2 ayrı iş)

1. Header'daki sepet ikonuna basılınca `/sepet` sayfasına dümdüz yönlendiriyoruz
   (`site-header.tsx` satır 611: `<Link href="/sepet">`). Release'de bu buton sayfa
   değiştirmiyor, sağdan kayarak açılan bir "cart drawer" (çekmece panel) açıyor;
   detaylı sepet sayfasına gitmek isteyen oradaki "Sepeti Görüntüle" linkine basıyor.
2. Header'daki arama/hesap/sepet ikonlarında üst menüde kullandığımız `.nav-underline`
   hover alt-çizgi animasyonu yok — sadece `hover:text-clay` ile renk değişiyor
   (bkz. `linkClassName`'siz üç ayrı `<Link>`, satır 592-618).

## Release'den ölçülen cart drawer — birebir teknik döküm

### DOM iskeleti (canlı HTML'den, kısaltılmadan)

```html
<cart-drawer class="is-visible">
  <div class="color-scheme-1 gradient">
    <div class="cart-drawer" id="sections--...__cart-drawer">
      <div class="cart-drawer__inner" role="dialog" aria-modal="true" aria-label="Your cart" tabindex="-1">
        <div class="cart-drawer__head">
          <p class="cart-drawer__title h4">Your cart<span class="cart-drawer__title-counter">1</span></p>
          <button class="cart-drawer__close" aria-label="Close">...</button>
        </div>
        <cart-drawer-items>
          <div class="cart-drawer__items">
            <div class="cart-item">
              <div class="cart-item__media">...</div>
              <div class="cart-item__details">
                <h3 class="cart-item__title">Natural high neck top</h3>
                <div class="cart-item__price">2,733.00TL</div>
                <dl><dd>XS</dd></dl>
                <div class="cart-item__bottom-content">
                  <div class="cart-item__quantity"><!-- quantity-input, - [1] + --></div>
                  <cart-remove-button><!-- çöp kutusu ikonu --></cart-remove-button>
                </div>
                <div class="cart-item__actions--price">2,733.00TL</div>
              </div>
            </div>
          </div>
        </cart-drawer-items>
        <div class="cart-drawer__bottom">
          <div class="cart-drawer__summary">
            <div class="cart-drawer__summary-total">
              <span>Subtotal</span><p>Taxes included. Shipping calculated at checkout.</p>
              <span class="cart-drawer__total-price">2,733.00 TRY</span>
            </div>
            <div class="cart-drawer__terms"><!-- şartlar checkbox'ı --></div>
            <div class="cart-drawer__action-buttons">
              <a href="/cart" class="button button--outlined uppercase button--full">View cart</a>
              <button class="button button--filled uppercase button--full">Checkout</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</cart-drawer>
```

Tetikleme mantığı JS ile `<cart-drawer>` elementine `is-visible` class'ı ekleyip
çıkarmaktan ibaret — bütün animasyon SADECE bu tek class'a bağlı CSS ile yürüyor.

### Açılış/kapanış animasyonu (asıl istenen kısım)

```css
/* Kapalı hal (varsayılan) */
.cart-drawer__inner {
  background-color: rgb(255,255,255);
  display: flex;
  flex-direction: column;
  width: 36rem;           /* 576px, ekran dar ise max-width:100% ile taşar */
  max-width: 100%;
  height: 100dvh;
  position: fixed;
  inset-block: 0;          /* top:0; bottom:0 */
  inset-inline-end: 0;     /* right:0 */
  z-index: 800;             /* header'ın z-index'i */
  transform: translate(100%);   /* ekranın tamamen sağında, görünmüyor */
  opacity: 0;
  visibility: hidden;
  transition:
    transform 450ms cubic-bezier(0.74, -0.01, 0.26, 1),
    visibility 450ms cubic-bezier(0.74, -0.01, 0.26, 1);
  overflow-y: auto;
}

/* Panelin arkasındaki karartma (backdrop) — .cart-drawer'ın kendi ::before'u */
cart-drawer.is-visible .cart-drawer::before {
  content: "";
  display: block;
  position: fixed;
  inset: 0;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 800;
}

/* Açık hal — <cart-drawer class="is-visible"> olunca devreye giriyor */
cart-drawer.is-visible .cart-drawer {
  pointer-events: all;
  opacity: 1;
  visibility: visible;
}
cart-drawer.is-visible .cart-drawer__inner {
  opacity: 1;
  visibility: visible;
  transform: translate(0);
  z-index: 801;    /* backdrop'un 1 üstü */
}
```

Önemli detaylar:
- Panel **sağdan kayarak** açılıyor (`translate(100%)` → `translate(0)`), yukarıdan/
  aşağıdan değil. Genişlik sabit **576px** (ekran dar ise tam genişlik), yükseklik
  **tam ekran** (100dvh) — görseldeki gibi header'ın altında değil, en üstten başlıyor.
- Easing **cubic-bezier(0.74, -0.01, 0.26, 1)** — hafif "geri tepme" hissi veren,
  standart ease-in-out'tan farklı özel bir eğri; klasik `ease` kullanılırsa Release'in
  "yumuşak ama hızlı açılan" hissi tutmaz. Süre **450ms**.
- `opacity` de değişiyor ama **transition listesinde yok** — yani opacity anında 0→1
  atlıyor, gerçek animasyon tamamen `transform`'dan geliyor. Bunu birebir taklit etmek
  için opacity'i transition'a KATMAMAK gerekiyor (Tailwind'de `transition-transform`
  kullanıp `transition-opacity` eklememek gibi düşünülebilir, ya da opacity'i hiç
  state'e bağlamayıp sadece `visibility`/`transform` ile kontrol etmek).
- Karartma (backdrop) ayrı bir eleman değil, panelin kendi `::before`'u; rengi
  `rgba(0,0,0,0.5)`, kendi transition'ı yok (panelle birlikte class değişince anında
  görünür/kaybolur — bu da bilinçli bir tercih, backdrop'un ayrı bir "fade" süresi yok).
- z-index: backdrop header ile aynı katmanda (800), panel bir üstünde (801) — yani
  panel header'ın da üzerinde duruyor.

### Tipografi ve renkler (Poppins zaten bizim de fontumuz — ekstra font yüklemeye gerek yok)

| Öğe | Font | Boyut | Ağırlık | Harf aralığı | Diğer |
|---|---|---|---|---|---|
| Başlık "Your cart" | Poppins | 21px | 400 | -0.84px | line-height 21px |
| Sayaç ("1") başlık yanında | Poppins | 12px | 400 | -0.84px | |
| Ürün adı (cart-item__title) | Poppins | 12px | **600** | 0.24px | **UPPERCASE** |
| Ürün fiyatı (satır altı, soluk) | Poppins | 12px | 400 | normal | `color: rgba(ink,.75)` |
| Adet (quantity) input/buton | Poppins / Arial(ikon) | 12px | 400 | normal | |
| Subtotal satırı | Poppins | 21px | 400 | normal | |
| Toplam tutar | Poppins | 21px | **600** | 0.2px | |
| Şartlar checkbox label | Poppins | 12px | 400 | normal | line-height 15px |
| "View cart" / "Checkout" butonları | Poppins | 10px | 400 | **1px** | UPPERCASE, `padding:16px 24px` |

Renkler bizim mevcut token'larımızla birebir örtüşüyor, ekstra hex eklemeye gerek yok:
- Metin: `text-ink` (#111111 = Release'in `rgb(17,17,17)`)
- Çizgiler/kenarlık: `border-line` (#ebebeb = Release'in `rgb(235,235,235)`)
- Panel arka planı: `bg-cream` (#ffffff)
- Backdrop: `bg-ink/50` (rgba(17,17,17,.5) — Release tam siyah rgba(0,0,0,.5) kullanıyor,
  aradaki fark gözle görülmez, tutarlılık için `bg-black/50` da kullanılabilir)

### Bileşenler (ölçüler)

- **Kapat butonu**: 24×24px, `position: sticky; top:0; left:24px`, arka plan yok, kenarlık
  yok — mevcut `AnimatedMenuIcon`'a gerek yok, Release'de basit bir X ikonu (bizim
  `AnimatedMenuIcon` zaten X çizebiliyor, `open` prop'u `true` verilerek reuse edilebilir
  ya da düz bir X SVG yeterli).
- **Header padding**: `2.4rem 1.6rem 2rem` (yaklaşık `pt-6 px-4 pb-5` civarı, projede rem
  tabanı farklı olabileceğinden Claude Code build alıp göz kararıyla eşleştirsin).
- **Ürün görseli**: 360×480 oranında (3:4), sabit küçük thumbnail.
- **Adet seçici (quantity)**: hap şeklinde, `border-radius:50px`, `border:1px solid
  border-line`, yükseklik 46px — projede zaten `product-viewer.tsx`'teki adet seçiciyle
  AYNI görsel dil (`rounded-full border border-line`), o bileşen buraya da taşınabilir.
- **Sil (remove) butonu**: çöp kutusu SVG ikonu, 20×20, `stroke-width:1.2`.
- **Alt özet çizgisi**: `.cart-drawer__summary::before` — üstte ince bir ayırıcı çizgi
  (`height:1px`, `background: border-line`), tam genişlik.
- **"Sepeti Görüntüle" butonu**: dolgusuz (outline) hap buton — `border:1px solid ink`,
  `border-radius:50px`, yükseklik 44px, `/sepet` sayfasına gider (Release'de `/cart`).
- **"Ödemeye Geç" butonu**: dolu (filled) hap buton — `bg-ink`, `text-cream`, aynı ölçüler.
  Bizde bu buton doğrudan `/odeme` sayfasına gitmeli (Release'de gerçek Shopify checkout'a
  submit ediyor, bizde eşdeğeri kendi ödeme sayfamız).

Bu iki buton stili zaten `product-viewer.tsx`'te satır 749-765'te var olan
`rounded-[50px] border border-ink ... text-[10px] uppercase tracking-[1.4px]` classlarıyla
BİREBİR aynı aile — yeni bir stil icat etmeye gerek yok, aynı class deseni kopyalanabilir.

## Claude Code'a verilecek 1. prompt — Cart Drawer

```
Header'daki sepet ikonuna basınca artık /sepet sayfasına yönlendirmek yerine, Release
temasındaki gibi sağdan kayarak açılan bir "cart drawer" (açılır sepet paneli) açmak
istiyorum. release-main.myshopify.com/products/top-13 üzerinde ölçülen gerçek teknik
detaylar (tahmin değil, computed style'dan alındı):

ANİMASYON:
- Panel `position: fixed; inset-block: 0; inset-inline-end: 0` (sağda, tam yükseklik,
  100dvh), genişlik 576px (dar ekranlarda max-width:100%).
- Kapalıyken `transform: translateX(100%)` (ekranın sağında, tamamen gizli),
  `visibility: hidden`.
- Açılırken `transform: translateX(0)`, `visibility: visible`.
- transition: `transform 450ms cubic-bezier(0.74, -0.01, 0.26, 1), visibility 450ms
  cubic-bezier(0.74, -0.01, 0.26, 1)` — SADECE transform ve visibility'de transition var,
  opacity'de YOK (opacity'i state'e bağlamaya gerek yok, sadece transform+visibility
  yeterli).
- Panelin arkasında ayrı bir karartma (backdrop) katmanı: `position:fixed; inset:0;
  background: rgba(0,0,0,.5)` (bizde `bg-black/50` veya `bg-ink/50` kullanılabilir),
  panelle aynı anda class değişimiyle görünür/kaybolur (kendi transition'ı yok, aniden
  açılır/kapanır — sadece panelin transform'u animasyonlu).
- z-index: backdrop header'la aynı katmanda veya üstünde olmalı (header `z-40`), panel
  backdrop'ın 1 üstünde.

UYGULAMA:
1. src/lib/cart.tsx içindeki CartContext'e `isDrawerOpen: boolean`, `openDrawer: () =>
   void`, `closeDrawer: () => void` ekle (basit useState, localStorage'a yazılmasına
   gerek yok).
2. Yeni bir src/components/cart-drawer.tsx bileşeni oluştur. src/components/site-header.tsx
   içindeki MobileMenu bileşeninin yapısını referans al (createPortal ile document.body'ye
   taşıma, body scroll kilidi `document.body.style.overflow = "hidden"`, mount/visible
   iki aşamalı state ile transition'ın gerçekten oynaması - MobileMenu'de zaten bu pattern
   var, aynısını kopyala).
   İçerik:
   - Üstte başlık "Sepetim" + parantez içinde ürün adedi (useCart().totalCount), sağda
     kapat butonu (X ikonu — mevcut AnimatedMenuIcon open={true} kullanılabilir ya da
     düz X SVG).
   - Ortada useCart().lines listesi: her satır için görsel (image), ürün adı (UPPERCASE,
     12px, font-semibold, tracking geniş — cart-item__title ölçüleriyle eşleştir), beden/
     renk, adet seçici (product-viewer.tsx'teki mevcut +/- adet seçici stilini/deseni
     tekrar kullan: rounded-full border border-line, 46px yükseklik), "Kaldır" linki
     (removeLine çağırır), satır toplam fiyatı (formatPrice).
   - Sepet boşsa: basit bir "Sepetiniz boş" mesajı + "Ürünleri Keşfet" linki (sepet.page.tsx
     içindeki boş durum metniyle tutarlı).
   - Altta: ince ayırıcı çizgi (border-t border-line), "Ara Toplam" + formatPrice(totalCents),
     iki buton yan yana DEĞİL alt alta ya da yan yana (Release'de yan yana, %50/%50):
     "Sepeti Görüntüle" (outline hap buton, href /sepet, tıklanınca drawer da kapansın),
     "Ödemeye Geç" (dolu/filled hap buton, href /odeme). Bu iki butonun stilini
     product-viewer.tsx satır 749-765'teki mevcut `rounded-[50px] border border-ink ...
     text-[10px] uppercase tracking-[1.4px]` pill buton deseninden birebir kopyala —
     yeni bir stil icat etme.
3. site-header.tsx'te CartDrawer bileşenini <header>'ın içine (MobileMenu'nün yanına)
   ekle.
4. site-header.tsx satır 611'deki `<Link href="/sepet">` sepet linkini değiştir: artık
   sayfaya gitmesin, tıklanınca openDrawer() çağırsın (href'i koru, onClick içinde
   preventDefault + openDrawer — no-JS fallback için href kalsın).
5. Ürün sayfasında "Sepete Ekle"ye basılınca (product-viewer.tsx handleAdd, satır 297)
   Release'de olduğu gibi drawer otomatik açılıyor mu, buna bakma/ekleme — bu ayrı bir
   iş, şu an sadece header'daki sepet ikonunun davranışını değiştiriyoruz. (Eğer bunu da
   otomatik açmamı istersen ayrıca söyle, şimdilik dokunma.)
6. Test: npx tsc --noEmit ve npm run build hatasız tamamlanmalı. Yerel scratchpad'de
   Playwright ile: sepete bir ürün ekleyip header'daki sepet ikonuna tıkla, panelin
   sağdan 450ms'de kayarak açıldığını, arkasında karartmanın belirdiğini, karartmaya
   tıklayınca ya da X'e basınca panelin kapandığını doğrula. 1280px ve 390px (mobil)
   genişlikte ekran görüntüsü al.
7. Bulguları ve öncesi/sonrası ekran görüntülerini özetle paylaş.
8. DEPLOY_STATUS.md'ye bu işin özetini not düş (proje talimatı gereği).

Commit'i öner ama benim onayım olmadan push etme.
```

## Claude Code'a verilecek 2. prompt — Header ikon butonlarında (arama/hesap/sepet) nav-underline hover

```
site-header.tsx'te üst menü sekmelerinde ("Tüm Ürünler", "Kadın" vb.) kullandığımız
.nav-underline hover alt-çizgi animasyonu (globals.css satır 99-119 — background değil,
::before + scaleX(0)→scaleX(1) + transform-origin left/right tekniği, 0.4s ease, hover
çıkışında transition'sız anında origin değişip sağa doğru kayıp kaybolma efekti) header
sağındaki arama/hesap/sepet ikon butonlarında YOK — sadece `hover:text-clay` ile renk
değişiyor. Bu üçüne de aynı .nav-underline hover'ı ekle:

1. Satır 592-598 (arama linki): `<SearchIcon />`'u bir `<span className="nav-underline
   inline-block">` içine al, nav-underline class'ını span'a ekle (Link'in kendisine değil
   — çünkü nav-underline `position:relative` + `::before` kullanıyor, ikonun tam
   kutusunun altına çizgi çizecek).
2. Satır 599-605 (hesap linki): aynısını `<AccountIcon />` için yap.
3. Satır 611-618 (sepet linki): burada dikkat — Link'in içinde hem `<CartIcon />` hem de
   adet rozeti (`{totalCount > 0 && <span className="absolute ...">}`) var. nav-underline
   SADECE `<CartIcon />`'u saran ayrı bir `<span className="nav-underline inline-block">`
   içine alınmalı, rozet span'ı bunun DIŞINDA kalmalı (yoksa alt çizgi rozetin de altına
   uzar ya da rozet konumu bozulur). Link'in kendisindeki `relative inline-flex` class'ı
   aynen kalsın (rozetin absolute konumlanması buna bağlı).
4. Bu üç ikonda `hover:text-clay` class'ını kaldırma gerekmiyor (clay zaten ink ile aynı
   renk, ama hover geri bildirimini artık alt çizgi de veriyor) — sadece nav-underline
   span'ını ekle, mevcut class'ları bozma.
5. Test: npx tsc --noEmit ve npm run build hatasız tamamlanmalı. Yerel scratchpad'de
   Playwright ile 1280px genişlikte arama/hesap/sepet ikonlarına tek tek hover yapıp alt
   çizginin ikonun altında (rozetin altına uzamadan) soldan sağa açıldığını ekran
   görüntüsüyle doğrula.
6. Bulguları ve öncesi/sonrası ekran görüntülerini özetle paylaş.
7. DEPLOY_STATUS.md'ye bu işin özetini not düş (proje talimatı gereği).

Commit'i öner ama benim onayım olmadan push etme.
```

## Notlar / kararlar

- İki iş birbirinden bağımsız, istersen ayrı ayrı ayrı Claude Code oturumlarında da
  verilebilir — ikisi de aynı dosyada (`site-header.tsx`) çalışacağı için art arda
  vermek (önce cart drawer, sonra hover) çakışma riskini azaltır.
- Cart drawer'ın "Sepete Ekle"ye basınca otomatik açılması (Release'de öyle) bilerek
  kapsam dışı bırakıldı — sadece header'daki sepet ikonunun davranışı soruldu. İstersen
  ayrı bir adım olarak bunu da ekletebiliriz.
- Tüm ölçümler `release-main.myshopify.com/products/top-13?variant=41219943006287`
  üzerinden, ürün sepete eklenip drawer açık haldeyken computed style ile alındı; renk
  paleti zaten Release'in kendi paletiyle birebir eşleşen tailwind.config.ts token'larına
  (`ink`, `cream`, `line`) oturtuldu, yeni hex kod önerilmedi.
