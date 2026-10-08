# Ödeme Sayfası Düzeltmeleri Planı

Tarih: 2026-09-22
Kaynak: Kullanıcı isteği (Cowork araştırma) — uygulama Claude Code ile yapılacak.

## 1. Footer /odeme sayfasında tamamen kaldırılsın

Dosya: `src/components/site-footer.tsx`, satır 50-59:
```tsx
export function SiteFooter() {
  // Odeme sayfasi, gri ozet panelini/form sutununu footer'a kadar boslugu
  // birebir bitiren kendi rowStyle mantigina sahip (bkz. checkout-form.tsx);
  // footer'in genel mt-section (6rem) bosluğu orada bu bitisikligi bozup
  // gorunur bir bosluk yaratiyordu, o yuzden yalnizca /odeme'de kaldiriliyor.
  const pathname = usePathname();
  const isCheckout = pathname === "/odeme";

  return (
    <footer className={`${isCheckout ? "" : "mt-section"} bg-ink text-cream`}>
```

Şu an `isCheckout` sadece üst boşluğu (`mt-section`) kaldırıyor, footer'ın kendisi (güven kutuları, Kurumsal/İletişim/Alışveriş link sütunları, büyük logo, iyzico logo bandı, alt telif satırı) hâlâ tam olarak render ediliyor.

**İstenen:** `isCheckout` (pathname === "/odeme") true olduğunda `SiteFooter` hiçbir şey render etmesin (`return null`). Footer tamamen kaldırılsın, sadece boşluk ayarı yeterli değil.

Not: `/odeme/basarisiz` ve `/odeme/tesekkurler` gibi alt sayfalarda footer'ın durumu ayrıca kontrol edilsin — muhtemelen orada footer kalmalı (kullanıcı sadece "ödeme ekranı"ndan bahsetti, yani aktif checkout formunun olduğu `/odeme` sayfası), pathname kontrolü net `"/odeme"` ile sınırlı tutulmalı, `startsWith` kullanılmamalı.

## 2. Footer'a kadar zorla uzatma (minHeight hack) da kaldırılsın

Dosya: `src/app/(site)/odeme/checkout-form.tsx`

Satır ~297-304:
```tsx
// Icerik (sepet) kisa oldugunda bile gri panel footer'a kadar dolsun diye
// satira viewport-header yuksekligi kadar minimum yukseklik veriliyor -
// aksi halde "main flex-1" sadece kisa icerigi kadar yer kaplayip footer'i
// sabitlemek icin altta bos beyaz alan birakiyor, bu bosluk beyaz zeminde
// hic belli olmuyordu ama gri panel gorunur hale getirdi.
const rowStyle: React.CSSProperties = isDesktop
  ? { minHeight: "calc(100vh - 72px)", alignContent: "stretch" }
  : {};
```
ve satır 307:
```tsx
<div className="py-10 lg:grid lg:grid-cols-2 lg:py-0" style={rowStyle}>
```

**İstenen:** Footer madde 1 ile tamamen kaldırılınca bu hack'in orijinal amacı (gri panelin footer'a kadar uzanması) da ortadan kalkıyor. `rowStyle` objesi ve `style={rowStyle}` kullanımı kaldırılsın; sayfa doğal içerik yüksekliğine göre aksın.

Not: Bu değişiklikten sonra sepet az ürünlüyken gri özet panelinin altında boşluk kalabilir — bu, kullanıcının istediği "sayfa tamamen aşağı doğru aksın" davranışının doğal/kabul edilen sonucu.

## 3. Sol bloktaki "İletişim" bölümü kaldırılsın

Dosya: `src/app/(site)/odeme/checkout-form.tsx`, satır 335-341:
```tsx
<section className="space-y-4">
  <h2 className="text-xl font-semibold">İletişim</h2>
  <label className="flex items-center gap-3 text-sm text-ink/70">
    <input type="checkbox" name="newsletterOptIn" className="h-5 w-5 rounded-lg border border-line" />
    Kampanya ve fırsatlardan haberdar ol
  </label>
</section>
```

**İstenen:** Bu section tamamen kaldırılsın. Dikkat: `newsletterOptIn` form alanı kaldırılırsa, bu alanı okuyan bir backend/route (örn. `/api/orders`) varsa orada `undefined`/`false` davranışının sorun yaratmadığı teyit edilsin (muhtemelen opsiyonel bir alan, sorun çıkarmaz ama Claude Code kontrol etsin).

## 4. Header altındaki 1-2px boşluk

Dosya: `src/components/site-header.tsx`, satır 672:
```tsx
{!isTransparentPage && <div aria-hidden className="h-[72px]" />}
```

Header `position: fixed` olduğu için sayfa akışına header yüksekliği kadar boşluk bırakan bir "spacer" div bu. Header'ın kendisinde `border-b` (1px) var (bkz. satır 570-573) ve header'ın gerçek render yüksekliği (padding + içerik + border) sabit `72px` ile birebir örtüşmüyor olabilir — bu da sayfanın en üstünde (header'ın hemen altında) 1-2px'lik bir boşluk/çizgi olarak görünüyor.

Aynı `h-[72px]` değeri `src/app/(site)/layout.tsx` satır 59'daki Suspense fallback'inde de var:
```tsx
<Suspense fallback={<div className="h-[72px]" />}>
```

**Bu component tüm sitede ortak olduğu için iki seçenek var, Claude Code karar versin/sorsun:**

- **Seçenek A (kök neden düzeltmesi, önerilen):** Header'ın gerçek yüksekliğini ölçüp (`getBoundingClientRect` ile bir `useEffect`'te — `checkout-form.tsx`'te zaten benzer bir "ölçüp inline style ver" pattern'i var, aynısı kullanılabilir) spacer'ın yüksekliğini buna göre dinamik ayarlamak, ya da header'ın padding/border değerlerini net 72px'e (border dahil, box-sizing: border-box ile) sabitlemek. Bu tüm sayfalarda boşluğu düzeltir.
- **Seçenek B (sadece /odeme'de gizleme):** Kök nedene dokunmadan, sadece ödeme sayfasında görünen boşluğu `checkout-form.tsx`'in en üst wrapper'ına küçük bir `-mt-px` veya `-mt-[2px]` gibi negatif margin ekleyerek görsel olarak kapatmak. Daha kırılgan bir çözüm (piksel değeri header render'ına göre değişebilir), ama diğer sayfalara dokunmaz.

Kullanıcı "bu sayfada kaldıralım" dediği için varsayılan olarak Seçenek B ile başlanabilir, ama Claude Code önce boşluğun gerçekten sadece /odeme'de mi yoksa diğer sayfalarda da (header border rengi/arka plan farklı olduğu için) var olup fark edilmediğini kontrol etsin; öyleyse Seçenek A daha doğru olur.

## Uygulama notları (proje kurallarına göre)
- Kodlama Claude Code ile yapılacak.
- Her onaylanan değişiklikten sonra Claude Code yerel commit atsın, kullanıcı söylemeden push etmesin.
- Değişiklik sonrası DEPLOY_STATUS.md'ye not düşülsün.
- Kurulu skill'ler (karpathy-guidelines) kullanılsın.
