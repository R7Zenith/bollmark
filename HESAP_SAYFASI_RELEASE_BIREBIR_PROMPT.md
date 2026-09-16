# Hesap Bölümünü (Giriş/Kayıt + Dashboard) Release Temasıyla Birebir Uyumlu Hale Getir

Release temasının canlı demosunda (release-main.myshopify.com), hem giriş yapılmamış (login/register) hem giriş yapılmış (account overview/orders/addresses) ekranlar `getComputedStyle` ile ölçüldü. Bollmark'ta renk paleti zaten Release'in monokromuna eşit (ink #111111, line #ebebeb, font Poppins var(--font-sans)) — eksik olan **layout mimarisi, pill/hap buton dili, input/kart radius'u ve negatif letter-spacing başlıklar**.

## A) GİRİŞ / KAYIT — `src/app/(site)/hesap/giris/page.tsx`

Mevcut tab mantığına (`handleLogin`/`handleRegister`, `useState<"giris"|"kayit">`) DOKUNMA, sadece görsel katmanı değiştir:

- İki kolonlu flex layout: `flex flex-col lg:flex-row`, her kolon `flex-1`. Sol kolon tam yükseklik moda görseli (`object-cover`), `hidden lg:block` (Release'in `small-hide medium-hide`'ının karşılığı — mobil/tablette tamamen gizli). Görsel: Unsplash'ten ücretsiz/ticari kullanıma uygun moda portresi (marka fotoğrafı kopyalanmayacak).
- Sağ kolon: `max-w-[432px] mx-auto lg:mx-0`, dikeyde ortalanmış, `px-9` (36px) yatay boşluk.
- Başlık: Giriş sekmesinde "Tekrar hoş geldin!", Kayıt sekmesinde "Hoş geldin!" → `font-display text-[47px] leading-[47px] tracking-[-1.88px] font-normal`.
- Label: `text-[10px] font-medium tracking-[1px] uppercase text-ink`.
- Input: `rounded-lg border border-line h-12 px-4 text-xs bg-transparent` (8px radius, 48px yükseklik) — mevcut köşeli `border border-line px-4 py-3` yerine.
- Birincil buton (Giriş Yap / Hesap Oluştur): `rounded-full bg-ink text-white text-[10px] tracking-[1px] uppercase px-6 py-4 hover:bg-ink/90` — tam pill, köşeli `bg-ink py-3` yerine.
- Tab switcher'ı da pill diline çevir: aktif tab dolu siyah pill, pasif tab outline pill (`border border-ink text-ink bg-transparent`) — mevcut border-bottom tab tasarımının yerine.
- "Şifremi unuttum" linki ekle (10px uppercase underline), route yoksa TODO placeholder bırak.

## B) HESAP DASHBOARD MİMARİSİ — sidebar'a geçiş

Şu an her sayfa (`hesap/page.tsx`, `hesap/siparislerim/page.tsx`, `hesap/adreslerim/page.tsx`, `hesap/puanlarim/page.tsx`, `hesap/favorilerim/page.tsx`) kendi içinde ayrı ayrı `<div className="mx-auto max-w-3xl px-6 py-16"><h1>...</h1><HesapNav/>...</div>` tekrarlıyor, `HesapNav` üstte yatay tab. Release'de bu **ortak bir sidebar layout** ve sayfalar sadece sağ panelin içeriğini veriyor. Yapılacaklar:

1. **`src/app/(site)/hesap/layout.tsx` oluştur** (yeni dosya). Bu layout:
   - `requireCustomer()` ile müşteriyi çekip üstte breadcrumb (`Ana Sayfa / Hesabım`, 10px uppercase, `/` ayraçlı) + `h1` "Merhaba, {customer.name}!" (`font-display text-[47px] leading-[47px] tracking-[-1.88px]`) render etsin.
   - Altında `flex flex-col lg:flex-row gap-0` içinde iki blok:
     - **Sol sidebar** (`w-full lg:w-[320px] border border-line`): `HesapNav`'ı burada kullan ama YENİDEN TASARLA (bkz. madde C).
     - **Sağ panel** (`flex-1 border border-line lg:border-l-0 p-8 lg:p-12 lg:px-16`): `{children}` — yani alt sayfaların (`page.tsx` dosyaları) artık SADECE panel içeriğini (başlık + veri) render etmesi yeterli, kendi `max-w-3xl` wrapper'ını ve `h1`'i KALDIR.
   - `lg:border-l-0` ile sidebar'ın sağ border'ı sağ panelin sol border'ıyla çakışıp tek kalın çizgi görünmesin (Release'de iki ayrı border yan yana duruyor, ince fark önemli değil — istersen ikisini de `border` bırak).

2. Her alt sayfadan (`page.tsx`, `siparislerim`, `adreslerim`, `puanlarim`, `favorilerim`) şunları SİL: dış `<div className="mx-auto max-w-3xl px-6 py-16">` wrapper, `<h1 className="font-display text-3xl">...</h1>`, `<div className="mt-8"><HesapNav /></div>`. Yerine panel içi başlık için `<h2 className="font-display text-xl">...</h2>` bırak (Release'in "Account details" / "Order history" h2'sine karşılık).

3. **Özet sayfası (`hesap/page.tsx`) için özel olarak** Release'in "Account details | Address details" iki sütun düzenini uygula: `grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0`, sağ sütuna `lg:border-l lg:border-line lg:pl-16` ekle. Sol sütun: sipariş özeti kartları + son siparişler; sağ sütun: adres özeti + "Adreslerimi Gör" pill link (outline pill, `rounded-full border border-ink px-6 py-4 text-[10px] uppercase tracking-[1px]`).

## C) `src/components/hesap-nav.tsx` — sidebar'a dönüştür

- Wrapper: `<ul className="divide-y divide-line">` (yatay flex yerine dikey liste).
- Her item: `<li>` içinde `<Link>` — `className="flex items-center justify-between px-9 py-8 text-xl font-normal text-ink hover:bg-ink/[0.024]"` (21px ≈ `text-xl`, padding 32px/36px ≈ `py-8 px-9`), aktif sayfada `bg-ink/[0.024]` uygula (`pathname === item.href` kontrolüyle). Satır sonuna sağ ok ikonu ekle (basit bir `›` karakteri veya lucide `ChevronRight` varsa).
- "Çıkış Yap" linkini listeden ayır: `<div className="px-9 py-6">` içinde `text-[10px] uppercase tracking-[1px] underline` stiliyle ayrı, alt boşluklu bir blok olarak bırak (Release'de "LOG OUT" ayrı, altta duruyor).
- Mobil davranışı için bkz. madde E — sidebar'ın border'ı ve item padding'i mobilde küçülüyor, ekstra collapse/hamburger gerekmiyor, sadece stil farkı.

## D) Kartlar ve butonlar — tutarlılık

- Tüm `border border-line bg-white p-6` istatistik/içerik kutularına `rounded-lg` ekle (8px, input radius'uyla eşit).
- Sayfa içi birincil aksiyon butonları (ör. adres ekle, çıkış) `rounded-full` pill diline çevrilsin: dolu siyah = birincil (`Adres Ekle`, `Giriş Yap`), outline siyah = ikincil (`Adreslerimi Gör`, `Log In` linki).
- "EDIT ADDRESS / DELETE" tarzı satır içi aksiyonlar (`hesap-address-row.tsx`) için: `text-[10px] uppercase tracking-[1px] underline` link stiline çevir.
- Hardcoded hex kullanma, mevcut `ink`/`line`/`cream` token'larını kullan.

## Test
Değişiklikten sonra `/hesap`, `/hesap/siparislerim`, `/hesap/adreslerim`, `/hesap/puanlarim`, `/hesap/favorilerim` sayfalarını hem 1440px hem 390px genişlikte ekran görüntüsü alıp sidebar/panel border'larının, aktif menü vurgusunun ve pill butonların Release ile örtüştüğünü doğrula.
