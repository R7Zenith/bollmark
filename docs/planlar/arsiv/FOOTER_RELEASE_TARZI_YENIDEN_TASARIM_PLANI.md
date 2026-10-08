# Footer Yeniden Tasarımı — Release Tarzı — Araştırma ve Claude Code Promptu

## İstek

Kullanıcı, referans aldığımız Shopify **Release** temasının footer'ını
paylaştı (ekran görüntüsü) ve Bollmark'ın footer'ının da aynı düzene
kavuşmasını istiyor: **sol altta büyük, iri bir logo/wordmark**, **sağ
tarafta sayfa linkleri**, genel olarak daha okunaklı ve işlevsel bir
footer.

## Mevcut durum (`src/components/site-footer.tsx`)

Şu an footer tek sıra, 3 sütunlu basit bir grid:

1. Sütun 1: küçük "Bollmark" yazısı (normal boyut, `text-xl`) + kısa
   açıklama metni.
2. Sütun 2: "Kurumsal" başlığı altında 5 link (Hakkımızda, Hikayemiz,
   İade & Değişim, Kargo Bilgisi, Gizlilik Politikası).
3. Sütun 3: "İletişim" başlığı altında e-posta + telefon (düz metin,
   link değil).

Altında ortalanmış, tek satır telif hakkı metni.

Eksikler: büyük/etkileyici bir logo bloğu yok, kategori/alışveriş
linkleri yok, sosyal medya ikonları yok, bülten (newsletter) kaydı yok,
ödeme yöntemi ikonları yok — Release'in zengin, çok katmanlı footer'ına
kıyasla oldukça yalın kalıyor.

## Release footer'ının yapısı (referans ekran görüntülerinden)

Üç yatay blok:

1. **Üst blok**: solda bülten kaydı (e-posta input + "Subscribe"
   butonu), sağda 3 link sütunu (Company / Pages / Shop) — her sütun
   başlığı küçük harfli, gri, harf aralığı geniş; linkler beyaz/okunaklı.
2. **Orta blok**: sayfa genişliğinde **çok büyük** bir wordmark ("release"
   — ekranın genişliğinin büyük bir kısmını kaplayan dev bir logo
   yazısı), altında kısa bir marka açıklaması, sağında sosyal medya
   ikonları (Instagram, YouTube, TikTok, X, Vimeo) yatay sırada.
3. **Alt bar**: ince bir üst çizgiyle ayrılmış, solda telif hakkı +
   "Powered by Shopify" metni, sağda ödeme yöntemi ikonları (kart
   logoları, PayPal vb.).

Kullanıcının ikinci ekran görüntüsü (kendi taslağı/denemesi) zaten bu
yöne bir adım atmış görünüyor — "BOLLMARK" wordmark'ı biraz büyütülmüş,
"Kurumsal"/"İletişim" sütunları korunmuş — ama hâlâ Release'deki
**iri/dev logo bloğu**, **çoklu link sütunları (kategori linkleri
dahil)**, **sosyal ikonlar** ve **bülten alanı** eksik.

## Bollmark'a özgü kısıtlar / öneriler

- **Marka renkleri korunmalı**: mevcut `bg-ink text-cream` + `clay` vurgu
  rengi zaten oturmuş bir sistem (Release'in saf siyah/beyazına
  geçilmeyecek, sadece *düzen* Release'den alınacak).
- **Font**: mevcut `font-display` (site genelinde kullanılan display
  fontu) büyük wordmark için de kullanılmalı, yeni bir font eklenmeyecek.
- **Alışveriş/kategori sütunu**: Release'in "Shop" sütununda Tops,
  T-shirts, Knitwear gibi gerçek ürün tipi linkleri var. Bollmark'ta da
  bunun karşılığı olarak üst menüde (`UST_MENU_MEGA_MENU_PLANI.md`)
  tanımlanan ortak ürün tipi kategorilerinden (Tişört, Gömlek, Pantolon,
  Sweatshirt, Ceket, Mont & Kaban vb.) ilk 6 tanesi `/urunler?kategori=<slug>`
  linkleriyle footer'a eklenebilir — böylece footer sadece dekoratif
  değil, gerçekten işlevsel/SEO-dostu iç linkler içerir.
- **Bülten (newsletter) kaydı**: kod tabanında bunu karşılayacak bir API
  route (`/api/.../newsletter` gibi) veya tablo **yok**. Bunu bu işin
  kapsamına dahil etmiyoruz — Claude Code'a önce **sadece görsel/UI**
  olarak (input + buton, gönderim henüz bağlı değil ya da basitçe
  `mailto:` / no-op) eklettireceğiz; gerçek e-posta toplama ayrı bir iş
  olarak sonraya bırakılsın (istersek ayrı bir plan açarız).
- **Sosyal medya linkleri**: kod tabanında hiçbir sosyal medya URL'si
  tanımlı değil. Claude Code'a placeholder/boş `href="#"` bırakmasını ve
  ikonları sade inline SVG olarak eklemesini söyleyeceğiz (dış kütüphane
  eklemesin); gerçek hesap linkleri kullanıcıdan gelince doldurulur.
- **Ödeme ikonları**: opsiyonel, kapsam dışı bırakılabilir (gerekirse
  ayrı eklenir) — Release'deki kart logoları marka varlığı gerektiriyor,
  şimdilik atlanıyor.

## Önerilen yeni footer yapısı

1. **Üst blok** (grid, mobilde tek sütun, `md:` üstünde çok sütunlu):
   - Sol: "Bültenimize katılın" başlığı + kısa açıklama + e-posta input
     + buton (görsel olarak Release'deki pill/kare input+buton stiline
     benzer, ama Bollmark'ın mevcut buton bileşenleriyle tutarlı).
   - Sağ: 2-3 link sütunu — "Kurumsal" (mevcut 5 link), "Sayfalar" (yeni:
     SSS varsa, İletişim sayfası vb. — yoksa mevcutları böl), "Alışveriş"
     (yeni: ilk 6 ürün tipi kategorisi + "Tüm Ürünler").
2. **Orta blok**: `text-6xl`/`text-8xl` (responsive: mobilde küçülsün)
   ölçeğinde dev "BOLLMARK" wordmark'ı + altında mevcut kısa açıklama
   cümlesi; sağında/altında (mobilde alta düşecek şekilde) sosyal medya
   ikon satırı.
3. **Alt bar**: ince üst border, solda telif hakkı metni (mevcut), sağda
   (opsiyonel, boşsa hiç render etme) ödeme ikonları alanı — şimdilik
   atlanabilir.

## Claude Code'a verilecek prompt

```
Bollmark storefront'unun footer'ını (`src/components/site-footer.tsx`)
Release (Shopify teması) footer'ının düzenine benzer şekilde yeniden
tasarlayacağız — kullanıcı özellikle "sol altta büyük bir logo, sağ
tarafta sayfalar, daha okunaklı ve işlevsel" istiyor. Marka renklerini
(`bg-ink`, `text-cream`, `clay` vurgu) ve `font-display` fontunu
KORU — sadece düzen ve zenginlik Release'den esinlenecek, renk paleti
değişmeyecek.

Mevcut footer tek sıra 3 sütun (marka+açıklama / Kurumsal linkleri /
İletişim). Yeni yapı üç yatay blok olacak:

### 1. Üst blok — bülten + link sütunları
- Solda: küçük bir başlık ("Bültenimize katılın" gibi) + kısa açıklama
  + bir e-posta `<input type="email">` ve "Abone Ol" butonu yan yana
  (form `onSubmit` şimdilik sadece `event.preventDefault()` yapsın,
  gerçek bir API'ye bağlanmayacak — TODO yorumu bırak: gerçek kayıt
  endpoint'i ayrı bir iş).
- Sağda, `md:` üstünde 3 sütun halinde (mobilde tek sütun, dikey
  sıralı):
  - "Kurumsal": mevcut 5 link aynen kalsın (Hakkımızda, Hikayemiz,
    İade & Değişim, Kargo Bilgisi, Gizlilik Politikası).
  - "İletişim": mevcut e-posta + telefonu `<a href="mailto:...">` ve
    `<a href="tel:...">` olarak linkli hale getir (şu an düz metin).
  - "Alışveriş": `/urunler?kategori=<slug>` linkleriyle şu 6 kategori +
    en altta "Tüm Ürünler" (`/urunler`): Tişört (tisort), Gömlek
    (gomlek), Pantolon (pantolon), Sweatshirt (sweatshirt), Ceket
    (ceket), Mont & Kaban (mont-kaban). ÖNEMLİ: bu slug'ları
    varsaymadan önce `prisma/seed` veya DB'deki gerçek `Category.slug`
    değerleriyle doğrula (proje `UST_MENU_MEGA_MENU_PLANI.md`'de
    listelenen 9 ortak ürün tipinden ilk 6'sını seç) — slug yanlışsa
    kırık link olur.

### 2. Orta blok — dev wordmark
- Sayfa genişliğine yakın, responsive büyük bir "BOLLMARK" başlığı:
  mobilde `text-5xl`, masaüstünde `text-8xl`/`text-9xl` civarı,
  `font-display`, `tracking-widest2` (mevcut token'ı kullan), harfler
  taşmasın diye `leading-none` ve gerekirse `break-words` ekle.
- Altında mevcut kısa açıklama cümlesi ("Özenle seçilmiş kumaşlar...").
- Sağında (masaüstünde) veya altında (mobilde) yatay sosyal medya ikon
  satırı: Instagram, TikTok, (isteğe bağlı X/Facebook) — inline SVG
  ikonlar kullan (dış paket/kütüphane EKLEME), her biri `href="#"`
  placeholder olsun ve `aria-label` ile isimlendirilsin (gerçek hesap
  linkleri sonradan girilecek — bunu bir yorum satırıyla belirt).

### 3. Alt bar
- Mevcut ince üst border + telif hakkı satırını koru, sadece
  hizalamayı sola al (şu an ortalı) ve blok içine mobilde de düzgün
  sığacak şekilde `flex-wrap` ekle. Ödeme ikonları EKLEME (kapsam
  dışı).

### Genel
- Tüm yeni interaktif elemanlarda (input, buton, linkler) klavye
  erişilebilirliği ve odak (focus) stillerini koru (mevcut sitede
  kullanılan focus-visible pattern'i neyse onu uygula).
- Mobilde (375px) yatay taşma olmamalı — `overflow-x` kontrolü yap.
- `npx tsc --noEmit` ve `npm run build` hatasız tamamlanmalı.
- Değişiklik sonrası masaüstü (1440px) ve mobil (375px) ekran
  görüntüsü al, öncesi/sonrası karşılaştırmasını paylaş.
- Commit mesajını öner ama benim onayım olmadan push etme.
- Bu işten sonra DEPLOY_STATUS.md'ye kısa bir not düş.
```

## Sonraki adımlar (bu planın kapsamı dışında, ayrı iş olabilir)

- Bülten kaydını gerçek bir API'ye bağlamak (yeni tablo + route).
- Gerçek sosyal medya hesap linklerini girmek.
- Ödeme yöntemi ikonlarını eklemek (marka varlıkları gerektirir).
