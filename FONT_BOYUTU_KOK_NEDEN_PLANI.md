# Ürün Detay Sayfası — Yazı Boyutları Neden Release'i Tutmuyor? (Kök Neden Bulundu)

## Tetikleyen olay

Kullanıcı, release-main.myshopify.com/products/top-8 ile Bollmark'ın kendi
ürün detay sayfasını yan yana karşılaştırdı; sağdaki metinlerin (başlık,
açıklama, diğer yazılar, butonlar, yerleşim) punto/görünüm olarak
tutmadığını bildirdi. Önceki oturumlarda `RELEASE_TEMA_BIREBIR_UYUM_PLANI.md`
Adım 3 ve Adım 6'da bu sayfa için Release'in canlı CSS'inden birebir rem
değerleri (`2.1rem`, `1.4rem`, `1.6rem`, `0.1rem` tracking vb.) alınıp
Bollmark'a aynen uygulanmıştı. Bu oturumda **gerçek tarayıcıda, her iki
siteyi de local önizleme şifresiyle açıp (`?preview=` — `.env`'deki
`PREVIEW_PASSWORD`) computed style ölçerek** karşılaştırma yapıldı ve kök
neden kesin olarak bulundu.

## Kök neden — kesin (tarayıcıda ölçüldü, tahmin değil)

**Release temasının kök (`html`) font-size'ı 10px, Bollmark'ınki ise
Tailwind'in varsayılanı olan 16px.**

```
release-main.myshopify.com  → getComputedStyle(document.documentElement).fontSize = "10px"
bollmark (localhost:3000)   → getComputedStyle(document.documentElement).fontSize = "16px"
```

Shopify'ın Release/Dawn temalarında yaygın bir teknik budur: kök font-size
10px'e sabitlenir, böylece tüm `rem` değerleri "1rem = 10px" üzerinden
hesaplanır (`2.1rem` = 21px, `1.4rem` = 14px gibi kolay okunur sayılar
verir). Önceki oturumlarda Release'in CSS'inden `2.1rem`, `1.4rem`,
`1.6rem`, `0.1rem` gibi rem değerleri **doğru şekilde okunmuştu**, ama
Bollmark'ın kendi `globals.css`'inde kök font-size hiç 10px'e
çekilmediği (hâlâ tarayıcı varsayılanı 16px) için bu değerler Bollmark'ta
**1.6 kat (16/10) daha büyük** render ediliyor. Yani ölçülen rakamlar değil,
o rakamların hangi taban üzerinden hesaplandığı yanlış aktarılmış.

`src/app/globals.css` içinde `html { scroll-behavior: smooth; }` var ama
`font-size` satırı yok — kanıt bu.

## Ölçülen fark tablosu (aynı `products/top-8` benzeri ürün, 1600px genişlik)

| Eleman | Release (gerçek) | Bollmark (şu an) | Bollmark'ın kodu | Olması gereken |
|---|---|---|---|---|
| Ürün başlığı (`h1`) | **21px**, letter-spacing -0.84px | **33.6px**, -1.344px | `text-[2.1rem] tracking-[-0.04em]` | `text-[21px]` (veya kök font-size düzeltilirse `text-[2.1rem]` aynen kalabilir) |
| Fiyat | **14px** | **22.4px** | `text-[1.4rem]` (2 yerde) | `text-[14px]` |
| Accordion başlığı ("Ürün Detayları" vb.) | **16px** (1.6rem×10px) | **25.6px** | `text-[1.6rem]` | `text-[16px]` |
| Beden/Renk kutucuğu harf aralığı | 1px (0.1rem×10px) | 1.6px | `tracking-[0.1rem]` | `tracking-[1px]` |
| Rozet border-radius | 4px (0.4rem×10px) | 6.4px | `rounded-[0.4rem]` | `rounded-[4px]` |
| Güven ızgarası kart radius | 14px (1.4rem×10px) | 22.4px | `rounded-[1.4rem]` | `rounded-[14px]` |
| Galeri/ızgara boşluğu | 8px (0.8rem×10px) | 12.8px | `gap-[0.8rem]` | `gap-[8px]` |
| Açıklama paragrafı | **14px** | **16px** (hiç özel class yok, Tailwind varsayılanı) | class yok / `prose-description` | `text-sm` (14px) eklenmeli |
| Sepete Ekle / Hemen Al buton yazısı | 10px | 10px ✅ | `text-[10px]` (px ile yazılmış) | değişiklik gerekmiyor |
| Buton yüksekliği/köşe yarıçapı (46px / 50px) | 46px / 50px | 46px / 50px ✅ | `h-[46px] rounded-[50px]` (px) | değişiklik gerekmiyor |
| Beden kutucuğu (28×28px) | 28×28 | 28×28 ✅ | `min-w-[28px]` + `h-7`(28px) (px) | değişiklik gerekmiyor |

**Örüntü net:** `rem` ile yazılan HER şey ~1.6× büyük render oluyor;
`px` ile yazılan (butonlar, beden kutuları, buton yüksekliği) zaten doğru
boyutta, çünkü onlar zaten piksel cinsindendi ve kök font-size'dan
etkilenmiyor.

## İki olası çözüm — hangisi seçilmeli

**Seçenek A (kapsamlı, önerilen): Bollmark'ın kök font-size'ını da 10px'e
çek** (`html { font-size: 62.5%; }` veya `10px`), Release'den alınan TÜM
rem değerleri (bu sayfa dahil, ileride kopyalanacak başka Release
ölçümleri de dahil) otomatik doğru boyutta render olur, tekrar tekrar
"rem mi px mi" hesabı yapmaya gerek kalmaz. **Risk:** Tailwind'in
kendi `rem`-tabanlı sınıfları da (`text-sm`, `p-4`, `gap-4` gibi
DOĞRUDAN Tailwind utility'leri, storefront'un başka hiçbir yerinde
`text-[Xrem]` şeklinde YAZILMAMIŞ olanlar) etkilenir — bunlar da 0.625
kat küçülür. Yani bu değişiklik **storefront'un tamamını** (header,
katalog, sepet, checkout vb.) etkiler ve her sayfa yeniden gözden
geçirilmesi gerekir. Tek bir sayfa için düşünülemez.

**Seçenek B (dar kapsamlı, daha güvenli): Sadece ürün detay sayfasındaki
`text-[Xrem]` / `tracking-[Xrem]` / `rounded-[Xrem]` / `gap-[Xrem]`
yazımlarını yukarıdaki tabloya göre doğrudan px karşılıklarına çevir**
(`text-[2.1rem]` → `text-[21px]` vb.). Sadece bu 6 satır değişir,
sayfanın geri kalanı (zaten px ile yazılmış butonlar/kutucuklar)
etkilenmez, başka hiçbir sayfa bozulmaz. **Bundan sonra Release'den yeni
bir ölçüm alınırken de "rem" yerine doğrudan px'e çevrilerek yazılmalı**
(bu proje için kalıcı kural).

**Öneri: Seçenek B.** Daha az riskli, sadece şikayet edilen sayfayı
düzeltir, geri kalan storefront'a dokunmaz. Kalıcı kural olarak not
düşülmeli: *Release'in CSS'inden bundan sonra bir rem değeri okunduğunda,
Bollmark'a yazılırken o değer × 10 = px karşılığı olarak yazılsın (kök
font-size'ları farklı olduğu için asla rem aynen kopyalanmasın).*

## Claude Code'a verilecek prompt

```
Ürün detay sayfasında (src/components/product-viewer.tsx) Release temasından
(release-main.myshopify.com/products/top-8) alınan bazı font boyutları/
tracking/radius/gap değerleri rem cinsinden birebir kopyalanmış, ama
Release'in kök (html) font-size'ı 10px iken Bollmark'ınki tarayıcı
varsayılanı olan 16px - bu yüzden bu değerler Bollmark'ta gerçekte
Release'den %60 daha büyük render oluyor (ölçüldü: h1 33.6px yerine 21px
olmalıydı, fiyat 22.4px yerine 14px, accordion başlığı 25.6px yerine 16px
olmalıydı). Kök font-size'ı sitede genel olarak değiştirmiyoruz (bu,
storefront'un geri kalanını da etkiler ve kapsam dışı) - sadece bu
sayfadaki rem yazımlarını Release'in GERÇEK piksel karşılığına çeviriyoruz.

product-viewer.tsx içinde şu değişiklikleri yap (satır numaraları yaklaşık,
dosyada ara):

1. Ürün başlığı `<h1>`: `text-[2.1rem] leading-[1.15] tracking-[-0.04em]`
   → `text-[21px] leading-[1.15] tracking-[-0.84px]`

2. Fiyat gösterimi (iki yerde, indirimli/indirimsiz span'ler):
   `text-[1.4rem]` → `text-[14px]` (her iki kullanımda da)

3. Accordion başlıkları ("Ürün Detayları" ve "Beden Tablosu" summary'leri,
   iki yerde): `text-[1.6rem] tracking-[-0.04em]` → `text-[16px]
   tracking-[-0.64px]`

4. Beden ve renk seçim kutucukları (iki `tracking-[0.1rem]` kullanımı):
   → `tracking-[1px]`

5. İndirim rozeti: `rounded-[0.4rem]` → `rounded-[4px]`

6. Güven rozeti statik ızgara kartı: `rounded-[1.4rem]` → `rounded-[14px]`

7. Galeri ızgara boşluğu: `gap-[0.8rem]` → `gap-[8px]` (iki yerde,
   `md:grid md:grid-cols-2 md:gap-[0.8rem]` ve güven ızgarası
   `grid-cols-3 gap-[0.8rem]`)

8. Ürün açıklaması (`descriptionHtml` render eden div, className
   `prose-description relative leading-relaxed text-ink/70 ...`): şu an
   font-size hiç belirtilmemiş, Tailwind varsayılanı 16px'e düşüyor;
   Release'de bu 14px. `text-sm` class'ı ekle (className'in başına).

Değişiklik SADECE bu dosyada, sadece rem→px dönüşümü - başka bir mantık,
layout veya davranış değişikliği YOK. Bu değerler zaten daha önceki
oturumlarda Release'den ölçülüp doğrulanmıştı, burada sadece hangi taban
üzerinden hesaplandığı (10px vs 16px) düzeltiliyor.

Sonra:
1. npx tsc --noEmit ve npm run build hatasız geçmeli.
2. Yerel dev sunucuda ürün detay sayfasını (herhangi bir ürün) Playwright ile
   1600px'te aç, h1/fiyat/accordion başlığının computed font-size'ını
   getComputedStyle ile ölç - 21px / 14px / 16px olduğunu doğrula.
3. Görsel olarak 1600px ve 390px ekran görüntüsü al, yatay taşma olmadığını
   ve genel görünümün bozulmadığını kontrol et.

DEPLOY_STATUS.md'ye bu düzeltmeyi ve doğrulama sonuçlarını not düş.
Commit'i öner ama onayım olmadan push etme.
```

## Not — kalıcı kural (bundan sonraki Release ölçümleri için)

Release'in CSS'inden bundan sonra okunan HER rem değeri, Bollmark'a
yazılırken **× 10 yapılıp px olarak** yazılmalı (`1rem` Release'de = 10px).
`RELEASE_TEMA_BIREBIR_UYUM_PLANI.md`'deki daha önceki adımlarda da (Adım 1,
mega menü ölçümleri gibi) rem→px çevirisi doğru yapılmış mıydı ayrıca
gözden geçirilmeli - bu oturumda sadece ürün detay sayfası (Adım 3/6)
incelendi, header/katalog ölçümleri bu bulgudan etkilenmiş olabilir,
bir sonraki oturumda kontrol edilmeli.
